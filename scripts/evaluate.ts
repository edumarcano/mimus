import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

import { buildRewritePrompt, PROMPT_VERSION } from "../src/lib/prompts";
import { streamRewrite } from "../src/lib/server/openrouter";
import { MODEL_CONFIG } from "../src/lib/server/model-config";
import { effectiveIntensity } from "../src/lib/styles";
import { REQUEST_DEADLINE_MS } from "../src/lib/limits";
import { AppError } from "../src/lib/server/errors";
import {
  applyLimit,
  filterCasesByIds,
  filterCasesBySplit,
  parseDirtyTrackedFiles,
  parseEvalArgs,
  providerCallRefusal,
  requiresCleanTreeForHoldout,
  type EvalCase,
} from "./evaluate-cli";
import {
  consumeAdapterStream,
  runDeterministicChecks,
} from "./evaluate-stream";

const NO_LIVE_MESSAGE =
  "Evaluation skipped: pass --live to opt in to provider calls. No provider call was made.";

// Space sequential live requests ~4.2s apart to stay under typical provider RPM limits.
export const REQUEST_INTERVAL_MS = 4200;

const DEFAULT_EVAL_TRANSPORT = "openrouter-chat-completions";

export type EvalRunDeps = {
  streamRewrite?: typeof streamRewrite;
  now?: () => number;
  gitRevision?: () => string;
  gitPorcelain?: () => string;
  readTransport?: () => string;
  writeRaw?: (filePath: string, line: string) => void;
  sleep?: (ms: number) => Promise<void>;
};

function defaultGitRevision(): string {
  try {
    return execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function defaultGitPorcelain(): string {
  try {
    return execSync("git status --porcelain", { encoding: "utf8" });
  } catch {
    return "";
  }
}

function defaultTransport(): string {
  return DEFAULT_EVAL_TRANSPORT;
}

function loadCases(): EvalCase[] {
  const filePath = path.join(process.cwd(), "evals", "cases.jsonl");
  const text = readFileSync(filePath, "utf8");
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as EvalCase);
}

function effectiveModelSettings(): Record<string, unknown> {
  return { ...MODEL_CONFIG };
}

export async function runEvaluation(
  argv: string[],
  deps: EvalRunDeps = {},
): Promise<number> {
  const args = parseEvalArgs(argv);
  if (args.parseError) {
    console.error(args.parseError);
    return 1;
  }
  const refusal = providerCallRefusal(args);
  if (refusal === "no-live") {
    console.error(NO_LIVE_MESSAGE);
    return 1;
  }
  if (refusal === "holdout") {
    console.error(
      "Holdout evaluation requires --include-holdout. No provider call was made.",
    );
    return 1;
  }

  const porcelain = (deps.gitPorcelain ?? defaultGitPorcelain)();
  const dirtyFiles = parseDirtyTrackedFiles(porcelain);
  const dirty = dirtyFiles.length > 0;

  if (requiresCleanTreeForHoldout(args) && dirty) {
    console.error(
      "Release-candidate run requires a clean tree for prompts, styles, model-config, and openrouter adapter. Dirty:",
      dirtyFiles.join(", "),
    );
    return 1;
  }

  const adapter = deps.streamRewrite ?? streamRewrite;
  const now = deps.now ?? (() => Date.now());
  const sleep =
    deps.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const gitRevision = (deps.gitRevision ?? defaultGitRevision)();
  const transport = (deps.readTransport ?? defaultTransport)();

  const allCases = loadCases();
  const filtered = applyLimit(
    filterCasesByIds(filterCasesBySplit(allCases, args.split), args.ids),
    args.limit,
  );

  if (args.ids && args.ids.length > 0 && filtered.length === 0) {
    console.error(
      "No development cases matched --ids. No provider call was made.",
    );
    return 1;
  }

  const resultsDir = path.join(process.cwd(), "evals", "results", "raw");
  mkdirSync(resultsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outPath = path.join(resultsDir, `run-${stamp}.jsonl`);
  const append =
    deps.writeRaw ??
    ((filePath: string, line: string) => {
      writeFileSync(filePath, line, { flag: "a" });
    });

  for (const [index, evalCase] of filtered.entries()) {
    if (index > 0) {
      await sleep(REQUEST_INTERVAL_MS);
    }
    const started = now();
    const intensityEffective = effectiveIntensity(
      evalCase.targetStyle as Parameters<typeof effectiveIntensity>[0],
      evalCase.intensity as Parameters<typeof effectiveIntensity>[1],
    );
    const prompt = buildRewritePrompt({
      sourceStyle: evalCase.sourceStyle as Parameters<
        typeof buildRewritePrompt
      >[0]["sourceStyle"],
      targetStyle: evalCase.targetStyle as Parameters<
        typeof buildRewritePrompt
      >[0]["targetStyle"],
      intensity: evalCase.intensity as Parameters<
        typeof buildRewritePrompt
      >[0]["intensity"],
      text: evalCase.text,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_DEADLINE_MS);

    let streamResult: Awaited<ReturnType<typeof consumeAdapterStream>>;
    try {
      const iterable = adapter(prompt, controller.signal);
      streamResult = await consumeAdapterStream(iterable, controller.signal);
    } finally {
      clearTimeout(timer);
      try {
        controller.abort();
      } catch {
        // Upstream cleanup; do not fail the recorded case.
      }
    }

    if (streamResult.errorCode === "SERVICE_QUOTA_EXHAUSTED") {
      const record = buildRecord({
        evalCase,
        streamResult,
        intensityEffective,
        gitRevision,
        transport,
        dirty,
        dirtyFiles,
        started,
        now,
      });
      append(outPath, `${JSON.stringify(record)}\n`);
      console.error("Provider quota exhausted; stopping the run.");
      return 1;
    }

    const checks = runDeterministicChecks(
      streamResult.outputText,
      streamResult.normalizedCompletion,
      evalCase.preserveTokens,
    );

    const record = buildRecord({
      evalCase,
      streamResult,
      intensityEffective,
      gitRevision,
      transport,
      dirty,
      dirtyFiles,
      started,
      now,
      checks,
    });
    append(outPath, `${JSON.stringify(record)}\n`);
  }

  console.log(`Wrote ${filtered.length} record(s) to ${outPath}`);
  return 0;
}

function buildRecord(options: {
  evalCase: EvalCase;
  streamResult: Awaited<ReturnType<typeof consumeAdapterStream>>;
  intensityEffective: string;
  gitRevision: string;
  transport: string;
  dirty: boolean;
  dirtyFiles: string[];
  started: number;
  now: () => number;
  checks?: ReturnType<typeof runDeterministicChecks>;
}) {
  const {
    evalCase,
    streamResult,
    intensityEffective,
    gitRevision,
    transport,
    dirty,
    dirtyFiles,
    started,
    now,
    checks,
  } = options;

  const usage =
    streamResult.usage &&
    (streamResult.usage.inputTokens !== undefined ||
      streamResult.usage.outputTokens !== undefined)
      ? streamResult.usage
      : null;

  return {
    caseId: evalCase.id,
    outputText: streamResult.outputText,
    normalizedCompletion: streamResult.normalizedCompletion,
    errorCode: streamResult.errorCode ?? null,
    modelId: MODEL_CONFIG.model,
    effectiveSettings: effectiveModelSettings(),
    promptVersion: PROMPT_VERSION,
    transport,
    gitRevision,
    dirty,
    dirtyFiles,
    effectiveIntensity: intensityEffective,
    date: new Date().toISOString(),
    latencyMs: now() - started,
    usage,
    checks: checks ?? null,
  };
}

const executedDirectly =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("evaluate.ts") ||
    process.argv[1].endsWith("evaluate.js"));

if (executedDirectly) {
  runEvaluation(process.argv.slice(2))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      if (error instanceof AppError) {
        console.error(error.code);
      } else {
        console.error(error);
      }
      process.exitCode = 1;
    });
}

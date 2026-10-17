import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { loadExperiment, safeId } from "./benchmark/manifest";
import {
  estimateCost,
  generateExperiment,
  judgeExperiment,
  refreshCatalog,
  validateCatalog,
  referenceGenerations,
} from "./benchmark/runner";
import { evaluateOutput, estimateMaximumCost } from "./benchmark/evaluators";
import { buildReport } from "./benchmark/reports";
import {
  createReviewSet,
  renderReviewHtml,
  importReviews,
} from "./benchmark/review";
import { simulateCascade } from "./benchmark/cascade";
import {
  append,
  ledgerSpend,
  readJsonl,
  ROOT,
  runDirectory,
  writeOnce,
} from "./benchmark/store";
import { benchmarkPrompt } from "./benchmark/prompt";
import type {
  GenerationRecord,
  HumanReview,
  JudgmentRecord,
  LedgerEntry,
  ReviewSet,
} from "./benchmark/types";

const COMMANDS = [
  "preflight",
  "generate",
  "judge",
  "review-export",
  "review-import",
  "report",
  "cascade",
];
const VALUE_FLAGS = [
  "manifest",
  "run",
  "limit",
  "evaluator",
  "input",
  "review-set",
  "count",
  "seed",
  "decision-evaluator",
  "llm-evaluator",
  "split",
  "reuse-from",
];
const BOOL_FLAGS = ["live", "fixture", "include-holdout", "refresh-catalog"];
export function parseArgs(argv: string[]) {
  const [command, ...rest] = argv;
  if (!COMMANDS.includes(command))
    throw new Error(`Use: ${COMMANDS.join(" | ")}`);
  const values: Record<string, string> = {};
  const flags = new Set<string>();
  for (let i = 0; i < rest.length; i++) {
    if (!rest[i].startsWith("--"))
      throw new Error("Unexpected positional argument");
    const flag = rest[i].slice(2);
    if (flags.has(flag) || flag in values)
      throw new Error("Duplicate argument");
    if (BOOL_FLAGS.includes(flag)) flags.add(flag);
    else if (
      VALUE_FLAGS.includes(flag) &&
      rest[i + 1] &&
      !rest[i + 1].startsWith("--")
    )
      values[flag] = rest[++i];
    else throw new Error(`Invalid argument: --${flag}`);
  }
  const integer = (key: string, fallback?: number) => {
    const value = values[key];
    if (value === undefined) return fallback;
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))
      throw new Error(`Invalid --${key}`);
    return Number(value);
  };
  if (values.limit !== undefined && integer("limit")! < 1)
    throw new Error("Limit must be positive");
  if (
    values.count !== undefined &&
    (integer("count")! < 1 || integer("count")! > 25)
  )
    throw new Error("Review count must be 1..25");
  return { command, values, flags, integer };
}
export async function main(argv: string[]): Promise<void> {
  const { command, values, flags, integer } = parseArgs(argv);
  if (flags.has("refresh-catalog") && command !== "preflight")
    throw new Error("Catalog refresh belongs to preflight");
  if (values["reuse-from"] && command !== "generate")
    throw new Error("Observation reuse belongs to generate");
  const runId = safeId(values.run ?? "demo");
  const directory = runDirectory(runId);
  mkdirSync(ROOT, { recursive: true });
  const lockFile = path.join(ROOT, ".lock");
  let lock: number;
  try {
    lock = openSync(lockFile, "wx");
  } catch {
    throw new Error(
      "Another benchmark owns the lock. If it crashed, inspect its PID before removing evals/results/raw/benchmark/.lock.",
    );
  }
  try {
    writeFileSync(lock, JSON.stringify({ pid: process.pid, command, runId }));
    if (
      command === "preflight" ||
      command === "generate" ||
      command === "judge"
    ) {
      const experiment = loadExperiment(
        values.manifest ?? "evals/experiments/effort.json",
      );
      if (command === "preflight") {
        if (flags.has("refresh-catalog")) {
          await refreshCatalog();
          validateCatalog(experiment.manifest);
        }
        const generatorCount = experiment.manifest.configurations.filter(
          (c) => c.role === "generator",
        ).length;
        const estimates = experiment.manifest.configurations.map((config) => {
          const factor =
            experiment.manifest.repetitions *
            (config.role === "generator" ? 1 : Math.max(1, generatorCount));
          const upperEstimateUsd =
            experiment.cases.reduce(
              (sum, c) =>
                sum +
                (config.role === "generator"
                  ? estimateCost(
                      config,
                      benchmarkPrompt(c, experiment.manifest.promptVersion),
                    )
                  : estimateMaximumCost(
                      {
                        case: c,
                        outputText: c.outputText ?? "x".repeat(8000),
                      } as GenerationRecord,
                      config,
                    )),
              0,
            ) * factor;
          return {
            configuration: config.id,
            model: config.model,
            reasoning: config.reasoning,
            requests: experiment.cases.length * factor,
            upperEstimateUsd,
          };
        });
        console.log(
          JSON.stringify(
            {
              manifest: experiment.manifest.id,
              manifestHash: experiment.manifestHash,
              datasetHash: experiment.datasetHash,
              cases: experiment.cases.length,
              currentLedgerUsd: ledgerSpend(
                readJsonl<LedgerEntry>(path.join(ROOT, "ledger.jsonl")),
              ),
              targetUsd: experiment.manifest.targetUsd,
              maxUsd: experiment.manifest.maxUsd,
              estimates,
              note: "Conservative estimates, not measured costs. Paid runs need approval and --live; preflight sends no inference requests.",
            },
            null,
            2,
          ),
        );
        return;
      }
      const options = {
        runId,
        live: flags.has("live"),
        fixture: flags.has("fixture"),
        includeHoldout: flags.has("include-holdout"),
        limit: integer("limit"),
        reuseRunId: values["reuse-from"],
      };
      if (command === "generate")
        console.log(
          `Recorded ${(await generateExperiment(experiment, options)).length} generation attempts.`,
        );
      else {
        if (!values.evaluator) throw new Error("Judge requires --evaluator ID");
        console.log(
          `Recorded ${(await judgeExperiment(experiment, { ...options, evaluatorId: values.evaluator }, evaluateOutput)).length} judgments.`,
        );
      }
      return;
    }
    let generations = readJsonl<GenerationRecord>(
      path.join(directory, "generations.jsonl"),
    );
    if (!generations.length && command === "review-export" && values.manifest) {
      const experiment = loadExperiment(values.manifest);
      generations = referenceGenerations(experiment, runId);
    }
    if (!generations.length)
      throw new Error("No generation records for this run");
    const judgments = readJsonl<JudgmentRecord>(
      path.join(directory, "judgments.jsonl"),
    );
    const reviews = readJsonl<HumanReview>(path.join(directory, "human.jsonl"));
    if (command === "report" && values.input) {
      const other = runDirectory(values.input);
      generations.push(
        ...readJsonl<GenerationRecord>(path.join(other, "generations.jsonl")),
      );
      judgments.push(
        ...readJsonl<JudgmentRecord>(path.join(other, "judgments.jsonl")),
      );
      reviews.push(...readJsonl<HumanReview>(path.join(other, "human.jsonl")));
    }
    if (command === "report") {
      const report = buildReport(
        generations,
        judgments,
        reviews,
        values.evaluator,
      );
      mkdirSync(directory, { recursive: true });
      for (const [extension, content] of [
        ["md", report.markdown],
        ["csv", report.csv],
        ["html", report.html],
      ] as const)
        writeFileSync(path.join(directory, `report.${extension}`), content);
      writeFileSync(path.join(directory, "cases.csv"), report.casesCsv);
      writeFileSync(
        path.join(directory, "summary.json"),
        JSON.stringify(report.summary, null, 2),
      );
      console.log(`Reports: ${path.relative(process.cwd(), directory)}`);
    } else if (command === "review-export") {
      if (values.split)
        generations = generations.filter((g) => g.case.split === values.split);
      const id = safeId(values["review-set"] ?? "calibration");
      const set = createReviewSet(generations, {
        id,
        seed: integer("seed", 42)!,
        count: integer("count", 12)!,
      });
      if (!existsSync(path.join(directory, "generations.jsonl")))
        generations.forEach((g) =>
          append(path.join(directory, "generations.jsonl"), g),
        );
      writeOnce(path.join(directory, `review-${id}.json`), set);
      writeFileSync(
        path.join(directory, `review-${id}.html`),
        renderReviewHtml(set, generations),
        { flag: "wx" },
      );
      console.log(
        `Open ${path.join(directory, `review-${id}.html`)}; keep the mapping JSON private until scoring.`,
      );
    } else if (command === "review-import") {
      if (!values.input)
        throw new Error("Review import requires --input scoring.json");
      const id = safeId(values["review-set"] ?? "calibration");
      const set = JSON.parse(
        readFileSync(path.join(directory, `review-${id}.json`), "utf8"),
      ) as ReviewSet;
      const imported = importReviews(
        set,
        JSON.parse(readFileSync(values.input, "utf8")),
      );
      if (reviews.some((review) => review.reviewSetId === id))
        throw new Error(
          "Review set already imported; original scores are immutable",
        );
      const studyReviewCount = readdirSync(ROOT, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .reduce(
          (sum, entry) =>
            sum +
            readJsonl<HumanReview>(path.join(ROOT, entry.name, "human.jsonl"))
              .length,
          0,
        );
      if (studyReviewCount + imported.length > 25)
        throw new Error("Human review cap is 25 across the study");
      // Validate the whole batch before the first append.
      imported.forEach((review) =>
        append(path.join(directory, "human.jsonl"), review),
      );
      console.log(`Imported ${imported.length} original human scores.`);
    } else if (command === "cascade") {
      if (!values["decision-evaluator"] || !values["llm-evaluator"])
        throw new Error("Specify --decision-evaluator and --llm-evaluator");
      const report = simulateCascade(generations, judgments, {
        decisionEvaluatorId: values["decision-evaluator"],
        llmEvaluatorId: values["llm-evaluator"],
        seed: integer("seed", 42)!,
      });
      writeFileSync(
        path.join(directory, "cascade.json"),
        JSON.stringify(report, null, 2),
      );
      console.log(`Simulation only: ${path.join(directory, "cascade.json")}`);
    }
  } finally {
    closeSync(lock);
    unlinkSync(lockFile);
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : "Benchmark failed");
    process.exitCode = 1;
  });
}

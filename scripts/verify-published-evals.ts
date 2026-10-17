import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { MAX_INPUT_CODE_POINTS, countCodePoints } from "../src/lib/limits";
import { INTENSITIES, STYLE_IDS } from "../src/lib/styles";

// These are sanitized publication schemas, deliberately separate from internal run records.
type ObjectRecord = Record<string, unknown>;
type Score = 0 | 1 | 2;
type Generation = {
  id: string;
  caseId: string;
  configId: string;
  normalizedCompletion: string;
  errorCode: string | null;
  firstContentMs: number | null;
  durationMs: number | null;
  costUsd: number | null;
  transport: string;
};
type Judgment = {
  generationId: string;
  evaluatorId: string;
  status: string;
  meaning: Score | null;
  style: Score | null;
  tags: string[];
  durationMs: number | null;
  costUsd: number | null;
};
type Human = {
  generationId: string;
  reviewSetId: string;
  blindId: string;
  meaning: Score;
  style: Score;
  tags: string[];
  note: string;
};
export type PublishedInputs = {
  dataset: unknown[];
  manifest: unknown;
  observations: unknown[];
  summary: unknown;
};

export const publishedPaths = {
  dataset: "evals/datasets/release-v1.jsonl",
  manifest: "evals/experiments/release-finalists-v1.json",
  observations: "evals/results/release-run-2026-10-15.jsonl",
  summary: "evals/results/release-run-2026-10-15.json",
} as const;

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
function object(value: unknown, label: string): ObjectRecord {
  check(
    value !== null && typeof value === "object" && !Array.isArray(value),
    `${label}: expected object`,
  );
  return value as ObjectRecord;
}
function array(value: unknown, label: string): unknown[] {
  check(Array.isArray(value), `${label}: expected array`);
  return value;
}
function string(value: unknown, label: string): string {
  check(
    typeof value === "string" && value.length > 0,
    `${label}: expected nonempty string`,
  );
  return value;
}
function nullableString(value: unknown, label: string): string | null {
  return value === null ? null : string(value, label);
}
function number(value: unknown, label: string): number {
  check(
    typeof value === "number" && Number.isFinite(value) && value >= 0,
    `${label}: expected finite nonnegative number`,
  );
  return value;
}
function nullableNumber(value: unknown, label: string): number | null {
  return value === null ? null : number(value, label);
}
function score(value: unknown, label: string): Score {
  check(
    value === 0 || value === 1 || value === 2,
    `${label}: expected score 0, 1 or 2`,
  );
  return value;
}
function strings(value: unknown, label: string): string[] {
  return array(value, label).map((v) => string(v, label));
}
function annotations(
  value: unknown,
  label: string,
  required: boolean,
): string[] {
  const result = strings(value, label);
  check(
    (!required || result.length > 0) &&
      result.every((entry) => entry.trim().length > 0),
    `${label}: expected ${required ? "nonempty " : ""}non-whitespace string entries`,
  );
  return result;
}
function unique<T>(
  items: T[],
  key: (item: T) => string,
  label: string,
): Map<string, T> {
  const result = new Map<string, T>();
  for (const item of items) {
    const id = key(item);
    check(!result.has(id), `Duplicate ${label}: ${id}`);
    result.set(id, item);
  }
  return result;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
function equal(actual: unknown, expected: unknown, label: string): void {
  if (typeof actual === "number" && typeof expected === "number") {
    check(
      Number.isInteger(actual) && Number.isInteger(expected)
        ? actual === expected
        : Math.abs(actual - expected) <=
            Math.max(1e-12, Math.abs(actual) * 1e-10),
      `${label}: expected ${expected}, recomputed ${actual}`,
    );
  } else
    check(
      canonical(actual) === canonical(expected),
      `${label}: published value differs from recomputed evidence`,
    );
}
function compareFields(
  actual: ObjectRecord,
  expected: ObjectRecord,
  label: string,
): void {
  for (const [key, value] of Object.entries(actual))
    equal(value, expected[key], `${label}.${key}`);
}
function percentile(values: (number | null)[], p: number): number | null {
  const sorted = values
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  return sorted.length ? sorted[Math.ceil(p * sorted.length) - 1] : null;
}
function sum(values: (number | null)[]): number | null {
  return values.length && values.every((v) => v !== null)
    ? values.reduce<number>((a, b) => a + (b ?? 0), 0)
    : null;
}
export function parseJsonLines(text: string, label: string): unknown[] {
  return text.split(/\r?\n/).flatMap((line, index) => {
    if (!line.trim()) return [];
    try {
      return [JSON.parse(line) as unknown];
    } catch {
      throw new Error(`${label}:${index + 1}: invalid JSON`);
    }
  });
}
export function loadPublishedInputs(root = process.cwd()): PublishedInputs {
  const read = (path: string) => readFileSync(resolve(root, path), "utf8");
  return {
    dataset: parseJsonLines(
      read(publishedPaths.dataset),
      publishedPaths.dataset,
    ),
    manifest: JSON.parse(read(publishedPaths.manifest)) as unknown,
    observations: parseJsonLines(
      read(publishedPaths.observations),
      publishedPaths.observations,
    ),
    summary: JSON.parse(read(publishedPaths.summary)) as unknown,
  };
}

export function verifyPublishedInputs(inputs: PublishedInputs) {
  const manifest = object(inputs.manifest, "manifest");
  const summary = object(inputs.summary, "summary");
  check(
    manifest.id === "release-finalists-v1" &&
      manifest.stage === "release" &&
      manifest.schemaVersion === 1 &&
      manifest.repetitions === 1 &&
      manifest.dataset === publishedPaths.dataset,
    "Unsupported release manifest",
  );
  const runId = string(manifest.id, "manifest.id");
  const promptVersion = string(
    manifest.promptVersion,
    "manifest.promptVersion",
  );
  equal(summary.runId, runId, "summary.runId");
  equal(summary.manifest, manifest, "summary.manifest");
  const configs = array(manifest.configurations, "configurations").map((c) =>
    object(c, "configuration"),
  );
  const configById = unique(
    configs,
    (c) => string(c.id, "configuration.id"),
    "configuration",
  );
  const generators = configs.filter((c) => c.role === "generator");
  const judges = configs.filter((c) => c.role === "llm");
  check(
    generators.length === 2 && judges.length === 1 && configs.length === 3,
    "Expected two generators and one LLM judge",
  );
  const judgeId = string(judges[0].id, "judge.id");
  const cases = inputs.dataset.map((value) => {
    const c = object(value, "case");
    check(
      c.split === "release" && typeof c.critical === "boolean",
      "Invalid release case",
    );
    const text = string(c.text, "case.text");
    check(
      text.trim().length > 0,
      "case.text: must contain non-whitespace text",
    );
    check(
      countCodePoints(text) <= MAX_INPUT_CODE_POINTS,
      `case.text: exceeds ${MAX_INPUT_CODE_POINTS} code points`,
    );
    const sourceStyle = string(c.sourceStyle, "case.sourceStyle");
    const targetStyle = string(c.targetStyle, "case.targetStyle");
    check(
      STYLE_IDS.some((style) => style === sourceStyle),
      "Invalid case.sourceStyle",
    );
    check(
      STYLE_IDS.some((style) => style === targetStyle),
      "Invalid case.targetStyle",
    );
    check(sourceStyle !== targetStyle, "Case styles must be distinct");
    const intensity = string(c.intensity, "case.intensity");
    check(
      INTENSITIES.some((level) => level === intensity),
      "Invalid case.intensity",
    );
    annotations(c.mustPreserve, "case.mustPreserve", true);
    annotations(c.mustNotInvent, "case.mustNotInvent", true);
    if (c.preserveTokens !== undefined)
      annotations(c.preserveTokens, "case.preserveTokens", false);
    if (c.themes !== undefined) annotations(c.themes, "case.themes", false);
    return c;
  });
  const caseById = unique(cases, (c) => string(c.id, "case.id"), "case");
  const selectedIds = strings(manifest.caseIds, "manifest.caseIds");
  unique(selectedIds, (id) => id, "selected case");
  check(
    cases.length === 40 &&
      selectedIds.length === 40 &&
      selectedIds.every((id) => caseById.has(id)),
    "Release requires all 40 cases",
  );
  check(
    cases.filter((c) => c.critical).length === 10 &&
      new Set(cases.map((c) => `${c.sourceStyle}->${c.targetStyle}`)).size ===
        20,
    "Release critical/direction coverage differs",
  );
  const generations: Generation[] = [];
  const judgments: Judgment[] = [];
  const humans: Human[] = [];
  for (const value of inputs.observations) {
    const r = object(value, "observation");
    if (r.kind === "generation") {
      const configId = string(r.configId, "generation.configId");
      check(
        configById.get(configId)?.role === "generator",
        "Unknown generator",
      );
      equal(r.config, configById.get(configId), "generation.config");
      check(
        r.runId === runId &&
          r.promptVersion === promptVersion &&
          r.repetition === 0,
        "Generation run/prompt/repetition mismatch",
      );
      const caseId = string(r.caseId, "generation.caseId");
      check(caseById.has(caseId), "Unknown generation case");
      string(r.outputText, "generation.outputText");
      const completion = string(
        r.normalizedCompletion,
        "generation.normalizedCompletion",
      );
      check(
        ["complete", "incomplete", "error"].includes(completion),
        "Unknown completion state",
      );
      generations.push({
        id: string(r.id, "generation.id"),
        caseId,
        configId,
        normalizedCompletion: completion,
        errorCode: nullableString(r.errorCode, "generation.errorCode"),
        firstContentMs: nullableNumber(
          r.firstContentMs,
          "generation.firstContentMs",
        ),
        durationMs: nullableNumber(r.durationMs, "generation.durationMs"),
        costUsd: nullableNumber(r.costUsd, "generation.costUsd"),
        transport: string(r.transport, "generation.transport"),
      });
    } else if (r.kind === "automated") {
      check(
        r.runId === runId &&
          r.evaluatorId === judgeId &&
          r.rubricVersion === "1" &&
          r.evaluationSource === "openrouter",
        "Automated evaluator/run mismatch",
      );
      check(
        r.status === "complete" || r.status === "unresolved",
        "Invalid judgment status",
      );
      nullableString(r.errorCode, "automated.errorCode");
      if (r.status === "complete") {
        score(r.meaning, "automated.meaning");
        score(r.style, "automated.style");
        check(r.errorCode === null, "Complete judgment has error");
      } else
        check(
          r.meaning === null && r.style === null,
          "Unresolved judgment must have null scores",
        );
      judgments.push({
        generationId: string(r.generationId, "automated.generationId"),
        evaluatorId: judgeId,
        status: r.status,
        meaning:
          r.meaning === null ? null : score(r.meaning, "automated.meaning"),
        style: r.style === null ? null : score(r.style, "automated.style"),
        tags: strings(r.tags, "automated.tags"),
        durationMs: nullableNumber(r.durationMs, "automated.durationMs"),
        costUsd: nullableNumber(r.costUsd, "automated.costUsd"),
      });
    } else if (r.kind === "human") {
      check(
        r.schemaVersion === 1 && typeof r.note === "string",
        "Invalid human record",
      );
      humans.push({
        generationId: string(r.generationId, "human.generationId"),
        reviewSetId: string(r.reviewSetId, "human.reviewSetId"),
        blindId: string(r.blindId, "human.blindId"),
        meaning: score(r.meaning, "human.meaning"),
        style: score(r.style, "human.style"),
        tags: strings(r.tags, "human.tags"),
        note: r.note,
      });
    } else throw new Error("Unknown observation kind");
  }
  const generationById = unique(generations, (r) => r.id, "generation id");
  unique(
    generations,
    (r) => `${r.configId}:${r.caseId}`,
    "generation observation",
  );
  const judgmentByGeneration = unique(
    judgments,
    (r) => r.generationId,
    "automated judgment",
  );
  unique(humans, (r) => r.generationId, "human generation");
  unique(humans, (r) => r.blindId, "human blind id");
  check(
    judgments.every((r) => generationById.has(r.generationId)) &&
      humans.every((r) => generationById.has(r.generationId)),
    "Broken generation join",
  );
  check(
    generations.length === 80 &&
      judgments.length === generations.length &&
      generations.every((g) => judgmentByGeneration.has(g.id)),
    "Missing generation or judgment coverage",
  );
  const complete = (g: Generation) =>
    g.normalizedCompletion === "complete" && g.errorCode === null;
  const resolved = (j: Judgment) =>
    j.status === "complete" && j.meaning !== null && j.style !== null;
  const coverage = {
    generationAttempts: generations.length,
    completeGenerations: generations.filter(complete).length,
    judgments: judgments.length,
    resolvedJudgments: judgments.filter(resolved).length,
    unresolvedJudgments: judgments.filter((j) => !resolved(j)).length,
  };
  compareFields(
    coverage,
    object(summary.coverage, "summary.coverage"),
    "coverage",
  );
  const reportedCosts = [...generations, ...judgments].map((r) => r.costUsd);
  const phaseReportedCosts = {
    phaseRequests: reportedCosts.length,
    phaseKnownUsd: reportedCosts.reduce<number>(
      (total, cost) => total + (cost ?? 0),
      0,
    ),
    phaseUnknownSettlements: reportedCosts.filter((cost) => cost === null)
      .length,
  };
  compareFields(
    phaseReportedCosts,
    object(summary.costs, "summary.costs"),
    "costs",
  );
  const publishedConfigurations = array(
    summary.configurations,
    "summary.configurations",
  ).map((c) => object(c, "summary.configuration"));
  const publishedByConfig = unique(
    publishedConfigurations,
    (c) => string(c.configId, "summary.configId"),
    "summary configuration",
  );
  check(
    publishedByConfig.size === generators.length,
    "Summary configuration coverage differs",
  );
  const configurations = generators.map((config) => {
    const g = generations.filter((r) => r.configId === config.id);
    check(
      g.length === 40 &&
        selectedIds.every((id) => g.some((r) => r.caseId === id)),
      "Missing configuration case coverage",
    );
    const j = g.map((r) => judgmentByGeneration.get(r.id)!);
    const critical = g
      .filter((r) => caseById.get(r.caseId)!.critical)
      .map((r) => judgmentByGeneration.get(r.id)!);
    const scoreable = g
      .filter(complete)
      .map((r) => judgmentByGeneration.get(r.id)!)
      .filter(resolved);
    const meaning2 = scoreable.filter((r) => r.meaning === 2).length;
    const style2 = scoreable.filter((r) => r.style === 2).length;
    const criticalMeaning0 = critical.filter(
      (r) => resolved(r) && r.meaning === 0,
    ).length;
    const criticalUnresolved = critical.filter((r) => !resolved(r)).length;
    const criteria = {
      meaning2AtLeast36: meaning2 >= 36,
      style2AtLeast32: style2 >= 32,
      zeroCriticalMeaning0: criticalMeaning0 === 0,
      zeroCriticalUnresolved: criticalUnresolved === 0,
    };
    const actual = {
      configId: config.id,
      model: config.model,
      reasoning: config.reasoning,
      generated: g.length,
      uniqueCases: new Set(g.map((r) => r.caseId)).size,
      completeGenerations: g.filter(complete).length,
      errors: g.filter(
        (r) => r.errorCode !== null || r.normalizedCompletion === "error",
      ).length,
      incomplete: g.filter((r) => !complete(r)).length,
      argonResolved: j.filter(resolved).length,
      argonUnresolved: j.filter((r) => !resolved(r)).length,
      meaning2,
      style2,
      criticalCases: critical.length,
      criticalMeaning0,
      criticalUnresolved,
      generationCostUsd: sum(g.map((r) => r.costUsd)),
      argonCostUsd: sum(j.map((r) => r.costUsd)),
      firstContentCoverage: `${g.filter((r) => r.firstContentMs !== null).length}/${g.length}`,
      totalDurationCoverage: `${g.filter((r) => r.durationMs !== null).length}/${g.length}`,
      p50FirstContentMs: percentile(
        g.map((r) => r.firstContentMs),
        0.5,
      ),
      p95FirstContentMs: percentile(
        g.map((r) => r.firstContentMs),
        0.95,
      ),
      p50DurationMs: percentile(
        g.map((r) => r.durationMs),
        0.5,
      ),
      p95DurationMs: percentile(
        g.map((r) => r.durationMs),
        0.95,
      ),
      argonResolvedResponseLatencyCoverage: `${j.filter((r) => resolved(r) && r.durationMs !== null).length}/${g.length}`,
      p50ArgonResolvedResponseMs: percentile(
        j.filter(resolved).map((r) => r.durationMs),
        0.5,
      ),
      p95ArgonResolvedResponseMs: percentile(
        j.filter(resolved).map((r) => r.durationMs),
        0.95,
      ),
      numericCriteria: {
        ...criteria,
        passed: Object.values(criteria).every(Boolean),
      },
      meaningCounts: {
        zero: scoreable.filter((r) => r.meaning === 0).length,
        one: scoreable.filter((r) => r.meaning === 1).length,
        two: meaning2,
        unresolved: j.filter((r) => !resolved(r)).length,
      },
    };
    const published = publishedByConfig.get(string(config.id, "config.id"));
    check(published, "Missing published configuration");
    compareFields(actual, published, `configuration.${config.id}`);
    compareFields(
      {
        full40GenerationCoverage: true,
        allGenerationsComplete: g.every(complete),
        all40ArgonJudgmentsResolved: j.every(resolved),
        freshOpenRouterTransport: g.every((r) => r.transport === "openrouter"),
      },
      object(published.evidenceCompleteness, "evidenceCompleteness"),
      `configuration.${config.id}.evidenceCompleteness`,
    );
    return actual;
  });
  const recommendation = object(summary.recommendation, "recommendation");
  const recommendedConfig = configById.get(
    string(recommendation.configId, "recommendation.configId"),
  );
  check(
    recommendedConfig?.role === "generator",
    "Unknown recommended generator",
  );
  compareFields(
    {
      model: recommendedConfig.model,
      reasoning: recommendedConfig.reasoning,
      maxOutputTokens: recommendedConfig.maxOutputTokens,
      promptVersion,
    },
    recommendation,
    "recommendation",
  );
  check(
    configurations.find((config) => config.configId === recommendedConfig.id)
      ?.numericCriteria.passed === true,
    "Recommended generator does not meet recomputed numerical targets",
  );
  const audit = object(summary.humanAudit, "humanAudit");
  const auditSummary = object(audit.summary, "humanAudit.summary");
  const auditRecords = array(auditSummary.records, "audit records").map((r) =>
    object(r, "audit record"),
  );
  const auditByGeneration = unique(
    auditRecords,
    (r) => string(r.generationId, "audit generationId"),
    "audit generation",
  );
  check(auditRecords.length === humans.length, "Human audit coverage differs");
  compareFields(
    { required: 8, prepared: auditRecords.length },
    audit,
    "humanAudit",
  );
  let meaningAgreement = 0;
  let styleAgreement = 0;
  const modelCoverage: Record<string, number> = {};
  const strata = new Map<
    string,
    {
      stratum: string;
      count: number;
      meaningAgreement: number;
      styleAgreement: number;
    }
  >();
  for (const human of humans) {
    const record = auditByGeneration.get(human.generationId);
    check(record, "Missing human audit record");
    const generation = generationById.get(human.generationId)!;
    const judgment = judgmentByGeneration.get(human.generationId)!;
    equal(human.reviewSetId, auditSummary.reviewSetId, "human.reviewSetId");
    compareFields(
      {
        blindId: human.blindId,
        caseId: generation.caseId,
        configId: generation.configId,
        critical: caseById.get(generation.caseId)!.critical,
        human: {
          meaning: human.meaning,
          style: human.style,
          tags: human.tags,
          note: human.note,
        },
        automated: {
          evaluatorId: judgment.evaluatorId,
          status: judgment.status,
          meaning: judgment.meaning,
          style: judgment.style,
          tags: judgment.tags,
        },
      },
      record,
      "human audit record",
    );
    const ma = resolved(judgment) && human.meaning === judgment.meaning;
    const sa = resolved(judgment) && human.style === judgment.style;
    compareFields(
      { meaningAgreement: ma, styleAgreement: sa },
      record,
      "human agreement",
    );
    meaningAgreement += Number(ma);
    styleAgreement += Number(sa);
    modelCoverage[generation.configId] =
      (modelCoverage[generation.configId] ?? 0) + 1;
    const stratum = string(record.stratum, "human stratum");
    check(
      ["confident_pass", "suspected", "fallback_pass"].includes(stratum),
      "Unknown audit stratum",
    );
    const bucket = strata.get(stratum) ?? {
      stratum,
      count: 0,
      meaningAgreement: 0,
      styleAgreement: 0,
    };
    bucket.count++;
    bucket.meaningAgreement += Number(ma);
    bucket.styleAgreement += Number(sa);
    strata.set(stratum, bucket);
  }
  const humanAudit = {
    reviewed: humans.length,
    meaningAgreement,
    styleAgreement,
    humanMeaning0: humans.filter((r) => r.meaning === 0).length,
    humanMeaning1: humans.filter((r) => r.meaning === 1).length,
    humanMeaning2: humans.filter((r) => r.meaning === 2).length,
    humanStyle2: humans.filter((r) => r.style === 2).length,
    modelCoverage,
  };
  compareFields(humanAudit, auditSummary, "humanAudit.summary");
  if (humanAudit.humanMeaning0 === 0)
    equal(
      auditSummary.seriousFailureSensitivity,
      null,
      "seriousFailureSensitivity",
    );
  compareFields(
    {
      completed: humans.length,
      confidentPasses: strata.get("confident_pass")?.count ?? 0,
      suspected: strata.get("suspected")?.count ?? 0,
      fallbackPasses: strata.get("fallback_pass")?.count ?? 0,
    },
    audit,
    "humanAudit",
  );
  equal(
    [...strata.values()].sort((a, b) => a.stratum.localeCompare(b.stratum)),
    array(auditSummary.strata, "audit strata")
      .map((r) => object(r, "stratum"))
      .sort((a, b) => String(a.stratum).localeCompare(String(b.stratum))),
    "humanAudit.strata",
  );
  return {
    verified: true,
    runId,
    coverage,
    phaseReportedCosts,
    configurations,
    humanAudit,
    limitations: [
      "Checks sanitized committed evidence only; no provider calls or environment files.",
      "Private billing ledgers, raw-file digests, source provenance, reuse and official release eligibility are not independently reconstructed.",
      "Human labels remain separate from automated scores; agreement is limited to the published audit sample.",
    ],
  };
}

export function main(args = process.argv.slice(2)): void {
  check(
    args.length === 0 || (args.length === 1 && args[0] === "--json"),
    "Usage: npm run eval:verify -- [--json]",
  );
  const result = verifyPublishedInputs(loadPublishedInputs());
  if (args.includes("--json")) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(
      `Verified ${result.runId}: ${result.coverage.generationAttempts} generations, ${result.coverage.resolvedJudgments}/${result.coverage.judgments} resolved automated judgments, ${result.humanAudit.reviewed} human reviews.`,
    );
    for (const config of result.configurations)
      console.log(
        `${config.configId}: meaning 2 ${config.meaning2}/40; style 2 ${config.style2}/40; generation cost ${config.generationCostUsd ?? "unknown"}; judge cost ${config.argonCostUsd ?? "unknown"}.`,
      );
    for (const limitation of result.limitations) console.log(limitation);
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    main();
  } catch (error) {
    console.error(
      `Published evaluation verification failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

import { createHash } from "node:crypto";
import type { GenerationRecord, HumanReview, JudgmentRecord } from "./types";

export type EvaluatorValidationSummary = {
  scorer: "evaluator" | "human";
  scorerId: string;
  split: string;
  expectedExamples: number;
  resolved: number;
  unresolved: number;
  meaningAgreement: number;
  meaningDenominator: number;
  meaningUnresolved: number;
  styleAgreement: number;
  styleDenominator: number;
  styleUnresolved: number;
  seriousFalseAccepts: number;
  seriousDenominator: number;
  faithfulFalseRejects: number;
  faithfulDenominator: number;
};

export type GroupSummary = {
  configId: string;
  configHash: string;
  promptVersion: string;
  split: string;
  repetition: number;
  generated: number;
  uniqueCases: number;
  errors: number;
  incomplete: number;
  unresolved: number;
  meaning2: number;
  style2: number;
  criticalMeaning0: number;
  criticalUnresolved: number;
  eligibleReleaseEvidence: boolean;
  p50FirstContentMs: number | null;
  p95FirstContentMs: number | null;
  p50DurationMs: number | null;
  p95DurationMs: number | null;
  generationCostUsd: number | null;
  judgingCostUsd: number | null;
  humanReviews: number;
  fixtureRecords: number;
};

export type BenchmarkSummary = { groups: GroupSummary[]; evaluatorValidation: EvaluatorValidationSummary[] };

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([name, item]) => `${JSON.stringify(name)}:${canonical(item)}`).join(",")}}`;
  return JSON.stringify(value);
}

function configHash(record: GenerationRecord): string {
  return createHash("sha256").update(canonical(record.config)).digest("hex");
}

function key(record: GenerationRecord) {
  return JSON.stringify([record.configId, configHash(record), record.promptVersion, record.case.split, record.repetition]);
}

function checkedUnique<T>(items: T[], id: (item: T) => string, label: string): Map<string, T> {
  const result = new Map<string, T>();
  for (const item of items) {
    const itemId = id(item);
    const previous = result.get(itemId);
    if (previous && JSON.stringify(previous) !== JSON.stringify(item)) {
      throw new Error(`Conflicting ${label} records for ${itemId}`);
    }
    result.set(itemId, item);
  }
  return result;
}

function percentile(values: number[], percentileValue: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(percentileValue * sorted.length) - 1] ?? sorted[sorted.length - 1];
}

function sumKnown(values: Array<number | null | undefined>): number | null {
  if (!values.length || values.some((value) => value == null || !Number.isFinite(value))) return null;
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function summarize(
  generations: GenerationRecord[],
  judgments: JudgmentRecord[],
  humanReviews: HumanReview[],
  evaluatorId?: string,
): BenchmarkSummary {
  const uniqueGenerations = checkedUnique(generations, (record) => record.id, "generation");
  const observationKeys = new Map<string, GenerationRecord>();
  for (const record of uniqueGenerations.values()) {
    const observationKey = JSON.stringify([record.configId, configHash(record), record.promptVersion, record.case.split, record.caseId, record.repetition]);
    const previous = observationKeys.get(observationKey);
    if (previous && previous.id !== record.id) throw new Error(`Conflicting generation observations for ${observationKey}`);
    observationKeys.set(observationKey, record);
  }
  const uniqueJudgments = checkedUnique(judgments, (record) => record.id, "judgment");
  const uniqueReviews = checkedUnique(humanReviews, (record) => `${record.reviewSetId}:${record.generationId}`, "human review");
  const judgmentByGeneration = new Map<string, JudgmentRecord>();
  for (const judgment of uniqueJudgments.values()) {
    if (evaluatorId && judgment.evaluatorId !== evaluatorId) continue;
    if (!evaluatorId && new Set([...uniqueJudgments.values()].map((item) => item.evaluatorId)).size > 1) continue;
    const previous = judgmentByGeneration.get(judgment.generationId);
    if (previous && JSON.stringify(previous) !== JSON.stringify(judgment)) {
      throw new Error(`Conflicting evaluator judgments for generation ${judgment.generationId}`);
    }
    judgmentByGeneration.set(judgment.generationId, judgment);
  }
  const reviewsByGeneration = new Map<string, HumanReview[]>();
  for (const review of uniqueReviews.values()) reviewsByGeneration.set(review.generationId, [...(reviewsByGeneration.get(review.generationId) ?? []), review]);

  const buckets = new Map<string, { generations: GenerationRecord[]; judgments: JudgmentRecord[]; reviews: HumanReview[] }>();
  for (const generation of uniqueGenerations.values()) {
    const bucketKey = key(generation);
    const bucket = buckets.get(bucketKey) ?? { generations: [], judgments: [], reviews: [] };
    bucket.generations.push(generation);
    const judgment = judgmentByGeneration.get(generation.id);
    if (judgment) bucket.judgments.push(judgment);
    bucket.reviews.push(...(reviewsByGeneration.get(generation.id) ?? []));
    buckets.set(bucketKey, bucket);
  }

  const groups: GroupSummary[] = [];
  for (const bucket of buckets.values()) {
    const first = bucket.generations[0];
    // Repetition zero is the primary release denominator; later rows show supplemental repeats.
    const primary = bucket.generations;
    const fixtureRecords = primary.filter((record) => (record as GenerationRecord & { transport?: string }).transport === "fixture");
    const primaryIds = new Set(primary.map((record) => record.id));
    const primaryJudgments = bucket.judgments.filter((record) => primaryIds.has(record.generationId));
    const unresolvedJudgments = primaryJudgments.filter((record) => record.status !== "complete" || record.meaning == null || record.style == null);
    const completeGenerations = new Set(primary.filter((record) => record.normalizedCompletion === "complete" && !record.errorCode).map((record) => record.id));
    const scoreable = primaryJudgments.filter((record) => completeGenerations.has(record.generationId) && record.status === "complete");
    const critical = primary.filter((record) => record.case.critical);
    const criticalJudgments = critical.map((record) => judgmentByGeneration.get(record.id));
    const release = first.case.split === "release";
    const uniqueReleaseCases = new Set(primary.map((record) => record.caseId)).size;
    const directions = new Set(primary.map((record) => `${record.case.sourceStyle}->${record.case.targetStyle}`));
    groups.push({
      configId: first.configId,
      configHash: configHash(first),
      promptVersion: first.promptVersion,
      split: first.case.split,
      repetition: first.repetition,
      generated: primary.length,
      uniqueCases: new Set(primary.map((record) => record.caseId)).size,
      errors: primary.filter((record) => record.errorCode != null || record.normalizedCompletion === "error").length,
      incomplete: primary.filter((record) => record.normalizedCompletion !== "complete" || Boolean(record.errorCode)).length,
      unresolved: unresolvedJudgments.length + primary.filter((record) => !judgmentByGeneration.has(record.id)).length,
      meaning2: scoreable.filter((record) => record.meaning === 2).length,
      style2: scoreable.filter((record) => record.style === 2).length,
      criticalMeaning0: criticalJudgments.filter((record) => record?.status === "complete" && record.meaning === 0).length,
      criticalUnresolved: criticalJudgments.filter((record) => !record || record.status !== "complete" || record.meaning == null).length,
      eligibleReleaseEvidence: release && first.repetition === 0 && fixtureRecords.length === 0 && uniqueReleaseCases === 40 && directions.size === 20 && critical.length === 10 &&
        scoreable.filter((record) => record.meaning === 2).length >= 36 &&
        scoreable.filter((record) => record.style === 2).length >= 32 &&
        criticalJudgments.every((record) => record?.status === "complete" && record.meaning !== 0 && record.meaning != null),
      p50FirstContentMs: percentile(primary.map((record) => record.firstContentMs).filter((value): value is number => value != null), 0.5),
      p95FirstContentMs: percentile(primary.map((record) => record.firstContentMs).filter((value): value is number => value != null), 0.95),
      p50DurationMs: percentile(primary.map((record) => record.durationMs), 0.5),
      p95DurationMs: percentile(primary.map((record) => record.durationMs), 0.95),
      generationCostUsd: sumKnown(primary.map((record) => record.costUsd)),
      judgingCostUsd: sumKnown(primaryJudgments.map((record) => record.costUsd)),
      humanReviews: bucket.reviews.filter((record) => primaryIds.has(record.generationId)).length,
      fixtureRecords: fixtureRecords.length,
    });
  }
  groups.sort((a, b) => a.configId.localeCompare(b.configId) || a.promptVersion.localeCompare(b.promptVersion) || a.split.localeCompare(b.split) || a.repetition - b.repetition);
  const validationByKey = new Map<string, EvaluatorValidationSummary>();
  const getValidation = (scorer: "evaluator" | "human", scorerId: string, split: string) => {
    const validationKey = JSON.stringify([scorer, scorerId, split]);
    const current = validationByKey.get(validationKey) ?? { scorer, scorerId, split, expectedExamples: 0, resolved: 0, unresolved: 0, meaningAgreement: 0, meaningDenominator: 0, meaningUnresolved: 0, styleAgreement: 0, styleDenominator: 0, styleUnresolved: 0, seriousFalseAccepts: 0, seriousDenominator: 0, faithfulFalseRejects: 0, faithfulDenominator: 0 };
    validationByKey.set(validationKey, current);
    return current;
  };
  const generationById = uniqueGenerations;
  const evaluatorScores = new Map<string, JudgmentRecord>();
  for (const judgment of uniqueJudgments.values()) {
    const generation = generationById.get(judgment.generationId);
    if (!generation || generation.case.labelSource !== "constructed" || (generation.case.expectedMeaning == null && generation.case.expectedStyle == null)) continue;
    const scoreKey = `${judgment.evaluatorId}:${judgment.generationId}`;
    const prior = evaluatorScores.get(scoreKey);
    if (prior && JSON.stringify(prior) !== JSON.stringify(judgment)) throw new Error(`Conflicting evaluator judgments for ${scoreKey}`);
    evaluatorScores.set(scoreKey, judgment);
  }
  for (const judgment of evaluatorScores.values()) {
    const generation = generationById.get(judgment.generationId)!;
    const summary = getValidation("evaluator", judgment.evaluatorId, generation.case.split);
    summary.expectedExamples += 1;
    const meaningResolved = judgment.status === "complete" && (generation.case.expectedMeaning == null || judgment.meaning != null);
    const styleResolved = judgment.status === "complete" && (generation.case.expectedStyle == null || judgment.style != null);
    if (meaningResolved && styleResolved) summary.resolved += 1;
    else summary.unresolved += 1;
    if (generation.case.expectedMeaning != null) {
      if (!meaningResolved || judgment.meaning == null) summary.meaningUnresolved += 1;
      else {
        summary.meaningDenominator += 1;
        if (judgment.meaning === generation.case.expectedMeaning) summary.meaningAgreement += 1;
        if (generation.case.expectedMeaning === 0) {
          summary.seriousDenominator += 1;
          if (judgment.meaning === 2) summary.seriousFalseAccepts += 1;
        }
        if (generation.case.expectedMeaning === 2) {
          summary.faithfulDenominator += 1;
          if (judgment.meaning < 2) summary.faithfulFalseRejects += 1;
        }
      }
    }
    if (generation.case.expectedStyle != null) {
      if (!styleResolved || judgment.style == null) summary.styleUnresolved += 1;
      else {
        summary.styleDenominator += 1;
        if (judgment.style === generation.case.expectedStyle) summary.styleAgreement += 1;
      }
    }
  }
  for (const review of uniqueReviews.values()) {
    const generation = generationById.get(review.generationId);
    if (!generation || generation.case.labelSource !== "constructed" || (generation.case.expectedMeaning == null && generation.case.expectedStyle == null)) continue;
    const summary = getValidation("human", review.reviewSetId, generation.case.split);
    summary.expectedExamples += 1;
    summary.resolved += 1;
    if (generation.case.expectedMeaning != null) {
      summary.meaningDenominator += 1;
      if (review.meaning === generation.case.expectedMeaning) summary.meaningAgreement += 1;
      if (generation.case.expectedMeaning === 0) {
        summary.seriousDenominator += 1;
        if (review.meaning === 2) summary.seriousFalseAccepts += 1;
      }
      if (generation.case.expectedMeaning === 2) {
        summary.faithfulDenominator += 1;
        if (review.meaning < 2) summary.faithfulFalseRejects += 1;
      }
    }
    if (generation.case.expectedStyle != null) {
      summary.styleDenominator += 1;
      if (review.style === generation.case.expectedStyle) summary.styleAgreement += 1;
    }
  }
  const evaluatorValidation = [...validationByKey.values()].sort((a, b) => a.scorer.localeCompare(b.scorer) || a.scorerId.localeCompare(b.scorerId) || a.split.localeCompare(b.split));
  return { groups, evaluatorValidation };
}

function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (/^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
}

export function buildReport(
  generations: GenerationRecord[],
  judgments: JudgmentRecord[],
  humanReviews: HumanReview[],
  evaluatorId?: string,
): { markdown: string; csv: string; html: string; summary: BenchmarkSummary } {
  const summary = summarize(generations, judgments, humanReviews, evaluatorId);
  const columns = Object.keys(summary.groups[0] ?? { configId: "" });
  const markdown = [
    "# Mimus benchmark report",
    "",
    "Automated evaluation with limited human calibration and auditing. No model is declared a winner by a weighted score. Constructed expected labels are comparison references, not human ground truth.",
    "Human and automated scores are reported separately. Only repetition 0 contributes to primary denominators; incomplete generations cannot count as semantic successes.",
    "",
    "| Configuration | Config hash | Prompt | Split | Rep | N | Errors | Incomplete | Unresolved | Meaning 2 | Style 2 | Critical meaning 0 | Critical unresolved | P50/P95 TTFT ms | P50/P95 total ms | Generation cost USD | Judging cost USD | Fixture records | Release evidence eligible | Human reviews |",
    "|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---:|---:|---:|---|---:|",
    ...summary.groups.map((group) => `| ${group.configId} | ${group.configHash} | ${group.promptVersion} | ${group.split} | ${group.repetition} | ${group.generated} | ${group.errors} | ${group.incomplete} | ${group.unresolved} | ${group.meaning2} | ${group.style2} | ${group.criticalMeaning0} | ${group.criticalUnresolved} | ${group.p50FirstContentMs ?? "unknown"}/${group.p95FirstContentMs ?? "unknown"} | ${group.p50DurationMs ?? "unknown"}/${group.p95DurationMs ?? "unknown"} | ${group.generationCostUsd ?? "unknown"} | ${group.judgingCostUsd ?? "unknown"} | ${group.fixtureRecords} | ${group.eligibleReleaseEvidence ? "yes" : "no"} | ${group.humanReviews} |`),
    "",
    "## Evaluator validation against constructed labels and human review",
    "",
    "Agreement is reported as counts with explicit resolved denominators. Serious false accepts are expected meaning-0 examples scored 2; faithful false rejects are expected meaning-2 examples scored below 2. Human and evaluator observations remain separate and neither is treated as universal ground truth.",
    "",
    "| Scorer | Scorer ID | Split | Expected examples | Resolved | Unresolved | Meaning agreement / denominator | Meaning unresolved | Style agreement / denominator | Style unresolved | Serious false accepts / denominator | Faithful false rejects / denominator |",
    "|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...summary.evaluatorValidation.map((item) => `| ${item.scorer} | ${item.scorerId} | ${item.split} | ${item.expectedExamples} | ${item.resolved} | ${item.unresolved} | ${item.meaningAgreement}/${item.meaningDenominator} | ${item.meaningUnresolved} | ${item.styleAgreement}/${item.styleDenominator} | ${item.styleUnresolved} | ${item.seriousFalseAccepts}/${item.seriousDenominator} | ${item.faithfulFalseRejects}/${item.faithfulDenominator} |`),
    "",
    "Unknown usage or cost is shown as unknown, not zero. Release eligibility is a mechanical check of case count, direction/critical coverage, scores, and unresolved critical judgments; it is not a statistical guarantee or release decision.",
  ].join("\n");
  const csv = [columns.map(csvCell).join(","), ...summary.groups.map((group) => columns.map((column) => csvCell(group[column as keyof GroupSummary])).join(","))].join("\n");
  const rows = summary.groups.map((group) => `<tr>${columns.map((column) => `<td>${escapeHtml(group[column as keyof GroupSummary])}</td>`).join("")}</tr>`).join("");
  const headers = columns.map((column) => `<th scope="col">${escapeHtml(column)}</th>`).join("");
  const selectedJudgments = new Map<string, JudgmentRecord[]>();
  for (const judgment of judgments) {
    if (evaluatorId && judgment.evaluatorId !== evaluatorId) continue;
    selectedJudgments.set(judgment.generationId, [...(selectedJudgments.get(judgment.generationId) ?? []), judgment]);
  }
  const selectedHuman = new Map<string, HumanReview[]>();
  for (const review of checkedUnique(humanReviews, (record) => `${record.reviewSetId}:${record.generationId}`, "human review").values()) selectedHuman.set(review.generationId, [...(selectedHuman.get(review.generationId) ?? []), review]);
  const details = [...checkedUnique(generations, (record) => record.id, "generation").values()].map((record) => {
    const automated = selectedJudgments.get(record.id) ?? [];
    const human = selectedHuman.get(record.id) ?? [];
    const automatedRows = automated.length ? automated.map((item) => `<p>${escapeHtml(item.evaluatorId)}: meaning ${escapeHtml(item.meaning ?? "unresolved")}, style ${escapeHtml(item.style ?? "unresolved")}, tags ${escapeHtml(item.tags.join(", ") || "none")}</p>`).join("") : "<p>Unresolved</p>";
    const humanRows = human.length ? human.map((item) => `<p>meaning ${item.meaning}, style ${item.style}, tags ${escapeHtml(item.tags.join(", ") || "none")}</p>`).join("") : "<p>Not reviewed</p>";
    return `<details><summary>${escapeHtml(record.caseId)} · ${escapeHtml(record.configId)} · repetition ${record.repetition}</summary><h3>Source</h3><pre>${escapeHtml(record.case.text)}</pre><h3>Output</h3><pre>${escapeHtml(record.outputText)}</pre><p>Completion: ${escapeHtml(record.normalizedCompletion)}; error: ${escapeHtml(record.errorCode ?? "none")}</p><h3>Automated judgments</h3>${automatedRows}<h3>Human reviews</h3>${humanRows}</details>`;
  }).join("");
  const validationRows = summary.evaluatorValidation.map((item) => `<tr>${[item.scorer, item.scorerId, item.split, item.expectedExamples, item.resolved, item.unresolved, `${item.meaningAgreement}/${item.meaningDenominator}`, item.meaningUnresolved, `${item.styleAgreement}/${item.styleDenominator}`, item.styleUnresolved, `${item.seriousFalseAccepts}/${item.seriousDenominator}`, `${item.faithfulFalseRejects}/${item.faithfulDenominator}`].map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`).join("");
  const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Mimus benchmark report</title><style>body{font:16px system-ui,sans-serif;margin:2rem;color:#14323a}table{border-collapse:collapse;display:block;overflow:auto}th,td{border:1px solid #9ab;padding:.5rem;text-align:left}th{background:#f5fafb}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5fafb;padding:.75rem}details{border-top:1px solid #9ab;padding:.75rem}</style><h1>Mimus benchmark report</h1><p>Automated evaluation with limited human calibration and auditing. No weighted winner is declared. Human and automated scores remain separate. Constructed expected labels are comparison references, not human ground truth.</p><h2>Configuration summary</h2><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table><p>Unknown usage or cost is shown as unknown, not zero. Release evidence eligibility is not a statistical guarantee or release decision. Repetition 0 is the primary release denominator; later repetitions are supplemental.</p><h2>Evaluator validation</h2><p>Agreement has explicit resolved denominators. Serious false accepts and faithful false rejects compare to constructed labels. Human reviews are reported separately.</p><table><thead><tr>${["Scorer", "Scorer ID", "Split", "Expected examples", "Resolved", "Unresolved", "Meaning agreement / denominator", "Meaning unresolved", "Style agreement / denominator", "Style unresolved", "Serious false accepts / denominator", "Faithful false rejects / denominator"].map((value) => `<th scope="col">${escapeHtml(value)}</th>`).join("")}</tr></thead><tbody>${validationRows}</tbody></table><h2>Per-case evidence</h2>${details}</html>`;
  return { markdown, csv, html, summary };
}

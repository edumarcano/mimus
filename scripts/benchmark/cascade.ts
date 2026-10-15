import type { GenerationRecord, JudgmentRecord } from "./types";

export type CascadeThresholdResult = {
  threshold: number;
  split: "calibration" | "validation";
  cases: number;
  passed: number;
  failed: number;
  escalated: number;
  disagreements: number;
  missedSeriousFailures: number;
  falseRejections: number;
  baselinePasses: number;
  baselineResolved: number;
  baselineUnresolved: number;
  decisionCostUsd: number | null;
  estimatedDownstreamSavingsUsd: number | null;
};

export type CascadeReport = {
  decisionEvaluatorId: string;
  llmEvaluatorId: string;
  thresholds: CascadeThresholdResult[];
  selectedThreshold: number | null;
  selectedValidation: CascadeThresholdResult | null;
  note: string;
};

const SERIOUS_TAGS = new Set(["invention", "commitment", "attribution", "negation", "omission", "numbers_dates", "instruction_handling", "incomplete"]);

function validateProbability(value: number | undefined, label: string): number | null {
  if (value === undefined) return null;
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`Invalid ${label} probability`);
  return value;
}

function sampleAudit(generationId: string, seed: number): boolean {
  let hash = 2166136261 ^ seed;
  for (const char of generationId) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return ((hash >>> 0) % 10) === 0;
}

function llmSerious(judgment: JudgmentRecord | undefined): boolean {
  return !!judgment && judgment.status === "complete" && (judgment.meaning === 0 || judgment.tags.some((tag) => SERIOUS_TAGS.has(tag)));
}

function evaluatorsDisagree(decision: JudgmentRecord | undefined, llm: JudgmentRecord | undefined): boolean {
  if (!decision || decision.status !== "complete" || !llm || llm.status !== "complete") return false;
  const decisionSeriousTags = decision.tags.filter((tag) => SERIOUS_TAGS.has(tag)).sort().join(",");
  const llmSeriousTags = llm.tags.filter((tag) => SERIOUS_TAGS.has(tag)).sort().join(",");
  return decision.meaning !== llm.meaning || decision.style !== llm.style || decisionSeriousTags !== llmSeriousTags;
}

function decisionIsSelfContradictory(decision: JudgmentRecord, threshold: number): boolean {
  const probabilities = decision.probabilities ?? {};
  const meaningPass = probabilities.meaningPass;
  const seriousFailure = probabilities.seriousFailure;
  const scoreConflictsWithTags = decision.meaning === 2 && decision.tags.some((tag) => SERIOUS_TAGS.has(tag));
  const confidenceConflicts = typeof meaningPass === "number" && typeof seriousFailure === "number" && meaningPass >= threshold && seriousFailure >= threshold;
  return scoreConflictsWithTags || confidenceConflicts;
}

function decisionRoute(
  generation: GenerationRecord,
  decision: JudgmentRecord | undefined,
  threshold: number,
  seed: number,
): "pass" | "fail" | "escalate" {
  if (!decision || decision.status !== "complete") return "escalate";
  const probabilities = decision.probabilities ?? {};
  const meaningPass = validateProbability(probabilities.meaningPass, "meaningPass");
  const stylePass = validateProbability(probabilities.stylePass, "stylePass");
  const seriousFailure = validateProbability(probabilities.seriousFailure, "seriousFailure");
  if (generation.case.critical || decisionIsSelfContradictory(decision, threshold) || sampleAudit(generation.id, seed)) return "escalate";
  const confidentPass = typeof meaningPass === "number" && typeof stylePass === "number" && typeof seriousFailure === "number" &&
    meaningPass >= threshold && stylePass >= threshold && seriousFailure < threshold;
  const confidentFail = typeof seriousFailure === "number" && seriousFailure >= threshold;
  if (confidentPass) return "pass";
  if (confidentFail) return "fail";
  return "escalate";
}

function sumKnown(values: Array<number | null>): number | null {
  if (!values.length || values.some((value) => value == null || !Number.isFinite(value))) return null;
  return values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

function evaluate(
  generations: GenerationRecord[],
  decisions: Map<string, JudgmentRecord>,
  llms: Map<string, JudgmentRecord>,
  threshold: number,
  seed: number,
  split: "calibration" | "validation",
): CascadeThresholdResult {
  let passed = 0;
  let failed = 0;
  let escalated = 0;
  let disagreements = 0;
  let missedSeriousFailures = 0;
  let falseRejections = 0;
  let baselinePasses = 0;
  let baselineResolved = 0;
  const decisionCosts: Array<number | null> = [];
  const llmCosts: Array<number | null> = [];
  for (const generation of generations) {
    const decision = decisions.get(generation.id);
    const llm = llms.get(generation.id);
    if (llm?.status === "complete" && llm.meaning !== null && llm.style !== null) baselineResolved++;
    const baselinePass = llm?.status === "complete" && llm.meaning === 2 && llm.style === 2 && !llmSerious(llm);
    if (baselinePass) baselinePasses++;
    const route = decisionRoute(generation, decision, threshold, seed);
    if (evaluatorsDisagree(decision, llm)) disagreements += 1;
    decisionCosts.push(decision?.costUsd ?? null);
    llmCosts.push(llm?.costUsd ?? null);
    if (route === "escalate") escalated += 1;
    else if (route === "pass") {
      passed += 1;
      if (llmSerious(llm)) missedSeriousFailures += 1;
    } else {
      failed += 1;
      if (baselinePass) falseRejections++;
    }
  }
  const llmTotal = sumKnown(llmCosts);
  const escalatedLlmIds = generations.filter((generation) => decisionRoute(generation, decisions.get(generation.id), threshold, seed) === "escalate");
  const actualEscalatedCost = escalatedLlmIds.length === 0 ? 0 : sumKnown(escalatedLlmIds.map((generation) => llms.get(generation.id)?.costUsd ?? null));
  const savings = llmTotal == null || actualEscalatedCost == null ? null : Math.max(0, llmTotal - actualEscalatedCost);
  return { threshold, split, cases: generations.length, passed, failed, escalated, disagreements, missedSeriousFailures, falseRejections, baselinePasses, baselineResolved, baselineUnresolved:generations.length-baselineResolved, decisionCostUsd: sumKnown(decisionCosts), estimatedDownstreamSavingsUsd: baselineResolved === generations.length ? savings : null };
}

export function simulateCascade(
  generations: GenerationRecord[],
  judgments: JudgmentRecord[],
  options: { decisionEvaluatorId: string; llmEvaluatorId: string; seed: number; thresholds?: number[] },
): CascadeReport {
  const thresholds = options.thresholds ?? [0.8, 0.9, 0.95];
  if (options.decisionEvaluatorId === options.llmEvaluatorId) throw new Error("Cascade requires distinct decision and LLM evaluators");
  if (judgments.some(j => (j.evaluatorId === options.decisionEvaluatorId && j.evaluator.role !== "decision") || (j.evaluatorId === options.llmEvaluatorId && j.evaluator.role !== "llm"))) throw new Error("Cascade evaluator role mismatch");
  if (!Number.isSafeInteger(options.seed)) throw new Error("Cascade seed must be an integer");
  for (const threshold of thresholds) if (!Number.isFinite(threshold) || threshold <= 0 || threshold >= 1) throw new Error("Cascade thresholds must be between 0 and 1");
  if (new Set(thresholds).size !== thresholds.length) throw new Error("Cascade thresholds must be unique");
  const uniqueGenerations = new Map<string, GenerationRecord>();
  const observationKeys = new Map<string, GenerationRecord>();
  for (const generation of generations) {
    if (generation.repetition !== 0) continue;
    const prior = uniqueGenerations.get(generation.id);
    if (prior && JSON.stringify(prior) !== JSON.stringify(generation)) throw new Error(`Conflicting generation records for ${generation.id}`);
    const observationKey = JSON.stringify([generation.configId, generation.promptVersion, generation.case.split, generation.caseId, generation.repetition]);
    const priorObservation = observationKeys.get(observationKey);
    if (priorObservation && priorObservation.id !== generation.id) throw new Error(`Conflicting generation observations for ${observationKey}`);
    observationKeys.set(observationKey, generation);
    uniqueGenerations.set(generation.id, generation);
  }
  const uniqueJudgments = new Map<string, JudgmentRecord>();
  for (const judgment of judgments) {
    const key = `${judgment.evaluatorId}:${judgment.generationId}`;
    const prior = uniqueJudgments.get(key);
    if (prior && JSON.stringify(prior) !== JSON.stringify(judgment)) throw new Error(`Conflicting judgments for ${key}`);
    uniqueJudgments.set(key, judgment);
  }
  const decisionMap = new Map<string, JudgmentRecord>();
  const llmMap = new Map<string, JudgmentRecord>();
  for (const judgment of uniqueJudgments.values()) {
    if (judgment.evaluatorId === options.decisionEvaluatorId) decisionMap.set(judgment.generationId, judgment);
    if (judgment.evaluatorId === options.llmEvaluatorId) llmMap.set(judgment.generationId, judgment);
  }
  const all = [...uniqueGenerations.values()];
  const calibration = all.filter((record) => record.case.split === "calibration");
  const validation = all.filter((record) => record.case.split === "validation");
  const rows: CascadeThresholdResult[] = [];
  for (const threshold of thresholds) {
    rows.push(evaluate(calibration, decisionMap, llmMap, threshold, options.seed, "calibration"));
    rows.push(evaluate(validation, decisionMap, llmMap, threshold, options.seed, "validation"));
  }
  const calibrations = rows.filter((row) => row.split === "calibration");
  const comparable = calibration.length > 0 && validation.length > 0 && rows.every(row=>row.baselineUnresolved === 0);
  const selected = comparable ? [...calibrations].sort((a, b) => a.missedSeriousFailures - b.missedSeriousFailures || a.falseRejections - b.falseRejections || a.escalated - b.escalated || a.threshold - b.threshold)[0] : undefined;
  const selectedValidation = selected ? rows.find((row) => row.split === "validation" && row.threshold === selected.threshold) ?? null : null;
  return {
    decisionEvaluatorId: options.decisionEvaluatorId,
    llmEvaluatorId: options.llmEvaluatorId,
    thresholds: rows,
    selectedThreshold: selected?.threshold ?? null,
    selectedValidation,
    note: "Escalation routing uses only the decision evaluator, critical-case rules, decision self-contradictions, uncertainty, and seeded audits. Independent LLM disagreements are measured after routing and cannot trigger an LLM call that the simulation counts as avoided. Serious-failure comparisons use LLM labels, not human truth. False rejections count routed failures against resolved LLM passes (meaning 2, style 2, no serious tags); baselinePasses is their denominator. Thresholds minimize missed serious failures, then false rejections, then escalations on calibration data and are reported separately on validation data; this is not release gating.",
  };
}

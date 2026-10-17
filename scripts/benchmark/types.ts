import type { Intensity, StyleId } from "../../src/lib/styles";
import type { NormalizedCompletion } from "../evaluate-stream";

export const FAILURE_TAGS = [
  "invention",
  "commitment",
  "attribution",
  "negation",
  "omission",
  "numbers_dates",
  "instruction_handling",
  "style_intensity",
  "incomplete",
] as const;
export type FailureTag = (typeof FAILURE_TAGS)[number];
export type Score = 0 | 1 | 2;
export type CaseSplit =
  "development" | "release" | "calibration" | "validation";
export type BenchmarkCase = {
  id: string;
  split: CaseSplit;
  critical: boolean;
  text: string;
  sourceStyle: StyleId;
  targetStyle: StyleId;
  intensity: Intensity;
  mustPreserve: string[];
  mustNotInvent: string[];
  preserveTokens?: string[];
  themes?: string[];
  groupId?: string;
  outputText?: string;
  expectedMeaning?: Score;
  expectedStyle?: Score;
  labelSource?: "constructed";
};
export type Reasoning = {
  effort?: "none" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
  enabled?: boolean;
};
export type BenchmarkConfig = {
  id: string;
  model: string;
  role: "generator" | "llm" | "decision";
  reasoning: Reasoning;
  maxOutputTokens: number;
  inputUsdPerMillion: number;
  outputUsdPerMillion: number;
};
export type Manifest = {
  schemaVersion: 1;
  id: string;
  stage:
    | "pilot"
    | "prompt"
    | "effort"
    | "development"
    | "repeat"
    | "release"
    | "evaluators";
  dataset: string;
  promptVersion: "4" | "candidate-v5";
  configurations: BenchmarkConfig[];
  repetitions: number;
  seed: number;
  targetUsd: number;
  maxUsd: number;
  pricingDate: string;
  caseIds?: string[];
};
export type Usage = {
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  costUsd?: number;
};
export type GenerationRecord = {
  schemaVersion: 1;
  kind: "generation";
  id: string;
  runId: string;
  manifestHash: string;
  datasetHash: string;
  gitRevision: string;
  dirty: boolean;
  caseId: string;
  configId: string;
  promptVersion: string;
  case: BenchmarkCase;
  config: BenchmarkConfig;
  repetition: number;
  date: string;
  outputText: string;
  normalizedCompletion: NormalizedCompletion;
  errorCode: string | null;
  firstContentMs: number | null;
  durationMs: number;
  usage: Usage | null;
  costUsd: number | null;
  estimatedCostUsd: number;
  provider?: string;
  providerGenerationId?: string;
  transport?: "fixture" | "openrouter" | "constructed";
  promptHash?: string;
  reusedFrom?: { runId: string; generationId: string };
};
export type JudgmentRecord = {
  schemaVersion: 1;
  kind: "judgment";
  id: string;
  runId: string;
  generationId: string;
  evaluatorId: string;
  evaluator: BenchmarkConfig;
  rubricVersion: string;
  status: "complete" | "unresolved";
  meaning: Score | null;
  style: Score | null;
  tags: FailureTag[];
  evidence: string[];
  probabilities: Record<string, number> | null;
  date: string;
  durationMs: number;
  usage: Usage | null;
  costUsd: number | null;
  estimatedCostUsd: number;
  errorCode: string | null;
  provider?: string;
  providerGenerationId?: string;
};
export type HumanReview = {
  schemaVersion: 1;
  kind: "human";
  reviewSetId: string;
  generationId: string;
  meaning: Score;
  style: Score;
  tags: FailureTag[];
  note: string;
};
export type ReviewSet = {
  schemaVersion: 1;
  id: string;
  items: Array<{ blindId: string; generationId: string }>;
};
export type LedgerEntry = {
  schemaVersion: 1;
  kind: "reservation" | "settlement";
  jobId: string;
  runId: string;
  manifestHash: string;
  date: string;
  reservedUsd: number;
  chargedUsd: number | null;
};

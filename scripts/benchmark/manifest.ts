import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import path from "node:path";
import { INTENSITIES, STYLE_IDS } from "../../src/lib/styles";
import { countCodePoints, MAX_INPUT_CODE_POINTS } from "../../src/lib/limits";
import type { BenchmarkCase, BenchmarkConfig, Manifest } from "./types";

export function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
export function safeId(value: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(value)) throw new Error("Invalid artifact ID");
  return value;
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object");
  return value as Record<string, unknown>;
}
function finite(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}
export const MODEL_EFFORTS: Record<string, readonly string[]> = {
  "z-ai/glm-5.3-flash": ["low", "high", "max"],
  "openai/gpt-6-luna": ["none", "low", "medium", "high", "xhigh", "max"],
  "anthropic/claude-haiku-5.5": ["low", "medium", "high", "xhigh", "max"],
  "google/gemini-3.5-flash-lite": ["minimal", "low", "medium", "high"],
  "google/gemini-4-argon": ["low", "medium", "high"],
};
const DECISION_MODELS = ["typesafe/jev-1.14", "microsoft/microsoft-decision-1", "perplexity/pplx-decider-v1.1-27b"];
export function validateConfig(raw: unknown): BenchmarkConfig {
  const c = object(raw);
  if (typeof c.id !== "string") throw new Error("Configuration needs an ID");
  safeId(c.id);
  if (typeof c.model !== "string" || !["generator", "llm", "decision"].includes(String(c.role))) throw new Error("Invalid model or role");
  if (!finite(c.maxOutputTokens, 1, 2048) || !Number.isInteger(c.maxOutputTokens)) throw new Error("Completion cap must be 1..2048");
  if (!finite(c.inputUsdPerMillion, 0, 100) || !finite(c.outputUsdPerMillion, 0, 100)) throw new Error("Invalid pricing");
  const reasoning = object(c.reasoning);
  if (Object.keys(reasoning).some(key => !["enabled", "effort"].includes(key))) throw new Error("Unknown reasoning setting");
  if (reasoning.enabled !== undefined && typeof reasoning.enabled !== "boolean") throw new Error("Invalid thinking flag");
  if (c.role === "decision") {
    if (!DECISION_MODELS.includes(c.model) || Object.keys(reasoning).length) throw new Error("Unsupported decision configuration");
  } else {
    if (!MODEL_EFFORTS[c.model]?.includes(String(reasoning.effort))) throw new Error("Unsupported effort");
    if (reasoning.enabled === false && !["anthropic/claude-haiku-5.5", "openai/gpt-6-luna"].includes(c.model)) throw new Error("Thinking cannot be disabled for this model");
    if (reasoning.enabled === false && c.model === "openai/gpt-6-luna" && reasoning.effort !== "none") throw new Error("Disabled Luna needs none effort");
  }
  return c as unknown as BenchmarkConfig;
}
export function validateManifest(raw: unknown): Manifest {
  const m = object(raw);
  if (m.schemaVersion !== 1 || typeof m.id !== "string") throw new Error("Unsupported manifest");
  safeId(m.id);
  if (!["pilot", "prompt", "effort", "development", "repeat", "release", "evaluators"].includes(String(m.stage))) throw new Error("Invalid stage");
  if (typeof m.dataset !== "string" || !["4", "candidate-v5"].includes(String(m.promptVersion))) throw new Error("Invalid dataset or prompt");
  if (!finite(m.maxUsd, 0.000001, 3) || !finite(m.targetUsd, 0, m.maxUsd)) throw new Error("Budget must fit $3 ceiling");
  if (!finite(m.repetitions, 1, 3) || !Number.isInteger(m.repetitions) || !Number.isSafeInteger(m.seed)) throw new Error("Invalid repetitions or seed");
  if (typeof m.pricingDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(m.pricingDate) || !Number.isFinite(Date.parse(m.pricingDate))) throw new Error("Pricing date required");
  if (!Array.isArray(m.configurations) || m.configurations.length === 0) throw new Error("No configurations");
  const configs = m.configurations.map(validateConfig);
  if (new Set(configs.map(c => c.id)).size !== configs.length) throw new Error("Duplicate configuration ID");
  if (m.caseIds !== undefined && (!Array.isArray(m.caseIds) || m.caseIds.length === 0 || m.caseIds.some(id => typeof id !== "string") || new Set(m.caseIds).size !== m.caseIds.length)) throw new Error("Invalid case IDs");
  return { ...m, configurations: configs } as unknown as Manifest;
}
export function validateCase(raw: unknown): BenchmarkCase {
  const c = object(raw);
  if (typeof c.id !== "string") throw new Error("Case ID required");
  safeId(c.id);
  if (!["development", "release", "calibration", "validation"].includes(String(c.split))) throw new Error("Invalid case split");
  if (typeof c.text !== "string" || !c.text.trim() || countCodePoints(c.text) > MAX_INPUT_CODE_POINTS) throw new Error("Invalid synthetic passage");
  if (!(STYLE_IDS as readonly unknown[]).includes(c.sourceStyle) || !(STYLE_IDS as readonly unknown[]).includes(c.targetStyle) || c.sourceStyle === c.targetStyle || !(INTENSITIES as readonly unknown[]).includes(c.intensity)) throw new Error("Invalid styles or intensity");
  if (typeof c.critical !== "boolean") throw new Error("Critical flag required");
  for (const key of ["mustPreserve", "mustNotInvent"]) {
    if (!Array.isArray(c[key]) || c[key].length === 0 || c[key].some(v => typeof v !== "string" || !v.trim())) throw new Error("Meaning annotations required");
  }
  if (c.preserveTokens !== undefined && (!Array.isArray(c.preserveTokens) || c.preserveTokens.some(v => typeof v !== "string" || !v))) throw new Error("Invalid exact-token annotations");
  if (c.outputText !== undefined && (typeof c.outputText !== "string" || !c.outputText.trim() || ![0,1,2].includes(Number(c.expectedMeaning)) || ![0,1,2].includes(Number(c.expectedStyle)) || c.labelSource !== "constructed" || typeof c.groupId !== "string")) throw new Error("Invalid constructed reference");
  return c as unknown as BenchmarkCase;
}
export function loadExperiment(manifestPath: string): { manifest: Manifest; cases: BenchmarkCase[]; datasetHash: string; manifestHash: string } {
  const manifest = validateManifest(JSON.parse(readFileSync(manifestPath, "utf8")));
  const datasetPath = path.resolve(manifest.dataset);
  const allowed = realpathSync("evals");
  if (!datasetPath.startsWith(allowed + path.sep) || !datasetPath.endsWith(".jsonl")) throw new Error("Dataset must be synthetic JSONL under evals");
  if (!realpathSync(datasetPath).startsWith(allowed + path.sep)) throw new Error("Dataset symlink escapes synthetic corpus");
  const rawCases = readFileSync(datasetPath, "utf8").split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
  // The former holdout was evaluated on Gemini. It is supplemental development
  // evidence now; leave the historical file and old CLI semantics untouched.
  const cases = rawCases.map(raw => validateCase(datasetPath === path.resolve("evals/cases.jsonl") && raw.split === "holdout" ? { ...raw, split: "development" } : raw));
  if (new Set(cases.map(c => c.id)).size !== cases.length) throw new Error("Duplicate case ID");
  const selected = manifest.caseIds ? cases.filter(c => manifest.caseIds!.includes(c.id)) : cases;
  if (!selected.length || (manifest.caseIds && selected.length !== manifest.caseIds.length)) throw new Error("Unknown or empty case selection");
  const groups = new Map<string, string>();
  for (const c of cases) if (c.groupId) {
    if (groups.has(c.groupId) && groups.get(c.groupId) !== c.split) throw new Error("Reference pair crosses splits");
    groups.set(c.groupId, c.split);
  }
  if (manifest.stage === "release" && (selected.length !== 40 || selected.some(c => c.split !== "release") || selected.filter(c => c.critical).length !== 10 || new Set(selected.map(c => c.sourceStyle + c.targetStyle)).size !== 20 || manifest.repetitions !== 1)) throw new Error("Release requires 40 fresh cases, 20 directions and 10 critical cases");
  if (manifest.stage !== "release" && selected.some(c => c.split === "release")) throw new Error("Release data requires release stage");
  return { manifest, cases: selected, datasetHash: hash(rawCases), manifestHash: hash(manifest) };
}

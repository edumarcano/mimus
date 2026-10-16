import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { streamRewriteWithConfig, type ModelEvent } from "../../src/lib/server/openrouter";
import { REQUEST_DEADLINE_MS } from "../../src/lib/limits";
import { consumeAdapterStream } from "../evaluate-stream";
import { REQUEST_INTERVAL_MS } from "../evaluate";
import { hash, loadExperiment, object } from "./manifest";
import { benchmarkPrompt } from "./prompt";
import { EvaluationDeadlineError, estimateMaximumCost } from "./evaluators";
import { append, readJsonl, reserve, ROOT, runDirectory, writeOnce } from "./store";
import type { BenchmarkConfig, GenerationRecord, JudgmentRecord, Manifest, Usage } from "./types";

export type Experiment = ReturnType<typeof loadExperiment>;
export type RunnerOptions = { runId: string; live: boolean; includeHoldout: boolean; fixture?: boolean; limit?: number; reuseRunId?: string };
export type Generator = (request: ReturnType<typeof benchmarkPrompt>, signal: AbortSignal, config: BenchmarkConfig, apiKey: string) => AsyncIterable<ModelEvent>;
type RunDeps = { generate?: Generator; now?: () => number; sleep?: (ms: number) => Promise<void>; git?: () => { revision: string; dirty: boolean } };
function gitInfo() {
  const revision = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const dirty = execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" }).trim().length > 0;
  return { revision, dirty };
}
export function estimateCost(config: BenchmarkConfig, input: unknown): number {
  // UTF-8 bytes bound ordinary tokenizer input length; include template overhead.
  // Decisions may repeat state per atomic question, so reserve a fan-out bound.
  const bytes = Buffer.byteLength(JSON.stringify(input), "utf8") + 1024;
  return (bytes * (config.role === "decision" ? 16 : 1) * config.inputUsdPerMillion + config.maxOutputTokens * config.outputUsdPerMillion) / 1_000_000;
}
export function usageCost(config: BenchmarkConfig, usage: Usage | null): number | null {
  if (usage?.costUsd !== undefined && Number.isFinite(usage.costUsd) && usage.costUsd >= 0) return usage.costUsd;
  return null;
}
export function estimatedUsageCost(config: BenchmarkConfig, usage: Usage | null, reservation: number): number {
  if (usage?.inputTokens === undefined || usage?.outputTokens === undefined) return reservation;
  return (usage.inputTokens * config.inputUsdPerMillion + usage.outputTokens * config.outputUsdPerMillion) / 1_000_000;
}
export function ordered<T>(items: T[], seed: number): T[] {
  let state = seed >>> 0;
  const next = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 0x100000000; };
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [result[i], result[j]] = [result[j], result[i]]; }
  return result;
}
export async function refreshCatalog() {
  const all = await Promise.all(["text", "decisions"].map(async modality => {
    const response = await fetch(`https://openrouter.ai/api/v1/models?output_modalities=${modality}`, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error("Catalog unavailable");
    const result = object(await response.json());
    if (!Array.isArray(result.data)) throw new Error("Malformed catalog");
    return result.data;
  }));
  const snapshot = { fetchedAt: new Date().toISOString(), data: all.flat() };
  mkdirSync(ROOT, { recursive: true });
  writeFileSync(path.join(ROOT, "catalog.json"), JSON.stringify(snapshot, null, 2));
  return snapshot;
}
export function validateCatalog(manifest: Manifest) {
  const file = path.join(ROOT, "catalog.json");
  if (!existsSync(file)) throw new Error("Refresh the public catalog with preflight --refresh-catalog before paid runs");
  const catalog = object(JSON.parse(readFileSync(file, "utf8")));
  if (typeof catalog.fetchedAt !== "string" || Math.abs(Date.now() - Date.parse(catalog.fetchedAt)) > 86_400_000 || !Number.isFinite(Date.parse(catalog.fetchedAt)) || !Array.isArray(catalog.data)) throw new Error("Catalog snapshot must be less than 24 hours old");
  for (const config of manifest.configurations) {
    const raw = catalog.data.find(value => object(value).id === config.model);
    if (!raw) throw new Error(`Unavailable catalog model: ${config.model}`);
    const m = object(raw); const pricing = object(m.pricing);
    if (!Number.isFinite(Number(pricing.prompt)) || !Number.isFinite(Number(pricing.completion)) || Number(pricing.prompt) * 1e6 > config.inputUsdPerMillion + 1e-10 || Number(pricing.completion) * 1e6 > config.outputUsdPerMillion + 1e-10) throw new Error(`Refresh pricing in manifest: ${config.id}`);
    const reasoning = m.reasoning ? object(m.reasoning) : {};
    if (config.role !== "decision" && (config.reasoning.enabled === false ? reasoning.mandatory === true : !Array.isArray(reasoning.supported_efforts) || !reasoning.supported_efforts.includes(config.reasoning.effort))) throw new Error(`Catalog cannot confirm reasoning setting: ${config.id}`);
  }
  return hash(catalog);
}
function prepareRun(experiment: Experiment, options: RunnerOptions, git: { revision: string; dirty: boolean }) {
  if (!options.fixture && !options.live) throw new Error("Pass --live only after approval for paid calls, or use --fixture for an offline demonstration");
  if (options.fixture && options.live) throw new Error("Fixture and live modes are mutually exclusive");
  if (options.limit !== undefined && (!Number.isSafeInteger(options.limit) || options.limit < 1)) throw new Error("Limit must be a positive integer");
  if (experiment.manifest.stage === "release" && (!options.includeHoldout || options.limit !== undefined || git.dirty)) throw new Error("Release evaluation requires --include-holdout, no limit, and a clean tracked/untracked tree");
  if (experiment.manifest.stage === "release" && experiment.manifest.id.endsWith("-template")) throw new Error("Freeze a named finalist manifest from development evidence before opening release cases");
  if (experiment.manifest.stage === "release" && options.reuseRunId) throw new Error("Fresh release runs cannot reuse development observations");
  if (!options.fixture) validateCatalog(experiment.manifest);
  const directory = runDirectory(options.runId);
  const sourceHash = hash(["src/lib/prompts.ts", "src/lib/styles.ts", "src/lib/limits.ts", "src/lib/server/errors.ts", "src/lib/server/config.ts", "src/lib/server/model-config.ts", "src/lib/server/openrouter.ts", "scripts/evaluate.ts", "scripts/evaluate-cli.ts", "scripts/evaluate-stream.ts", "scripts/benchmark.ts", "scripts/benchmark/prompt.ts", "scripts/benchmark/runner.ts", "scripts/benchmark/store.ts", "scripts/benchmark/evaluators.ts", "scripts/benchmark/types.ts", "scripts/benchmark/manifest.ts", "package-lock.json"].map(file => [file, readFileSync(file, "utf8")]));
  const metadata = { schemaVersion: 1, manifestHash: experiment.manifestHash, datasetHash: experiment.datasetHash, sourceHash, gitRevision: git.revision, dirty: git.dirty, transport: options.fixture ? "fixture" : "openrouter" };
  const file = path.join(directory, "run.json");
  if (existsSync(file)) {
    if (hash(JSON.parse(readFileSync(file, "utf8"))) !== hash(metadata)) throw new Error("Resume requires identical manifest, dataset, source revision, and transport");
  } else {
    writeOnce(file, metadata);
    writeOnce(path.join(directory, "manifest.json"), experiment.manifest);
    if (!options.fixture) writeOnce(path.join(directory, "catalog.json"), JSON.parse(readFileSync(path.join(ROOT,"catalog.json"),"utf8")));
  }
  return directory;
}
async function* fixtureGenerator(request: ReturnType<typeof benchmarkPrompt>): AsyncIterable<ModelEvent> {
  yield { type: "delta", text: "[Fixture demonstration] " };
  yield { type: "delta", text: request.input };
  yield { type: "finish", reason: "complete", usage: { inputTokens: 1, outputTokens: 1 } };
}
export async function generateExperiment(experiment: Experiment, options: RunnerOptions, deps: RunDeps = {}): Promise<GenerationRecord[]> {
  const git = (deps.git ?? gitInfo)();
  const directory = prepareRun(experiment, options, git);
  const file = path.join(directory, "generations.jsonl");
  const previous = readJsonl<GenerationRecord>(file);
  const reusable = options.reuseRunId ? readJsonl<GenerationRecord>(path.join(runDirectory(options.reuseRunId),"generations.jsonl")) : [];
  if (options.reuseRunId && (!reusable.length || options.reuseRunId === options.runId)) throw new Error("Reuse requires a different existing source run");
  const configs = experiment.manifest.configurations.filter(c => c.role === "generator");
  if (!configs.length) throw new Error("Manifest has no generators");
  const jobs = ordered(experiment.cases.flatMap(c => configs.flatMap(config => Array.from({ length: experiment.manifest.repetitions }, (_, repetition) => ({ c, config, repetition })))), experiment.manifest.seed);
  const now = deps.now ?? Date.now;
  const generate = deps.generate ?? (options.fixture ? fixtureGenerator : streamRewriteWithConfig);
  const sleep = deps.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const apiKey = options.fixture ? "fixture" : process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Server-only OPENROUTER_API_KEY required");
  let dispatched = 0;
  for (const { c, config, repetition } of jobs) {
    const id = hash([options.runId, experiment.manifestHash, experiment.datasetHash, c.id, config.id, repetition]);
    if (previous.some(r => r.id === id)) continue;
    if (options.limit !== undefined && dispatched >= options.limit) break;
    if (dispatched && !options.fixture) await sleep(REQUEST_INTERVAL_MS);
    const prompt = benchmarkPrompt(c, experiment.manifest.promptVersion);
    const matching = reusable.find(r=>r.promptHash === hash(prompt) && hash(r.config) === hash(config) && hash(r.case) === hash(c) && r.repetition === repetition && r.normalizedCompletion === "complete" && !r.errorCode && r.transport === (options.fixture ? "fixture" : "openrouter"));
    if (matching) {
      const record: GenerationRecord = { ...matching,id,runId:options.runId,manifestHash:experiment.manifestHash,datasetHash:experiment.datasetHash,reusedFrom:{runId:matching.runId,generationId:matching.id} };
      append(file,record); previous.push(record); continue;
    }
    const reservation = estimateCost(config, prompt);
    const settle = options.fixture ? () => {} : reserve(id, options.runId, experiment.manifestHash, reservation, experiment.manifest.maxUsd);
    const started = now(); let firstContentMs: number | null = null;
    let metadata: { provider?: string; providerGenerationId?: string } = {};
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), REQUEST_DEADLINE_MS);
    async function* timed() {
      for await (const event of generate(prompt, controller.signal, config, apiKey!)) {
        if (event.type === "delta" && firstContentMs === null) firstContentMs = now() - started;
        if (event.type === "finish") metadata = { provider: event.provider, providerGenerationId: event.providerGenerationId };
        yield event;
      }
    }
    const result = await consumeAdapterStream(timed(), controller.signal).finally(() => { clearTimeout(timer); controller.abort(); });
    const usage: Usage | null = result.usage ?? null;
    const measured = options.fixture ? 0 : usageCost(config, usage);
    const estimated = options.fixture ? 0 : estimatedUsageCost(config, usage, reservation);
    // Unknown billing keeps the full reservation charged in the ledger.
    settle(measured);
    const record: GenerationRecord = { schemaVersion: 1, kind: "generation", id, runId: options.runId, manifestHash: experiment.manifestHash, datasetHash: experiment.datasetHash, gitRevision: git.revision, dirty: git.dirty, caseId: c.id, configId: config.id, promptVersion: experiment.manifest.promptVersion, promptHash:hash(prompt), case: c, config, repetition, date: new Date().toISOString(), outputText: result.outputText, normalizedCompletion: result.normalizedCompletion, errorCode: result.errorCode ?? null, firstContentMs, durationMs: now() - started, usage, costUsd: measured, estimatedCostUsd: estimated, transport: options.fixture ? "fixture" : "openrouter", ...metadata };
    append(file, record); previous.push(record); dispatched++;
    if (record.errorCode === "SERVICE_QUOTA_EXHAUSTED") throw new Error("Quota/rate limit encountered; run stopped without retry");
  }
  return previous;
}
export function referenceGenerations(experiment: Experiment, runId: string): GenerationRecord[] {
  const config: BenchmarkConfig = { id: "constructed-reference", model: "constructed-reference", role: "generator", reasoning: {}, maxOutputTokens: 2048, inputUsdPerMillion: 0, outputUsdPerMillion: 0 };
  return experiment.cases.map(c => {
    if (c.outputText === undefined) throw new Error("Evaluator dataset needs constructed outputs");
    return { schemaVersion: 1, kind: "generation", id: hash([runId, experiment.datasetHash, c.id]), runId, manifestHash: experiment.manifestHash, datasetHash: experiment.datasetHash, gitRevision: "constructed", dirty: false, caseId: c.id, configId: config.id, promptVersion: "constructed", case: c, config, repetition: 0, date: new Date().toISOString(), outputText: c.outputText, normalizedCompletion: "complete", errorCode: null, firstContentMs: null, durationMs: 0, usage: null, costUsd: 0, estimatedCostUsd: 0, transport: "constructed" };
  });
}
export async function judgeExperiment(experiment: Experiment, options: RunnerOptions & { evaluatorId: string }, evaluate: (g: GenerationRecord, c: BenchmarkConfig, key: string, signal: AbortSignal) => Promise<JudgmentRecord>): Promise<JudgmentRecord[]> {
  const git = gitInfo();
  const directory = prepareRun(experiment, options, git);
  const evaluator = experiment.manifest.configurations.find(c => c.id === options.evaluatorId && c.role !== "generator");
  if (!evaluator) throw new Error("Unknown evaluator");
  const file = path.join(directory, "judgments.jsonl");
  const previous = readJsonl<JudgmentRecord>(file);
  const generations = experiment.manifest.stage === "evaluators" ? referenceGenerations(experiment, options.runId) : readJsonl<GenerationRecord>(path.join(directory, "generations.jsonl"));
  if (!generations.length) throw new Error("No generation records to judge");
  if (experiment.manifest.stage === "evaluators" && !existsSync(path.join(directory, "generations.jsonl"))) generations.forEach(g => append(path.join(directory, "generations.jsonl"), g));
  const apiKey = options.fixture ? "fixture" : process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("Server-only OPENROUTER_API_KEY required");
  let dispatched = 0;
  for (const generation of generations) {
    const id = hash([generation.id, evaluator, "rubric-1"]);
    if (previous.some(j => j.id === id)) continue;
    if (options.limit !== undefined && dispatched >= options.limit) break;
    if (dispatched && !options.fixture) await new Promise(resolve => setTimeout(resolve, REQUEST_INTERVAL_MS));
    const reservation = estimateMaximumCost(generation,evaluator);
    const noRequest = generation.normalizedCompletion !== "complete" || Boolean(generation.errorCode);
    const settle = options.fixture || noRequest ? () => {} : reserve(id, options.runId, experiment.manifestHash, reservation, experiment.manifest.maxUsd);
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(new EvaluationDeadlineError()), REQUEST_DEADLINE_MS);
    const result = options.fixture || noRequest ? { schemaVersion: 1 as const, kind: "judgment" as const, id, runId: options.runId, generationId: generation.id, evaluatorId: evaluator.id, evaluator, rubricVersion: "1", status: "unresolved" as const, meaning: null, style: null, tags: [], evidence: options.fixture ? ["Fixture only; no semantic quality judgment"] : [], probabilities: null, date: new Date().toISOString(), durationMs: 0, usage: null, costUsd: 0, estimatedCostUsd: 0, errorCode: options.fixture ? "FIXTURE_ONLY" : "incomplete_generation" } : await evaluate(generation, evaluator, apiKey, controller.signal).finally(() => { clearTimeout(timer); controller.abort(); });
    clearTimeout(timer);
    const record = { ...result, id };
    settle(usageCost(evaluator, record.usage));
    append(file, record); previous.push(record); dispatched++;
    if (record.errorCode === "SERVICE_QUOTA_EXHAUSTED") throw new Error("Quota/rate limit encountered; judging stopped without retry");
  }
  return previous;
}

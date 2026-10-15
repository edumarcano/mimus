import { describe, expect, it } from "vitest";
import type { GenerationRecord, JudgmentRecord } from "../scripts/benchmark/types";
import { simulateCascade } from "../scripts/benchmark/cascade";

function generation(id: string, split: "calibration" | "validation" = "calibration", critical = false): GenerationRecord {
  return {
    schemaVersion: 1, kind: "generation", id, runId: "r", manifestHash: "m", datasetHash: "d", gitRevision: "rev", dirty: false,
    caseId: id, configId: "model", promptVersion: "4", case: { id, split, critical, text: "source", sourceStyle: "human", targetStyle: "linkedin", intensity: "balanced", mustPreserve: [], mustNotInvent: [] },
    config: { id: "model", model: "provider/model", role: "generator", reasoning: {}, maxOutputTokens: 2048, inputUsdPerMillion: 1, outputUsdPerMillion: 1 },
    repetition: 0, date: "2026-10-15T00:00:00.000Z", outputText: "result", normalizedCompletion: "complete", errorCode: null, firstContentMs: 10, durationMs: 20, usage: null, costUsd: 0.01, estimatedCostUsd: 0.01,
  };
}

function judgment(id: string, evaluatorId: "decision" | "llm", overrides: Partial<JudgmentRecord> = {}): JudgmentRecord {
  return {
    schemaVersion: 1, kind: "judgment", id: `${evaluatorId}-${id}`, runId: "r", generationId: id, evaluatorId,
    evaluator: { id: evaluatorId, model: `provider/${evaluatorId}`, role: evaluatorId === "decision" ? "decision" : "llm", reasoning: {}, maxOutputTokens: 1024, inputUsdPerMillion: 1, outputUsdPerMillion: 1 },
    rubricVersion: "1", status: "complete", meaning: 2, style: 2, tags: [], evidence: [], probabilities: evaluatorId === "decision" ? { meaningPass: 0.99, stylePass: 0.99, seriousFailure: 0.01 } : null,
    date: "2026-10-15T00:00:00.000Z", durationMs: 20, usage: null, costUsd: 0.005, estimatedCostUsd: 0.005, errorCode: null, ...overrides,
  };
}

function run(generations: GenerationRecord[], judgments: JudgmentRecord[], seed = 17) {
  return simulateCascade(generations, judgments, { decisionEvaluatorId: "decision", llmEvaluatorId: "llm", seed });
}

describe("offline cascade simulation", () => {
  it("always escalates critical and contradictory examples and selects on calibration only", () => {
    const cases = [generation("c1", "calibration", true), generation("c2"), generation("v1", "validation")];
    const judgments = cases.flatMap((item) => [
      judgment(item.id, "decision"),
      judgment(item.id, "llm", item.id === "c2" ? { meaning: 0, tags: ["commitment"] } : {}),
    ]);
    const report = run(cases, judgments, 7);
    const calibration = report.thresholds.find((row) => row.threshold === 0.8 && row.split === "calibration")!;
    expect(calibration.escalated).toBe(1);
    expect(calibration.disagreements).toBe(1);
    expect(calibration.missedSeriousFailures).toBe(1);
    expect(report.selectedThreshold).not.toBeNull();
    expect(report.selectedValidation?.split).toBe("validation");
    expect(report.note).toContain("not human truth");
  });

  it("keeps seeded audit selection deterministic and excludes repeated generations", () => {
    const cases = Array.from({ length: 40 }, (_, index) => generation(`case-${index}`));
    const judgments = cases.flatMap((item) => [judgment(item.id, "decision"), judgment(item.id, "llm")]);
    const first = run(cases, judgments, 42);
    const second = run(cases, judgments, 42);
    expect(first).toEqual(second);
    expect(first.thresholds.find((row) => row.split === "calibration")?.cases).toBe(40);
    expect(first.thresholds.filter((row) => row.split === "validation").every((row) => row.cases === 0)).toBe(true);
  });

  it("rejects invalid probability values", () => {
    const item = generation("bad");
    expect(() => run([item], [judgment("bad", "decision", { probabilities: { meaningPass: 1.1, stylePass: 1, seriousFailure: 0 } }), judgment("bad", "llm")])).toThrow(/Invalid meaningPass/);
  });

  it("leaves threshold selection inconclusive when baseline labels are unresolved",()=>{
    const cases = [generation("c"),generation("v","validation")];
    const report = run(cases,[judgment("c","decision"),judgment("c","llm"),judgment("v","decision"),judgment("v","llm",{status:"unresolved",meaning:null,style:null})]);
    expect(report.selectedThreshold).toBeNull();
    expect(report.thresholds.find(r=>r.split === "validation")?.baselineUnresolved).toBe(1);
    expect(report.thresholds.find(r=>r.split === "validation")?.estimatedDownstreamSavingsUsd).toBeNull();
  });

  it("does not use a downstream LLM disagreement to route a confident pass", () => {
    const item = generation("missed");
    const report = run([item], [
      judgment("missed", "decision"),
      judgment("missed", "llm", { meaning: 0, tags: ["commitment"] }),
    ], 7);
    const row = report.thresholds.find((result) => result.threshold === 0.8 && result.split === "calibration")!;
    expect(row.passed).toBe(1);
    expect(row.escalated).toBe(0);
    expect(row.missedSeriousFailures).toBe(1);
    expect(report.note).toContain("cannot trigger an LLM call");
  });
});

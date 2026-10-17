import { describe, expect, it } from "vitest";
import type {
  GenerationRecord,
  JudgmentRecord,
} from "../scripts/benchmark/types";
import { simulateCascade } from "../scripts/benchmark/cascade";

function generation(
  id: string,
  split: "development" | "calibration" | "validation" = "calibration",
  critical = false,
): GenerationRecord {
  return {
    schemaVersion: 1,
    kind: "generation",
    id,
    runId: "r",
    manifestHash: "m",
    datasetHash: "d",
    gitRevision: "rev",
    dirty: false,
    caseId: id,
    configId: "model",
    promptVersion: "4",
    case: {
      id,
      split,
      critical,
      text: "source",
      sourceStyle: "human",
      targetStyle: "linkedin",
      intensity: "balanced",
      mustPreserve: [],
      mustNotInvent: [],
    },
    config: {
      id: "model",
      model: "provider/model",
      role: "generator",
      reasoning: {},
      maxOutputTokens: 2048,
      inputUsdPerMillion: 1,
      outputUsdPerMillion: 1,
    },
    repetition: 0,
    date: "2026-10-15T00:00:00.000Z",
    outputText: "result",
    normalizedCompletion: "complete",
    errorCode: null,
    firstContentMs: 10,
    durationMs: 20,
    usage: null,
    costUsd: 0.01,
    estimatedCostUsd: 0.01,
  };
}

function judgment(
  id: string,
  evaluatorId: "decision" | "llm",
  overrides: Partial<JudgmentRecord> = {},
): JudgmentRecord {
  return {
    schemaVersion: 1,
    kind: "judgment",
    id: `${evaluatorId}-${id}`,
    runId: "r",
    generationId: id,
    evaluatorId,
    evaluator: {
      id: evaluatorId,
      model: `provider/${evaluatorId}`,
      role: evaluatorId === "decision" ? "decision" : "llm",
      reasoning: {},
      maxOutputTokens: 1024,
      inputUsdPerMillion: 1,
      outputUsdPerMillion: 1,
    },
    rubricVersion: "1",
    status: "complete",
    meaning: 2,
    style: 2,
    tags: [],
    evidence: [],
    probabilities:
      evaluatorId === "decision"
        ? { meaningPass: 0.99, stylePass: 0.99, seriousFailure: 0.01 }
        : null,
    date: "2026-10-15T00:00:00.000Z",
    durationMs: 20,
    usage: null,
    costUsd: 0.005,
    estimatedCostUsd: 0.005,
    errorCode: null,
    ...overrides,
  };
}

function run(
  generations: GenerationRecord[],
  judgments: JudgmentRecord[],
  seed = 17,
) {
  return simulateCascade(generations, judgments, {
    decisionEvaluatorId: "decision",
    llmEvaluatorId: "llm",
    seed,
  });
}

describe("offline cascade simulation", () => {
  it("selects on development while keeping constructed calibration and validation separate", () => {
    const cases = [
      generation("c2", "development"),
      generation("constructed", "calibration", true),
      generation("v1", "validation"),
    ];
    const originalCases = structuredClone(cases);
    const judgments = cases.flatMap((item) => [
      judgment(item.id, "decision", {
        meaning: 0,
        probabilities: {
          meaningPass: 0.05,
          stylePass: 0.99,
          seriousFailure: 0.85,
        },
      }),
      judgment(
        item.id,
        "llm",
        item.case.split === "development"
          ? {}
          : item.case.split === "calibration"
            ? { status: "unresolved", meaning: null, style: null }
            : { meaning: 0 },
      ),
    ]);
    const report = run(cases, judgments, 7);
    expect(report.cohortCounts).toEqual({
      development: 1,
      calibration: 1,
      validation: 1,
    });
    expect(report.thresholdSource).toBe("development");
    expect(report.selectedThreshold).toBe(0.9);
    expect(report.incompleteReasons).toEqual([]);
    expect(
      report.thresholds.find(
        (row) => row.threshold === 0.8 && row.split === "development",
      )?.falseRejections,
    ).toBe(1);
    expect(
      report.thresholds.find(
        (row) => row.threshold === 0.8 && row.split === "calibration",
      )?.baselinePasses,
    ).toBe(0);
    expect(
      report.thresholds.find(
        (row) => row.threshold === 0.8 && row.split === "calibration",
      )?.baselineUnresolved,
    ).toBe(1);
    expect(report.selectedValidation?.cases).toBe(1);
    expect(report.selectedValidation?.split).toBe("validation");
    expect(
      report.thresholds.find(
        (row) => row.threshold === 0.8 && row.split === "validation",
      )?.missedSeriousFailures,
    ).toBe(0);
    expect(cases).toEqual(originalCases);
  });

  it("reports development observations and missing validation instead of an empty simulation", () => {
    const item = generation("c2", "development");
    const report = run(
      [item],
      [judgment(item.id, "decision"), judgment(item.id, "llm")],
      7,
    );
    expect(report.thresholdSource).toBe("development");
    expect(report.cohortCounts.development).toBe(1);
    expect(
      report.thresholds
        .filter((row) => row.split === "development")
        .every((row) => row.cases === 1),
    ).toBe(true);
    expect(report.selectedThreshold).toBeNull();
    expect(report.incompleteReasons).toContain(
      "No held-out validation observations.",
    );
  });

  it("always escalates critical and contradictory examples and selects on calibration only", () => {
    const cases = [
      generation("c1", "calibration", true),
      generation("c2"),
      generation("v1", "validation"),
    ];
    const judgments = cases.flatMap((item) => [
      judgment(item.id, "decision"),
      judgment(
        item.id,
        "llm",
        item.id === "c2" ? { meaning: 0, tags: ["commitment"] } : {},
      ),
    ]);
    const report = run(cases, judgments, 7);
    const calibration = report.thresholds.find(
      (row) => row.threshold === 0.8 && row.split === "calibration",
    )!;
    expect(calibration.escalated).toBe(1);
    expect(calibration.disagreements).toBe(1);
    expect(calibration.missedSeriousFailures).toBe(1);
    expect(report.selectedThreshold).not.toBeNull();
    expect(report.selectedValidation?.split).toBe("validation");
    expect(report.note).toContain("not human truth");
  });

  it("keeps seeded audit selection deterministic and excludes repeated generations", () => {
    const cases = Array.from({ length: 40 }, (_, index) =>
      generation(`case-${index}`),
    );
    const judgments = cases.flatMap((item) => [
      judgment(item.id, "decision"),
      judgment(item.id, "llm"),
    ]);
    const first = run(cases, judgments, 42);
    const second = run(cases, judgments, 42);
    expect(first).toEqual(second);
    expect(
      first.thresholds.find((row) => row.split === "calibration")?.cases,
    ).toBe(40);
    expect(
      first.thresholds
        .filter((row) => row.split === "validation")
        .every((row) => row.cases === 0),
    ).toBe(true);
  });

  it("rejects invalid probability values", () => {
    const item = generation("bad");
    expect(() =>
      run(
        [item],
        [
          judgment("bad", "decision", {
            probabilities: {
              meaningPass: 1.1,
              stylePass: 1,
              seriousFailure: 0,
            },
          }),
          judgment("bad", "llm"),
        ],
      ),
    ).toThrow(/Invalid meaningPass/);
  });

  it("leaves threshold selection inconclusive when baseline labels are unresolved", () => {
    const cases = [generation("c"), generation("v", "validation")];
    const report = run(cases, [
      judgment("c", "decision"),
      judgment("c", "llm"),
      judgment("v", "decision"),
      judgment("v", "llm", {
        status: "unresolved",
        meaning: null,
        style: null,
      }),
    ]);
    expect(report.selectedThreshold).toBeNull();
    expect(
      report.thresholds.find((r) => r.split === "validation")
        ?.baselineUnresolved,
    ).toBe(1);
    expect(
      report.thresholds.find((r) => r.split === "validation")
        ?.estimatedDownstreamSavingsUsd,
    ).toBeNull();
  });

  it("does not use a downstream LLM disagreement to route a confident pass", () => {
    const item = generation("missed");
    const report = run(
      [item],
      [
        judgment("missed", "decision"),
        judgment("missed", "llm", { meaning: 0, tags: ["commitment"] }),
      ],
      7,
    );
    const row = report.thresholds.find(
      (result) => result.threshold === 0.8 && result.split === "calibration",
    )!;
    expect(row.passed).toBe(1);
    expect(row.escalated).toBe(0);
    expect(row.missedSeriousFailures).toBe(1);
    expect(row.estimatedDownstreamSavingsUsd).toBe(0.005);
    expect(report.note).toContain("cannot trigger an LLM call");
  });

  it("counts confident false rejections and avoids selecting a threshold that causes them", () => {
    const cases = [generation("c2"), generation("v1", "validation")];
    const judgments = cases.flatMap((item) => [
      judgment(item.id, "decision", {
        meaning: 0,
        probabilities: {
          meaningPass: 0.05,
          stylePass: 0.99,
          seriousFailure: 0.85,
        },
      }),
      judgment(item.id, "llm"),
    ]);
    const report = run(cases, judgments, 7);
    const row = report.thresholds.find(
      (r) => r.threshold === 0.8 && r.split === "calibration",
    )!;
    expect(row.failed).toBe(1);
    expect(row.falseRejections).toBe(1);
    expect(row.baselinePasses).toBe(1);
    expect(report.selectedThreshold).toBe(0.9);
    expect(
      report.thresholds.find(
        (r) => r.threshold === 0.9 && r.split === "calibration",
      )?.falseRejections,
    ).toBe(0);
  });

  it("excludes unresolved and non-passing baselines and escalations from false rejections", () => {
    const cases = [
      generation("critical", "calibration", true),
      generation("failure"),
      generation("unknown"),
      generation("tagged"),
    ];
    const baselines: Partial<JudgmentRecord>[] = [
      {},
      { meaning: 0 },
      { status: "unresolved", meaning: null, style: null },
      { tags: ["invention"] },
    ];
    const judgments = cases.flatMap((item, index) => [
      judgment(item.id, "decision", {
        meaning: 0,
        probabilities: {
          meaningPass: 0,
          stylePass: 0.99,
          seriousFailure: 0.99,
        },
      }),
      judgment(item.id, "llm", baselines[index]),
    ]);
    const row = run(cases, judgments, 7).thresholds.find(
      (r) => r.threshold === 0.8 && r.split === "calibration",
    )!;
    expect(row.falseRejections).toBe(0);
    expect(row.baselinePasses).toBe(1);
    expect(row.baselineUnresolved).toBe(1);
    expect(row.estimatedDownstreamSavingsUsd).toBeNull();
  });

  it("keeps the calibration threshold even when validation would favor another", () => {
    const cases = [generation("c2"), generation("v1", "validation")];
    const judgments = cases.flatMap((item) => [
      judgment(item.id, "decision", {
        meaning: 0,
        probabilities: {
          meaningPass: 0.05,
          stylePass: 0.99,
          seriousFailure: 0.85,
        },
      }),
      judgment(
        item.id,
        "llm",
        item.case.split === "calibration" ? { meaning: 0 } : {},
      ),
    ]);
    const report = run(cases, judgments, 7);
    expect(report.selectedThreshold).toBe(0.8);
    expect(report.selectedValidation?.falseRejections).toBe(1);
    expect(
      report.thresholds.find(
        (r) => r.threshold === 0.9 && r.split === "validation",
      )?.falseRejections,
    ).toBe(0);
  });
});

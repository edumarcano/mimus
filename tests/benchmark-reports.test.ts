import { describe, expect, it } from "vitest";
import { loadExperiment } from "../scripts/benchmark/manifest";
import type {
  GenerationRecord,
  JudgmentRecord,
  HumanReview,
} from "../scripts/benchmark/types";
import { buildReport } from "../scripts/benchmark/reports";

function generation(
  overrides: Partial<GenerationRecord> = {},
): GenerationRecord {
  const base: GenerationRecord = {
    schemaVersion: 1,
    kind: "generation",
    id: "g1",
    runId: "r1",
    manifestHash: "m",
    datasetHash: "d",
    gitRevision: "rev",
    dirty: false,
    caseId: "case1",
    configId: "model-a",
    promptVersion: "4",
    case: {
      id: "case1",
      split: "development",
      critical: false,
      text: "Source",
      sourceStyle: "human",
      targetStyle: "linkedin",
      intensity: "balanced",
      mustPreserve: [],
      mustNotInvent: [],
    },
    config: {
      id: "model-a",
      model: "provider/model",
      role: "generator",
      reasoning: { effort: "low" },
      maxOutputTokens: 2048,
      inputUsdPerMillion: 1,
      outputUsdPerMillion: 1,
    },
    repetition: 0,
    date: "2026-10-15T00:00:00.000Z",
    outputText: "Rewrite",
    normalizedCompletion: "complete",
    errorCode: null,
    firstContentMs: 100,
    durationMs: 500,
    usage: null,
    costUsd: null,
    estimatedCostUsd: 0.001,
  };
  return { ...base, ...overrides };
}

function judgment(overrides: Partial<JudgmentRecord> = {}): JudgmentRecord {
  return {
    schemaVersion: 1,
    kind: "judgment",
    id: "j1",
    runId: "r1",
    generationId: "g1",
    evaluatorId: "judge",
    evaluator: {
      id: "judge",
      model: "provider/judge",
      role: "llm",
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
    probabilities: null,
    date: "2026-10-15T00:00:00.000Z",
    durationMs: 10,
    usage: null,
    costUsd: null,
    estimatedCostUsd: 0.001,
    errorCode: null,
    ...overrides,
  };
}

describe("benchmark reporting", () => {
  it("counts missing judgments across the full reference cohort and each split", () => {
    const records = ["calibration", "validation"].flatMap((split) =>
      [0, 1].map((index) =>
        generation({
          id: `${split}-${index}`,
          caseId: `${split}-${index}`,
          case: {
            ...generation().case,
            split: split as "calibration" | "validation",
            labelSource: "constructed",
            expectedMeaning: 2,
            expectedStyle: 2,
          },
        }),
      ),
    );
    const scores = [
      judgment({ generationId: "calibration-0" }),
      judgment({
        id: "other-judge",
        generationId: "validation-0",
        evaluatorId: "other",
      }),
    ];
    const result = buildReport(records, scores, []);

    for (const scorerId of ["judge", "other"]) {
      for (const split of ["calibration", "validation"]) {
        const resolved =
          (scorerId === "judge" ? "calibration" : "validation") === split
            ? 1
            : 0;
        expect(result.summary.evaluatorValidation).toContainEqual(
          expect.objectContaining({
            scorer: "evaluator",
            scorerId,
            split,
            expectedExamples: 2,
            resolved,
            unresolved: 2 - resolved,
            meaningDenominator: resolved,
            meaningUnresolved: 2 - resolved,
            styleDenominator: resolved,
            styleUnresolved: 2 - resolved,
          }),
        );
      }
    }
  });

  it("reports an explicitly selected evaluator even before its first judgment", () => {
    const record = generation({
      case: {
        ...generation().case,
        labelSource: "constructed",
        expectedMeaning: 2,
        expectedStyle: 2,
      },
    });
    const result = buildReport([record], [], [], "not-started");
    expect(result.summary.evaluatorValidation).toEqual([
      expect.objectContaining({
        scorerId: "not-started",
        expectedExamples: 1,
        resolved: 0,
        unresolved: 1,
        meaningUnresolved: 1,
        styleUnresolved: 1,
      }),
    ]);
  });

  it("requires complete LLM judgments for every release observation", () => {
    const cases = loadExperiment(
      "evals/experiments/release-template.json",
    ).cases;
    const records = cases.map((c) =>
      generation({ id: c.id, caseId: c.id, case: c, transport: "openrouter" }),
    );
    const scores = records.map((g) =>
      judgment({ id: `j-${g.id}`, generationId: g.id }),
    );
    expect(
      buildReport(records, scores, []).summary.groups[0]
        .eligibleReleaseEvidence,
    ).toBe(true);
    expect(
      buildReport(
        records,
        scores.map((j) => ({
          ...j,
          evaluator: { ...j.evaluator, role: "decision" },
        })),
        [],
      ).summary.groups[0].eligibleReleaseEvidence,
    ).toBe(false);
    const noncritical = records.find((r) => !r.case.critical)!;
    expect(
      buildReport(
        records,
        scores.map((j) =>
          j.generationId === noncritical.id ? { ...j, style: null } : j,
        ),
        [],
      ).summary.groups[0].eligibleReleaseEvidence,
    ).toBe(false);
  });
  it("uses only repetition zero for the primary denominator and keeps unknown costs unknown", () => {
    const primary = generation();
    const repeat = generation({ id: "g2", repetition: 1, caseId: "case2" });
    const failed = generation({
      id: "g3",
      caseId: "case3",
      normalizedCompletion: "incomplete",
      outputText: "partial",
    });
    const result = buildReport(
      [primary, repeat, failed],
      [
        judgment(),
        judgment({
          id: "j3",
          generationId: "g3",
          status: "unresolved",
          meaning: null,
          style: null,
        }),
      ],
      [],
    );
    const group = result.summary.groups.find((item) => item.repetition === 0)!;
    expect(group.generated).toBe(2);
    expect(group.incomplete).toBe(1);
    expect(group.meaning2).toBe(1);
    expect(group.generationCostUsd).toBeNull();
    expect(group.judgingCostUsd).toBeNull();
    expect(result.markdown).toContain(
      "Automated evaluation with limited human calibration and auditing",
    );
    expect(result.markdown).toContain("unknown");
  });

  it("rejects conflicting duplicate scores and keeps human review distinct", () => {
    const first = judgment();
    expect(() =>
      buildReport(
        [generation()],
        [first, judgment({ id: "j2", meaning: 0 })],
        [],
      ),
    ).toThrow(/Conflicting evaluator judgments/);
    const human: HumanReview = {
      schemaVersion: 1,
      kind: "human",
      reviewSetId: "rs",
      generationId: "g1",
      meaning: 1,
      style: 2,
      tags: [],
      note: "human",
    };
    const result = buildReport([generation()], [first], [human]);
    expect(result.summary.groups[0].humanReviews).toBe(1);
    expect(result.summary.humanAgreement[0]).toMatchObject({
      reviewed: 1,
      resolved: 1,
      meaningAgreement: 0,
      styleAgreement: 1,
    });
    expect(result.markdown).toContain(
      "Human and automated scores are reported separately",
    );
  });

  it("reports evaluator and human comparisons to constructed labels separately", () => {
    const record = generation({
      case: {
        ...generation().case,
        labelSource: "constructed",
        expectedMeaning: 0,
        expectedStyle: 2,
      },
    });
    const machine = judgment({ meaning: 2, style: 1 });
    const human: HumanReview = {
      schemaVersion: 1,
      kind: "human",
      reviewSetId: "human-set",
      generationId: "g1",
      meaning: 0,
      style: 2,
      tags: [],
      note: "",
    };
    const result = buildReport([record], [machine], [human]);
    expect(result.summary.evaluatorValidation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          scorer: "evaluator",
          scorerId: "judge",
          expectedExamples: 1,
          seriousFalseAccepts: 1,
          seriousDenominator: 1,
          styleAgreement: 0,
          styleDenominator: 1,
        }),
        expect.objectContaining({
          scorer: "human",
          scorerId: "human-set",
          expectedExamples: 1,
          seriousFalseAccepts: 0,
          seriousDenominator: 1,
          styleAgreement: 1,
          styleDenominator: 1,
        }),
      ]),
    );
    expect(result.html).toContain("Serious false accepts");
  });

  it("keeps changed configurations separate and leaves an unselected multi-evaluator group unresolved", () => {
    const original = generation({
      case: {
        ...generation().case,
        labelSource: "constructed",
        expectedMeaning: 2,
        expectedStyle: 2,
      },
    });
    const changed = generation({
      id: "g2",
      caseId: "case2",
      config: { ...original.config, reasoning: { effort: "max" } },
    });
    const result = buildReport(
      [original, changed],
      [
        judgment(),
        judgment({
          id: "other-judge",
          generationId: "g1",
          evaluatorId: "other",
        }),
      ],
      [],
    );
    expect(result.summary.groups).toHaveLength(2);
    expect(
      result.summary.groups.reduce(
        (total, group) => total + group.unresolved,
        0,
      ),
    ).toBe(2);
    expect(
      new Set(result.summary.groups.map((group) => group.configHash)).size,
    ).toBe(2);
    expect(
      result.summary.evaluatorValidation.map((item) => item.scorerId).sort(),
    ).toEqual(["judge", "other"]);
  });

  it("escapes HTML and CSV formulas from record fields", () => {
    const record = generation({
      configId: "=1+1",
      caseId: "formula",
      outputText: "<img src=x onerror=alert(1)>",
    });
    const result = buildReport([record], [], []);
    expect(result.html).not.toContain("<img src=x");
    expect(result.html).toContain("&lt;img");
    expect(result.csv).toContain("'=1+1");
  });
});

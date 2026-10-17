import { describe, expect, it } from "vitest";
import {
  loadPublishedInputs,
  parseJsonLines,
  verifyPublishedInputs,
  type PublishedInputs,
} from "../scripts/verify-published-evals";
import { MAX_INPUT_CODE_POINTS } from "../src/lib/limits";

type RecordValue = Record<string, unknown>;
function record(value: unknown): RecordValue {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error("Expected test object");
  return value as RecordValue;
}
function fixture() {
  return loadPublishedInputs();
}
function observation(inputs: PublishedInputs, kind: string): RecordValue {
  return record(
    inputs.observations.find((value) => record(value).kind === kind),
  );
}
function publishedConfig(inputs: PublishedInputs, id: unknown): RecordValue {
  const configs = record(inputs.summary).configurations;
  if (!Array.isArray(configs)) throw new Error("Expected configurations");
  return record(configs.find((value) => record(value).configId === id));
}

describe("published release evidence verification", () => {
  it.each([
    ["unknown source style", (c: RecordValue) => (c.sourceStyle = "unknown")],
    ["unknown target style", (c: RecordValue) => (c.targetStyle = "unknown")],
    ["identical styles", (c: RecordValue) => (c.targetStyle = c.sourceStyle)],
    ["invalid intensity", (c: RecordValue) => (c.intensity = "extreme")],
    ["whitespace-only text", (c: RecordValue) => (c.text = " \n\t ")],
    ["empty required annotations", (c: RecordValue) => (c.mustPreserve = [])],
    [
      "whitespace required annotation",
      (c: RecordValue) => (c.mustNotInvent = [" \t "]),
    ],
    ["non-array preserve tokens", (c: RecordValue) => (c.preserveTokens = "x")],
    [
      "whitespace preserve token",
      (c: RecordValue) => (c.preserveTokens = [" \t "]),
    ],
    ["non-string theme", (c: RecordValue) => (c.themes = [42])],
    ["whitespace theme", (c: RecordValue) => (c.themes = ["  "])],
  ])("rejects release cases with %s", (_name, change) => {
    const inputs = fixture();
    change(record(inputs.dataset[0]));
    expect(() => verifyPublishedInputs(inputs)).toThrow();
  });

  it("accepts empty optional annotation arrays", () => {
    const inputs = fixture();
    record(inputs.dataset[0]).preserveTokens = [];
    record(inputs.dataset[0]).themes = [];
    expect(() => verifyPublishedInputs(inputs)).not.toThrow();
  });

  it.each(["unknown style", "identical styles"])(
    "rejects %s even when aggregate direction coverage stays at twenty",
    (mutation) => {
      const inputs = fixture();
      const cases = inputs.dataset.map(record);
      for (const item of cases) {
        if (mutation === "unknown style") {
          if (item.sourceStyle === "human") item.sourceStyle = "unknown";
          if (item.targetStyle === "human") item.targetStyle = "unknown";
        } else if (
          item.sourceStyle === "human" &&
          item.targetStyle === "linkedin"
        ) {
          item.targetStyle = "human";
        }
      }
      expect(
        new Set(cases.map((item) => `${item.sourceStyle}->${item.targetStyle}`))
          .size,
      ).toBe(20);
      expect(() => verifyPublishedInputs(inputs)).toThrow(
        mutation === "unknown style" ? /Invalid case\./ : /must be distinct/,
      );
    },
  );

  it("enforces the input code-point limit and treats ignored Human intensity as a valid request value", () => {
    const inputs = fixture();
    const humanTarget = inputs.dataset.find(
      (value) => record(value).targetStyle === "human",
    );
    if (!humanTarget) throw new Error("Expected a Human-target release case");
    record(humanTarget).intensity = "maximum";
    record(inputs.dataset[0]).text = "😀".repeat(MAX_INPUT_CODE_POINTS);
    expect(() => verifyPublishedInputs(inputs)).not.toThrow();

    record(inputs.dataset[0]).text = "😀".repeat(MAX_INPUT_CODE_POINTS + 1);
    expect(() => verifyPublishedInputs(inputs)).toThrow(/case.text: exceeds/);
  });

  it.each([undefined, 42, {}])(
    "rejects malformed unresolved error metadata (%s)",
    (errorCode) => {
      const inputs = fixture();
      const unresolved = record(
        inputs.observations.find(
          (value) =>
            record(value).kind === "automated" &&
            record(value).status === "unresolved",
        ),
      );
      unresolved.errorCode = errorCode;
      expect(() => verifyPublishedInputs(inputs)).toThrow(
        /automated.errorCode/,
      );
    },
  );

  it.each([
    "configId",
    "model",
    "reasoning",
    "promptVersion",
    "maxOutputTokens",
  ])("rejects inconsistent recommendation %s", (field) => {
    const inputs = fixture();
    record(record(inputs.summary).recommendation)[field] = "fabricated";
    expect(() => verifyPublishedInputs(inputs)).toThrow();
  });
  it("recomputes the committed comparison while preserving unresolved and separate human labels", () => {
    const inputs = fixture();
    const before = JSON.stringify(inputs);
    const result = verifyPublishedInputs(inputs);
    expect(result.coverage).toMatchObject({
      generationAttempts: 80,
      judgments: 80,
      resolvedJudgments: 79,
      unresolvedJudgments: 1,
    });
    expect(
      result.configurations.map((c) => [
        c.configId,
        c.meaning2,
        c.style2,
        c.numericCriteria.passed,
      ]),
    ).toEqual([
      ["haiku-low", 38, 23, false],
      ["gemini-minimal", 37, 37, true],
    ]);
    expect(result.configurations[0].argonCostUsd).toBeNull();
    expect(result.humanAudit).toMatchObject({
      reviewed: 8,
      meaningAgreement: 7,
      styleAgreement: 4,
      humanMeaning1: 1,
    });
    expect(JSON.stringify(inputs)).toBe(before);
  });

  it.each([
    [
      "duplicate generation id",
      (i: PublishedInputs) =>
        i.observations.push(structuredClone(observation(i, "generation"))),
    ],
    [
      "duplicate observation",
      (i: PublishedInputs) =>
        i.observations.push({
          ...observation(i, "generation"),
          id: "another-id",
        }),
    ],
    [
      "duplicate automated judgment",
      (i: PublishedInputs) =>
        i.observations.push(structuredClone(observation(i, "automated"))),
    ],
    [
      "duplicate human label",
      (i: PublishedInputs) =>
        i.observations.push(structuredClone(observation(i, "human"))),
    ],
    ["missing generation", (i: PublishedInputs) => i.observations.splice(0, 1)],
    [
      "missing automated judgment",
      (i: PublishedInputs) => {
        const n = i.observations.findIndex(
          (r) => record(r).kind === "automated",
        );
        i.observations.splice(n, 1);
      },
    ],
    [
      "broken automated join",
      (i: PublishedInputs) => {
        observation(i, "automated").generationId = "missing";
      },
    ],
    [
      "broken human join",
      (i: PublishedInputs) => {
        observation(i, "human").generationId = "missing";
      },
    ],
    [
      "unknown configuration",
      (i: PublishedInputs) => {
        observation(i, "generation").configId = "other";
      },
    ],
    [
      "unknown case",
      (i: PublishedInputs) => {
        observation(i, "generation").caseId = "other";
      },
    ],
    [
      "configuration drift",
      (i: PublishedInputs) => {
        record(observation(i, "generation").config).model = "other/model";
      },
    ],
    [
      "invalid score",
      (i: PublishedInputs) => {
        observation(i, "automated").meaning = 3;
      },
    ],
    [
      "complete null score",
      (i: PublishedInputs) => {
        observation(i, "automated").meaning = null;
      },
    ],
    [
      "unresolved scored judgment",
      (i: PublishedInputs) => {
        observation(i, "automated").status = "unresolved";
      },
    ],
    [
      "negative cost",
      (i: PublishedInputs) => {
        observation(i, "generation").costUsd = -1;
      },
    ],
    [
      "invalid latency",
      (i: PublishedInputs) => {
        observation(i, "generation").firstContentMs = "100";
      },
    ],
    [
      "missing cost",
      (i: PublishedInputs) => {
        delete observation(i, "generation").costUsd;
      },
    ],
    [
      "wrong count",
      (i: PublishedInputs) => {
        record(record(i.summary).coverage).judgments = 79;
      },
    ],
    [
      "wrong percentile",
      (i: PublishedInputs) => {
        publishedConfig(i, "gemini-minimal").p95FirstContentMs = 999;
      },
    ],
    [
      "wrong cost total",
      (i: PublishedInputs) => {
        publishedConfig(i, "gemini-minimal").generationCostUsd = 0;
      },
    ],
    [
      "wrong release target",
      (i: PublishedInputs) => {
        record(publishedConfig(i, "gemini-minimal").numericCriteria).passed =
          false;
      },
    ],
    [
      "human label overwrite",
      (i: PublishedInputs) => {
        observation(i, "human").style = 1;
      },
    ],
    [
      "wrong human agreement",
      (i: PublishedInputs) => {
        record(record(record(i.summary).humanAudit).summary).meaningAgreement =
          8;
      },
    ],
    [
      "duplicate dataset case",
      (i: PublishedInputs) => {
        i.dataset[1] = structuredClone(i.dataset[0]);
      },
    ],
    [
      "wrong critical coverage",
      (i: PublishedInputs) => {
        record(i.dataset[0]).critical = false;
      },
    ],
    [
      "unknown record kind",
      (i: PublishedInputs) => i.observations.push({ kind: "judgment" }),
    ],
  ])("rejects %s", (_name, change) => {
    const inputs = fixture();
    change(inputs);
    expect(() => verifyPublishedInputs(inputs)).toThrow();
  });

  it("rejects a recommendation that fails recomputed numerical targets", () => {
    const inputs = fixture();
    const recommendation = record(record(inputs.summary).recommendation);
    const manifest = record(inputs.manifest);
    if (!Array.isArray(manifest.configurations))
      throw new Error("Expected manifest configurations");
    const haiku = manifest.configurations
      .map(record)
      .find((config) => config.id === "haiku-low");
    if (!haiku) throw new Error("Expected Haiku finalist configuration");
    recommendation.configId = "haiku-low";
    recommendation.model = haiku.model;
    recommendation.reasoning = haiku.reasoning;
    recommendation.maxOutputTokens = haiku.maxOutputTokens;
    expect(() => verifyPublishedInputs(inputs)).toThrow(
      /does not meet recomputed numerical targets/,
    );
  });

  it("propagates unknown reported generation costs rather than substituting estimates or zero", () => {
    const inputs = fixture();
    const generation = observation(inputs, "generation");
    const originalCost = generation.costUsd as number;
    generation.costUsd = null;
    const costs = record(record(inputs.summary).costs);
    costs.phaseKnownUsd = (costs.phaseKnownUsd as number) - originalCost;
    costs.phaseUnknownSettlements =
      (costs.phaseUnknownSettlements as number) + 1;
    publishedConfig(inputs, generation.configId).generationCostUsd = null;
    expect(
      verifyPublishedInputs(inputs).configurations.find(
        (c) => c.configId === generation.configId,
      )?.generationCostUsd,
    ).toBeNull();
  });

  it("retains missing latency as a reduced coverage denominator", () => {
    const inputs = fixture();
    observation(inputs, "generation").firstContentMs = null;
    // Every derived field must be reconciled; a missing measurement cannot silently keep 40/40 coverage.
    expect(() => verifyPublishedInputs(inputs)).toThrow(/firstContentCoverage/);
  });

  it("identifies malformed JSONL lines and permits blank lines", () => {
    expect(parseJsonLines('\n{"kind":"human"}\n\n', "fixture")).toEqual([
      { kind: "human" },
    ]);
    expect(() => parseJsonLines("{}\n{broken}", "fixture")).toThrow(
      "fixture:2: invalid JSON",
    );
  });
});

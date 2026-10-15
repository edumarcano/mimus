import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type CaseRecord = {
  id: string;
  split: string;
  critical: boolean;
  text: string;
  sourceStyle: string;
  targetStyle: string;
  intensity: string;
  mustPreserve: string[];
  mustNotInvent: string[];
  groupId?: string;
  outputText?: string;
  expectedMeaning?: number;
  expectedStyle?: number;
  labelSource?: string;
  themes?: string[];
};

function readJsonLines<T>(relativePath: string): T[] {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8")
    .trim()
    .split(/\r?\n/)
    .map((line) => JSON.parse(line) as T);
}

describe("benchmark datasets", () => {
  const historical = readJsonLines<CaseRecord>("evals/cases.jsonl");
  const challenge = readJsonLines<CaseRecord>("evals/datasets/evaluator-challenge.jsonl");
  const release = readJsonLines<CaseRecord>("evals/datasets/release-v1.jsonl");
  const screening = JSON.parse(
    readFileSync(resolve(process.cwd(), "evals/datasets/screening.json"), "utf8"),
  ) as string[];

  it("selects 12 unique existing development cases with the required coverage", () => {
    const byId = new Map(historical.map((item) => [item.id, item]));
    expect(screening).toHaveLength(12);
    expect(new Set(screening).size).toBe(12);
    expect(screening.every((id) => byId.get(id)?.split === "development")).toBe(true);
    const themes = screening.flatMap((id) => byId.get(id)?.themes ?? []);
    for (const theme of [
      "short_input",
      "long_input",
      "negation",
      "attribution_uncertainty",
      "numbers",
      "dates",
      "quoted_instruction",
      "prompt_injection",
      "tentative_conditional",
    ]) {
      expect(themes).toContain(theme);
    }
  });

  it("keeps each evaluator challenge pair in one split with constructed reference labels", () => {
    expect(challenge).toHaveLength(40);
    expect(new Set(challenge.map((item) => item.id)).size).toBe(40);
    expect(challenge.map((item) => item.split).filter((split) => split === "calibration")).toHaveLength(24);
    expect(challenge.map((item) => item.split).filter((split) => split === "validation")).toHaveLength(16);
    for (const split of ["calibration","validation"]) {
      expect(challenge.some(c=>c.split === split && c.critical)).toBe(true);
      expect(challenge.some(c=>c.split === split && !c.critical)).toBe(true);
    }

    const groups = new Map<string | undefined, CaseRecord[]>();
    for (const item of challenge) {
      groups.set(item.groupId, [...(groups.get(item.groupId) ?? []), item]);
    }
    expect(groups.size).toBe(20);
    for (const pair of groups.values()) {
      expect(pair).toHaveLength(2);
      expect(new Set(pair.map((item) => item.split)).size).toBe(1);
      expect(new Set(pair.map((item) => item.text)).size).toBe(1);
      expect(pair.every((item) => item.labelSource === "constructed")).toBe(true);
      expect(pair.every((item) => item.sourceStyle !== item.targetStyle)).toBe(true);
      expect(pair.every((item) => item.expectedStyle === 2 && item.outputText)).toBe(true);
      expect(pair.every((item) => item.mustPreserve.length >= 2)).toBe(true);
      expect(pair.every((item) => item.mustPreserve.every((fact) => !/preserve the source/i.test(fact)))).toBe(true);
      expect(pair.every((item) => item.mustNotInvent.every((claim) => !/do not add causes, approvals/i.test(claim)))).toBe(true);
      expect(pair.map((item) => item.expectedMeaning).sort()).toEqual([0, 2]);
      expect(new Set(pair.map((item) => item.outputText)).size).toBe(2);
    }
    const conditionalPair = groups.get("evaluator-pair-03") ?? [];
    expect(conditionalPair.find((item) => item.expectedMeaning === 0)?.outputText)
      .toContain("send the draft now");
    expect(conditionalPair.find((item) => item.expectedMeaning === 2)?.mustPreserve)
      .toContain("Do not send the draft before Lee confirms the address.");
    expect(challenge.some((item) => historical.some((prior) => prior.id === item.id))).toBe(false);
  });

  it("covers all 20 style directions in 40 fresh release cases with ten critical cases", () => {
    expect(release).toHaveLength(40);
    expect(new Set(release.map((item) => item.id)).size).toBe(40);
    expect(release.every((item) => item.split === "release")).toBe(true);
    expect(release.every((item) => item.sourceStyle !== item.targetStyle)).toBe(true);
    expect(release.filter((item) => item.critical)).toHaveLength(10);
    expect(new Set(release.map((item) => `${item.sourceStyle}->${item.targetStyle}`)).size).toBe(20);
    expect(new Set(release.map((item) => item.intensity))).toEqual(
      new Set(["subtle", "balanced", "maximum"]),
    );
    expect(release.every((item) => item.text.length <= 3_000)).toBe(true);
    expect(release.some((item) => item.text.length >= 1_000 && item.themes?.includes("long_input"))).toBe(true);
    expect(release.some((item) => item.text.length <= 60 && item.themes?.includes("short_input"))).toBe(true);
    expect(release.every((item) => item.mustPreserve.length && item.mustNotInvent.length)).toBe(true);
    const firstCase = release.find((item) => item.id === "release-v1-01");
    expect(firstCase?.mustPreserve.join(" ")).toContain("Ari");
    expect(firstCase?.mustPreserve.join(" ")).toContain("Tuesday");
    expect(firstCase?.mustPreserve.join(" ")).toContain("studio");
    expect(firstCase?.mustPreserve.join(" ")).toContain("deposit");
    expect(release.some((item) => historical.some((prior) => prior.text === item.text))).toBe(false);
  });
});

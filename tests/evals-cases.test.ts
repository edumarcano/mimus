import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { INTENSITIES, STYLE_IDS } from "@/lib/styles";

type EvalCase = {
  id: string;
  split: "development" | "holdout";
  critical: boolean;
  text: string;
  sourceStyle: string;
  targetStyle: string;
  intensity: string;
  mustPreserve: string[];
  mustNotInvent: string[];
  preserveTokens?: string[];
  themes?: string[];
};

const REQUIRED_THEMES = [
  "reverse_simplification",
  "short_input",
  "long_input",
  "numbers",
  "dates",
  "negation",
  "tentative_commitment",
  "ambiguous_motive",
  "quoted_instruction",
  "prompt_injection",
  "attribution_uncertainty",
  "tentative_conditional",
  "implied_agreement_discussion",
  "reflective_filler",
] as const;

const DEV_ONLY_THEMES = new Set([
  "attribution_uncertainty",
  "tentative_conditional",
  "implied_agreement_discussion",
  "reflective_filler",
]);

function loadCases(): EvalCase[] {
  const filePath = path.join(process.cwd(), "evals", "cases.jsonl");
  return readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as EvalCase);
}

function pairKey(source: string, target: string): string {
  return `${source}->${target}`;
}

describe("evals/cases.jsonl", () => {
  const cases = loadCases();

  it("has exactly 50 cases with required fields and unique ids", () => {
    expect(cases).toHaveLength(50);
    const ids = new Set<string>();
    for (const item of cases) {
      expect(item.id.length).toBeGreaterThan(0);
      expect(ids.has(item.id)).toBe(false);
      ids.add(item.id);
      expect(item.split === "development" || item.split === "holdout").toBe(
        true,
      );
      expect(typeof item.critical).toBe("boolean");
      expect(item.text.length).toBeGreaterThan(0);
      expect(STYLE_IDS).toContain(item.sourceStyle);
      expect(STYLE_IDS).toContain(item.targetStyle);
      expect(item.sourceStyle).not.toBe(item.targetStyle);
      expect(item.mustPreserve.length).toBeGreaterThan(0);
      expect(item.mustNotInvent.length).toBeGreaterThan(0);
    }
  });

  it("matches split and critical counts", () => {
    expect(cases).toHaveLength(50);
    expect(cases.filter((c) => c.split === "development")).toHaveLength(40);
    expect(cases.filter((c) => c.split === "holdout")).toHaveLength(10);
    expect(cases.filter((c) => c.critical)).toHaveLength(10);
  });

  it("keeps fresh holdout texts distinct from every development text", () => {
    const devTexts = new Set(
      cases.filter((c) => c.split === "development").map((c) => c.text),
    );
    for (const holdout of cases.filter((c) => c.split === "holdout")) {
      expect(devTexts.has(holdout.text)).toBe(false);
    }
  });

  it("covers all 20 distinct style pairs", () => {
    const seen = new Set<string>();
    for (const item of cases) {
      seen.add(pairKey(item.sourceStyle, item.targetStyle));
    }
    expect(seen.size).toBe(20);
  });

  it("uses only valid intensity values", () => {
    for (const item of cases) {
      expect(INTENSITIES as readonly string[]).toContain(item.intensity);
    }
  });

  it("gives pair-coverage cases distinct passages", () => {
    const pairCases = cases.filter((item) => item.id.startsWith("dev-pair-"));
    expect(pairCases).toHaveLength(20);
    const uniqueTexts = new Set(pairCases.map((item) => item.text));
    expect(uniqueTexts.size).toBe(20);
  });

  it("includes subtle, balanced, and maximum on non-Human targets", () => {
    const intensities = new Set<string>();
    for (const item of cases) {
      if (item.targetStyle !== "human") {
        intensities.add(item.intensity);
      }
    }
    expect(intensities.has("subtle")).toBe(true);
    expect(intensities.has("balanced")).toBe(true);
    expect(intensities.has("maximum")).toBe(true);
  });

  it("declares coverage themes and keeps Oct 6 phenomena on development", () => {
    const themeToSplit = new Map<string, Set<string>>();
    for (const item of cases) {
      for (const theme of item.themes ?? []) {
        if (!themeToSplit.has(theme)) {
          themeToSplit.set(theme, new Set());
        }
        themeToSplit.get(theme)!.add(item.split);
      }
    }

    for (const theme of REQUIRED_THEMES) {
      expect(themeToSplit.has(theme)).toBe(true);
    }

    for (const theme of DEV_ONLY_THEMES) {
      const splits = themeToSplit.get(theme);
      expect(splits?.has("development")).toBe(true);
      expect(splits?.has("holdout")).toBe(false);
    }
  });
});

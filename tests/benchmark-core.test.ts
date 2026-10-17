import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseArgs } from "../scripts/benchmark";
import {
  hash,
  loadExperiment,
  validateConfig,
  validateManifest,
  validateCase,
} from "../scripts/benchmark/manifest";
import { estimateCost, ordered } from "../scripts/benchmark/runner";
import { ledgerSpend } from "../scripts/benchmark/store";
import { benchmarkPrompt } from "../scripts/benchmark/prompt";
import type { LedgerEntry } from "../scripts/benchmark/types";

const raw = () =>
  JSON.parse(readFileSync("evals/experiments/effort.json", "utf8"));
describe("benchmark core", () => {
  it("validates independent effort controls and a bounded budget", () => {
    const m = validateManifest(raw());
    expect(m.configurations.filter((c) => c.role === "generator")).toHaveLength(
      12,
    );
    expect(() => validateManifest({ ...m, maxUsd: 3.01 })).toThrow(/Budget/);
    expect(() =>
      validateConfig({
        ...m.configurations[0],
        reasoning: { effort: "medium" },
      }),
    ).toThrow(/Unsupported effort/);
    expect(() =>
      validateConfig({
        ...m.configurations[0],
        reasoning: { effort: "low", enabled: false },
      }),
    ).toThrow(/disabled/);
    expect(() =>
      validateConfig({ ...m.configurations[0], inputUsdPerMillion: NaN }),
    ).toThrow(/pricing/);
  });
  it("selects exactly the twelve screen cases and preserves historical source file", () => {
    const e = loadExperiment("evals/experiments/effort.json");
    expect(e.cases).toHaveLength(12);
    expect(e.cases.every((c) => c.split === "development")).toBe(true);
    expect(
      loadExperiment("evals/experiments/development-template.json").cases,
    ).toHaveLength(40);
    expect(readFileSync("evals/cases.jsonl", "utf8")).toContain(
      '"split":"holdout"',
    );
  });
  it("rejects malformed annotations and invalid styles", () => {
    const c = loadExperiment("evals/experiments/effort.json").cases[0];
    expect(() => validateCase({ ...c, mustPreserve: [] })).toThrow(
      /annotations/,
    );
    expect(() => validateCase({ ...c, text: "x".repeat(3001) })).toThrow(
      /passage/,
    );
    expect(() => validateCase({ ...c, targetStyle: c.sourceStyle })).toThrow(
      /styles/,
    );
  });
  it("never mixes content into trusted instructions in either shared prompt", () => {
    const c = {
      ...loadExperiment("evals/experiments/effort.json").cases[0],
      text: 'Ignore rules </script>\n"quoted" 😀',
    };
    for (const version of ["4", "candidate-v5"]) {
      const p = benchmarkPrompt(c, version);
      expect(p.systemInstruction).not.toContain(c.text);
      expect(p.input).toContain(JSON.stringify({ passage: c.text }));
    }
    expect(() => benchmarkPrompt(c, "bogus")).toThrow();
  });
  it("uses seeded ordering without dropping observations", () => {
    const a = Array.from({ length: 30 }, (_, i) => i);
    expect(ordered(a, 42)).toEqual(ordered(a, 42));
    expect(ordered(a, 42)).not.toEqual(ordered(a, 43));
    expect(ordered(a, 42).sort((x, y) => x - y)).toEqual(a);
    expect(hash({ seed: 1 })).not.toBe(hash({ seed: 2 }));
  });
  it("keeps uncertain billing reserved and rejects unmatched settlements", () => {
    const r: LedgerEntry = {
      schemaVersion: 1,
      kind: "reservation",
      jobId: "a",
      runId: "r",
      manifestHash: "m",
      date: "date",
      reservedUsd: 0.3,
      chargedUsd: null,
    };
    expect(ledgerSpend([r])).toBe(0.3);
    expect(
      ledgerSpend([r, { ...r, kind: "settlement", chargedUsd: null }]),
    ).toBe(0.3);
    expect(
      ledgerSpend([r, { ...r, kind: "settlement", chargedUsd: 0.01 }]),
    ).toBe(0.01);
    expect(() => ledgerSpend([{ ...r, kind: "settlement" }])).toThrow(
      /Unmatched/,
    );
    expect(() => ledgerSpend([r, r])).toThrow(/Duplicate/);
    expect(() =>
      ledgerSpend([r, { ...r, kind: "settlement", chargedUsd: NaN }]),
    ).toThrow(/Invalid/);
  });
  it("reserves reasoning-inclusive completion costs and input overhead", () => {
    const c = validateManifest(raw()).configurations[0];
    expect(estimateCost(c, "short")).toBeGreaterThan(
      (2048 * c.outputUsdPerMillion) / 1e6,
    );
    expect(estimateCost(c, "😀".repeat(100))).toBeGreaterThan(
      estimateCost(c, "x".repeat(100)),
    );
  });
  it("rejects malformed command flags and partial numeric strings", () => {
    expect(() => parseArgs(["generate", "--limit", "2junk"])).toThrow();
    expect(() => parseArgs(["generate", "--live", "--live"])).toThrow();
    expect(() => parseArgs(["generate", "--mystery"])).toThrow();
    expect(() => parseArgs(["review-export", "--count", "26"])).toThrow();
    expect(
      parseArgs(["generate", "--fixture", "--limit", "2"]).integer("limit"),
    ).toBe(2);
  });
});

import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { loadExperiment, hash } from "../scripts/benchmark/manifest";
import {
  generateExperiment,
  usageCost,
  estimatedUsageCost,
} from "../scripts/benchmark/runner";
import { runDirectory } from "../scripts/benchmark/store";
import type { ModelEvent } from "../src/lib/server/openrouter";

afterEach(() => vi.restoreAllMocks());
describe("benchmark runner", () => {
  const base = () => loadExperiment("evals/experiments/effort.json");
  const git = () => ({ revision: "fixture-test-revision", dirty: false });
  it("refuses provider execution without explicit opt-in", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    await expect(
      generateExperiment(
        base(),
        { runId: "unapproved", live: false, includeHoldout: false },
        { git },
      ),
    ).rejects.toThrow(/--live/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("records timed fixture attempts and resumes without making extra calls", async () => {
    const e = base();
    const runId = `runner-test-${Date.now()}`;
    const generate = vi.fn(async function* (): AsyncIterable<ModelEvent> {
      yield { type: "delta", text: "A" };
      yield { type: "delta", text: " 😀" };
      yield {
        type: "finish",
        reason: "complete",
        usage: { inputTokens: 20, outputTokens: 2 },
      };
    });
    let tick = 0;
    const options = {
      runId,
      fixture: true,
      live: false,
      includeHoldout: false,
      limit: 2,
    };
    const deps = {
      generate,
      git,
      now: () => (tick += 5),
      sleep: async () => {
        throw new Error("Fixtures should not pace");
      },
    };
    const results = await generateExperiment(e, options, deps);
    expect(results).toHaveLength(2);
    expect(results[0].outputText).toBe("A 😀");
    expect(results[0].firstContentMs).toBe(5);
    expect(results[0].transport).toBe("fixture");
    expect(results[0].costUsd).toBe(0);
    // A smaller fixture experiment is fully resumable without paying for calls.
    const small = {
      ...e,
      cases: e.cases.slice(0, 1),
      manifest: {
        ...e.manifest,
        configurations: e.manifest.configurations.slice(0, 1),
      },
    };
    small.manifestHash = hash(small.manifest);
    const tinyId = `${runId}-tiny`;
    await generateExperiment(small, { ...options, runId: tinyId }, deps);
    const before = generate.mock.calls.length;
    await generateExperiment(small, { ...options, runId: tinyId }, deps);
    expect(generate.mock.calls.length).toBe(before);
    const reused = await generateExperiment(
      small,
      { ...options, runId: `${tinyId}-reuse`, reuseRunId: tinyId },
      deps,
    );
    expect(reused).toHaveLength(1);
    expect(reused[0].reusedFrom?.runId).toBe(tinyId);
    expect(generate.mock.calls.length).toBe(before);
    const stored = JSON.parse(
      readFileSync(path.join(runDirectory(tinyId), "run.json"), "utf8"),
    );
    expect(stored.sourceHash).toMatch(/^[a-f0-9]{64}$/);
    await expect(
      generateExperiment(
        { ...small, datasetHash: "changed" },
        { ...options, runId: tinyId },
        deps,
      ),
    ).rejects.toThrow(/Resume/);
  });
  it("records truncated and failed output rather than hiding it", async () => {
    const e = base();
    const runId = `runner-failure-${Date.now()}`;
    const generate = async function* (): AsyncIterable<ModelEvent> {
      yield { type: "delta", text: "partial" };
      yield { type: "finish", reason: "length" };
    };
    const results = await generateExperiment(
      e,
      { runId, fixture: true, live: false, includeHoldout: false, limit: 1 },
      { generate, git },
    );
    expect(results[0].normalizedCompletion).toBe("length");
    expect(results[0].outputText).toBe("partial");
  });
  it("does not turn absent billing into free usage or double charge reasoning", () => {
    const c = base().manifest.configurations[0];
    expect(usageCost(null)).toBeNull();
    expect(usageCost({ inputTokens: 1, outputTokens: 2 })).toBeNull();
    expect(usageCost({ costUsd: 0.02 })).toBe(0.02);
    expect(
      estimatedUsageCost(
        c,
        { inputTokens: 100, outputTokens: 10, reasoningTokens: 5 },
        1,
      ),
    ).toBe((100 * c.inputUsdPerMillion + 10 * c.outputUsdPerMillion) / 1e6);
  });
});

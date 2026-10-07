import { describe, expect, it, vi } from "vitest";

import {
  parseEvalArgs,
  providerCallRefusal,
} from "../scripts/evaluate-cli";
import type { ModelEvent } from "@/lib/server/gemini";
import { REQUEST_INTERVAL_MS, runEvaluation } from "../scripts/evaluate";

describe("evaluate CLI helpers", () => {
  it("defaults split to development", () => {
    expect(parseEvalArgs([]).split).toBe("development");
    expect(parseEvalArgs([]).live).toBe(false);
  });

  it("refuses holdout without --include-holdout", () => {
    expect(
      providerCallRefusal({
        live: true,
        split: "holdout",
        includeHoldout: false,
      }),
    ).toBe("holdout");
    expect(
      providerCallRefusal({
        live: true,
        split: "all",
        includeHoldout: false,
      }),
    ).toBe("holdout");
  });

  it("rejects invalid --split before any adapter call", async () => {
    const streamRewrite = vi.fn(async function* (): AsyncIterable<ModelEvent> {
      yield { type: "delta", text: "nope" };
    });
    const code = await runEvaluation(["--live", "--split", "bogus"], {
      streamRewrite,
    });
    expect(code).toBe(1);
    expect(streamRewrite).not.toHaveBeenCalled();
  });

  it("rejects invalid --limit before any adapter call", async () => {
    const streamRewrite = vi.fn(async function* (): AsyncIterable<ModelEvent> {
      yield { type: "delta", text: "nope" };
    });
    const code = await runEvaluation(["--live", "--limit", "0"], {
      streamRewrite,
    });
    expect(code).toBe(1);
    expect(streamRewrite).not.toHaveBeenCalled();
  });

  it("missing --live does not call a fake adapter", async () => {
    const streamRewrite = vi.fn(async function* (): AsyncIterable<ModelEvent> {
      yield { type: "delta", text: "nope" };
    });
    const code = await runEvaluation([], { streamRewrite });
    expect(code).toBe(1);
    expect(streamRewrite).not.toHaveBeenCalled();
  });

  it("paces sequential live requests below the provider rate limit", async () => {
    const streamRewrite = vi.fn(async function* (): AsyncIterable<ModelEvent> {
      yield { type: "delta", text: "ok" };
      yield { type: "finish", reason: "complete" };
    });
    const sleeps: number[] = [];
    const code = await runEvaluation(["--live", "--limit", "2"], {
      streamRewrite,
      sleep: async (ms) => {
        sleeps.push(ms);
      },
      gitRevision: () => "test",
      gitPorcelain: () => "",
      readGenaiVersion: () => "test",
      writeRaw: () => {},
    });
    expect(code).toBe(0);
    expect(streamRewrite).toHaveBeenCalledTimes(2);
    // Spacing applies between requests, not before the first.
    expect(sleeps).toEqual([REQUEST_INTERVAL_MS]);
  });
});

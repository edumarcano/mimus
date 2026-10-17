import { describe, expect, it, vi } from "vitest";

import { parseEvalArgs, providerCallRefusal } from "../scripts/evaluate-cli";
import type { ModelEvent } from "@/lib/server/openrouter";
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

  it.each([
    ["unknown option", ["--live", "--limti", "5"]],
    ["unexpected positional argument", ["--live", "extra"]],
    ["malformed limit", ["--live", "--limit", "5oops"]],
    ["decimal limit", ["--live", "--limit", "1.5"]],
    ["unsafe integer limit", ["--live", "--limit", "9007199254740992"]],
    ["repeated flag", ["--live", "--live"]],
    ["repeated value option", ["--live", "--limit", "1", "--limit", "2"]],
  ])("rejects %s before any adapter call", async (_description, argv) => {
    const streamRewrite = vi.fn(async function* (): AsyncIterable<ModelEvent> {
      yield { type: "delta", text: "nope" };
    });
    const code = await runEvaluation(argv, { streamRewrite });
    expect(code).toBe(1);
    expect(parseEvalArgs(argv).parseError).toBeDefined();
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

  it("rejects unmatched --ids before any adapter call", async () => {
    const streamRewrite = vi.fn(async function* (): AsyncIterable<ModelEvent> {
      yield { type: "delta", text: "nope" };
    });
    const code = await runEvaluation(["--live", "--ids", "no-such-case"], {
      streamRewrite,
    });
    expect(code).toBe(1);
    expect(streamRewrite).not.toHaveBeenCalled();
  });

  it("rejects every unmatched id before a limit can hide it or call the adapter", async () => {
    const streamRewrite = vi.fn(async function* (): AsyncIterable<ModelEvent> {
      yield { type: "delta", text: "nope" };
    });
    const code = await runEvaluation(
      ["--live", "--ids", "dev-negation-01,no-such-case", "--limit", "1"],
      { streamRewrite },
    );
    expect(code).toBe(1);
    expect(streamRewrite).not.toHaveBeenCalled();
  });

  it("rejects an id outside the selected split before any adapter call", async () => {
    const streamRewrite = vi.fn(async function* (): AsyncIterable<ModelEvent> {
      yield { type: "delta", text: "nope" };
    });
    const code = await runEvaluation(
      ["--live", "--split", "development", "--ids", "holdout2-injection-memo"],
      { streamRewrite },
    );
    expect(code).toBe(1);
    expect(streamRewrite).not.toHaveBeenCalled();
  });

  it("rejects an empty --ids value before any adapter call", async () => {
    const streamRewrite = vi.fn(async function* (): AsyncIterable<ModelEvent> {
      yield { type: "delta", text: "nope" };
    });
    const code = await runEvaluation(["--live", "--ids", " , "], {
      streamRewrite,
    });
    expect(code).toBe(1);
    expect(streamRewrite).not.toHaveBeenCalled();
  });

  it("runs only the requested case ids", async () => {
    const streamRewrite = vi.fn(async function* (): AsyncIterable<ModelEvent> {
      yield { type: "delta", text: "ok" };
      yield { type: "finish", reason: "complete" };
    });
    const writes: string[] = [];
    const code = await runEvaluation(
      ["--live", "--ids", "dev-negation-01,dev-inject-01"],
      {
        streamRewrite,
        gitRevision: () => "test",
        gitPorcelain: () => "",
        readTransport: () => "test-transport",
        writeRaw: (_filePath, line) => {
          writes.push(line);
        },
      },
    );
    expect(code).toBe(0);
    expect(streamRewrite).toHaveBeenCalledTimes(2);
    expect(writes).toHaveLength(2);
    expect(JSON.parse(writes[0]!).caseId).toBe("dev-negation-01");
    expect(JSON.parse(writes[1]!).caseId).toBe("dev-inject-01");
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
      readTransport: () => "test-transport",
      writeRaw: () => {},
    });
    expect(code).toBe(0);
    expect(streamRewrite).toHaveBeenCalledTimes(2);
    // Spacing applies between requests, not before the first.
    expect(sleeps).toEqual([REQUEST_INTERVAL_MS]);
  });

  it("keeps a valid positive limit applied to the selected split", async () => {
    const streamRewrite = vi.fn(async function* (): AsyncIterable<ModelEvent> {
      yield { type: "delta", text: "ok" };
      yield { type: "finish", reason: "complete" };
    });
    const writes: string[] = [];
    const code = await runEvaluation(["--live", "--limit", "1"], {
      streamRewrite,
      gitRevision: () => "test",
      gitPorcelain: () => "",
      readTransport: () => "test-transport",
      writeRaw: (_filePath, line) => {
        writes.push(line);
      },
    });
    expect(code).toBe(0);
    expect(streamRewrite).toHaveBeenCalledTimes(1);
    expect(JSON.parse(writes[0]!).caseId).toBe("dev-negation-01");
  });
});

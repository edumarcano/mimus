import { afterEach, describe, expect, it, vi } from "vitest";
import { streamRewriteWithConfig } from "@/lib/server/openrouter";

function sse(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("streamRewriteWithConfig", () => {
  it("applies explicitly supplied provider preferences", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: sse(["data: [DONE]\n\n"]),
    });
    vi.stubGlobal("fetch", fetchMock);

    for await (const _event of streamRewriteWithConfig(
      { systemInstruction: "system", input: "text" },
      new AbortController().signal,
      {
        model: "google/gemini-3.5-flash-lite",
        maxOutputTokens: 2_048,
        reasoning: { effort: "minimal" },
        providerPreferences: {
          only: ["google-vertex"],
          dataCollection: "deny",
          zdr: false,
          requireParameters: true,
        },
      },
      "live-key",
    ))
      void _event;

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).provider).toEqual({
      only: ["google-vertex"],
      data_collection: "deny",
      zdr: false,
      require_parameters: true,
    });
  });

  it("uses the supplied config and exposes only non-content finish metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      body: sse([
        'data: {"id":"gen-1","provider":"Provider A","choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"finish_reason":"stop"}],"usage":{"prompt_tokens":4,"completion_tokens":8,"completion_tokens_details":{"reasoning_tokens":3},"cost":0.0002}}\n\n',
        "data: [DONE]\n\n",
      ]),
    });
    vi.stubGlobal("fetch", fetchMock);
    const signal = new AbortController().signal;
    const events = [];
    for await (const event of streamRewriteWithConfig(
      { systemInstruction: "system", input: "text" },
      signal,
      {
        model: "vendor/model",
        maxOutputTokens: 77,
        reasoning: { effort: "medium" },
      },
      "benchmark-key",
    ))
      events.push(event);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init.signal).toBe(signal);
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer benchmark-key",
    );
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("vendor/model");
    expect(body.max_tokens).toBe(77);
    expect(body.reasoning).toEqual({ effort: "medium" });
    expect(body.provider).toEqual({
      data_collection: "deny",
      zdr: true,
      require_parameters: true,
    });
    expect(events).toEqual([
      { type: "delta", text: "Hello" },
      {
        type: "finish",
        reason: "complete",
        usage: {
          inputTokens: 4,
          outputTokens: 8,
          reasoningTokens: 3,
          costUsd: 0.0002,
        },
        provider: "Provider A",
        providerGenerationId: "gen-1",
      },
    ]);
  });

  it("does not add absent usage metadata to the finish event", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        body: sse([
          'data: {"choices":[{"finish_reason":"stop"}]}\n\n',
          "data: [DONE]\n\n",
        ]),
      }),
    );
    const events = [];
    for await (const event of streamRewriteWithConfig(
      { systemInstruction: "s", input: "i" },
      new AbortController().signal,
      { model: "m", maxOutputTokens: 4, reasoning: { enabled: false } },
      "key",
    ))
      events.push(event);
    expect(events).toEqual([{ type: "finish", reason: "complete" }]);
  });

  it("maps an already-aborted request through the transport error boundary", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    controller.abort();
    await expect(async () => {
      for await (const _event of streamRewriteWithConfig(
        { systemInstruction: "s", input: "i" },
        controller.signal,
        { model: "m", maxOutputTokens: 4, reasoning: {} },
        "key",
      ))
        void _event;
    }).rejects.toMatchObject({ code: "UPSTREAM_TIMEOUT" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

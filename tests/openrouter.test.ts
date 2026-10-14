import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MODEL_CONFIG } from "@/lib/server/model-config";
import { ERROR_MESSAGES } from "@/lib/server/errors";
import { streamRewrite } from "@/lib/server/openrouter";

const ENV_KEYS = [
  "OPENROUTER_API_KEY",
  "MIMUS_MODE",
  "APP_ORIGIN",
  "MIMUS_LIVE_COUNTRIES",
] as const;

let savedEnv: Record<string, string | undefined> = {};
let fetchMock: ReturnType<typeof vi.fn>;

function sseBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

function mockFetchResponse(options: {
  status?: number;
  chunks?: string[];
  rejectWith?: unknown;
}) {
  if (options.rejectWith !== undefined) {
    fetchMock.mockRejectedValueOnce(options.rejectWith);
    return;
  }
  const status = options.status ?? 200;
  fetchMock.mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    body:
      options.chunks !== undefined ? sseBody(options.chunks) : null,
  });
}

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
  process.env.OPENROUTER_API_KEY = "test-key";
  process.env.MIMUS_MODE = "live";
  process.env.APP_ORIGIN = "http://localhost:3000";
  process.env.MIMUS_LIVE_COUNTRIES = "US";
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = savedEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  vi.unstubAllGlobals();
});

async function collectEvents(
  signal: AbortSignal = new AbortController().signal,
) {
  const events = [];
  for await (const event of streamRewrite(
    { systemInstruction: "sys", input: "user" },
    signal,
  )) {
    events.push(event);
  }
  return events;
}

describe("streamRewrite", () => {
  it("calls OpenRouter chat completions once with the migration body", async () => {
    mockFetchResponse({
      chunks: [
        'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":5}}\n\n',
        "data: [DONE]\n\n",
      ],
    });

    const signal = new AbortController().signal;
    const events = await collectEvents(signal);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.signal).toBe(signal);
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer test-key");
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["HTTP-Referer"]).toBeUndefined();
    expect(headers["X-Title"]).toBeUndefined();

    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.model).toBe(MODEL_CONFIG.model);
    expect(body.messages).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "user" },
    ]);
    expect(body.max_tokens).toBe(MODEL_CONFIG.maxOutputTokens);
    expect(body.reasoning).toEqual({ effort: MODEL_CONFIG.reasoningEffort });
    expect(body.provider).toEqual({
      data_collection: MODEL_CONFIG.dataCollection,
      zdr: MODEL_CONFIG.zdr,
      require_parameters: true,
    });
    expect(body.require_parameters).toBeUndefined();
    expect(body.stream).toBe(true);
    expect(body.stream_options).toEqual({ include_usage: true });
    expect(body.tools).toBeUndefined();
    expect(body.plugins).toBeUndefined();
    expect(body.temperature).toBeUndefined();
    expect(body.top_p).toBeUndefined();

    expect(events).toEqual([
      { type: "delta", text: "Hello" },
      {
        type: "finish",
        reason: "complete",
        usage: { inputTokens: 3, outputTokens: 5 },
      },
    ]);
  });

  it("defers finish until [DONE] and merges usage from a later chunk", async () => {
    mockFetchResponse({
      chunks: [
        'data: {"choices":[{"delta":{"content":"Hello"},"finish_reason":null}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
        'data: {"choices":[{"delta":{"content":""},"finish_reason":"stop"}],"usage":{"prompt_tokens":11,"completion_tokens":22}}\n\n',
        "data: [DONE]\n\n",
      ],
    });

    const events = await collectEvents();
    expect(events).toEqual([
      { type: "delta", text: "Hello" },
      {
        type: "finish",
        reason: "complete",
        usage: { inputTokens: 11, outputTokens: 22 },
      },
    ]);
  });

  it("drops reasoning deltas and forwards content", async () => {
    mockFetchResponse({
      chunks: [
        'data: {"choices":[{"delta":{"reasoning":"hidden","reasoning_content":"also hidden","content":""},"finish_reason":null}]}\n\n',
        'data: {"choices":[{"delta":{"content":"Visible"},"finish_reason":null}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
        "data: [DONE]\n\n",
      ],
    });

    const events = await collectEvents();
    expect(events.filter((e) => e.type === "delta")).toEqual([
      { type: "delta", text: "Visible" },
    ]);
  });

  it("maps finish_reason values", async () => {
    const cases: Array<{
      reason: string;
      expected: "complete" | "blocked" | "length" | "other";
    }> = [
      { reason: "stop", expected: "complete" },
      { reason: "length", expected: "length" },
      { reason: "content_filter", expected: "blocked" },
      { reason: "error", expected: "other" },
    ];

    for (const { reason, expected } of cases) {
      fetchMock.mockReset();
      mockFetchResponse({
        chunks: [
          `data: {"choices":[{"delta":{},"finish_reason":"${reason}"}]}\n\n`,
          "data: [DONE]\n\n",
        ],
      });
      const events = await collectEvents();
      expect(events[0]).toEqual({
        type: "finish",
        reason: expected,
        usage: undefined,
      });
    }
  });

  it("does not emit finish when finish_reason is null", async () => {
    mockFetchResponse({
      chunks: [
        'data: {"choices":[{"delta":{"content":"partial"},"finish_reason":null}]}\n\n',
      ],
    });

    const events = await collectEvents();
    expect(events).toEqual([{ type: "delta", text: "partial" }]);
  });

  it("ignores SSE comment lines and stops on [DONE]", async () => {
    mockFetchResponse({
      chunks: [
        ": keep-alive\n\n",
        'data: {"choices":[{"delta":{"content":"x"},"finish_reason":null}]}\n\n',
        "data: [DONE]\n\n",
        'data: {"choices":[{"delta":{"content":"late"},"finish_reason":null}]}\n\n',
      ],
    });

    const events = await collectEvents();
    expect(events).toEqual([{ type: "delta", text: "x" }]);
  });

  it("maps HTTP 402 and 429 to SERVICE_QUOTA_EXHAUSTED", async () => {
    for (const status of [402, 429]) {
      fetchMock.mockReset();
      mockFetchResponse({ status });
      await expect(collectEvents()).rejects.toMatchObject({
        code: "SERVICE_QUOTA_EXHAUSTED",
        message: ERROR_MESSAGES.SERVICE_QUOTA_EXHAUSTED,
      });
    }
  });

  it("maps HTTP 401, 403, 404, and 500 to SERVICE_UNAVAILABLE", async () => {
    // 401: revoked or invalid key. 403: provider or budget block. All fail closed.
    for (const status of [401, 403, 404, 500]) {
      fetchMock.mockReset();
      mockFetchResponse({ status });
      await expect(collectEvents()).rejects.toMatchObject({
        code: "SERVICE_UNAVAILABLE",
        message: ERROR_MESSAGES.SERVICE_UNAVAILABLE,
      });
    }
  });

  it("does not yield finish after abort mid-stream", async () => {
    const controller = new AbortController();
    let pulled = false;
    const encoder = new TextEncoder();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      body: new ReadableStream({
        pull(ctrl) {
          if (!pulled) {
            pulled = true;
            ctrl.enqueue(
              encoder.encode(
                'data: {"choices":[{"delta":{"content":"part"},"finish_reason":null}]}\n\n' +
                  'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
              ),
            );
            return;
          }
          return new Promise<void>(() => {});
        },
      }),
    });

    const events: Array<{ type: string; text?: string }> = [];
    await expect(async () => {
      for await (const event of streamRewrite(
        { systemInstruction: "s", input: "u" },
        controller.signal,
      )) {
        events.push(event);
        controller.abort();
      }
    }).rejects.toMatchObject({ code: "UPSTREAM_TIMEOUT" });

    expect(events).toEqual([{ type: "delta", text: "part" }]);
    expect(events.some((e) => e.type === "finish")).toBe(false);
  });

  it("maps abort to UPSTREAM_TIMEOUT", async () => {
    const controller = new AbortController();
    fetchMock.mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            const error = new Error("Aborted");
            error.name = "AbortError";
            reject(error);
          });
          controller.abort();
        }),
    );

    await expect(
      collectEvents(controller.signal),
    ).rejects.toMatchObject({
      code: "UPSTREAM_TIMEOUT",
    });
  });

  it("throws SERVICE_UNAVAILABLE without calling fetch when the key is missing", async () => {
    delete process.env.OPENROUTER_API_KEY;
    await expect(collectEvents()).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not leak malformed SSE in the thrown error message", async () => {
    const secretPayload = "super-secret-provider-body-xyz";
    mockFetchResponse({
      chunks: [`data: ${secretPayload}\n\n`],
    });

    await expect(collectEvents()).rejects.toSatisfy((error: Error) => {
      expect(error.message).toBe(ERROR_MESSAGES.SERVICE_UNAVAILABLE);
      expect(error.message).not.toContain(secretPayload);
      return true;
    });
  });

  it("throws SERVICE_UNAVAILABLE when choice.error is present", async () => {
    mockFetchResponse({
      chunks: [
        'data: {"choices":[{"error":{"message":"provider failure"},"finish_reason":null}]}\n\n',
        "data: [DONE]\n\n",
      ],
    });

    await expect(collectEvents()).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
  });
});

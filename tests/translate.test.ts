import { afterEach, describe, expect, it, vi } from "vitest";
import { ERROR_STATUS } from "@/lib/server/errors";
import { NOTICE_VERSION } from "@/lib/notice";
import { MAX_OUTPUT_CODE_POINTS } from "@/lib/limits";
import type { ServerConfig } from "@/lib/server/config";
import type { ModelEvent } from "@/lib/server/openrouter";
import { AppError } from "@/lib/server/errors";
import { createTranslateHandler } from "@/lib/server/translate";
import { SseStreamParser } from "@/lib/stream";

const ENV_KEYS = [
  "MIMUS_MODE",
  "OPENROUTER_API_KEY",
  "APP_ORIGIN",
  "MIMUS_LIVE_COUNTRIES",
  "MIMUS_DEV_ALLOW_LOCAL_LIVE",
] as const;

const envSnapshot = (): Record<string, string | undefined> => {
  const out: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) {
    out[key] = process.env[key];
  }
  return out;
};

let savedEnv = envSnapshot();

const liveConfig: ServerConfig = {
  mode: "live",
  isLive: true,
  configError: false,
  openrouterApiKey: "key",
  appOrigin: "http://localhost:3000",
  liveCountries: ["US"],
  devAllowLocalLive: true,
};

function resetEnv(overrides: Record<string, string | undefined>) {
  savedEnv = envSnapshot();
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
  Object.assign(process.env, overrides);
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    text: "Hello from human voice.",
    sourceStyle: "human",
    targetStyle: "linkedin",
    intensity: "balanced",
    eligibilityConfirmed: true,
    privacyNoticeVersion: NOTICE_VERSION,
    ...overrides,
  };
}

function postRequest(
  body: unknown,
  init: RequestInit & { signal?: AbortSignal } = {},
): Request {
  return new Request("http://localhost:3000/api/translate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:3000",
      "x-vercel-ip-country": "US",
      ...(init.headers ?? {}),
    },
    body: JSON.stringify(body),
    signal: init.signal,
  });
}

async function collectSse(response: Response): Promise<string[]> {
  const parser = new SseStreamParser();
  const events: string[] = [];
  const reader = response.body!.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    for (const parsed of parser.push(value)) {
      events.push(parsed.event);
    }
  }
  return events;
}

function adapterFrom(
  events: ModelEvent[],
  onSignal?: (signal: AbortSignal) => void,
) {
  return async function* (_req: unknown, signal: AbortSignal) {
    onSignal?.(signal);
    for (const event of events) {
      if (signal.aborted) {
        return;
      }
      yield event;
    }
  };
}

describe("createTranslateHandler", () => {
  afterEach(() => {
    vi.useRealTimers();
    for (const key of ENV_KEYS) {
      const value = savedEnv[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it("does not call adapter when validation fails", async () => {
    const adapter = vi.fn(adapterFrom([]));
    const handler = createTranslateHandler({
      getConfig: () => liveConfig,
      adapter,
    });

    const response = await handler(
      postRequest(validBody({ eligibilityConfirmed: false })),
    );
    expect(response.status).toBe(403);
    expect(adapter).not.toHaveBeenCalled();
  });

  it("returns 503 in demo mode without calling adapter", async () => {
    const adapter = vi.fn(adapterFrom([]));
    const handler = createTranslateHandler({
      getConfig: () => ({ ...liveConfig, isLive: false, mode: "demo" }),
      adapter,
    });
    const response = await handler(postRequest(validBody()));
    expect(response.status).toBe(503);
    expect(adapter).not.toHaveBeenCalled();
  });

  it("returns 413 while reading an oversize chunked body", async () => {
    const adapter = vi.fn(adapterFrom([]));
    const handler = createTranslateHandler({
      getConfig: () => liveConfig,
      adapter,
    });

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(9000));
        controller.enqueue(new Uint8Array(9000));
        controller.close();
      },
    });

    const response = await handler(
      new Request("http://localhost:3000/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost:3000",
        },
        body: stream,
        duplex: "half",
      } as RequestInit),
    );

    expect(response.status).toBe(413);
    expect(adapter).not.toHaveBeenCalled();
  });

  it("streams meta, delta, and done on success", async () => {
    const handler = createTranslateHandler({
      getConfig: () => liveConfig,
      adapter: adapterFrom([
        { type: "delta", text: "Rewritten " },
        { type: "delta", text: "text." },
        { type: "finish", reason: "complete" },
      ]),
    });

    const response = await handler(
      postRequest(validBody(), {
        headers: { "x-vercel-ip-country": "US" },
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/event-stream");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    const events = await collectSse(response);
    expect(events).toEqual(["meta", "delta", "delta", "done"]);
  });

  it("returns 422 JSON when the first provider event is blocked", async () => {
    const handler = createTranslateHandler({
      getConfig: () => liveConfig,
      adapter: adapterFrom([{ type: "finish", reason: "blocked" }]),
    });
    const response = await handler(
      postRequest(validBody(), {
        headers: { "x-vercel-ip-country": "US" },
      }),
    );
    expect(response.status).toBe(422);
    const json = await response.json();
    expect(json.error.code).toBe("CONTENT_BLOCKED");
  });

  it("returns 502 when the first finish is length", async () => {
    const handler = createTranslateHandler({
      getConfig: () => liveConfig,
      adapter: adapterFrom([{ type: "finish", reason: "length" }]),
    });
    const response = await handler(
      postRequest(validBody(), {
        headers: { "x-vercel-ip-country": "US" },
      }),
    );
    expect(response.status).toBe(502);
  });

  it("returns 504 when deadline fires before the first event", async () => {
    const handler = createTranslateHandler({
      getConfig: () => liveConfig,
      deadlineMs: 40,
      adapter: async function* (_req, signal) {
        await new Promise<void>((_resolve, reject) => {
          if (signal.aborted) {
            reject(new AppError("UPSTREAM_TIMEOUT"));
            return;
          }
          signal.addEventListener(
            "abort",
            () => reject(new AppError("UPSTREAM_TIMEOUT")),
            { once: true },
          );
        });
        yield { type: "delta", text: "late" };
      },
    });

    const response = await handler(postRequest(validBody()));
    expect(response.status).toBe(504);
  }, 2000);

  it("aborts upstream and returns INCOMPLETE_OUTPUT when output exceeds cap", async () => {
    const big = "x".repeat(MAX_OUTPUT_CODE_POINTS);
    let captured: AbortSignal | undefined;
    const handler = createTranslateHandler({
      getConfig: () => liveConfig,
      adapter: adapterFrom(
        [
          { type: "delta", text: big },
          { type: "delta", text: "y" },
          { type: "finish", reason: "complete" },
        ],
        (signal) => {
          captured = signal;
        },
      ),
    });

    const response = await handler(
      postRequest(validBody(), {
        headers: { "x-vercel-ip-country": "US" },
      }),
    );
    const events = await collectSse(response);
    expect(events.at(-1)).toBe("error");
    expect(captured?.aborted).toBe(true);
  });

  it("aborts adapter when the client cancels mid-stream without unhandled rejections", async () => {
    const rejections: unknown[] = [];
    const onRejection = (reason: unknown) => {
      rejections.push(reason);
    };
    process.on("unhandledRejection", onRejection);

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    let captured: AbortSignal | undefined;
    const handler = createTranslateHandler({
      getConfig: () => liveConfig,
      adapter: async function* (_req, signal) {
        captured = signal;
        yield { type: "delta", text: "partial" };
        await new Promise((resolve) => setTimeout(resolve, 200));
        yield { type: "finish", reason: "complete" };
      },
    });

    const controller = new AbortController();
    const response = await handler(
      postRequest(validBody(), {
        headers: { "x-vercel-ip-country": "US" },
        signal: controller.signal,
      }),
    );

    controller.abort();
    await collectSse(response);

    expect(captured?.aborted).toBe(true);
    expect(rejections).toHaveLength(0);
    expect(logSpy.mock.calls.filter((call) => {
      const line = call[0];
      return typeof line === "string" && line.includes('"requestId"');
    })).toHaveLength(1);

    logSpy.mockRestore();
    process.off("unhandledRejection", onRejection);
  });

  it("passes corporate profile text to the adapter for human to corporate", async () => {
    let systemInstruction = "";
    const handler = createTranslateHandler({
      getConfig: () => liveConfig,
      adapter: async function* (req) {
        systemInstruction = req.systemInstruction;
        yield { type: "delta", text: "Aligned copy." };
        yield { type: "finish", reason: "complete" };
      },
    });

    const response = await handler(
      postRequest(
        validBody({
          text: "The team spent three hours discussing a button color.",
          sourceStyle: "human",
          targetStyle: "corporate",
          intensity: "balanced",
        }),
        { headers: { "x-vercel-ip-country": "US" } },
      ),
    );

    expect(response.status).toBe(200);
    expect(systemInstruction).toContain("Formal workplace phrasing");
    expect(systemInstruction).toMatch(/Do not add emojis or hashtags/i);
  });

  it("returns balanced effectiveIntensity in meta for human target", async () => {
    const handler = createTranslateHandler({
      getConfig: () => liveConfig,
      adapter: adapterFrom([
        { type: "delta", text: "Plain." },
        { type: "finish", reason: "complete" },
      ]),
    });

    const response = await handler(
      postRequest(
        validBody({
          sourceStyle: "linkedin",
          targetStyle: "human",
          intensity: "maximum",
          text: "Three hours. One button color.",
        }),
        { headers: { "x-vercel-ip-country": "US" } },
      ),
    );

    expect(response.status).toBe(200);
    const parser = new SseStreamParser();
    const reader = response.body!.getReader();
    const { value } = await reader.read();
    const events = parser.push(value!);
    expect(events[0]?.event).toBe("meta");
    expect(events[0]?.data).toMatchObject({ effectiveIntensity: "balanced" });
  });

  it("does not log submitted or generated text on success", async () => {
    const secretInput = "SECRET_INPUT_TEXT";
    const secretOutput = "SECRET_OUTPUT_TEXT";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const handler = createTranslateHandler({
      getConfig: () => liveConfig,
      adapter: adapterFrom([
        { type: "delta", text: secretOutput },
        { type: "finish", reason: "complete" },
      ]),
    });

    const response = await handler(
      postRequest(validBody({ text: secretInput }), {
        headers: { "x-vercel-ip-country": "US" },
      }),
    );
    await collectSse(response);

    const logged = logSpy.mock.calls
      .map((call) => String(call[0]))
      .join("\n");
    expect(logged).toContain('"requestId"');
    expect(logged).not.toContain(secretInput);
    expect(logged).not.toContain(secretOutput);
    logSpy.mockRestore();
  });

  it("does not log submitted text on pre-stream errors", async () => {
    const secretInput = "SECRET_ERROR_INPUT";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const handler = createTranslateHandler({
      getConfig: () => liveConfig,
      adapter: vi.fn(adapterFrom([])),
    });

    await handler(
      postRequest(validBody({ text: secretInput, eligibilityConfirmed: false }), {
        headers: { "x-vercel-ip-country": "US" },
      }),
    );

    const logged = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(logged).not.toContain(secretInput);
    logSpy.mockRestore();
  });

  it("does not log generated text on blocked responses", async () => {
    const secretOutput = "BLOCKED_PARTIAL";
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const handler = createTranslateHandler({
      getConfig: () => liveConfig,
      adapter: adapterFrom([
        { type: "delta", text: secretOutput },
        { type: "finish", reason: "blocked" },
      ]),
    });

    await handler(
      postRequest(validBody(), {
        headers: { "x-vercel-ip-country": "US" },
      }),
    );

    const logged = logSpy.mock.calls.map((call) => String(call[0])).join("\n");
    expect(logged).not.toContain(secretOutput);
    logSpy.mockRestore();
  });

  it("returns INCOMPLETE_OUTPUT when finish is complete with no text", async () => {
    const handler = createTranslateHandler({
      getConfig: () => liveConfig,
      adapter: adapterFrom([{ type: "finish", reason: "complete" }]),
    });
    const response = await handler(
      postRequest(validBody(), {
        headers: { "x-vercel-ip-country": "US" },
      }),
    );
    expect(response.status).toBe(ERROR_STATUS.INCOMPLETE_OUTPUT);
    const json = await response.json();
    expect(json.error.code).toBe("INCOMPLETE_OUTPUT");
  });

  it("returns INCOMPLETE_OUTPUT when empty delta precedes complete finish", async () => {
    const handler = createTranslateHandler({
      getConfig: () => liveConfig,
      adapter: adapterFrom([
        { type: "delta", text: "" },
        { type: "finish", reason: "complete" },
      ]),
    });
    const response = await handler(
      postRequest(validBody(), {
        headers: { "x-vercel-ip-country": "US" },
      }),
    );
    expect(response.status).toBe(200);
    const events = await collectSse(response);
    expect(events).not.toContain("done");
    expect(events.at(-1)).toBe("error");
  });

  it("returns 503 SERVICE_UNAVAILABLE in disabled mode without calling adapter", async () => {
    resetEnv({ MIMUS_MODE: "disabled" });
    const { getServerConfig } = await import("@/lib/server/config");
    const adapter = vi.fn(adapterFrom([]));
    const handler = createTranslateHandler({
      getConfig: getServerConfig,
      adapter,
    });
    const response = await handler(
      postRequest(validBody(), {
        headers: { "x-vercel-ip-country": "US" },
      }),
    );
    expect(response.status).toBe(503);
    const json = await response.json();
    expect(json.error.code).toBe("SERVICE_UNAVAILABLE");
    expect(adapter).not.toHaveBeenCalled();
  });

  it("does not call adapter when the client aborts before the first event", async () => {
    const adapter = vi.fn(adapterFrom([]));
    const handler = createTranslateHandler({
      getConfig: () => liveConfig,
      adapter,
    });

    const controller = new AbortController();
    controller.abort();

    const response = await handler(
      postRequest(validBody(), { signal: controller.signal }),
    );

    expect(adapter).not.toHaveBeenCalled();
    expect(response.status).toBe(ERROR_STATUS.UPSTREAM_TIMEOUT);
  });
});

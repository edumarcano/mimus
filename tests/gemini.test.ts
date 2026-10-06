import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MODEL_CONFIG } from "@/lib/server/model-config";

const { createMock } = vi.hoisted(() => ({
  createMock: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class MockGoogleGenAI {
    interactions = { create: createMock };
  },
}));

import { resetGeminiClientForTests, streamRewrite } from "@/lib/server/gemini";

const ENV_KEYS = [
  "GEMINI_API_KEY",
  "PARLANCE_MODE",
  "APP_ORIGIN",
  "PARLANCE_LIVE_COUNTRIES",
] as const;

let savedEnv: Record<string, string | undefined> = {};

beforeEach(() => {
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
  }
  process.env.GEMINI_API_KEY = "test-key";
  process.env.PARLANCE_MODE = "live";
  process.env.APP_ORIGIN = "http://localhost:3000";
  process.env.PARLANCE_LIVE_COUNTRIES = "US";
  resetGeminiClientForTests();
  createMock.mockReset();
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
  resetGeminiClientForTests();
});

function mockStream(events: unknown[]) {
  const iterable = {
    async *[Symbol.asyncIterator]() {
      for (const event of events) {
        yield event;
      }
    },
  };
  createMock.mockResolvedValue(iterable);
}

describe("streamRewrite", () => {
  it("calls interactions.create once with model config and no retries", async () => {
    mockStream([
      {
        event_type: "step.delta",
        delta: { type: "text", text: "Hello" },
      },
      {
        event_type: "interaction.completed",
        interaction: {
          id: "int-1",
          status: "completed",
          usage: { total_input_tokens: 3, total_output_tokens: 5 },
        },
      },
    ]);

    const signal = new AbortController().signal;
    const events = [];
    for await (const event of streamRewrite(
      { systemInstruction: "sys", input: "user" },
      signal,
    )) {
      events.push(event);
    }

    expect(createMock).toHaveBeenCalledTimes(1);
    const [params, options] = createMock.mock.calls[0] as [
      Record<string, unknown>,
      Record<string, unknown>,
    ];
    expect(params.model).toBe(MODEL_CONFIG.model);
    expect(params.store).toBe(false);
    expect(params.stream).toBe(true);
    expect(params.system_instruction).toBe("sys");
    expect(params.input).toBe("user");
    expect(params.generation_config).toEqual({
      max_output_tokens: MODEL_CONFIG.maxOutputTokens,
      thinking_level: MODEL_CONFIG.thinkingLevel,
    });
    expect(params.tools).toBeUndefined();
    expect(params.previous_interaction_id).toBeUndefined();
    expect(options.maxRetries).toBe(0);
    expect(options.signal).toBe(signal);

    expect(events).toEqual([
      { type: "delta", text: "Hello" },
      {
        type: "finish",
        reason: "complete",
        usage: { inputTokens: 3, outputTokens: 5 },
      },
    ]);
  });

  it("does not forward thought deltas", async () => {
    mockStream([
      {
        event_type: "step.delta",
        delta: { type: "thought_summary", text: "hidden" },
      },
      {
        event_type: "step.delta",
        delta: { type: "text", text: "Visible" },
      },
      {
        event_type: "interaction.completed",
        interaction: { id: "int-2", status: "completed" },
      },
    ]);

    const events = [];
    for await (const event of streamRewrite(
      { systemInstruction: "s", input: "u" },
      new AbortController().signal,
    )) {
      events.push(event);
    }

    expect(events.filter((e) => e.type === "delta")).toEqual([
      { type: "delta", text: "Visible" },
    ]);
  });

  it("maps terminal interaction.completed statuses", async () => {
    mockStream([
      {
        event_type: "interaction.completed",
        interaction: { id: "a", status: "incomplete" },
      },
    ]);
    let events = [];
    for await (const event of streamRewrite(
      { systemInstruction: "s", input: "u" },
      new AbortController().signal,
    )) {
      events.push(event);
    }
    expect(events[0]).toEqual({ type: "finish", reason: "length", usage: undefined });

    resetGeminiClientForTests();
    createMock.mockReset();
    mockStream([
      {
        event_type: "interaction.completed",
        interaction: { id: "b", status: "failed" },
      },
    ]);
    events = [];
    for await (const event of streamRewrite(
      { systemInstruction: "s", input: "u" },
      new AbortController().signal,
    )) {
      events.push(event);
    }
    expect(events[0]).toEqual({ type: "finish", reason: "other", usage: undefined });
  });

  it("does not emit finish when interaction.completed is missing", async () => {
    mockStream([
      {
        event_type: "step.delta",
        delta: { type: "text", text: "partial only" },
      },
    ]);

    const events = [];
    for await (const event of streamRewrite(
      { systemInstruction: "s", input: "u" },
      new AbortController().signal,
    )) {
      events.push(event);
    }

    expect(events).toEqual([{ type: "delta", text: "partial only" }]);
  });

  it("aborts when signal is already aborted", async () => {
    mockStream([
      {
        event_type: "step.delta",
        delta: { type: "text", text: "x" },
      },
    ]);
    const controller = new AbortController();
    controller.abort();
    const events = [];
    for await (const event of streamRewrite(
      { systemInstruction: "s", input: "u" },
      controller.signal,
    )) {
      events.push(event);
    }
    expect(events).toHaveLength(0);
  });
});

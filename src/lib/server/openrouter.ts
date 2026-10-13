import "server-only";

import { AppError } from "./errors";
import { getServerConfig } from "./config";
import { MODEL_CONFIG } from "./model-config";

const OPENROUTER_CHAT_COMPLETIONS_URL =
  "https://openrouter.ai/api/v1/chat/completions";

export type ModelEvent =
  | { type: "delta"; text: string }
  | {
      type: "finish";
      reason: "complete" | "blocked" | "length" | "other";
      usage?: { inputTokens?: number; outputTokens?: number };
    };

export type ModelRequest = {
  systemInstruction: string;
  input: string;
};

type ChatCompletionChunk = {
  choices?: Array<{
    delta?: {
      content?: string;
      reasoning?: string;
      reasoning_content?: string;
      reasoning_details?: unknown;
    };
    finish_reason?: string | null;
    error?: unknown;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
};

type SseStreamState = {
  finishReason: string | undefined;
  usage: { inputTokens?: number; outputTokens?: number } | undefined;
};

function mapFinishReason(
  reason: string,
): "complete" | "blocked" | "length" | "other" {
  if (reason === "stop") {
    return "complete";
  }
  if (reason === "length") {
    return "length";
  }
  if (reason === "content_filter") {
    return "blocked";
  }
  return "other";
}

function extractUsage(
  usage: ChatCompletionChunk["usage"],
): { inputTokens?: number; outputTokens?: number } | undefined {
  if (!usage) {
    return undefined;
  }
  const inputTokens = usage.prompt_tokens;
  const outputTokens = usage.completion_tokens;
  if (inputTokens === undefined && outputTokens === undefined) {
    return undefined;
  }
  return { inputTokens, outputTokens };
}

function mapHttpStatus(status: number): AppError {
  if (status === 402 || status === 429) {
    return new AppError("SERVICE_QUOTA_EXHAUSTED");
  }
  return new AppError("SERVICE_UNAVAILABLE");
}

function mapProviderError(error: unknown, signal: AbortSignal): AppError {
  if (error instanceof AppError) {
    return error;
  }
  if (signal.aborted) {
    return new AppError("UPSTREAM_TIMEOUT");
  }
  const name =
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    typeof (error as { name: unknown }).name === "string"
      ? (error as { name: string }).name
      : "";
  if (name === "AbortError") {
    return new AppError("UPSTREAM_TIMEOUT");
  }
  return new AppError("SERVICE_UNAVAILABLE");
}

function parseDataLine(payload: string): ChatCompletionChunk {
  try {
    return JSON.parse(payload) as ChatCompletionChunk;
  } catch {
    throw new AppError("SERVICE_UNAVAILABLE");
  }
}

function applyChunk(
  chunk: ChatCompletionChunk,
  state: SseStreamState,
): ModelEvent[] {
  const choice = chunk.choices?.[0];
  if (choice?.error !== undefined && choice.error !== null) {
    throw new AppError("SERVICE_UNAVAILABLE");
  }

  const events: ModelEvent[] = [];
  const content = choice?.delta?.content;
  if (typeof content === "string" && content.length > 0) {
    events.push({ type: "delta", text: content });
  }

  const finishReason = choice?.finish_reason;
  if (
    finishReason !== undefined &&
    finishReason !== null &&
    state.finishReason === undefined
  ) {
    state.finishReason = finishReason;
  }

  const chunkUsage = extractUsage(chunk.usage);
  if (chunkUsage !== undefined) {
    state.usage = chunkUsage;
  }

  return events;
}

function finishFromState(state: SseStreamState): ModelEvent | undefined {
  if (state.finishReason === undefined) {
    return undefined;
  }
  return {
    type: "finish",
    reason: mapFinishReason(state.finishReason),
    usage: state.usage,
  };
}

function* processDataPayload(
  data: string,
  state: SseStreamState,
): Generator<ModelEvent, "done" | "continue", unknown> {
  if (data === "[DONE]") {
    const finish = finishFromState(state);
    if (finish) {
      yield finish;
    }
    return "done";
  }
  const parsed = parseDataLine(data);
  yield* applyChunk(parsed, state);
  return "continue";
}

async function* readSseEvents(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
): AsyncIterable<ModelEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const state: SseStreamState = { finishReason: undefined, usage: undefined };

  try {
    while (true) {
      if (signal.aborted) {
        throw new AppError("UPSTREAM_TIMEOUT");
      }
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const rawLine of lines) {
        const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
        if (line.length === 0 || line.startsWith(":")) {
          continue;
        }
        if (!line.startsWith("data: ")) {
          throw new AppError("SERVICE_UNAVAILABLE");
        }
        const data = line.slice("data: ".length).trim();
        const outcome = yield* processDataPayload(data, state);
        if (outcome === "done") {
          return;
        }
      }
    }

    if (buffer.trim().length > 0) {
      const line = buffer.endsWith("\r") ? buffer.slice(0, -1) : buffer;
      if (!line.startsWith(":") && line.length > 0) {
        if (!line.startsWith("data: ")) {
          throw new AppError("SERVICE_UNAVAILABLE");
        }
        const data = line.slice("data: ".length).trim();
        const outcome = yield* processDataPayload(data, state);
        if (outcome === "done") {
          return;
        }
      }
    }

    if (signal.aborted) {
      throw new AppError("UPSTREAM_TIMEOUT");
    }

    const finish = finishFromState(state);
    if (finish) {
      yield finish;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function* streamRewrite(
  request: ModelRequest,
  signal: AbortSignal,
): AsyncIterable<ModelEvent> {
  const { openrouterApiKey } = getServerConfig();
  if (!openrouterApiKey) {
    throw new AppError("SERVICE_UNAVAILABLE");
  }

  try {
    const response = await fetch(OPENROUTER_CHAT_COMPLETIONS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openrouterApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL_CONFIG.model,
        messages: [
          { role: "system", content: request.systemInstruction },
          { role: "user", content: request.input },
        ],
        max_tokens: MODEL_CONFIG.maxOutputTokens,
        reasoning: { effort: MODEL_CONFIG.reasoningEffort },
        provider: {
          data_collection: MODEL_CONFIG.dataCollection,
          zdr: MODEL_CONFIG.zdr,
          require_parameters: true,
        },
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal,
    });

    if (!response.ok) {
      void response.body?.cancel();
      throw mapHttpStatus(response.status);
    }

    if (!response.body) {
      throw new AppError("SERVICE_UNAVAILABLE");
    }

    yield* readSseEvents(response.body, signal);
  } catch (error) {
    if (signal.aborted) {
      throw new AppError("UPSTREAM_TIMEOUT");
    }
    throw mapProviderError(error, signal);
  }
}

import "server-only";

import { GoogleGenAI } from "@google/genai";

type GenaiInteractionStreamEvent = {
  event_type: string;
  delta?: { type?: string; text?: string };
  interaction?: {
    id: string;
    status: string;
    usage?: {
      total_input_tokens?: number;
      total_output_tokens?: number;
    };
  };
};

import { AppError } from "./errors";
import { getServerConfig } from "./config";
import { MODEL_CONFIG } from "./model-config";

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

let client: GoogleGenAI | undefined;

function getClient(): GoogleGenAI {
  if (!client) {
    const { geminiApiKey } = getServerConfig();
    if (!geminiApiKey) {
      throw new AppError("SERVICE_UNAVAILABLE");
    }
    client = new GoogleGenAI({ apiKey: geminiApiKey });
  }
  return client;
}

function extractUsage(
  usage:
    | {
        total_input_tokens?: number;
        total_output_tokens?: number;
      }
    | undefined,
): { inputTokens?: number; outputTokens?: number } | undefined {
  if (!usage) {
    return undefined;
  }
  const inputTokens = usage.total_input_tokens;
  const outputTokens = usage.total_output_tokens;
  if (inputTokens === undefined && outputTokens === undefined) {
    return undefined;
  }
  return { inputTokens, outputTokens };
}

function mapTerminalStatus(status: string): "complete" | "length" | "other" {
  if (status === "completed") {
    return "complete";
  }
  if (status === "incomplete") {
    return "length";
  }
  return "other";
}

function isTextDelta(
  delta: { type?: string; text?: string } | undefined,
): delta is { type: "text"; text: string } {
  return (
    delta !== undefined &&
    delta.type === "text" &&
    typeof delta.text === "string"
  );
}

function mapProviderError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  const status =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number"
      ? (error as { status: number }).status
      : undefined;

  if (status === 429) {
    return new AppError("SERVICE_QUOTA_EXHAUSTED");
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

export async function* streamRewrite(
  request: ModelRequest,
  signal: AbortSignal,
): AsyncIterable<ModelEvent> {
  const ai = getClient();

  try {
    const created = await ai.interactions.create(
      {
        model: MODEL_CONFIG.model,
        stream: true,
        store: false,
        system_instruction: request.systemInstruction,
        input: request.input,
        generation_config: {
          max_output_tokens: MODEL_CONFIG.maxOutputTokens,
          thinking_level: MODEL_CONFIG.thinkingLevel,
        },
      },
      {
        maxRetries: 0,
        signal,
      },
    );

    const stream = created as AsyncIterable<GenaiInteractionStreamEvent>;

    for await (const event of stream) {
      if (signal.aborted) {
        break;
      }

      switch (event.event_type) {
        case "step.delta": {
          const delta = event.delta;
          if (isTextDelta(delta)) {
            yield { type: "delta", text: delta.text };
          }
          break;
        }
        case "interaction.completed": {
          const interaction = event.interaction;
          if (!interaction) {
            break;
          }
          yield {
            type: "finish",
            reason: mapTerminalStatus(interaction.status),
            usage: extractUsage(interaction.usage),
          };
          break;
        }
        case "error": {
          throw new AppError("SERVICE_UNAVAILABLE");
        }
        default:
          break;
      }
    }
  } catch (error) {
    if (signal.aborted) {
      throw new AppError("UPSTREAM_TIMEOUT");
    }
    throw mapProviderError(error);
  }
}

/** Test-only reset for lazy client singleton. */
export function resetGeminiClientForTests(): void {
  client = undefined;
}

import { countCodePoints, MAX_OUTPUT_CODE_POINTS } from "../src/lib/limits";
import type { ModelEvent } from "../src/lib/server/gemini";
import { AppError } from "../src/lib/server/errors";

export type NormalizedCompletion =
  | "complete"
  | "incomplete"
  | "blocked"
  | "length"
  | "error"
  | "interrupted";

export type StreamRunResult = {
  outputText: string;
  finishReason?: Extract<ModelEvent, { type: "finish" }>["reason"];
  usage?: { inputTokens?: number; outputTokens?: number };
  normalizedCompletion: NormalizedCompletion;
  errorCode?: string;
};

/** Concatenate deltas and take the finish event, matching the translate route. */
export async function consumeAdapterStream(
  events: AsyncIterable<ModelEvent>,
  signal: AbortSignal,
): Promise<StreamRunResult> {
  let outputText = "";
  let finish: Extract<ModelEvent, { type: "finish" }> | undefined;
  let usage: { inputTokens?: number; outputTokens?: number } | undefined;
  try {
    for await (const event of events) {
      if (signal.aborted) {
        return {
          outputText,
          usage,
          normalizedCompletion: "interrupted",
          errorCode: "UPSTREAM_TIMEOUT",
        };
      }
      if (event.type === "delta") {
        outputText += event.text;
        if (countCodePoints(outputText) > MAX_OUTPUT_CODE_POINTS) {
          return {
            outputText,
            usage,
            normalizedCompletion: "incomplete",
          };
        }
        continue;
      }
      finish = event;
      usage = event.usage ?? usage;
      break;
    }
  } catch (error) {
    if (error instanceof AppError) {
      return {
        outputText,
        usage,
        normalizedCompletion: "error",
        errorCode: error.code,
      };
    }
    return {
      outputText,
      usage,
      normalizedCompletion: "error",
      errorCode: "SERVICE_UNAVAILABLE",
    };
  }

  if (!finish) {
    return {
      outputText,
      usage,
      normalizedCompletion: "interrupted",
    };
  }

  if (finish.reason === "blocked") {
    return {
      outputText,
      finishReason: finish.reason,
      usage,
      normalizedCompletion: "blocked",
    };
  }

  if (finish.reason === "length") {
    return {
      outputText,
      finishReason: finish.reason,
      usage,
      normalizedCompletion: "length",
    };
  }

  if (finish.reason !== "complete" || outputText.trim().length === 0) {
    return {
      outputText,
      finishReason: finish.reason,
      usage,
      normalizedCompletion: "incomplete",
    };
  }

  if (countCodePoints(outputText) > MAX_OUTPUT_CODE_POINTS) {
    return {
      outputText,
      finishReason: finish.reason,
      usage,
      normalizedCompletion: "incomplete",
    };
  }

  return {
    outputText,
    finishReason: finish.reason,
    usage,
    normalizedCompletion: "complete",
  };
}

export type DeterministicChecks = {
  nonemptyOutput: boolean;
  withinOutputCap: boolean;
  completionComplete: boolean;
  preserveTokensOk: boolean;
};

export function runDeterministicChecks(
  outputText: string,
  normalizedCompletion: NormalizedCompletion,
  preserveTokens: string[] | undefined,
): DeterministicChecks {
  const withinOutputCap = countCodePoints(outputText) <= MAX_OUTPUT_CODE_POINTS;
  const nonemptyOutput = outputText.trim().length > 0;
  const completionComplete = normalizedCompletion === "complete";
  const tokens = preserveTokens ?? [];
  const preserveTokensOk = tokens.every((token) => outputText.includes(token));

  return {
    nonemptyOutput,
    withinOutputCap,
    completionComplete,
    preserveTokensOk,
  };
}

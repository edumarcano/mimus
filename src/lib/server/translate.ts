import "server-only";

import { NOTICE_VERSION } from "../notice";
import { PROMPT_VERSION, buildRewritePrompt } from "../prompts";
import { validateTranslateRequest } from "../schema";
import {
  countCodePoints,
  MAX_BODY_BYTES,
  MAX_OUTPUT_CODE_POINTS,
  REQUEST_DEADLINE_MS,
} from "../limits";
import { encodeSseEvent } from "../stream";
import type { AppErrorCode } from "../api-types";
import { readBoundedJsonBody } from "./body";
import type { ServerConfig } from "./config";
import { getServerConfig } from "./config";
import {
  AppError,
  ERROR_MESSAGES,
  ERROR_STATUS,
  errorJsonResponse,
} from "./errors";
import type { ModelEvent, ModelRequest } from "./gemini";
import { MODEL_CONFIG } from "./model-config";
import { checkRegion, isAllowedOrigin } from "./policy";

export type StreamRewriteAdapter = (
  request: ModelRequest,
  signal: AbortSignal,
) => AsyncIterable<ModelEvent>;

export type TranslateHandlerDeps = {
  getConfig?: () => ServerConfig;
  adapter: StreamRewriteAdapter;
  deadlineMs?: number;
  now?: () => number;
};

type RequestLog = {
  requestId: string;
  model: string;
  promptVersion: string;
  sourceStyle: string;
  targetStyle: string;
  durationMs: number;
  status: number;
  code?: AppErrorCode;
  inputTokens?: number;
  outputTokens?: number;
};

function logOnce(entry: RequestLog): void {
  console.log(
    JSON.stringify({
      requestId: entry.requestId,
      model: entry.model,
      promptVersion: entry.promptVersion,
      sourceStyle: entry.sourceStyle,
      targetStyle: entry.targetStyle,
      durationMs: entry.durationMs,
      status: entry.status,
      code: entry.code,
      inputTokens: entry.inputTokens,
      outputTokens: entry.outputTokens,
    }),
  );
}

function combineAbortSignals(signals: AbortSignal[]): AbortSignal {
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any(signals);
  }
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort();
      break;
    }
    signal.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return controller.signal;
}

function preStreamError(
  code: AppErrorCode,
  requestId: string,
  message?: string,
): Response {
  return errorJsonResponse(code, requestId, message);
}

export function createTranslateHandler(deps: TranslateHandlerDeps) {
  const getConfig = deps.getConfig ?? getServerConfig;
  const deadlineMs = deps.deadlineMs ?? REQUEST_DEADLINE_MS;
  const now = deps.now ?? (() => Date.now());

  return async function handleTranslate(request: Request): Promise<Response> {
    const requestId = crypto.randomUUID();
    const startedAt = now();
    let logged = false;

    const finishLog = (options: {
      status?: number;
      code?: AppErrorCode;
      styles?: { sourceStyle: string; targetStyle: string };
      usage?: { inputTokens?: number; outputTokens?: number };
    }) => {
      if (logged) {
        return;
      }
      logged = true;
      const status =
        options.status ??
        (options.code ? ERROR_STATUS[options.code] : 200);
      logOnce({
        requestId,
        model: MODEL_CONFIG.model,
        promptVersion: PROMPT_VERSION,
        sourceStyle: options.styles?.sourceStyle ?? "-",
        targetStyle: options.styles?.targetStyle ?? "-",
        durationMs: now() - startedAt,
        status,
        code: options.code,
        inputTokens: options.usage?.inputTokens,
        outputTokens: options.usage?.outputTokens,
      });
    };

    if (request.method !== "POST") {
      finishLog({ status: 405, code: "INVALID_REQUEST" });
      return new Response(null, { status: 405 });
    }

    const contentType = request.headers.get("Content-Type") ?? "";
    if (!contentType.toLowerCase().startsWith("application/json")) {
      finishLog({ code: "UNSUPPORTED_MEDIA_TYPE" });
      return preStreamError("UNSUPPORTED_MEDIA_TYPE", requestId);
    }

    const config = getConfig();
    if (!config.isLive) {
      finishLog({ code: "SERVICE_UNAVAILABLE" });
      return preStreamError("SERVICE_UNAVAILABLE", requestId);
    }

    const originCheck = isAllowedOrigin(request, config);
    if (!originCheck.ok) {
      finishLog({ code: "REQUEST_NOT_ALLOWED" });
      return preStreamError("REQUEST_NOT_ALLOWED", requestId);
    }

    const contentLength = request.headers.get("Content-Length");
    if (contentLength) {
      const length = Number.parseInt(contentLength, 10);
      if (!Number.isNaN(length) && length > MAX_BODY_BYTES) {
        finishLog({ code: "INPUT_TOO_LARGE" });
        return preStreamError("INPUT_TOO_LARGE", requestId);
      }
    }

    const bodyResult = await readBoundedJsonBody(request.body);
    if (!bodyResult.ok) {
      if (bodyResult.code === "INPUT_TOO_LARGE") {
        finishLog({ code: "INPUT_TOO_LARGE" });
        return preStreamError("INPUT_TOO_LARGE", requestId);
      }
      finishLog({ code: "INVALID_REQUEST" });
      return preStreamError("INVALID_REQUEST", requestId);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(bodyResult.text);
    } catch {
      finishLog({ code: "INVALID_REQUEST" });
      return preStreamError("INVALID_REQUEST", requestId);
    }

    const validated = validateTranslateRequest(parsed);
    if (!validated.ok) {
      finishLog({ code: validated.code });
      return preStreamError(validated.code, requestId, validated.message);
    }

    const payload = validated.value;
    const styles = {
      sourceStyle: payload.sourceStyle,
      targetStyle: payload.targetStyle,
    };

    if (payload.privacyNoticeVersion !== NOTICE_VERSION) {
      finishLog({ code: "NOTICE_CHANGED", styles });
      return preStreamError("NOTICE_CHANGED", requestId);
    }

    if (payload.eligibilityConfirmed !== true) {
      finishLog({ code: "REQUEST_NOT_ALLOWED", styles });
      return preStreamError("REQUEST_NOT_ALLOWED", requestId);
    }

    const requestUrl = new URL(request.url);
    const region = checkRegion(
      { headers: request.headers, hostname: requestUrl.hostname },
      config,
    );
    if (!region.ok) {
      finishLog({ code: "REGION_UNAVAILABLE", styles });
      return preStreamError("REGION_UNAVAILABLE", requestId);
    }

    const prompt = buildRewritePrompt({
      sourceStyle: payload.sourceStyle,
      targetStyle: payload.targetStyle,
      intensity: payload.effectiveIntensity,
      text: payload.text,
    });

    const deadlineController = new AbortController();
    const deadlineTimer = setTimeout(() => deadlineController.abort(), deadlineMs);
    const upstreamSignal = combineAbortSignals([
      request.signal,
      deadlineController.signal,
    ]);

    if (upstreamSignal.aborted) {
      clearTimeout(deadlineTimer);
      finishLog({ code: "UPSTREAM_TIMEOUT", styles });
      return preStreamError("UPSTREAM_TIMEOUT", requestId);
    }

    let iterator: AsyncIterator<ModelEvent> | undefined;
    try {
      const iterable = deps.adapter(prompt, upstreamSignal);
      iterator = iterable[Symbol.asyncIterator]();

      let outputText = "";
      let usage: { inputTokens?: number; outputTokens?: number } | undefined;
      const firstResult = await iterator.next();

      if (upstreamSignal.aborted) {
        clearTimeout(deadlineTimer);
        if (iterator.return) {
          await iterator.return(undefined);
        }
        finishLog({ code: "UPSTREAM_TIMEOUT", styles });
        return preStreamError("UPSTREAM_TIMEOUT", requestId);
      }

      if (firstResult.done) {
        clearTimeout(deadlineTimer);
        finishLog({ code: "INCOMPLETE_OUTPUT", styles });
        return preStreamError("INCOMPLETE_OUTPUT", requestId);
      }

      const handlePreStreamFinish = (event: Extract<ModelEvent, { type: "finish" }>) => {
        if (event.reason === "blocked") {
          finishLog({ code: "CONTENT_BLOCKED", styles, usage: event.usage });
          return preStreamError("CONTENT_BLOCKED", requestId);
        }
        finishLog({ code: "INCOMPLETE_OUTPUT", styles, usage: event.usage });
        return preStreamError("INCOMPLETE_OUTPUT", requestId);
      };

      if (firstResult.value.type === "finish") {
        clearTimeout(deadlineTimer);
        return handlePreStreamFinish(firstResult.value);
      }

      const firstDeltaText = firstResult.value.text;
      outputText += firstDeltaText;

      let streamClosed = false;
      const stream = new ReadableStream<Uint8Array>({
        start: async (controller) => {
          const encoder = new TextEncoder();
          const safeEnqueue = (chunk: string) => {
            if (streamClosed) {
              return;
            }
            try {
              controller.enqueue(encoder.encode(chunk));
            } catch {
              streamClosed = true;
            }
          };
          const safeClose = () => {
            if (streamClosed) {
              return;
            }
            streamClosed = true;
            try {
              controller.close();
            } catch {
              // Consumer already canceled or closed the stream.
            }
          };

          try {
            safeEnqueue(
              encodeSseEvent("meta", {
                requestId,
                promptVersion: PROMPT_VERSION,
                effectiveIntensity: payload.effectiveIntensity,
              }),
            );

            safeEnqueue(encodeSseEvent("delta", { text: firstDeltaText }));

            while (true) {
              if (upstreamSignal.aborted) {
                safeEnqueue(
                  encodeSseEvent("error", {
                    code: "UPSTREAM_TIMEOUT",
                    message: ERROR_MESSAGES.UPSTREAM_TIMEOUT,
                    requestId,
                  }),
                );
                finishLog({ code: "UPSTREAM_TIMEOUT", styles, usage });
                break;
              }

              const next = await iterator!.next();
              if (next.done) {
                safeEnqueue(
                  encodeSseEvent("error", {
                    code: "INCOMPLETE_OUTPUT",
                    message: ERROR_MESSAGES.INCOMPLETE_OUTPUT,
                    requestId,
                  }),
                );
                finishLog({ code: "INCOMPLETE_OUTPUT", styles, usage });
                break;
              }

              const event = next.value;
              if (event.type === "delta") {
                outputText += event.text;
                if (countCodePoints(outputText) > MAX_OUTPUT_CODE_POINTS) {
                  deadlineController.abort();
                  safeEnqueue(
                    encodeSseEvent("error", {
                      code: "INCOMPLETE_OUTPUT",
                      message: ERROR_MESSAGES.INCOMPLETE_OUTPUT,
                      requestId,
                    }),
                  );
                  finishLog({ code: "INCOMPLETE_OUTPUT", styles, usage });
                  break;
                }
                safeEnqueue(encodeSseEvent("delta", { text: event.text }));
                continue;
              }

              usage = event.usage ?? usage;
              if (event.reason === "blocked") {
                safeEnqueue(
                  encodeSseEvent("error", {
                    code: "CONTENT_BLOCKED",
                    message: ERROR_MESSAGES.CONTENT_BLOCKED,
                    requestId,
                  }),
                );
                finishLog({ code: "CONTENT_BLOCKED", styles, usage });
                break;
              }

              if (
                event.reason !== "complete" ||
                outputText.trim().length === 0
              ) {
                safeEnqueue(
                  encodeSseEvent("error", {
                    code: "INCOMPLETE_OUTPUT",
                    message: ERROR_MESSAGES.INCOMPLETE_OUTPUT,
                    requestId,
                  }),
                );
                finishLog({ code: "INCOMPLETE_OUTPUT", styles, usage });
                break;
              }

              safeEnqueue(
                encodeSseEvent("done", {
                  requestId,
                  finishReason: "complete",
                  durationMs: now() - startedAt,
                  ...(usage ? { usage } : {}),
                }),
              );
              finishLog({ status: 200, styles, usage });
              break;
            }
          } catch (error) {
            const code =
              error instanceof AppError ? error.code : "SERVICE_UNAVAILABLE";
            safeEnqueue(
              encodeSseEvent("error", {
                code,
                message: ERROR_MESSAGES[code],
                requestId,
              }),
            );
            finishLog({ code, styles, usage });
          } finally {
            clearTimeout(deadlineTimer);
            if (iterator?.return) {
              await iterator.return(undefined);
            }
            safeClose();
          }
        },
        cancel: () => {
          streamClosed = true;
          deadlineController.abort();
          clearTimeout(deadlineTimer);
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-store, no-transform",
        },
      });
    } catch (error) {
      clearTimeout(deadlineTimer);
      if (iterator?.return) {
        await iterator.return(undefined);
      }
      if (error instanceof AppError) {
        finishLog({ code: error.code, styles });
        return preStreamError(error.code, requestId);
      }
      finishLog({ code: "SERVICE_UNAVAILABLE", styles });
      return preStreamError("SERVICE_UNAVAILABLE", requestId);
    }
  };
}

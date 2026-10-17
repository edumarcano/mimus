"use client";

import { useEffect, useRef, type Dispatch } from "react";
import { ACK_STORAGE_KEY } from "@/lib/notice";
import { browserStorage, safeRemoveItem } from "@/lib/storage";
import { SseStreamParser } from "@/lib/stream";
import type { RequestSnapshot, TranslatorAction } from "@/lib/translator-state";

const CLIENT_ERROR_BY_CODE: Record<string, string> = {
  SERVICE_QUOTA_EXHAUSTED:
    "Shared free capacity for rewrites is used up. Try again later.",
  RATE_LIMITED:
    "Too many requests from this network. Please wait and try again.",
  REGION_UNAVAILABLE: "Live generation is not available in your region.",
  SERVICE_UNAVAILABLE: "Live generation is unavailable right now.",
};

function genericMessage(status: number): string {
  if (status === 429) {
    return "Too many requests. Shared networks sometimes hit the same limit.";
  }
  if (status === 413) return "That text is too long to send.";
  if (status === 403) return "Translation isn't available for this request.";
  if (status >= 500) {
    return "The service is unavailable right now. Please try again later.";
  }
  return "Something went wrong with that request. Please try again.";
}

function resolveClientMessage(
  code: string | undefined,
  status: number,
  serverMessage: string,
): string {
  if (code && CLIENT_ERROR_BY_CODE[code]) {
    return CLIENT_ERROR_BY_CODE[code];
  }
  if (status === 429 && !code) {
    return genericMessage(429);
  }
  return serverMessage;
}

async function parseHttpError(
  response: Response,
): Promise<{ message: string; code?: string }> {
  let message = genericMessage(response.status);
  let code: string | undefined;
  try {
    const raw = await response.text();
    const parsed: unknown = JSON.parse(raw);
    const err = (
      parsed as { error?: { message?: unknown; code?: unknown } } | null
    )?.error;
    if (err && typeof err.message === "string" && err.message.length > 0) {
      message = err.message;
    }
    if (err && typeof err.code === "string") {
      code = err.code;
    }
  } catch {
    // Body was HTML, empty, or not JSON: keep the generic message.
  }
  message = resolveClientMessage(code, response.status, message);
  const retry = response.headers.get("Retry-After");
  if (retry && /^\d+$/.test(retry.trim())) {
    message += ` Try again in about ${retry.trim()} seconds.`;
  }
  return { message, code };
}

export function useRewriteStream({
  noticeVersion,
  dispatch,
}: {
  noticeVersion: string;
  dispatch: Dispatch<TranslatorAction>;
}) {
  const runCounter = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  useEffect(() => () => abortRef.current?.abort(), []);

  async function run(snapshot: RequestSnapshot) {
    const runId = ++runCounter.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: "start", runId });
    let streaming = false;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const isCurrent = () =>
      runCounter.current === runId && !controller.signal.aborted;

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          text: snapshot.text,
          sourceStyle: snapshot.sourceStyle,
          targetStyle: snapshot.targetStyle,
          intensity: snapshot.effectiveIntensity,
          eligibilityConfirmed: true,
          privacyNoticeVersion: noticeVersion,
        }),
        signal: controller.signal,
      });

      if (!isCurrent()) {
        await response.body?.cancel();
        return;
      }

      const type = response.headers.get("Content-Type") ?? "";
      if (
        response.status !== 200 ||
        !type.includes("text/event-stream") ||
        !response.body
      ) {
        const { message, code } = await parseHttpError(response);
        if (!isCurrent()) return;
        if (code === "NOTICE_CHANGED") {
          safeRemoveItem(browserStorage("sessionStorage"), ACK_STORAGE_KEY);
          dispatch({ type: "setAcknowledged", value: false });
        }
        dispatch({ type: "failure", runId, message, code });
        return;
      }

      const parser = new SseStreamParser();
      reader = response.body.getReader();
      streaming = true;
      const handle = (events: ReturnType<SseStreamParser["push"]>) => {
        for (const ev of events) {
          if (ev.event === "delta" && typeof ev.data.text === "string") {
            dispatch({ type: "delta", runId, text: ev.data.text });
          } else if (ev.event === "done") {
            dispatch({ type: "done", runId });
          } else if (ev.event === "error") {
            dispatch({
              type: "streamError",
              runId,
              code: String(ev.data.code),
              message:
                typeof ev.data.message === "string" && ev.data.message
                  ? ev.data.message
                  : "The rewrite failed. Please try again.",
            });
          }
        }
      };
      while (true) {
        if (!isCurrent()) {
          await reader.cancel().catch(() => undefined);
          return;
        }
        const { done, value } = await reader.read();
        if (!isCurrent()) {
          await reader.cancel().catch(() => undefined);
          return;
        }
        if (done) break;
        handle(parser.push(value));
      }
      if (parser.end().interrupted) {
        dispatch({ type: "interrupted", runId });
      }
    } catch {
      if (controller.signal.aborted || runCounter.current !== runId) return;
      if (streaming) {
        dispatch({ type: "interrupted", runId });
        return;
      }
      dispatch({
        type: "failure",
        runId,
        message:
          "Couldn't reach the service. Check your connection and try again.",
      });
    } finally {
      reader?.releaseLock();
    }
  }

  function stop(runId: number) {
    dispatch({ type: "stop", runId });
    abortRef.current?.abort();
  }
  return { run, stop };
}

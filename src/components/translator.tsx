"use client";

import { useEffect, useId, useReducer, useRef } from "react";
import { EXAMPLES, type Example } from "@/lib/examples";
import { countCodePoints } from "@/lib/limits";
import { SseStreamParser } from "@/lib/stream";

export type TranslatorConfig = {
  mode: "demo" | "live" | "disabled";
  notice: { version: string; text: string };
  limits: { maxInputCodePoints: number };
};

type Status =
  | "idle"
  | "generating"
  | "complete"
  | "incomplete"
  | "interrupted"
  | "error"
  | "example";

type State = {
  text: string;
  acknowledged: boolean;
  status: Status;
  output: string;
  message: string;
  runId: number;
};

type Action =
  | { type: "text"; text: string }
  | { type: "acknowledge"; value: boolean }
  | { type: "example"; example: Example; showOutput: boolean }
  | { type: "start"; runId: number }
  | { type: "delta"; runId: number; text: string }
  | { type: "done"; runId: number }
  | { type: "streamError"; runId: number; code: string; message: string }
  | { type: "interrupted"; runId: number }
  | { type: "failure"; runId: number; message: string };

const initial: State = {
  text: "",
  acknowledged: false,
  status: "idle",
  output: "",
  message: "",
  runId: 0,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "text":
      return { ...state, text: action.text };
    case "acknowledge":
      return { ...state, acknowledged: action.value };
    case "example":
      return {
        ...state,
        text: action.example.input,
        output: action.showOutput ? action.example.output : "",
        status: action.showOutput ? "example" : "idle",
        message: "",
      };
    case "start":
      return {
        ...state,
        runId: action.runId,
        status: "generating",
        output: "",
        message: "",
      };
  }
  // Remaining actions belong to a specific run; ignore stale ones.
  if (action.runId !== state.runId || state.status !== "generating") {
    return state;
  }
  switch (action.type) {
    case "delta":
      return { ...state, output: state.output + action.text };
    case "done":
      return { ...state, status: "complete" };
    case "streamError":
      if (action.code === "CONTENT_BLOCKED" || state.output === "") {
        return {
          ...state,
          status: "error",
          output: "",
          message: action.message,
        };
      }
      return { ...state, status: "incomplete", message: action.message };
    case "interrupted":
      return {
        ...state,
        status: "interrupted",
        message: "The connection ended before the rewrite finished.",
      };
    case "failure":
      return {
        ...state,
        status: "error",
        output: "",
        message: action.message,
      };
  }
}

function genericMessage(status: number): string {
  if (status === 429) return "Too many requests right now. Please try again shortly.";
  if (status === 413) return "That text is too long to send.";
  if (status === 403) return "Translation isn't available for this request.";
  if (status >= 500) return "The service is unavailable right now. Please try again later.";
  return "Something went wrong with that request. Please try again.";
}

async function httpErrorMessage(response: Response): Promise<string> {
  let message = genericMessage(response.status);
  try {
    const raw = await response.text();
    const parsed: unknown = JSON.parse(raw);
    const err = (parsed as { error?: { message?: unknown } } | null)?.error;
    if (err && typeof err.message === "string" && err.message.length > 0) {
      message = err.message;
    }
  } catch {
    // Body was HTML, empty, or not JSON: keep the generic message.
  }
  const retry = response.headers.get("Retry-After");
  if (retry && /^\d+$/.test(retry.trim())) {
    message += ` Try again in about ${retry.trim()} seconds.`;
  }
  return message;
}

const STATUS_LABEL: Record<Status, string> = {
  idle: "Idle",
  generating: "Generating",
  complete: "Complete",
  incomplete: "Incomplete",
  interrupted: "Interrupted",
  error: "Error",
  example: "Example — not generated",
};

export function Translator({ config }: { config: TranslatorConfig }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const runCounter = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const ids = { text: useId(), ack: useId(), why: useId(), count: useId() };

  useEffect(() => () => abortRef.current?.abort(), []);

  const { mode } = config;
  const max = config.limits.maxInputCodePoints;
  const count = countCodePoints(state.text);
  const over = count > max;
  const busy = state.status === "generating";
  const hasText = state.text.trim().length > 0;

  let reason = "";
  if (mode === "demo") {
    reason = "Translate is off in demo mode. Choose an example to see a sample.";
  } else if (mode === "disabled") {
    reason = "Translation is currently unavailable.";
  } else if (busy) {
    reason = "A rewrite is in progress.";
  } else if (!hasText) {
    reason = "Enter some text to translate.";
  } else if (over) {
    reason = `Shorten your text to ${max.toLocaleString("en-US")} characters or fewer.`;
  } else if (!state.acknowledged) {
    reason = "Acknowledge the notice to translate.";
  }
  const canTranslate = reason === "";

  async function translate() {
    if (!canTranslate) return;
    const runId = ++runCounter.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: "start", runId });
    let streaming = false;

    try {
      const response = await fetch("/api/translate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          text: state.text,
          sourceStyle: "human",
          targetStyle: "linkedin",
          intensity: "balanced",
          eligibilityConfirmed: true,
          privacyNoticeVersion: config.notice.version,
        }),
        signal: controller.signal,
      });

      const type = response.headers.get("Content-Type") ?? "";
      if (response.status !== 200 || !type.includes("text/event-stream") || !response.body) {
        const message = await httpErrorMessage(response);
        dispatch({ type: "failure", runId, message });
        return;
      }

      const parser = new SseStreamParser();
      const reader = response.body.getReader();
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
        const { done, value } = await reader.read();
        if (done) break;
        handle(parser.push(value));
      }
      if (parser.end().interrupted) {
        dispatch({ type: "interrupted", runId });
      }
    } catch {
      if (controller.signal.aborted) return;
      if (streaming) {
        dispatch({ type: "interrupted", runId });
        return;
      }
      dispatch({
        type: "failure",
        runId,
        message: "Couldn't reach the service. Check your connection and try again.",
      });
    }
  }

  const announcement =
    state.status === "generating"
      ? "Generating…"
      : state.status === "complete"
        ? "Rewrite complete"
        : state.message;

  const statusText =
    state.message && state.status !== "complete" && state.status !== "example"
      ? `${STATUS_LABEL[state.status]} — ${state.message}`
      : STATUS_LABEL[state.status];

  const panel = "rounded-xl border border-line bg-white p-4 sm:p-6";
  const label = "text-sm font-semibold uppercase tracking-wide text-accent-strong";

  return (
    <div>
      <p className="mb-4 text-sm text-ink-soft" data-testid="direction">
        <span className="font-semibold text-ink">Human → LinkedIn</span>
        <span aria-hidden="true"> · </span>
        <span>Intensity: Balanced</span>
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className={panel} aria-labelledby={`${ids.text}-h`}>
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 id={`${ids.text}-h`} className={label}>
              Human
            </h2>
            <span className="text-sm text-ink-soft">Source</span>
          </div>
          <label htmlFor={ids.text} className="mb-2 block font-medium">
            Your text
          </label>
          <textarea
            id={ids.text}
            value={state.text}
            disabled={busy}
            onChange={(e) => dispatch({ type: "text", text: e.target.value })}
            aria-describedby={ids.count}
            rows={10}
            placeholder="Say it the way you'd say it out loud."
            className="block min-h-56 w-full resize-y rounded-lg border border-line bg-white p-3 text-base text-ink placeholder:text-ink-soft disabled:bg-canvas"
          />
          <p
            id={ids.count}
            data-testid="counter"
            className={`mt-2 text-sm ${over ? "font-semibold text-red-700" : "text-ink-soft"}`}
          >
            {count.toLocaleString("en-US")} / {max.toLocaleString("en-US")}
            {over ? " — over the limit; shorten your text" : ""}
          </p>

          <div className="mt-4">
            <p className="mb-1 text-sm text-ink-soft">Try an example</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    dispatch({
                      type: "example",
                      example: ex,
                      showOutput: mode === "demo",
                    })
                  }
                  className="min-h-11 rounded-full border border-line bg-accent-soft px-4 text-sm font-medium text-accent-strong hover:border-accent disabled:opacity-50"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 border-t border-line pt-4">
            <p className="text-sm text-ink-soft">{config.notice.text}</p>
            <label
              htmlFor={ids.ack}
              className="mt-3 flex min-h-11 cursor-pointer items-start gap-3"
            >
              <input
                id={ids.ack}
                type="checkbox"
                checked={state.acknowledged}
                disabled={busy}
                onChange={(e) =>
                  dispatch({ type: "acknowledge", value: e.target.checked })
                }
                className="mt-1 size-5 shrink-0 accent-accent"
              />
              <span className="text-sm">
                I am an adult, I understand this notice, and I won&rsquo;t submit
                personal or confidential text.
              </span>
            </label>
            <button
              type="button"
              onClick={translate}
              disabled={!canTranslate}
              aria-describedby={reason ? ids.why : undefined}
              className="mt-3 min-h-11 w-full rounded-lg bg-accent px-6 font-semibold text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-line disabled:text-ink sm:w-auto"
            >
              {busy ? "Translating…" : "Translate"}
            </button>
            {reason && (
              <p id={ids.why} className="mt-2 text-sm text-ink-soft">
                {reason}
              </p>
            )}
          </div>
        </section>

        <section className={panel} aria-labelledby={`${ids.text}-o`}>
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <h2 id={`${ids.text}-o`} className={label}>
              LinkedIn
            </h2>
            <span className="text-sm text-ink-soft">Result</span>
          </div>
          <p
            data-testid="status"
            className={`mb-2 text-sm font-medium ${
              state.status === "example"
                ? "text-accent-strong"
                : state.status === "error" ||
                    state.status === "incomplete" ||
                    state.status === "interrupted"
                  ? "text-red-700"
                  : "text-ink-soft"
            }`}
          >
            {statusText}
          </p>
          <div
            data-testid="output"
            tabIndex={0}
            aria-label="LinkedIn rewrite"
            className={`min-h-56 whitespace-pre-wrap rounded-lg border p-3 text-base ${
              state.status === "example"
                ? "border-dashed border-accent bg-accent-soft"
                : "border-line bg-canvas"
            }`}
          >
            {state.output || (
              <span className="text-ink-soft">
                Your rewrite will appear here.
              </span>
            )}
          </div>
          {(state.status === "incomplete" || state.status === "interrupted") && (
            <p className="mt-2 text-sm text-red-700">
              The text above is incomplete. Your input was kept; you can try again.
            </p>
          )}
        </section>
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}

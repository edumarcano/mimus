"use client";

import { useEffect, useId, useReducer, useRef, useState } from "react";
import type { LiveAvailability } from "@/lib/api-types";
import { EXAMPLES } from "@/lib/examples";
import {
  addEntry,
  clearHistory,
  historyPreview,
  loadHistory,
  saveHistory,
  type HistoryEntry,
} from "@/lib/history";
import { countCodePoints } from "@/lib/limits";
import {
  ACK_STORAGE_KEY,
  NOTICE_ACK_LABEL,
  NOTICE_DEMO,
  NOTICE_FULL,
} from "@/lib/notice";
import {
  loadPreferences,
  preferencesFromState,
  savePreferences,
} from "@/lib/preferences";
import {
  migrateLegacyStorage,
  safeRemoveItem,
  safeSetItem,
} from "@/lib/storage";
import { SseStreamParser } from "@/lib/stream";
import {
  effectiveIntensity,
  INTENSITIES,
  INTENSITY_LABELS,
  STYLE_IDS,
  STYLE_LABELS,
  type Intensity,
  type StyleId,
} from "@/lib/styles";
import {
  canCopy,
  canRegenerate,
  canSwapOutput,
  formatCopyBoth,
  INITIAL_TRANSLATOR_STATE,
  isStale,
  buildRequestSnapshot,
  submitBlockReason,
  translatorReducer,
  type RequestSnapshot,
  type TranslatorStatus,
} from "@/lib/translator-state";

export type TranslatorConfig = {
  mode: "demo" | "live" | "disabled";
  liveAvailability?: LiveAvailability;
  notice: { version: string; text: string };
  limits: { maxInputCodePoints: number };
};

export function isLiveTranslationAvailable(
  config: TranslatorConfig,
): boolean {
  return config.mode === "live" && config.liveAvailability !== "region";
}

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

const STATUS_LABEL: Record<TranslatorStatus, string> = {
  idle: "Idle",
  generating: "Generating",
  complete: "Complete",
  canceled: "Stopped",
  blocked: "Blocked",
  truncated: "Truncated",
  interrupted: "Interrupted",
  failed: "Failed",
  example: "Example — not generated",
  history: "From history — saved in this browser",
};

const PARTIAL_STATUSES: readonly TranslatorStatus[] = [
  "canceled",
  "truncated",
  "interrupted",
  "failed",
];

const selectClass =
  "min-h-11 w-full min-w-0 rounded-lg border border-control-line bg-white px-3 text-base text-ink disabled:bg-canvas disabled:opacity-60";
const secondaryButton =
  "min-h-11 rounded-lg border border-control-line bg-white px-4 text-sm font-medium transition-colors text-ink hover:border-accent disabled:cursor-not-allowed disabled:opacity-50";

function StyleSelect(props: {
  id: string;
  label: string;
  value: StyleId;
  disabled: boolean;
  onChange: (style: StyleId) => void;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={props.id} className="mb-1 block text-sm text-ink-soft">
        {props.label}
      </label>
      <select
        id={props.id}
        value={props.value}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.target.value as StyleId)}
        className={selectClass}
      >
        {STYLE_IDS.map((id) => (
          <option key={id} value={id}>
            {STYLE_LABELS[id]}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Translator({ config }: { config: TranslatorConfig }) {
  const [state, dispatch] = useReducer(
    translatorReducer,
    INITIAL_TRANSLATOR_STATE,
  );
  const [copyNote, setCopyNote] = useState<{
    key: string;
    ok: boolean;
    text: string;
  } | null>(null);
  const runCounter = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const prefsHydrated = useRef(false);
  const prevStatus = useRef(state.status);
  const ids = {
    text: useId(),
    ack: useId(),
    why: useId(),
    count: useId(),
    source: useId(),
    target: useId(),
    history: useId(),
  };

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const liveAvailable = isLiveTranslationAvailable(config);
  const noticeVersion = config.notice.version;
  const {
    sourceStyle,
    targetStyle,
    intensity,
    rememberedIntensity,
    historyEnabled,
  } = state;

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    migrateLegacyStorage();
    dispatch({
      type: "hydrateClient",
      prefs: loadPreferences() ?? undefined,
      history: loadHistory(),
    });
    prefsHydrated.current = true;
  }, []);

  useEffect(() => {
    if (!liveAvailable) return;
    try {
      const stored = sessionStorage.getItem(ACK_STORAGE_KEY);
      if (stored === noticeVersion) {
        dispatch({ type: "setAcknowledged", value: true });
      }
    } catch {
      // sessionStorage unavailable
    }
  }, [liveAvailable, noticeVersion]);

  useEffect(() => {
    if (!prefsHydrated.current) {
      return;
    }
    const prefs = preferencesFromState({
      sourceStyle,
      targetStyle,
      intensity,
      rememberedIntensity,
      historyEnabled,
    });
    if (!prefs) {
      return;
    }
    if (!savePreferences(prefs)) {
      dispatch({
        type: "setStorageNote",
        message: "Couldn't save to this browser.",
      });
    }
  }, [sourceStyle, targetStyle, intensity, rememberedIntensity, historyEnabled]);

  useEffect(() => {
    if (
      prevStatus.current !== "complete" &&
      state.status === "complete" &&
      state.historyEnabled &&
      state.snapshot &&
      state.output.length > 0
    ) {
      const next = addEntry(
        state.historyEntries,
        state.snapshot!,
        state.output,
      );
      if (!saveHistory(next)) {
        dispatch({
          type: "setStorageNote",
          message: "Couldn't save to this browser.",
        });
      }
      dispatch({ type: "setHistoryEntries", entries: next });
    }
    prevStatus.current = state.status;
    // historyEntries is a dependency, but saving only happens on the
    // transition into "complete" (guarded by prevStatus), so the
    // setHistoryEntries dispatch below cannot cause a second save.
  }, [
    state.status,
    state.historyEnabled,
    state.snapshot,
    state.output,
    state.historyEntries,
  ]);

  useEffect(() => {
    if (state.noticeOutdated) {
      const el = document.getElementById(ids.why);
      el?.focus();
    }
  }, [state.noticeOutdated, ids.why]);

  const { mode } = config;
  const max = config.limits.maxInputCodePoints;
  const count = countCodePoints(state.text);
  const over = count > max;
  const busy = state.status === "generating";
  const isHuman = state.targetStyle === "human";
  const reason = submitBlockReason(state, {
    mode,
    liveAvailability: config.liveAvailability,
    maxInputCodePoints: max,
  });
  const noticeText = liveAvailable ? NOTICE_FULL : NOTICE_DEMO;
  const canTranslate = reason === "";
  const stale = isStale(state);
  const regenerateOk = canRegenerate(state) && reason === "";
  const copyOk = canCopy(state);
  const swapMovesOutput = canSwapOutput(state);
  const effective = effectiveIntensity(state.targetStyle, state.intensity);
  const sourceLabel = STYLE_LABELS[state.sourceStyle];
  const targetLabel = STYLE_LABELS[state.targetStyle];

  async function run(snapshot: RequestSnapshot) {
    const runId = ++runCounter.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    dispatch({ type: "start", runId });
    let streaming = false;
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
          privacyNoticeVersion: config.notice.version,
        }),
        signal: controller.signal,
      });

      const type = response.headers.get("Content-Type") ?? "";
      if (response.status !== 200 || !type.includes("text/event-stream") || !response.body) {
        const { message, code } = await parseHttpError(response);
        if (code === "NOTICE_CHANGED") {
          safeRemoveItem(sessionStorage, ACK_STORAGE_KEY);
          dispatch({ type: "setAcknowledged", value: false });
        }
        dispatch({ type: "failure", runId, message, code });
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
        message: "Couldn't reach the service. Check your connection and try again.",
      });
    }
  }

  function translate() {
    if (!canTranslate) return;
    void run(buildRequestSnapshot(state));
  }

  function regenerate() {
    if (!regenerateOk || !state.snapshot) return;
    void run(state.snapshot);
  }

  function stop() {
    dispatch({ type: "stop", runId: state.runId });
    abortRef.current?.abort();
  }

  const copyKey = `${state.runId}:${state.status}`;
  async function copy(kind: "result" | "both") {
    let ok = false;
    let text: string;
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("unavailable");
      }
      const payload =
        kind === "both" && state.snapshot
          ? formatCopyBoth(state.snapshot, state.output)
          : state.output;
      await navigator.clipboard.writeText(payload);
      ok = true;
      text = kind === "both" ? "Copied both texts." : "Copied result.";
    } catch {
      text =
        "Couldn't copy automatically. Select the text and copy it manually.";
    }
    setCopyNote({ key: copyKey, ok, text });
  }

  function applyExample(id: string) {
    const ex = EXAMPLES.find((e) => e.id === id);
    if (!ex) return;
    dispatch({ type: "setSourceStyle", style: ex.sourceStyle });
    if (!liveAvailable) {
      dispatch({ type: "setTargetStyle", style: ex.targetStyle });
      dispatch({ type: "setIntensity", intensity: ex.intensity });
    }
    dispatch({
      type: "example",
      input: ex.input,
      showOutput: !liveAvailable,
      output: ex.output,
    });
  }

  function persistAck(value: boolean) {
    dispatch({ type: "setAcknowledged", value });
    if (value) {
      if (!safeSetItem(sessionStorage, ACK_STORAGE_KEY, config.notice.version)) {
        dispatch({
          type: "setStorageNote",
          message: "Couldn't save to this browser.",
        });
      }
    } else {
      safeRemoveItem(sessionStorage, ACK_STORAGE_KEY);
    }
  }

  function toggleHistory(enabled: boolean) {
    dispatch({ type: "setHistoryEnabled", enabled });
    if (!enabled) {
      if (!clearHistory()) {
        dispatch({
          type: "setStorageNote",
          message: "Couldn't save to this browser.",
        });
      }
      dispatch({ type: "setHistoryEntries", entries: [] });
    }
  }

  function loadFromHistory(entry: HistoryEntry) {
    dispatch({ type: "loadHistory", entry });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== "Enter" || !(e.ctrlKey || e.metaKey)) return;
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (!canTranslate) return;
    e.preventDefault();
    translate();
  }

  const announcement =
    state.status === "generating"
      ? "Generating…"
      : state.status === "complete" || state.status === "history"
        ? "Rewrite complete"
        : state.status === "canceled"
          ? "Stopped"
          : state.message;

  const statusText =
    state.message &&
    state.status !== "complete" &&
    state.status !== "history" &&
    state.status !== "example" &&
    state.status !== "canceled"
      ? `${STATUS_LABEL[state.status]} — ${state.message}`
      : STATUS_LABEL[state.status];
  const statusTone =
    state.status === "example" || state.status === "history"
      ? "text-accent-strong"
      : state.status === "blocked" || PARTIAL_STATUSES.includes(state.status)
        ? "text-red-700"
        : "text-ink-soft";
  const showPartialNote =
    PARTIAL_STATUSES.includes(state.status) && state.output !== "";
  const showStale =
    stale &&
    state.status !== "idle" &&
    state.status !== "generating" &&
    state.status !== "example";

  const panel = "min-w-0 rounded-xl border border-line bg-white p-4 sm:p-6";
  const label = "text-sm font-semibold uppercase tracking-wide text-accent-strong";

  return (
    <div>
      <p className="mb-4 text-sm text-ink-soft" data-testid="direction">
        <span className="font-semibold text-ink">
          {sourceLabel} → {targetLabel}
        </span>
        <span aria-hidden="true"> · </span>
        <span>
          {isHuman
            ? "Plain English"
            : `Intensity: ${INTENSITY_LABELS[effective]}`}
        </span>
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-4">
        <section className={panel} aria-labelledby={`${ids.text}-h`}>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
            <h2 id={`${ids.text}-h`} className={label}>
              {sourceLabel} <span className="text-ink-soft">· Source</span>
            </h2>
            <div className="w-full sm:w-48">
              <StyleSelect
                id={ids.source}
                label="Source style"
                value={state.sourceStyle}
                disabled={busy}
                onChange={(style) => dispatch({ type: "setSourceStyle", style })}
              />
            </div>
          </div>
          <label htmlFor={ids.text} className="mb-2 block font-medium">
            Your text
          </label>
          <textarea
            id={ids.text}
            value={state.text}
            disabled={busy}
            onChange={(e) => dispatch({ type: "setText", text: e.target.value })}
            onKeyDown={onKeyDown}
            ref={textareaRef}
            aria-describedby={ids.count}
            rows={10}
            placeholder="Say it the way you'd say it out loud."
            className="block min-h-56 w-full resize-y rounded-lg border border-control-line bg-white p-3 text-base text-ink placeholder:text-ink-soft disabled:bg-canvas"
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p
              id={ids.count}
              data-testid="counter"
              className={`text-sm ${over ? "font-semibold text-red-700" : "text-ink-soft"}`}
            >
              {count.toLocaleString("en-US")} / {max.toLocaleString("en-US")}
              {over ? " — over the limit; shorten your text" : ""}
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                dispatch({ type: "clear" });
                textareaRef.current?.focus();
              }}
              className={secondaryButton}
            >
              Clear
            </button>
          </div>

          <div className="mt-4">
            <p className="mb-1 text-sm text-ink-soft">Try an example</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  disabled={busy}
                  onClick={() => applyExample(ex.id)}
                  className="min-h-11 rounded-full transition-colors border border-control-line bg-accent-soft px-4 text-sm font-medium text-accent-strong hover:border-accent disabled:opacity-50"
                >
                  {ex.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 border-t border-line pt-4">
            <p className="text-sm text-ink-soft">{noticeText}</p>
            {liveAvailable && (
              <label
                htmlFor={ids.ack}
                className="mt-3 flex min-h-11 cursor-pointer items-start gap-3"
              >
                <input
                  id={ids.ack}
                  type="checkbox"
                  checked={state.acknowledged}
                  disabled={busy}
                  onChange={(e) => persistAck(e.target.checked)}
                  className="mt-1 size-5 shrink-0 accent-accent"
                />
                <span className="text-sm">{NOTICE_ACK_LABEL}</span>
              </label>
            )}
            {busy ? (
              <button
                type="button"
                onClick={stop}
                className="mt-3 min-h-11 w-full rounded-lg transition-colors border border-accent bg-white px-6 font-semibold text-accent-strong hover:bg-accent-soft sm:w-auto"
              >
                Stop
              </button>
            ) : (
              <button
                type="button"
                onClick={translate}
                disabled={!canTranslate}
                aria-describedby={reason ? ids.why : undefined}
                className="mt-3 min-h-11 w-full rounded-lg transition-colors bg-accent px-6 font-semibold text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:bg-line disabled:text-ink sm:w-auto"
              >
                Translate
              </button>
            )}
            {reason && (
              <p
                id={ids.why}
                tabIndex={-1}
                className="mt-2 text-sm text-ink-soft outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {reason}
              </p>
            )}
            {state.storageNote && (
              <p className="mt-2 text-sm text-ink-soft" role="status">
                {state.storageNote}
              </p>
            )}
          </div>
        </section>

        <div className="flex items-center justify-center lg:self-start lg:pt-24">
          <button
            type="button"
            onClick={() => {
              dispatch({ type: "swap" });
              textareaRef.current?.focus();
            }}
            disabled={busy}
            aria-label="Swap source and target styles"
            title={
              swapMovesOutput
                ? "Swap styles and move the result into the input"
                : "Swap styles"
            }
            className={`${secondaryButton} flex items-center gap-2`}
          >
            <span aria-hidden="true" className="lg:hidden">
              ⇅
            </span>
            <span aria-hidden="true" className="hidden lg:inline">
              ⇄
            </span>
            Swap
          </button>
        </div>

        <section className={panel} aria-labelledby={`${ids.text}-o`}>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
            <h2 id={`${ids.text}-o`} className={label}>
              {targetLabel} <span className="text-ink-soft">· Result</span>
            </h2>
            <div className="w-full sm:w-48">
              <StyleSelect
                id={ids.target}
                label="Target style"
                value={state.targetStyle}
                disabled={busy}
                onChange={(style) => dispatch({ type: "setTargetStyle", style })}
              />
            </div>
          </div>

          <fieldset
            disabled={busy || isHuman}
            className="mb-3 min-w-0 border-0 p-0"
          >
            <legend className="mb-1 text-sm text-ink-soft">Intensity</legend>
            <div className="flex flex-wrap gap-2">
              {INTENSITIES.map((level: Intensity) => (
                <label
                  key={level}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-control-line px-3 text-sm has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
                >
                  <input
                    type="radio"
                    name={`${ids.target}-intensity`}
                    value={level}
                    checked={state.intensity === level}
                    disabled={busy || isHuman}
                    onChange={() =>
                      dispatch({ type: "setIntensity", intensity: level })
                    }
                    className="size-4 accent-accent"
                  />
                  {INTENSITY_LABELS[level]}
                </label>
              ))}
            </div>
            {isHuman && (
              <p className="mt-1 text-sm text-ink-soft">
                Plain English keeps it direct.
              </p>
            )}
          </fieldset>

          <p
            data-testid="status"
            className={`mb-2 text-sm font-medium ${statusTone}`}
          >
            {busy && (
              <span
                aria-hidden="true"
                data-testid="busy-indicator"
                className="mr-2 inline-block size-2 rounded-full bg-accent align-middle motion-safe:animate-pulse"
              />
            )}
            {statusText}
          </p>
          {showStale && (
            <p data-testid="stale" className="mb-2 text-sm font-medium text-ink">
              Result is from your previous input
            </p>
          )}
          <div
            data-testid="output"
            tabIndex={0}
            aria-label={`${targetLabel} rewrite`}
            className={`min-h-56 whitespace-pre-wrap break-words rounded-lg border p-3 text-base ${
              state.status === "example" || state.status === "history"
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
          {showPartialNote && (
            <p className="mt-2 text-sm text-red-700">
              The text above is incomplete. Your input was kept; you can try again.
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!copyOk}
              onClick={() => void copy("result")}
              className={secondaryButton}
            >
              Copy result
            </button>
            <button
              type="button"
              disabled={!copyOk || !state.snapshot}
              onClick={() => void copy("both")}
              className={secondaryButton}
            >
              Copy both
            </button>
            <button
              type="button"
              disabled={!regenerateOk}
              onClick={regenerate}
              className={secondaryButton}
            >
              Regenerate
            </button>
          </div>
          {copyNote && copyNote.key === copyKey && (
            <p
              data-testid="copy-note"
              role="status"
              className={`mt-2 text-sm ${copyNote.ok ? "text-ink-soft" : "text-red-700"}`}
            >
              {copyNote.text}
            </p>
          )}
        </section>
      </div>

      <details className="mt-8 rounded-xl border border-line bg-white p-4">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-ink">
          History in this browser
        </summary>
        <div className="mt-4 space-y-3 text-sm text-ink-soft">
          <label className="flex min-h-11 cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={state.historyEnabled}
              disabled={busy}
              onChange={(e) => toggleHistory(e.target.checked)}
              className="size-5 accent-accent"
            />
            <span>Save completed rewrites in this browser</span>
          </label>
          <p>
            History is off by default, stored unencrypted in localStorage, and
            not suitable for shared devices.
          </p>
          <button
            type="button"
            disabled={busy || state.historyEntries.length === 0}
            onClick={() => {
              if (!clearHistory()) {
                dispatch({
                  type: "setStorageNote",
                  message: "Couldn't save to this browser.",
                });
              }
              dispatch({ type: "setHistoryEntries", entries: [] });
            }}
            className={secondaryButton}
          >
            Clear history
          </button>
          {state.historyEntries.length > 0 ? (
            <ul className="space-y-2" aria-labelledby={ids.history}>
              <li id={ids.history} className="sr-only">
                Saved rewrites
              </li>
              {state.historyEntries.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {STYLE_LABELS[entry.snapshot.sourceStyle]} →{" "}
                      {STYLE_LABELS[entry.snapshot.targetStyle]}
                    </p>
                    <p className="text-xs">
                      {new Date(entry.savedAt).toLocaleString()}
                    </p>
                    <p className="mt-1 truncate text-ink-soft">
                      {historyPreview(entry.output)}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => loadFromHistory(entry)}
                    className={secondaryButton}
                  >
                    Load
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>No saved rewrites yet.</p>
          )}
        </div>
      </details>

      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
    </div>
  );
}

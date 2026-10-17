"use client";

import { useEffect, useId, useReducer, useRef, useState } from "react";
import type { LiveAvailability } from "@/lib/api-types";
import { EXAMPLES } from "@/lib/examples";
import {
  addEntry,
  clearHistory,
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
  browserStorage,
  migrateLegacyStorage,
  safeRemoveItem,
  safeSetItem,
} from "@/lib/storage";
import { useRewriteStream } from "./use-rewrite-stream";
import { TranslatorHistory } from "./translator-history";
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
  type TranslatorStatus,
} from "@/lib/translator-state";

export type TranslatorConfig = {
  mode: "demo" | "live" | "disabled";
  liveAvailability?: LiveAvailability;
  notice: { version: string; text: string };
  limits: { maxInputCodePoints: number };
};

export function isLiveTranslationAvailable(config: TranslatorConfig): boolean {
  return config.mode === "live" && config.liveAvailability !== "region";
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
  const [exampleNotice, setExampleNotice] = useState({ text: "", sequence: 0 });
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
  const { run, stop: stopRun } = useRewriteStream({ noticeVersion, dispatch });
  const {
    sourceStyle,
    targetStyle,
    intensity,
    rememberedIntensity,
    historyEnabled,
  } = state;

  useEffect(() => {
    if (!migrateLegacyStorage()) {
      dispatch({
        type: "setStorageNote",
        message: "Couldn't save to this browser.",
      });
    }
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
      const stored = browserStorage("sessionStorage")?.getItem(ACK_STORAGE_KEY);
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
  }, [
    sourceStyle,
    targetStyle,
    intensity,
    rememberedIntensity,
    historyEnabled,
  ]);

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

  function translate() {
    if (!canTranslate) return;
    void run(buildRequestSnapshot(state));
  }

  function regenerate() {
    if (!regenerateOk || !state.snapshot) return;
    void run(state.snapshot);
  }

  function stop() {
    stopRun(state.runId);
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
    setExampleNotice((previous) => ({
      text: liveAvailable
        ? `${ex.label} example loaded into Your text.`
        : `${ex.label} example loaded. Example — not generated.`,
      sequence: previous.sequence + 1,
    }));
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
      if (
        !safeSetItem(
          browserStorage("sessionStorage"),
          ACK_STORAGE_KEY,
          config.notice.version,
        )
      ) {
        dispatch({
          type: "setStorageNote",
          message: "Couldn't save to this browser.",
        });
      }
    } else {
      safeRemoveItem(browserStorage("sessionStorage"), ACK_STORAGE_KEY);
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
  const label =
    "text-sm font-semibold uppercase tracking-wide text-accent-strong";

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
                onChange={(style) =>
                  dispatch({ type: "setSourceStyle", style })
                }
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
            onChange={(e) =>
              dispatch({ type: "setText", text: e.target.value })
            }
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
                onChange={(style) =>
                  dispatch({ type: "setTargetStyle", style })
                }
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
            <p
              data-testid="stale"
              className="mb-2 text-sm font-medium text-ink"
            >
              Result is from your previous input
            </p>
          )}
          <textarea
            data-testid="output"
            readOnly
            rows={8}
            value={state.output}
            placeholder="Your rewrite will appear here."
            aria-label={`${targetLabel} rewrite`}
            className={`field-sizing-content min-h-56 w-full resize-y whitespace-pre-wrap break-words rounded-lg border p-3 text-base placeholder:text-ink-soft ${
              state.status === "example" || state.status === "history"
                ? "border-dashed border-accent bg-accent-soft"
                : "border-line bg-canvas"
            }`}
          />
          {showPartialNote && (
            <p className="mt-2 text-sm text-red-700">
              The text above is incomplete. Your input was kept; you can try
              again.
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

      <TranslatorHistory
        enabled={state.historyEnabled}
        entries={state.historyEntries}
        busy={busy}
        labelId={ids.history}
        buttonClassName={secondaryButton}
        onToggle={toggleHistory}
        onLoad={loadFromHistory}
        onClear={() => {
          if (!clearHistory())
            dispatch({
              type: "setStorageNote",
              message: "Couldn't save to this browser.",
            });
          dispatch({ type: "setHistoryEntries", entries: [] });
        }}
      />

      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <div role="status" aria-live="polite" className="sr-only">
        <span key={exampleNotice.sequence}>{exampleNotice.text}</span>
      </div>
    </div>
  );
}

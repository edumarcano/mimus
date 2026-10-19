"use client";

import { historyPreview, type HistoryEntry } from "@/lib/history";
import { STYLE_DISPLAY_LABELS } from "@/lib/styles";

type TranslatorHistoryProps = {
  enabled: boolean;
  entries: HistoryEntry[];
  busy: boolean;
  labelId: string;
  buttonClassName: string;
  onToggle: (enabled: boolean) => void;
  onLoad: (entry: HistoryEntry) => void;
  onClear: () => void;
};

export function TranslatorHistory({
  enabled,
  entries,
  busy,
  labelId,
  buttonClassName,
  onToggle,
  onLoad,
  onClear,
}: TranslatorHistoryProps) {
  return (
    <details className="mt-8 rounded-xl border border-line bg-surface p-4">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-ink">
        History in this browser
      </summary>
      <div className="mt-4 space-y-3 text-sm text-ink-soft">
        <label className="flex min-h-11 cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={enabled}
            disabled={busy}
            onChange={(e) => onToggle(e.target.checked)}
            className="size-5 accent-accent"
          />
          <span>Save completed rewrites in this browser</span>
        </label>
        <p>
          History is off by default, stored unencrypted in localStorage, and not
          suitable for shared devices.
        </p>
        <button
          type="button"
          disabled={busy || entries.length === 0}
          onClick={onClear}
          className={buttonClassName}
        >
          Clear history
        </button>
        {entries.length > 0 ? (
          <ul className="space-y-2" aria-labelledby={labelId}>
            <li id={labelId} className="sr-only">
              Saved rewrites
            </li>
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium text-ink">
                    {STYLE_DISPLAY_LABELS[entry.snapshot.sourceStyle]} →{" "}
                    {STYLE_DISPLAY_LABELS[entry.snapshot.targetStyle]}
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
                  onClick={() => onLoad(entry)}
                  className={buttonClassName}
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
  );
}

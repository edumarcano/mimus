import type { RequestSnapshot } from "./translator-state";
import { safeGetItem, safeSetItem, type StorageLike } from "./storage";
import { INTENSITIES, isDistinctPair, STYLE_IDS } from "./styles";

export const HISTORY_STORAGE_KEY = "mimus:history:v1";
export const HISTORY_MAX_ENTRIES = 10;

export type HistoryEntry = {
  id: string;
  savedAt: string;
  snapshot: RequestSnapshot;
  output: string;
};

function isHistoryEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== "object") {
    return false;
  }
  const v = value as Record<string, unknown>;
  const snap = v.snapshot as Record<string, unknown> | undefined;
  if (
    typeof v.id !== "string" ||
    typeof v.savedAt !== "string" ||
    typeof v.output !== "string" ||
    !snap ||
    typeof snap.text !== "string" ||
    typeof snap.sourceStyle !== "string" ||
    typeof snap.targetStyle !== "string" ||
    typeof snap.effectiveIntensity !== "string"
  ) {
    return false;
  }
  if (
    !(STYLE_IDS as readonly string[]).includes(snap.sourceStyle) ||
    !(STYLE_IDS as readonly string[]).includes(snap.targetStyle) ||
    !(INTENSITIES as readonly string[]).includes(snap.effectiveIntensity)
  ) {
    return false;
  }
  return isDistinctPair(
    snap.sourceStyle as RequestSnapshot["sourceStyle"],
    snap.targetStyle as RequestSnapshot["targetStyle"],
  );
}

export function parseHistory(raw: string | null): HistoryEntry[] {
  if (raw === null) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isHistoryEntry).slice(0, HISTORY_MAX_ENTRIES);
  } catch {
    return [];
  }
}

export function loadHistory(
  storage: StorageLike = localStorage,
): HistoryEntry[] {
  return parseHistory(safeGetItem(storage, HISTORY_STORAGE_KEY));
}

export function saveHistory(
  entries: HistoryEntry[],
  storage: StorageLike = localStorage,
): boolean {
  return safeSetItem(storage, HISTORY_STORAGE_KEY, JSON.stringify(entries));
}

export function clearHistory(storage: StorageLike = localStorage): boolean {
  return saveHistory([], storage);
}

export function addEntry(
  entries: HistoryEntry[],
  snapshot: RequestSnapshot,
  output: string,
  now: () => string = () => new Date().toISOString(),
): HistoryEntry[] {
  const entry: HistoryEntry = {
    id: crypto.randomUUID(),
    savedAt: now(),
    snapshot,
    output,
  };
  return [entry, ...entries].slice(0, HISTORY_MAX_ENTRIES);
}

export function historyPreview(text: string, max = 80): string {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) {
    return oneLine;
  }
  return `${oneLine.slice(0, max - 1)}…`;
}

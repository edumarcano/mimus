import { describe, expect, it } from "vitest";
import {
  addEntry,
  clearHistory,
  HISTORY_MAX_ENTRIES,
  loadHistory,
  parseHistory,
  saveHistory,
  type HistoryEntry,
} from "@/lib/history";
import type { RequestSnapshot } from "@/lib/translator-state";

const snapshot: RequestSnapshot = {
  text: "hello",
  sourceStyle: "human",
  targetStyle: "linkedin",
  effectiveIntensity: "balanced",
};

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => {
      map.delete(key);
    },
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

describe("history", () => {
  it("rejects invalid enums and bounds oversized stored lists on load", () => {
    const good = addEntry([], snapshot, "out")[0];
    const bad = {
      ...good,
      snapshot: { ...snapshot, targetStyle: "pirate" },
    };
    const many = Array.from({ length: 15 }, () => good);
    expect(parseHistory(JSON.stringify([bad]))).toEqual([]);
    expect(parseHistory(JSON.stringify(many))).toHaveLength(
      HISTORY_MAX_ENTRIES,
    );
  });

  it("trims to ten newest entries", () => {
    let entries: HistoryEntry[] = [];
    for (let i = 0; i < 12; i++) {
      entries = addEntry(
        entries,
        snapshot,
        `out-${i}`,
        () => `2026-01-01T00:00:${String(i).padStart(2, "0")}.000Z`,
      );
    }
    expect(entries).toHaveLength(HISTORY_MAX_ENTRIES);
    expect(entries[0]?.output).toBe("out-11");
    expect(entries.at(-1)?.output).toBe("out-2");
  });

  it("rejects corrupt JSON and invalid entries", () => {
    expect(parseHistory("{not json")).toEqual([]);
    expect(
      parseHistory(
        JSON.stringify([
          {
            id: "1",
            savedAt: "t",
            output: "x",
            snapshot: {
              text: "a",
              sourceStyle: "human",
              targetStyle: "human",
              effectiveIntensity: "balanced",
            },
          },
        ]),
      ),
    ).toEqual([]);
  });

  it("tolerates storage that throws on get or set", () => {
    const throwing = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
    };
    expect(loadHistory(throwing)).toEqual([]);
    expect(saveHistory([], throwing)).toBe(false);
    expect(clearHistory(throwing)).toBe(false);
  });

  it("removes history without depending on setItem", () => {
    const storage = memoryStorage();
    const entries = addEntry([], snapshot, "saved");
    expect(saveHistory(entries, storage)).toBe(true);
    storage.setItem = () => {
      throw new Error("quota");
    };
    expect(clearHistory(storage)).toBe(true);
    expect(storage.getItem("mimus:history:v1")).toBeNull();
  });

  it("reports deletion failure without replacing the saved value", () => {
    const storage = memoryStorage();
    const entries = addEntry([], snapshot, "saved");
    expect(saveHistory(entries, storage)).toBe(true);
    storage.removeItem = () => {
      throw new Error("denied");
    };

    expect(clearHistory(storage)).toBe(false);
    expect(loadHistory(storage)).toEqual(entries);
  });
});

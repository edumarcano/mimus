// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { addEntry, HISTORY_STORAGE_KEY, loadHistory } from "@/lib/history";
import { ACK_STORAGE_KEY } from "@/lib/notice";
import { loadPreferences, PREFS_STORAGE_KEY } from "@/lib/preferences";
import {
  migrateLegacyStorage,
  migrateStorageKeys,
  resetLegacyStorageMigrationForTests,
} from "@/lib/storage";
import type { RequestSnapshot } from "@/lib/translator-state";

function memoryStorage(initial?: Record<string, string>) {
  const map = new Map(Object.entries(initial ?? {}));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
    removeItem: (key: string) => {
      map.delete(key);
    },
  };
}

const snapshot: RequestSnapshot = {
  text: "hello",
  sourceStyle: "human",
  targetStyle: "linkedin",
  effectiveIntensity: "balanced",
};

describe("migrateStorageKeys", () => {
  it("copies legacy value when the new key is absent and removes legacy", () => {
    const storage = memoryStorage({ "parlance:ack": "v-test" });
    migrateStorageKeys(storage, [
      { legacy: "parlance:ack", current: ACK_STORAGE_KEY },
    ]);
    expect(storage.getItem(ACK_STORAGE_KEY)).toBe("v-test");
    expect(storage.getItem("parlance:ack")).toBeNull();
  });

  it("keeps an existing new key and still removes legacy", () => {
    const storage = memoryStorage({
      "parlance:prefs:v1": JSON.stringify({ legacy: true }),
      [PREFS_STORAGE_KEY]: JSON.stringify({ current: true }),
    });
    migrateStorageKeys(storage, [
      { legacy: "parlance:prefs:v1", current: PREFS_STORAGE_KEY },
    ]);
    expect(storage.getItem(PREFS_STORAGE_KEY)).toBe(
      JSON.stringify({ current: true }),
    );
    expect(storage.getItem("parlance:prefs:v1")).toBeNull();
  });

  it("tolerates corrupt legacy values; validators reject them on read", () => {
    const storage = memoryStorage({ "parlance:prefs:v1": "{not json" });
    migrateStorageKeys(storage, [
      { legacy: "parlance:prefs:v1", current: PREFS_STORAGE_KEY },
    ]);
    expect(storage.getItem(PREFS_STORAGE_KEY)).toBe("{not json");
    expect(loadPreferences(storage)).toBeNull();
  });

  it("tolerates storage that throws", () => {
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
    expect(() =>
      migrateStorageKeys(throwing, [
        { legacy: "parlance:ack", current: ACK_STORAGE_KEY },
      ]),
    ).not.toThrow();
  });
});

describe("migrateLegacyStorage", () => {
  afterEach(() => {
    resetLegacyStorageMigrationForTests();
    vi.unstubAllGlobals();
  });

  it("is idempotent", () => {
    const local = memoryStorage({
      "parlance:history:v1": JSON.stringify([]),
    });
    vi.stubGlobal("localStorage", local);
    vi.stubGlobal("sessionStorage", memoryStorage());
    migrateLegacyStorage();
    migrateLegacyStorage();
    expect(local.getItem("parlance:history:v1")).toBeNull();
    expect(local.getItem(HISTORY_STORAGE_KEY)).toBe(JSON.stringify([]));
  });

  it("migrates valid history without enabling the history toggle", () => {
    const entry = addEntry([], snapshot, "saved")[0];
    const local = memoryStorage({
      "parlance:history:v1": JSON.stringify([entry]),
    });
    vi.stubGlobal("localStorage", local);
    vi.stubGlobal("sessionStorage", memoryStorage());
    migrateLegacyStorage();
    expect(local.getItem("parlance:history:v1")).toBeNull();
    expect(loadHistory(local)).toEqual([entry]);
  });
});

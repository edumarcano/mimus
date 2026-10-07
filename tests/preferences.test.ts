import { describe, expect, it } from "vitest";
import {
  isPreferences,
  loadPreferences,
  savePreferences,
  type Preferences,
} from "@/lib/preferences";

const valid: Preferences = {
  sourceStyle: "human",
  targetStyle: "linkedin",
  intensity: "balanced",
  rememberedIntensity: "maximum",
  historyEnabled: false,
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

describe("preferences", () => {
  it("round trips valid preferences", () => {
    const storage = memoryStorage();
    expect(savePreferences(valid, storage)).toBe(true);
    expect(loadPreferences(storage)).toEqual(valid);
  });

  it("rejects invalid enums and same-pair styles", () => {
    expect(
      isPreferences({ ...valid, sourceStyle: "not-a-style" }),
    ).toBe(false);
    expect(
      isPreferences({ ...valid, intensity: "loud" }),
    ).toBe(false);
    expect(
      isPreferences({ ...valid, sourceStyle: "human", targetStyle: "human" }),
    ).toBe(false);
  });

  it("returns null when storage is unavailable", () => {
    const storage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(loadPreferences(storage)).toBeNull();
    expect(savePreferences(valid, storage)).toBe(false);
  });
});

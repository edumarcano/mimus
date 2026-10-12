import { safeGetItem, safeParseJson, safeSetItem, type StorageLike } from "./storage";
import {
  INTENSITIES,
  isDistinctPair,
  STYLE_IDS,
  type Intensity,
  type StyleId,
} from "./styles";

export const PREFS_STORAGE_KEY = "mimus:prefs:v1";

export type Preferences = {
  sourceStyle: StyleId;
  targetStyle: StyleId;
  intensity: Intensity;
  rememberedIntensity: Intensity;
  historyEnabled: boolean;
};

export type PreferencesPatch = Partial<Preferences>;

function isStyleId(value: unknown): value is StyleId {
  return (
    typeof value === "string" &&
    (STYLE_IDS as readonly string[]).includes(value)
  );
}

function isIntensity(value: unknown): value is Intensity {
  return (
    typeof value === "string" &&
    (INTENSITIES as readonly string[]).includes(value)
  );
}

export function isPreferences(value: unknown): value is Preferences {
  if (!value || typeof value !== "object") {
    return false;
  }
  const v = value as Record<string, unknown>;
  if (
    !isStyleId(v.sourceStyle) ||
    !isStyleId(v.targetStyle) ||
    !isIntensity(v.intensity) ||
    !isIntensity(v.rememberedIntensity) ||
    typeof v.historyEnabled !== "boolean"
  ) {
    return false;
  }
  return isDistinctPair(v.sourceStyle, v.targetStyle);
}

export function loadPreferences(
  storage: StorageLike = localStorage,
): Preferences | null {
  return safeParseJson(safeGetItem(storage, PREFS_STORAGE_KEY), isPreferences);
}

export function savePreferences(
  prefs: Preferences,
  storage: StorageLike = localStorage,
): boolean {
  return safeSetItem(storage, PREFS_STORAGE_KEY, JSON.stringify(prefs));
}

export function preferencesFromState(state: {
  sourceStyle: StyleId;
  targetStyle: StyleId;
  intensity: Intensity;
  rememberedIntensity: Intensity;
  historyEnabled: boolean;
}): Preferences | null {
  if (!isDistinctPair(state.sourceStyle, state.targetStyle)) {
    return null;
  }
  return {
    sourceStyle: state.sourceStyle,
    targetStyle: state.targetStyle,
    intensity: state.intensity,
    rememberedIntensity: state.rememberedIntensity,
    historyEnabled: state.historyEnabled,
  };
}

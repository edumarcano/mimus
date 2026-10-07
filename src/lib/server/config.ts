import "server-only";

import type { LiveAvailability } from "../api-types";
import { MAX_INPUT_CODE_POINTS } from "../limits";
import { NOTICE_FULL, NOTICE_VERSION } from "../notice";
import { checkRegion, type PolicyContext } from "./policy";
import { MODEL_PUBLIC_LABEL } from "./model-config";

export type ParlanceMode = "demo" | "live" | "disabled";

export type ServerConfig = {
  mode: ParlanceMode;
  isLive: boolean;
  configError: boolean;
  geminiApiKey: string | undefined;
  appOrigin: string | undefined;
  liveCountries: readonly string[];
  devAllowLocalLive: boolean;
};

function parseMode(raw: string | undefined): {
  mode: ParlanceMode;
  invalid: boolean;
} {
  if (raw === undefined || raw.trim() === "") {
    return { mode: "demo", invalid: false };
  }
  if (raw === "live" || raw === "demo" || raw === "disabled") {
    return { mode: raw, invalid: false };
  }
  return { mode: "disabled", invalid: true };
}

function parseOrigin(raw: string | undefined): string | undefined {
  if (!raw || raw.trim() === "") {
    return undefined;
  }
  const trimmed = raw.trim();
  if (trimmed.endsWith("/")) {
    return undefined;
  }
  try {
    const url = new URL(trimmed);
    if (url.origin !== trimmed) {
      return undefined;
    }
    return url.origin;
  } catch {
    return undefined;
  }
}

function parseCountries(raw: string | undefined): readonly string[] {
  if (!raw || raw.trim() === "") {
    return [];
  }
  const codes = raw
    .split(",")
    .map((part) => part.trim().toUpperCase())
    .filter((part) => part.length > 0);
  const valid = codes.every((code) => /^[A-Z]{2}$/.test(code));
  return valid ? codes : [];
}

export function getServerConfig(): ServerConfig {
  // Intentionally ignore GEMINI_MODEL and any model override env vars.
  void process.env.GEMINI_MODEL;

  const { mode, invalid } = parseMode(process.env.PARLANCE_MODE);
  const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || undefined;
  const appOrigin = parseOrigin(process.env.APP_ORIGIN);
  const parsedCountries = parseCountries(process.env.PARLANCE_LIVE_COUNTRIES);
  const countriesInvalid =
    process.env.PARLANCE_LIVE_COUNTRIES !== undefined &&
    process.env.PARLANCE_LIVE_COUNTRIES.trim() !== "" &&
    parsedCountries.length === 0;
  const devAllowLocalLive =
    process.env.PARLANCE_DEV_ALLOW_LOCAL_LIVE === "true";

  const liveReady =
    mode === "live" &&
    Boolean(geminiApiKey) &&
    Boolean(appOrigin) &&
    parsedCountries.length > 0 &&
    !countriesInvalid;

  const configError = invalid || (mode === "live" && !liveReady);

  return {
    mode: configError && mode === "live" ? "disabled" : mode,
    isLive: liveReady,
    configError,
    geminiApiKey,
    appOrigin,
    liveCountries: parsedCountries,
    devAllowLocalLive,
  };
}

export type PublicConfig = {
  mode: ParlanceMode;
  liveAvailability?: LiveAvailability;
  notice: { version: string; text: string };
  limits: { maxInputCodePoints: number };
  modelLabel: string;
};

export function getPublicConfig(ctx?: PolicyContext): PublicConfig {
  const serverConfig = getServerConfig();
  const { mode, isLive } = serverConfig;
  const displayMode: ParlanceMode =
    mode === "live" && !isLive ? "disabled" : isLive ? "live" : mode;

  let liveAvailability: LiveAvailability | undefined;
  if (displayMode === "live" && ctx) {
    liveAvailability = checkRegion(ctx, serverConfig).ok
      ? "available"
      : "region";
  }

  return {
    mode: displayMode,
    liveAvailability,
    notice: {
      version: NOTICE_VERSION,
      text: NOTICE_FULL,
    },
    limits: {
      maxInputCodePoints: MAX_INPUT_CODE_POINTS,
    },
    modelLabel: MODEL_PUBLIC_LABEL,
  };
}

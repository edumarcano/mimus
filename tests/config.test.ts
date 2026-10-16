import { afterEach, describe, expect, it } from "vitest";
import { getPublicConfig, getServerConfig } from "@/lib/server/config";

const ENV_KEYS = [
  "MIMUS_MODE",
  "OPENROUTER_API_KEY",
  "GEMINI_API_KEY",
  "APP_ORIGIN",
  "MIMUS_LIVE_COUNTRIES",
  "MIMUS_DEV_ALLOW_LOCAL_LIVE",
  "GEMINI_MODEL",
  "OPENROUTER_MODEL",
  "PARLANCE_MODE",
  "PARLANCE_LIVE_COUNTRIES",
  "PARLANCE_DEV_ALLOW_LOCAL_LIVE",
] as const;

const snapshot = (): Record<string, string | undefined> => {
  const out: Record<string, string | undefined> = {};
  for (const key of ENV_KEYS) {
    out[key] = process.env[key];
  }
  return out;
};

let saved = snapshot();

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = saved[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
});

function resetEnv(overrides: Record<string, string | undefined>) {
  saved = snapshot();
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
  Object.assign(process.env, overrides);
}

describe("getServerConfig", () => {
  it("defaults to demo when unset", () => {
    resetEnv({});
    const config = getServerConfig();
    expect(config.mode).toBe("demo");
    expect(config.isLive).toBe(false);
  });

  it("treats invalid mode as not live", () => {
    resetEnv({ MIMUS_MODE: "bogus" });
    const config = getServerConfig();
    expect(config.isLive).toBe(false);
    expect(config.configError).toBe(true);
  });

  it("requires OPENROUTER_API_KEY, origin, and countries for live", () => {
    resetEnv({ MIMUS_MODE: "live" });
    expect(getServerConfig().isLive).toBe(false);

    resetEnv({
      MIMUS_MODE: "live",
      OPENROUTER_API_KEY: "test-key",
      APP_ORIGIN: "http://localhost:3000",
    });
    expect(getServerConfig().isLive).toBe(false);

    resetEnv({
      MIMUS_MODE: "live",
      OPENROUTER_API_KEY: "test-key",
      APP_ORIGIN: "http://localhost:3000",
      MIMUS_LIVE_COUNTRIES: "US",
    });
    expect(getServerConfig().isLive).toBe(true);
  });

  it("does not enable live from GEMINI_API_KEY alone", () => {
    resetEnv({
      MIMUS_MODE: "live",
      GEMINI_API_KEY: "legacy-key",
      APP_ORIGIN: "http://localhost:3000",
      MIMUS_LIVE_COUNTRIES: "US",
    });
    expect(getServerConfig().isLive).toBe(false);
  });

  it("ignores GEMINI_MODEL and OPENROUTER_MODEL env", () => {
    resetEnv({
      MIMUS_MODE: "live",
      OPENROUTER_API_KEY: "test-key",
      APP_ORIGIN: "http://localhost:3000",
      MIMUS_LIVE_COUNTRIES: "US",
      GEMINI_MODEL: "some-other-model",
      OPENROUTER_MODEL: "another-model",
    });
    expect(getServerConfig().isLive).toBe(true);
  });

  it("does not enable live from legacy PARLANCE_MODE alone", () => {
    resetEnv({
      PARLANCE_MODE: "live",
      OPENROUTER_API_KEY: "test-key",
      APP_ORIGIN: "http://localhost:3000",
      PARLANCE_LIVE_COUNTRIES: "US",
    });
    const config = getServerConfig();
    expect(config.mode).toBe("demo");
    expect(config.isLive).toBe(false);
    expect(config.liveCountries).toEqual([]);
    expect(config.devAllowLocalLive).toBe(false);
  });

  it("ignores legacy PARLANCE_LIVE_COUNTRIES and PARLANCE_DEV_ALLOW_LOCAL_LIVE", () => {
    resetEnv({
      MIMUS_MODE: "live",
      OPENROUTER_API_KEY: "test-key",
      APP_ORIGIN: "http://localhost:3000",
      PARLANCE_LIVE_COUNTRIES: "US",
      PARLANCE_DEV_ALLOW_LOCAL_LIVE: "true",
    });
    const config = getServerConfig();
    expect(config.isLive).toBe(false);
    expect(config.liveCountries).toEqual([]);
    expect(config.devAllowLocalLive).toBe(false);
  });
});

describe("getPublicConfig", () => {
  it("projects liveAvailability from region headers", () => {
    resetEnv({
      MIMUS_MODE: "live",
      OPENROUTER_API_KEY: "test-key",
      APP_ORIGIN: "http://localhost:3000",
      MIMUS_LIVE_COUNTRIES: "US",
    });
    const allowed = new Headers({ "x-vercel-ip-country": "US" });
    const blocked = new Headers({ "x-vercel-ip-country": "CA" });
    expect(
      getPublicConfig({ headers: allowed, hostname: "example.com" })
        .liveAvailability,
    ).toBe("available");
    expect(
      getPublicConfig({ headers: blocked, hostname: "example.com" })
        .liveAvailability,
    ).toBe("region");
  });

  it("never exposes secrets or origin", () => {
    resetEnv({
      MIMUS_MODE: "live",
      OPENROUTER_API_KEY: "secret-key",
      APP_ORIGIN: "http://localhost:3000",
      MIMUS_LIVE_COUNTRIES: "US",
    });
    const pub = getPublicConfig();
    expect(JSON.stringify(pub)).not.toContain("secret-key");
    expect(JSON.stringify(pub)).not.toContain("localhost");
    expect(pub.limits.maxInputCodePoints).toBe(3000);
    expect(pub.modelLabel).toBe("Gemini 3.5 Flash-Lite");
  });
});

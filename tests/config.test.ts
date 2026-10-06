import { afterEach, describe, expect, it } from "vitest";
import { getPublicConfig, getServerConfig } from "@/lib/server/config";

const ENV_KEYS = [
  "PARLANCE_MODE",
  "GEMINI_API_KEY",
  "APP_ORIGIN",
  "PARLANCE_LIVE_COUNTRIES",
  "PARLANCE_DEV_ALLOW_LOCAL_LIVE",
  "GEMINI_MODEL",
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
    resetEnv({ PARLANCE_MODE: "bogus" });
    const config = getServerConfig();
    expect(config.isLive).toBe(false);
    expect(config.configError).toBe(true);
  });

  it("requires key, origin, and countries for live", () => {
    resetEnv({ PARLANCE_MODE: "live" });
    expect(getServerConfig().isLive).toBe(false);

    resetEnv({
      PARLANCE_MODE: "live",
      GEMINI_API_KEY: "test-key",
      APP_ORIGIN: "http://localhost:3000",
    });
    expect(getServerConfig().isLive).toBe(false);

    resetEnv({
      PARLANCE_MODE: "live",
      GEMINI_API_KEY: "test-key",
      APP_ORIGIN: "http://localhost:3000",
      PARLANCE_LIVE_COUNTRIES: "US",
    });
    expect(getServerConfig().isLive).toBe(true);
  });

  it("ignores GEMINI_MODEL env", () => {
    resetEnv({
      PARLANCE_MODE: "live",
      GEMINI_API_KEY: "test-key",
      APP_ORIGIN: "http://localhost:3000",
      PARLANCE_LIVE_COUNTRIES: "US",
      GEMINI_MODEL: "some-other-model",
    });
    expect(getServerConfig().isLive).toBe(true);
  });
});

describe("getPublicConfig", () => {
  it("never exposes secrets or origin", () => {
    resetEnv({
      PARLANCE_MODE: "live",
      GEMINI_API_KEY: "secret-key",
      APP_ORIGIN: "http://localhost:3000",
      PARLANCE_LIVE_COUNTRIES: "US",
    });
    const pub = getPublicConfig();
    expect(JSON.stringify(pub)).not.toContain("secret-key");
    expect(JSON.stringify(pub)).not.toContain("localhost");
    expect(pub.limits.maxInputCodePoints).toBe(3000);
    expect(pub.modelLabel).toBeTruthy();
  });
});

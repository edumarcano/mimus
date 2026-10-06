import { afterEach, describe, expect, it, vi } from "vitest";
import type { ServerConfig } from "@/lib/server/config";
import { checkRegion, isAllowedOrigin, isLocalLiveBypass } from "@/lib/server/policy";

afterEach(() => {
  vi.unstubAllEnvs();
});

function liveConfig(): ServerConfig {
  return {
    mode: "live",
    isLive: true,
    configError: false,
    geminiApiKey: "key",
    appOrigin: "http://localhost:3000",
    liveCountries: ["US"],
    devAllowLocalLive: true,
  };
}

describe("isAllowedOrigin", () => {
  it("requires exact origin match", () => {
    const config = liveConfig();
    expect(
      isAllowedOrigin(
        new Request("http://localhost:3000/api/translate", {
          headers: { Origin: "http://localhost:3000" },
        }),
        config,
      ).ok,
    ).toBe(true);

    expect(
      isAllowedOrigin(
        new Request("http://localhost:3000/api/translate", {
          headers: { Origin: "http://localhost:3000/" },
        }),
        config,
      ).ok,
    ).toBe(false);

    expect(
      isAllowedOrigin(new Request("http://localhost:3000/api/translate"), config)
        .ok,
    ).toBe(false);
  });
});

describe("checkRegion", () => {
  it("rejects missing or non-allowlisted countries", () => {
    const config = liveConfig();
    vi.stubEnv("NODE_ENV", "production");

    expect(
      checkRegion(new Request("http://example.com/api/translate"), config).ok,
    ).toBe(false);

    expect(
      checkRegion(
        new Request("http://example.com/api/translate", {
          headers: { "x-vercel-ip-country": "CA" },
        }),
        config,
      ).ok,
    ).toBe(false);

    expect(
      checkRegion(
        new Request("http://example.com/api/translate", {
          headers: { "x-vercel-ip-country": "US" },
        }),
        config,
      ).ok,
    ).toBe(true);
  });

  it("allows local bypass only when all conditions hold", () => {
    const config = liveConfig();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("VERCEL_ENV", "");

    const loopback = new Request("http://localhost:3000/api/translate");
    expect(isLocalLiveBypass(loopback, config)).toBe(true);
    expect(checkRegion(loopback, config).ok).toBe(true);

    vi.stubEnv("VERCEL", "1");
    expect(isLocalLiveBypass(loopback, config)).toBe(false);

    vi.stubEnv("VERCEL", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(isLocalLiveBypass(loopback, config)).toBe(false);

    vi.stubEnv("NODE_ENV", "development");
    expect(
      isLocalLiveBypass(new Request("http://127.0.0.1:9999/api/translate"), {
        ...config,
        devAllowLocalLive: false,
      }),
    ).toBe(false);
  });
});

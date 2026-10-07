import "server-only";

import type { ServerConfig } from "./config";

export type OriginCheckResult =
  | { ok: true }
  | { ok: false; reason: "missing" | "mismatch" };

export function isAllowedOrigin(
  request: Request,
  config: ServerConfig,
): OriginCheckResult {
  const origin = request.headers.get("Origin");
  if (!origin) {
    return { ok: false, reason: "missing" };
  }
  if (!config.appOrigin || origin !== config.appOrigin) {
    return { ok: false, reason: "mismatch" };
  }
  return { ok: true };
}

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "[::1]" ||
    normalized === "::1"
  );
}

export type PolicyContext = {
  headers: Headers;
  hostname: string;
};

export function isLocalLiveBypass(
  ctx: PolicyContext,
  config: ServerConfig,
): boolean {
  if (!config.devAllowLocalLive) {
    return false;
  }
  if (process.env.NODE_ENV !== "development") {
    return false;
  }
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    return false;
  }
  return isLoopbackHostname(ctx.hostname);
}

export type RegionCheckResult =
  | { ok: true }
  | { ok: false; reason: "missing" | "not_allowlisted" };

export function checkRegion(
  ctx: PolicyContext,
  config: ServerConfig,
): RegionCheckResult {
  if (isLocalLiveBypass(ctx, config)) {
    return { ok: true };
  }

  const country = ctx.headers.get("x-vercel-ip-country");
  if (!country || country.trim() === "" || country === "XX") {
    return { ok: false, reason: "missing" };
  }

  const upper = country.trim().toUpperCase();
  if (!config.liveCountries.includes(upper)) {
    return { ok: false, reason: "not_allowlisted" };
  }

  return { ok: true };
}

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const config = JSON.parse(
  readFileSync(path.join(root, "vercel.json"), "utf8"),
) as {
  functions?: Record<string, { supportsCancellation?: unknown }>;
};

describe("vercel.json request cancellation", () => {
  it("enables supportsCancellation only for the translate route", () => {
    const enabled = Object.entries(config.functions ?? {}).filter(
      ([, settings]) => settings.supportsCancellation !== undefined,
    );
    expect(enabled).toEqual([
      ["src/app/api/translate/route.ts", { supportsCancellation: true }],
    ]);
  });

  it("points at a route file that exists in the repository", () => {
    expect(existsSync(path.join(root, "src/app/api/translate/route.ts"))).toBe(
      true,
    );
  });
});

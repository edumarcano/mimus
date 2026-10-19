import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const GLOBALS_CSS = join(process.cwd(), "src/app/globals.css");

function parseHex(hex: string): [number, number, number] {
  const normalized = hex.trim().toLowerCase();
  const match = /^#([0-9a-f]{6})$/.exec(normalized);
  if (!match) {
    throw new Error(`Invalid hex color: ${hex}`);
  }
  const value = match[1];
  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function linearize(channel: number): number {
  const c = channel / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(linearize);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2.x contrast ratio for two sRGB hex colors. */
function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

function readThemeColor(name: string): string {
  const css = readFileSync(GLOBALS_CSS, "utf8");
  const pattern = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`);
  const match = pattern.exec(css);
  if (!match) {
    throw new Error(`Missing --color-${name} in globals.css`);
  }
  return match[1].toLowerCase();
}

function readDarkThemeColor(name: string): string {
  const css = readFileSync(GLOBALS_CSS, "utf8");
  const darkBlock = css.match(/\.dark\s*\{([^}]+)\}/);
  if (!darkBlock) {
    throw new Error("Missing .dark block in globals.css");
  }
  const pattern = new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})\\s*;`);
  const match = pattern.exec(darkBlock[1]);
  if (!match) {
    throw new Error(`Missing --color-${name} in .dark block in globals.css`);
  }
  return match[1].toLowerCase();
}

describe("theme contrast tokens", () => {
  const white = "#ffffff";
  const canvas = readThemeColor("canvas");
  const controlLine = readThemeColor("control-line");

  it("control-line borders meet 3:1 on white, canvas, and accent-soft", () => {
    const accentSoft = readThemeColor("accent-soft");
    expect(contrastRatio(controlLine, white)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(controlLine, canvas)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(controlLine, accentSoft)).toBeGreaterThanOrEqual(3);
  });

  it("body text tokens meet 4.5:1 on white and canvas", () => {
    const textTokens = ["ink", "ink-soft", "accent-strong"] as const;
    for (const token of textTokens) {
      const color = readThemeColor(token);
      expect(
        contrastRatio(color, white),
        `${token} on white`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(color, canvas),
        `${token} on canvas`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("white text on accent meets 4.5:1", () => {
    const accent = readThemeColor("accent");
    expect(contrastRatio(white, accent)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("dark theme contrast tokens", () => {
  const surface = readDarkThemeColor("surface");
  const canvas = readDarkThemeColor("canvas");
  const controlLine = readDarkThemeColor("control-line");

  it("control-line borders meet 3:1 on surface, canvas, and accent-soft", () => {
    const accentSoft = readDarkThemeColor("accent-soft");
    expect(contrastRatio(controlLine, surface)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(controlLine, canvas)).toBeGreaterThanOrEqual(3);
    expect(contrastRatio(controlLine, accentSoft)).toBeGreaterThanOrEqual(3);
  });

  it("body text tokens meet 4.5:1 on surface and canvas", () => {
    const textTokens = ["ink", "ink-soft", "accent-strong"] as const;
    for (const token of textTokens) {
      const color = readDarkThemeColor(token);
      expect(
        contrastRatio(color, surface),
        `${token} on surface`,
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(color, canvas),
        `${token} on canvas`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("accent-ink on accent meets 4.5:1", () => {
    const accent = readDarkThemeColor("accent");
    const accentInk = readDarkThemeColor("accent-ink");
    expect(contrastRatio(accentInk, accent)).toBeGreaterThanOrEqual(4.5);
  });
});

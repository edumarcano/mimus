import { describe, expect, it } from "vitest";
import { countCodePoints, MAX_INPUT_CODE_POINTS } from "@/lib/limits";
import { NOTICE_VERSION } from "@/lib/notice";
import { validateTranslateRequest } from "@/lib/schema";
import { STYLE_IDS } from "@/lib/styles";

function base(overrides: Record<string, unknown> = {}) {
  return {
    text: "The team discussed a button color.",
    sourceStyle: "human",
    targetStyle: "linkedin",
    intensity: "balanced",
    eligibilityConfirmed: true,
    privacyNoticeVersion: NOTICE_VERSION,
    ...overrides,
  };
}

describe("validateTranslateRequest", () => {
  it("accepts a valid human to linkedin request", () => {
    const result = validateTranslateRequest(base());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.effectiveIntensity).toBe("balanced");
    }
  });

  it("rejects unknown fields", () => {
    const result = validateTranslateRequest(base({ extra: true }));
    expect(result).toEqual({
      ok: false,
      code: "INVALID_REQUEST",
      message: "The request body is invalid.",
    });
  });

  it("rejects missing fields", () => {
    const body = base();
    delete (body as { text?: string }).text;
    const result = validateTranslateRequest(body);
    expect(result.ok).toBe(false);
  });

  it("rejects bad enums and non-string text", () => {
    expect(validateTranslateRequest(base({ sourceStyle: "pirate" })).ok).toBe(
      false,
    );
    expect(validateTranslateRequest(base({ text: 42 })).ok).toBe(false);
  });

  it("rejects whitespace-only text", () => {
    const result = validateTranslateRequest(base({ text: "   \n\t  " }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toMatch(/Enter some text/);
    }
  });

  it("distinguishes 3000 vs 3001 code points", () => {
    const okText = "a".repeat(MAX_INPUT_CODE_POINTS);
    expect(countCodePoints(okText)).toBe(MAX_INPUT_CODE_POINTS);
    expect(validateTranslateRequest(base({ text: okText })).ok).toBe(true);

    const big = okText + "b";
    expect(countCodePoints(big)).toBe(MAX_INPUT_CODE_POINTS + 1);
    const result = validateTranslateRequest(base({ text: big }));
    expect(result).toEqual({
      ok: false,
      code: "INPUT_TOO_LARGE",
      message: "The text is too long. Shorten it and try again.",
    });
  });

  it("rejects all five same-style pairs", () => {
    for (const style of STYLE_IDS) {
      expect(
        validateTranslateRequest(
          base({ sourceStyle: style, targetStyle: style }),
        ),
      ).toMatchObject({
        ok: false,
        message: "Choose a different target style.",
      });
    }
  });

  it("accepts all twenty distinct style pairs", () => {
    for (const sourceStyle of STYLE_IDS) {
      for (const targetStyle of STYLE_IDS) {
        if (sourceStyle === targetStyle) continue;
        const result = validateTranslateRequest(
          base({ sourceStyle, targetStyle }),
        );
        expect(result.ok).toBe(true);
      }
    }
  });

  it("normalizes human target intensity and preserves internal whitespace", () => {
    const text = "  hello   world  ";
    const result = validateTranslateRequest(
      base({
        targetStyle: "human",
        sourceStyle: "linkedin",
        intensity: "maximum",
        text,
      }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.effectiveIntensity).toBe("balanced");
      expect(result.value.text).toBe(text);
    }
  });
});

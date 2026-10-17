import { countCodePoints, MAX_INPUT_CODE_POINTS } from "./limits";
import type { ValidatedTranslateRequest } from "./api-types";
import {
  effectiveIntensity,
  INTENSITIES,
  isDistinctPair,
  STYLE_IDS,
  type Intensity,
  type StyleId,
} from "./styles";

const REQUEST_KEYS = [
  "text",
  "sourceStyle",
  "targetStyle",
  "intensity",
  "eligibilityConfirmed",
  "privacyNoticeVersion",
] as const;

export type SchemaErrorCode = "INVALID_REQUEST" | "INPUT_TOO_LARGE";

export type SchemaSuccess = {
  ok: true;
  value: ValidatedTranslateRequest;
};

export type SchemaFailure = {
  ok: false;
  code: SchemaErrorCode;
  message: string;
};

export type SchemaResult = SchemaSuccess | SchemaFailure;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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

export function validateTranslateRequest(body: unknown): SchemaResult {
  if (!isPlainObject(body)) {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      message: "The request body is invalid.",
    };
  }

  for (const key of Object.keys(body)) {
    if (!(REQUEST_KEYS as readonly string[]).includes(key)) {
      return {
        ok: false,
        code: "INVALID_REQUEST",
        message: "The request body is invalid.",
      };
    }
  }

  for (const key of REQUEST_KEYS) {
    if (!(key in body)) {
      return {
        ok: false,
        code: "INVALID_REQUEST",
        message: "The request body is invalid.",
      };
    }
  }

  const {
    text,
    sourceStyle,
    targetStyle,
    intensity,
    eligibilityConfirmed,
    privacyNoticeVersion,
  } = body;

  if (typeof text !== "string") {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      message: "The request body is invalid.",
    };
  }

  if (
    !isStyleId(sourceStyle) ||
    !isStyleId(targetStyle) ||
    !isIntensity(intensity)
  ) {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      message: "The request body is invalid.",
    };
  }

  if (typeof privacyNoticeVersion !== "string") {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      message: "The request body is invalid.",
    };
  }

  if (typeof eligibilityConfirmed !== "boolean") {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      message: "The request body is invalid.",
    };
  }

  if (text.trim().length === 0) {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      message: "Enter some text to rewrite.",
    };
  }

  const codePoints = countCodePoints(text);
  if (codePoints > MAX_INPUT_CODE_POINTS) {
    return {
      ok: false,
      code: "INPUT_TOO_LARGE",
      message: "The text is too long. Shorten it and try again.",
    };
  }

  if (!isDistinctPair(sourceStyle, targetStyle)) {
    return {
      ok: false,
      code: "INVALID_REQUEST",
      message: "Choose a different target style.",
    };
  }

  const normalizedIntensity = effectiveIntensity(targetStyle, intensity);

  return {
    ok: true,
    value: {
      text,
      sourceStyle,
      targetStyle,
      intensity,
      eligibilityConfirmed,
      privacyNoticeVersion,
      effectiveIntensity: normalizedIntensity,
    },
  };
}

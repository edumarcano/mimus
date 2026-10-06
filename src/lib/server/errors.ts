import "server-only";

import type { AppErrorCode } from "../api-types";

export type { AppErrorCode };

export const ERROR_STATUS: Record<AppErrorCode, number> = {
  INVALID_REQUEST: 400,
  UNSUPPORTED_MEDIA_TYPE: 415,
  INPUT_TOO_LARGE: 413,
  REQUEST_NOT_ALLOWED: 403,
  REGION_UNAVAILABLE: 403,
  NOTICE_CHANGED: 409,
  CONTENT_BLOCKED: 422,
  RATE_LIMITED: 429,
  SERVICE_QUOTA_EXHAUSTED: 503,
  SERVICE_UNAVAILABLE: 503,
  UPSTREAM_TIMEOUT: 504,
  INCOMPLETE_OUTPUT: 502,
};

export const ERROR_MESSAGES: Record<AppErrorCode, string> = {
  INVALID_REQUEST: "The request could not be processed.",
  UNSUPPORTED_MEDIA_TYPE: "Use application/json for this request.",
  INPUT_TOO_LARGE: "The text is too long. Shorten it and try again.",
  REQUEST_NOT_ALLOWED: "This request is not allowed.",
  REGION_UNAVAILABLE:
    "Live generation is not available in your region.",
  NOTICE_CHANGED:
    "The data-use notice has changed. Refresh the page and acknowledge again.",
  CONTENT_BLOCKED:
    "The rewrite could not be completed because of content restrictions.",
  RATE_LIMITED: "Too many requests. Please wait and try again.",
  SERVICE_QUOTA_EXHAUSTED:
    "The rewrite service is temporarily unavailable. Please try again later.",
  SERVICE_UNAVAILABLE:
    "Live generation is unavailable right now.",
  UPSTREAM_TIMEOUT: "The rewrite took too long. Please try again.",
  INCOMPLETE_OUTPUT:
    "The rewrite did not finish completely. Try again or shorten the input.",
};

export function errorJsonResponse(
  code: AppErrorCode,
  requestId: string,
  message?: string,
): Response {
  return new Response(
    JSON.stringify({
      error: {
        code,
        message: message ?? ERROR_MESSAGES[code],
        requestId,
      },
    }),
    {
      status: ERROR_STATUS[code],
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    },
  );
}

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(code: AppErrorCode, message?: string) {
    super(message ?? ERROR_MESSAGES[code]);
    this.name = "AppError";
    this.code = code;
  }
}

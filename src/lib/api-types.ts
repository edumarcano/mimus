import type { Intensity, StyleId } from "./styles";

export type TranslateRequest = {
  text: string;
  sourceStyle: StyleId;
  targetStyle: StyleId;
  intensity: Intensity;
  eligibilityConfirmed: boolean;
  privacyNoticeVersion: string;
};

export type LiveAvailability = "available" | "region";

export type AppErrorCode =
  | "INVALID_REQUEST"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "INPUT_TOO_LARGE"
  | "REQUEST_NOT_ALLOWED"
  | "REGION_UNAVAILABLE"
  | "NOTICE_CHANGED"
  | "CONTENT_BLOCKED"
  | "RATE_LIMITED"
  | "SERVICE_QUOTA_EXHAUSTED"
  | "SERVICE_UNAVAILABLE"
  | "UPSTREAM_TIMEOUT"
  | "INCOMPLETE_OUTPUT";

export type ValidatedTranslateRequest = TranslateRequest & {
  effectiveIntensity: Intensity;
};

import "server-only";

// Candidate configuration; approve only after integration checks and evaluation.
export const MODEL_CONFIG = {
  provider: "google",
  model: "gemini-3.5-flash-lite",
  maxOutputTokens: 2_048,
  thinkingLevel: "medium",
} as const;

export const MODEL_PUBLIC_LABEL = "Gemini 3.5 Flash-Lite";

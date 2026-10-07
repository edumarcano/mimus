import "server-only";

// Release-candidate configuration; approved on 2026-10-07 after
// the evaluation recorded in evals/results/summary.md. Any change requires a
// new evaluation on a fresh independent holdout.
export const MODEL_CONFIG = {
  provider: "google",
  model: "gemini-3.5-flash-lite",
  maxOutputTokens: 2_048,
  thinkingLevel: "high",
} as const;

export const MODEL_PUBLIC_LABEL = "Gemini 3.5 Flash-Lite";

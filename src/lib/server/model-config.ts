import "server-only";

// Adopted from the staged benchmark: Gemini minimal with prompt v4.
// See docs/decisions.md for the evidence, limitations, and deployment status.
export const MODEL_CONFIG = {
  provider: "openrouter",
  maxOutputTokens: 2_048,
  model: "google/gemini-3.5-flash-lite",
  reasoningEffort: "minimal",
  providerPreferences: {
    only: ["google-vertex"],
    dataCollection: "deny",
    zdr: false,
    requireParameters: true,
  },
} as const;

export const MODEL_PUBLIC_LABEL = "Gemini 3.5 Flash-Lite";

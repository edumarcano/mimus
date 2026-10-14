import "server-only";

// Active configuration (z-ai/glm-5.3-flash with prompt v4). It is not a claim
// that GLM met the original meaning target. It was kept for v1.0.0 and the release
// evidence requirement was revised. See the release decision in
// docs/decisions.md.
export const MODEL_CONFIG = {
  provider: "openrouter",
  maxOutputTokens: 2_048,
  model: "z-ai/glm-5.3-flash",
  reasoningEffort: "low",
  dataCollection: "deny",
  zdr: true,
} as const;

export const MODEL_PUBLIC_LABEL = "GLM 5.3 Flash";

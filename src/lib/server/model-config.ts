import "server-only";

// Selected OpenRouter migration configuration (z-ai/glm-5.3-flash); not a claim
// that release acceptance passed. Prompt v4 is unchanged. Any production release
// still requires a new evaluation on a fresh independent holdout.
export const MODEL_CONFIG = {
  provider: "openrouter",
  maxOutputTokens: 2_048,
  model: "z-ai/glm-5.3-flash",
  reasoningEffort: "low",
  dataCollection: "deny",
  zdr: true,
} as const;

export const MODEL_PUBLIC_LABEL = "GLM 5.3 Flash";

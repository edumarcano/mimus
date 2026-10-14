import "server-only";

// Active configuration (z-ai/glm-5.3-flash with prompt v4). It is not a claim
// that GLM quality acceptance has passed: public live inference requires recorded
// release-evaluation scores on this committed configuration. See the GLM quality
// gate in docs/decisions.md.
export const MODEL_CONFIG = {
  provider: "openrouter",
  maxOutputTokens: 2_048,
  model: "z-ai/glm-5.3-flash",
  reasoningEffort: "low",
  dataCollection: "deny",
  zdr: true,
} as const;

export const MODEL_PUBLIC_LABEL = "GLM 5.3 Flash";

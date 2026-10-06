export type StyleId = "human" | "linkedin" | "corporate" | "startup" | "academic";
export type Intensity = "subtle" | "balanced" | "maximum";

export const STYLE_IDS: readonly StyleId[] = [
  "human",
  "linkedin",
  "corporate",
  "startup",
  "academic",
] as const;

export const INTENSITIES: readonly Intensity[] = [
  "subtle",
  "balanced",
  "maximum",
] as const;

export const STYLE_LABELS: Record<StyleId, string> = {
  human: "Human",
  linkedin: "LinkedIn",
  corporate: "Corporate",
  startup: "Startup Founder",
  academic: "Academic",
};

export const INTENSITY_LABELS: Record<Intensity, string> = {
  subtle: "Subtle",
  balanced: "Balanced",
  maximum: "Maximum",
};

export type StyleProfile = {
  writingBehavior: string;
  boundary: string;
  intensityGuidance: Partial<Record<Intensity, string>>;
};

export const STYLE_PROFILES: Partial<Record<StyleId, StyleProfile>> = {
  human: {
    writingBehavior:
      "Direct, natural plain English. Remove needless jargon and repetition.",
    boundary:
      "Keep material qualifications and facts; do not summarize away important content or invent a blunt motive.",
    intensityGuidance: {},
  },
  linkedin: {
    writingBehavior:
      "Professional-social cadence, elevated framing, short paragraphs, recognizable career-post rhetoric.",
    boundary:
      "No invented accomplishments, gratitude toward unnamed people, or emotions that contradict the input.",
    intensityGuidance: {
      subtle:
        "Light stylistic adjustment; broadly usable in real writing. Avoid added hashtags and emojis.",
      balanced:
        "Clearly recognizable LinkedIn style with restrained exaggeration. Permit at most one emoji and two relevant hashtags when they fit.",
      maximum:
        "Obvious parody of the LinkedIn register, still preserving facts and intent. Permit at most two emojis and three relevant hashtags.",
    },
  },
};

/** Milestone 1: Human ↔ LinkedIn only; Milestone 2 adds remaining pairs. */
export const SUPPORTED_DIRECTIONS = new Set<string>([
  "human->linkedin",
  "linkedin->human",
]);

export function directionKey(source: StyleId, target: StyleId): string {
  return `${source}->${target}`;
}

export function isSupportedDirection(
  source: StyleId,
  target: StyleId,
): boolean {
  return SUPPORTED_DIRECTIONS.has(directionKey(source, target));
}

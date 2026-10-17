export type StyleId =
  "human" | "linkedin" | "corporate" | "startup" | "academic";
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

export const STYLE_PROFILES: Record<StyleId, StyleProfile> = {
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
  corporate: {
    writingBehavior:
      "Formal workplace phrasing, diplomatic language, process vocabulary, clear professional requests.",
    boundary:
      "Do not invent approvals, meetings, deadlines, consensus, or authority.",
    intensityGuidance: {
      subtle:
        "Light stylistic adjustment; broadly usable in real workplace writing. Do not add emojis or hashtags.",
      balanced:
        "Clearly recognizable Corporate style with restrained exaggeration. Do not add emojis or hashtags.",
      maximum:
        "Obvious parody of the Corporate register, still preserving facts and intent. Do not add emojis or hashtags.",
    },
  },
  startup: {
    writingBehavior:
      "Energetic, concise, launch-oriented language and startup vocabulary where appropriate.",
    boundary:
      "No fabricated customers, growth, funding, traction, or claims of market leadership.",
    intensityGuidance: {
      subtle:
        "Light stylistic adjustment; broadly usable in real writing. Avoid added hashtags and emojis.",
      balanced:
        "Clearly recognizable Startup Founder style with restrained exaggeration. Permit at most one emoji and two relevant hashtags when they fit.",
      maximum:
        "Obvious parody of the Startup Founder register, still preserving facts and intent. Permit at most two emojis and three relevant hashtags.",
    },
  },
  academic: {
    writingBehavior:
      "Formal analytical phrasing, careful qualification, precise terminology.",
    boundary:
      "No fabricated experiments, findings, references, statistics, or evidence of causation.",
    intensityGuidance: {
      subtle:
        "Light stylistic adjustment; broadly usable in scholarly writing. Do not add emojis or hashtags.",
      balanced:
        "Clearly recognizable Academic style with restrained exaggeration. Do not add emojis or hashtags.",
      maximum:
        "Obvious parody of the Academic register, still preserving facts and intent. Do not add emojis or hashtags.",
    },
  },
};

export function isDistinctPair(source: StyleId, target: StyleId): boolean {
  return source !== target;
}

export function effectiveIntensity(
  target: StyleId,
  intensity: Intensity,
): Intensity {
  return target === "human" ? "balanced" : intensity;
}

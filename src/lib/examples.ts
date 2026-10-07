import type { Intensity, StyleId } from "./styles";

/** Fictional, author-written example pairs. */
export type Example = {
  id: string;
  label: string;
  sourceStyle: StyleId;
  targetStyle: StyleId;
  intensity: Intensity;
  input: string;
  output: string;
};

export const EXAMPLES: readonly Example[] = [
  {
    id: "late",
    label: "Running late",
    sourceStyle: "human",
    targetStyle: "linkedin",
    intensity: "balanced",
    input: "I'm running ten minutes late to the meeting, start without me.",
    output:
      "A quick calendar update: I'm running ten minutes late to our meeting.\n\nPlease go ahead and start without me. 🙏",
  },
  {
    id: "coffee",
    label: "Broken coffee machine",
    sourceStyle: "human",
    targetStyle: "linkedin",
    intensity: "balanced",
    input: "The office coffee machine is broken again and everyone is annoyed.",
    output:
      "Small things shape a workday.\n\nToday, that small thing is our office coffee machine. It's broken again, and everyone is feeling the frustration.\n\n#OfficeLife #TeamMorale",
  },
  {
    id: "emails",
    label: "Too many emails",
    sourceStyle: "human",
    targetStyle: "linkedin",
    intensity: "balanced",
    input: "I spent all day answering emails and got nothing else done.",
    output:
      "I spent the entire day answering emails.\n\nEvery reply sent. Nothing else done.\n\nSome days, the inbox sets the agenda. #Productivity",
  },
  {
    id: "button-linkedin-human",
    label: "Button color (plain)",
    sourceStyle: "linkedin",
    targetStyle: "human",
    intensity: "balanced",
    input:
      "Three hours. One button color. That was the team's discussion. #Design #Collaboration",
    output: "The team spent three hours discussing a button color.",
  },
  {
    id: "button-human-corporate",
    label: "Button color (corporate)",
    sourceStyle: "human",
    targetStyle: "corporate",
    intensity: "balanced",
    input: "The team spent three hours discussing a button color.",
    output: "The team dedicated three hours to aligning on the button's color.",
  },
];

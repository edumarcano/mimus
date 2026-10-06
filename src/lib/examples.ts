/** Fictional, author-written Human -> LinkedIn example pairs (Balanced). */
export type Example = {
  id: string;
  label: string;
  input: string;
  output: string;
};

export const EXAMPLES: readonly Example[] = [
  {
    id: "late",
    label: "Running late",
    input: "I'm running ten minutes late to the meeting, start without me.",
    output:
      "A quick calendar update: I'm running ten minutes late to our meeting.\n\nPlease go ahead and start without me. 🙏",
  },
  {
    id: "coffee",
    label: "Broken coffee machine",
    input: "The office coffee machine is broken again and everyone is annoyed.",
    output:
      "Small things shape a workday.\n\nToday, that small thing is our office coffee machine. It's broken again, and everyone is feeling the frustration.\n\n#OfficeLife #TeamMorale",
  },
  {
    id: "emails",
    label: "Too many emails",
    input: "I spent all day answering emails and got nothing else done.",
    output:
      "I spent the entire day answering emails.\n\nEvery reply sent. Nothing else done.\n\nSome days, the inbox sets the agenda. #Productivity",
  },
];

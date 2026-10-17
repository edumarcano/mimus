export type EvalSplit = "development" | "holdout" | "all";

export type ParsedEvalArgs = {
  live: boolean;
  split: EvalSplit;
  includeHoldout: boolean;
  limit?: number;
  ids?: string[];
  parseError?: string;
};

export type EvalCase = {
  id: string;
  split: "development" | "holdout";
  critical: boolean;
  text: string;
  sourceStyle: string;
  targetStyle: string;
  intensity: string;
  mustPreserve: string[];
  mustNotInvent: string[];
  preserveTokens?: string[];
  themes?: string[];
};

const SPLIT_VALUES = new Set<EvalSplit>(["development", "holdout", "all"]);
const KNOWN_OPTIONS = new Set([
  "--live",
  "--include-holdout",
  "--split",
  "--limit",
  "--ids",
]);

export function parseEvalArgs(argv: string[]): ParsedEvalArgs {
  let live = false;
  let split: EvalSplit = "development";
  let includeHoldout = false;
  let limit: number | undefined;
  let ids: string[] | undefined;
  let parseError: string | undefined;
  const seenOptions = new Set<string>();

  const fail = (message: string) => {
    parseError ??= message;
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      fail(`Unexpected argument: ${arg}`);
      continue;
    }
    if (!KNOWN_OPTIONS.has(arg)) {
      fail(`Unknown option: ${arg}`);
      continue;
    }
    if (seenOptions.has(arg)) {
      fail(`Repeated option: ${arg}`);
      continue;
    }
    seenOptions.add(arg);

    if (arg === "--live") {
      live = true;
      continue;
    }
    if (arg === "--include-holdout") {
      includeHoldout = true;
      continue;
    }
    if (arg === "--split") {
      const value = argv[++i];
      if (!value || !SPLIT_VALUES.has(value as EvalSplit)) {
        fail("Invalid --split; use development, holdout, or all.");
      } else {
        split = value as EvalSplit;
      }
      continue;
    }
    if (arg === "--limit") {
      const raw = argv[++i];
      const parsed = raw && /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
      if (!Number.isSafeInteger(parsed) || parsed <= 0) {
        fail("Invalid --limit; pass a safe positive integer.");
      } else {
        limit = parsed;
      }
      continue;
    }
    if (arg === "--ids") {
      const value = argv[++i];
      const parsed = value
        ? value
            .split(",")
            .map((id) => id.trim())
            .filter((id) => id.length > 0)
        : [];
      if (parsed.length === 0) {
        fail("Invalid --ids; pass a comma-separated list of case ids.");
      } else {
        ids = parsed;
      }
      continue;
    }
  }

  return { live, split, includeHoldout, limit, ids, parseError };
}

/** Returns a refusal reason code, or null when provider calls may proceed. */
export function providerCallRefusal(
  args: ParsedEvalArgs,
): "no-live" | "holdout" | null {
  if (!args.live) {
    return "no-live";
  }
  if (
    (args.split === "holdout" || args.split === "all") &&
    !args.includeHoldout
  ) {
    return "holdout";
  }
  return null;
}

export function filterCasesBySplit(
  cases: EvalCase[],
  split: EvalSplit,
): EvalCase[] {
  if (split === "all") {
    return cases;
  }
  return cases.filter((item) => item.split === split);
}

export function filterCasesByIds(
  cases: EvalCase[],
  ids: string[] | undefined,
): EvalCase[] {
  if (!ids || ids.length === 0) {
    return cases;
  }
  const wanted = new Set(ids);
  return cases.filter((item) => wanted.has(item.id));
}

export function applyLimit(cases: EvalCase[], limit?: number): EvalCase[] {
  if (limit === undefined) {
    return cases;
  }
  return cases.slice(0, limit);
}

export const RELEASE_CANDIDATE_TRACKED_FILES = [
  "src/lib/prompts.ts",
  "src/lib/styles.ts",
  "src/lib/server/model-config.ts",
  "src/lib/server/openrouter.ts",
] as const;

export function parseDirtyTrackedFiles(porcelain: string): string[] {
  const dirty = new Set<string>();
  for (const line of porcelain.split("\n")) {
    if (!line.trim()) {
      continue;
    }
    const path = line.slice(3).trim();
    for (const tracked of RELEASE_CANDIDATE_TRACKED_FILES) {
      if (path === tracked || path.endsWith(`/${tracked}`)) {
        dirty.add(tracked);
      }
    }
  }
  return [...dirty];
}

export function requiresCleanTreeForHoldout(args: ParsedEvalArgs): boolean {
  return (
    args.includeHoldout && (args.split === "holdout" || args.split === "all")
  );
}

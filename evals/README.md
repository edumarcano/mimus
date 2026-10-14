# Mimus evaluation

The synthetic set in `cases.jsonl` has 50 fictional cases:

- 30 original `dev-*` development cases;
- 10 `holdout-*` cases, consumed on 2026-10-07 and kept as supplemental
  development evidence (they informed prompt v4);
- 10 `holdout2-*` cases, written after that and untouched when the Gemini release
  candidate ran.

Ten cases are marked critical. Meaning preservation is a quality goal, not a
guarantee for any individual result.

## Records

| Record | What it is | Status |
| --- | --- | --- |
| [`results/summary.md`](results/summary.md) | Gemini release-candidate evaluation (`gemini-3.5-flash-lite`, prompt v4) | Historical; unchanged |
| [`results/glm-development.md`](results/glm-development.md) | GLM development run on 40 development-split cases | Development evidence; no recorded scores |
| `results/glm-release.md` | GLM release evaluation | Not run. The protocol is pre-registered in [`docs/decisions.md`](../docs/decisions.md#glm-quality-gate-active) |

The Gemini results do not transfer to the active GLM configuration.

## Running the evaluation

CI never calls a provider. The runner requires an explicit opt-in and sends
sequential requests through the same prompt builder and adapter as production.

```bash
npm run eval -- --live --limit 5                                # first 5 development cases
npm run eval -- --live                                          # development split (40 cases)
npm run eval -- --live --split holdout --include-holdout        # the 10 holdout2-* cases
npm run eval -- --live --ids dev-negation-01,dev-inject-01      # specific cases
```

- Without `--live`, the runner makes no provider call and exits with code 1.
- Development runs default to `--split development`. The holdout split, or `all`,
  also requires `--include-holdout` and a clean git tree for the prompt, styles,
  model configuration, and OpenRouter adapter.
- Requests are paced about 4.2 seconds apart. That is a conservative development
  interval, not an OpenRouter requirement. A rate or quota error stops the run and
  is recorded instead of retried. Unknown `--ids` fail before any provider call.
- The runner reads `OPENROUTER_API_KEY` from `.env.local` when it exists, or from
  the shell. Use a capped evaluation key.

Raw JSONL output goes to `evals/results/raw/` (gitignored) and records the model,
settings, prompt version, git revision, dirty flags, latency, and usage.

## Holdout status

- `holdout-*`: consumed. Its failures informed prompt v4, so it is not independent
  evidence for any configuration.
- `holdout2-*`: run and scored once on the frozen Gemini configuration. Its
  outputs informed the Gemini target revision. It has **not** been run on GLM and
  was never tuned on, so for GLM it is untuned but not untouched. Report it as
  "not tuned on GLM; previously run and scored on Gemini". A further prompt or
  model change would remove even that status.

## Scoring and targets

The runner records deterministic checks only (nonempty output, size cap,
completion status, optional `preserveTokens`). Meaning and style are scored 0-2 by
manual review with the rubric in the
[specification](../docs/product-spec.md#14-evaluation-plan). Release targets:

- meaning score 2 on at least 36 of 40 cases;
- style score 2 on at least 32 of 40 cases;
- no meaning score 0 on the 10 critical cases.

For the Gemini release candidate, meaning (36/40) and style (40/40) were met and the
critical target was not (9/10); the owner revised it for that configuration. The
release cohort is the 30 `dev-*` cases plus the 10 `holdout2-*` cases; the
`holdout-*` cases are supplemental.

Published results are sanitized summaries. They contain only fictional synthetic
text, never user input.

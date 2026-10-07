# Parlance evaluation

The synthetic set lives in `cases.jsonl` (40 fictional cases). It supports
prompt development and a small held-out split for release-candidate checks.

## Opt in to live API use

Ordinary CI does **not** call Google. To run inference locally:

```bash
npm run eval -- --live --limit 5
```

Without `--live`, the runner prints that no provider call was made and exits with
code 1.

Development runs default to `split=development` (30 cases). Holdout or all splits
require `--include-holdout`. A release-candidate run that includes holdout also
requires a clean git tree for the committed prompt, styles, model-config, and
Gemini adapter files.

The runner spaces sequential provider requests ~4.2 seconds apart, below the
owner-reported free-tier limit of 15 requests per minute. A full 40-case run
therefore takes a few minutes of wall time. If a request still hits a quota
error, the run stops and records it instead of retrying.

The runner loads `GEMINI_API_KEY` from `.env.local` when that file exists (via
Node's `--env-file-if-exists`). Otherwise export the variable in your shell; the
runner does not read the key from anywhere else.

## Holdout separation

Ten cases are tagged `split=holdout` and kept out of routine tuning. Once
holdout failures inform prompt changes, those cases are no longer independent
evidence—record that in review notes.

## Scoring

**Meaning** and **style** scores (0–2) are assigned by the owner during manual
review. The runner records deterministic checks only (nonempty output, size cap,
completion status, optional `preserveTokens`). It does not assign meaning or
style scores.

Release targets from the product spec:

- Meaning score 2 on at least 36/40 cases
- Style score 2 on at least 32/40 cases
- No meaning score 0 on the 10 critical cases

## Artifacts

Raw JSONL output is written under `evals/results/raw/` (gitignored). One timestamped
file per invocation records model id, settings, prompt version, SDK version, git
revision, dirty flags, latency, and usage when reported.

A reviewed summary belongs in `evals/results/summary.md` only after an owner-reviewed
run. That file is not created automatically.

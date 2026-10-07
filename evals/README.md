# Parlance evaluation

The synthetic set lives in `cases.jsonl`: 50 fictional cases total —
40 development cases (30 original `dev-*` plus the 10 consumed `holdout-*`
cases retained as supplemental development evidence) and 10 fresh independent
holdout cases (`holdout2-*`). It supports prompt development and a
held-out split for release-candidate checks.

## Opt in to live API use

Ordinary CI does **not** call Google. To run inference locally:

```bash
npm run eval -- --live --limit 5
```

Without `--live`, the runner prints that no provider call was made and exits
with code 1.

Development runs default to `split=development` (40 cases). Holdout or all
splits require `--include-holdout`. A release-candidate run that includes
holdout also requires a clean git tree for the committed prompt, styles,
model-config, and Gemini adapter files.

The runner spaces sequential provider requests ~4.2 seconds apart, below the
reported free-tier limit of 15 requests per minute. A full run
therefore takes a few minutes of wall time. If a request still hits a quota
error, the run stops and records it instead of retrying.

The runner loads `GEMINI_API_KEY` from `.env.local` when that file exists
(via Node's `--env-file-if-exists`). Otherwise export the variable in your
shell; the runner does not read the key from anywhere else.

Re-run specific development cases with `--ids dev-negation-01,dev-inject-01`.
Unmatched ids fail the run before any provider call.

## Holdout separation

The original 10-case holdout (`holdout-*` ids) was consumed on 2026-10-07:
its failures informed prompt v4, so those cases were reclassified as
development evidence and are no longer independent. The fresh independent set
(`holdout2-*` ids) ran once on the frozen release-candidate configuration on
2026-10-07 and is now spent as untouched evidence: any further prompt,
model, or dataset change invalidates it as independent. Once holdout failures
inform prompt changes, those cases are no longer independent evidence—record
that in review notes.

## Scoring

**Meaning** and **style** scores (0–2) are assigned during manual
review. The runner records deterministic checks only (nonempty output, size
cap, completion status, optional `preserveTokens`). It does not assign
meaning or style scores.

The release-target denominator is the **40-case release-candidate cohort**
defined in [`evals/results/summary.md`](results/summary.md): the 30 `dev-*`
cases plus the 10 fresh `holdout2-*` cases, evaluated on the frozen
configuration. The consumed `holdout-*` cases are supplemental development
evidence and do not count toward targets.

Release targets from the product spec, with the recorded revision:

- Meaning score 2 on at least 36/40 cases — **met (36/40)**
- Style score 2 on at least 32/40 cases — **met (40/40)**
- No meaning score 0 on the 10 critical cases — **not met (9/10)**; the
  this limitation is accepted and recorded for v1 (see
  [`evals/results/summary.md`](results/summary.md) for the rationale).

## Artifacts

Raw JSONL output is written under `evals/results/raw/` (gitignored). One
timestamped file per invocation records model id, settings, prompt version,
SDK version, git revision, dirty flags, latency, and usage when reported.

The reviewed, sanitized summary is
[`evals/results/summary.md`](results/summary.md), written after the
reviewed release-candidate runs. It never contains submitted user
text; quoted model outputs come from the fictional synthetic dataset only.
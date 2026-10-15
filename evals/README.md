# Mimus evaluation

The repository keeps its original 50-case corpus and adds separate data for a
reproducible v1 benchmark. The original records and split meanings are preserved.
The benchmark design in [`docs/benchmark-protocol.md`](../docs/benchmark-protocol.md)
describes planned experiments, not completed model results.

The synthetic set in [`cases.jsonl`](cases.jsonl) has 50 fictional cases:

- 30 original `dev-*` development cases;
- 10 `holdout-*` cases, consumed on 2026-10-07 and kept as supplemental
  development evidence (they informed prompt v4);
- 10 `holdout2-*` cases, written after that and evaluated on the Gemini release
  candidate.

Ten historical cases are marked critical. Meaning preservation is a quality goal,
not a guarantee for any individual result.

## Benchmark datasets

| File | Contents | Status |
| --- | --- | --- |
| [`datasets/screening.json`](datasets/screening.json) | 12 IDs selected from existing development cases | Development screen; not new cases |
| [`datasets/evaluator-challenge.jsonl`](datasets/evaluator-challenge.jsonl) | 20 source passages, each with a faithful and deliberately flawed rewrite; 12 calibration pairs and 8 validation pairs | Constructed reference labels; not human-validated ground truth |
| [`datasets/release-v1.jsonl`](datasets/release-v1.jsonl) | 40 fresh fictional cases across all 20 directed style pairs, including 10 critical cases | Reserved for final comparison after configurations are frozen |

The new model generations, evaluator comparison, cascade simulation, and final
release scoring are pending. No new model winner, quality score, or cost total is
claimed. Human review is planned for at most 25 outputs: 12 calibration, 8 audit,
and up to 5 disagreements.

## Records

| Record | What it is | Status |
| --- | --- | --- |
| [`results/summary.md`](results/summary.md) | Gemini release-candidate evaluation (`gemini-3.5-flash-lite`, prompt v4) | Historical; unchanged |
| [`results/glm-development.md`](results/glm-development.md) | GLM development run on 40 development-split cases | Development evidence; 39/40 deterministic checks passed; no recorded scores |

Historical records do not establish the quality of planned benchmark
configurations. Preserve them as dated observations; do not combine their scores
with fresh release results. Gemini results apply only to the evaluated Gemini
configuration, not to GLM.

## Existing evaluation runner

CI never calls a provider. The existing runner requires an explicit opt-in and
sends sequential requests through the production prompt builder and adapter.

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
- Requests are paced about 4.2 seconds apart. This is a conservative development
  interval, not an OpenRouter requirement. A rate or quota error stops the run and
  is recorded instead of retried. Unknown `--ids` fail before any provider call.
- The runner reads `OPENROUTER_API_KEY` from `.env.local` when it exists, or from
  the shell. Use a capped evaluation key.
- Raw JSONL output goes to ignored `evals/results/raw/` and records the model,
  settings, prompt version, Git revision, dirty flags, latency, and usage.

## Historical holdout status

- `holdout-*`: consumed. Its failures informed prompt v4, so it is not independent
  evidence for any configuration.
- `holdout2-*`: run and scored once on the frozen Gemini configuration. Its
  outputs informed the Gemini target revision. It has **not** been run on GLM and
  was never tuned on, so for GLM it is untuned but not untouched. A further prompt
  or model change removes even that status.

## Scoring and release targets

The existing runner records deterministic checks only (nonempty output, size cap,
completion status, optional `preserveTokens`). The v1 benchmark adds separate
automated meaning/style judgments and limited blind human calibration and
auditing. Keep the score sources separate; do not call the result fully
human-validated. The rubric is in the
[specification](../docs/product-spec.md#14-evaluation-plan), and the procedure is
in the [benchmark protocol](../docs/benchmark-protocol.md).

The fresh release targets are:

- meaning score 2 on at least 36 of 40 cases;
- style score 2 on at least 32 of 40 cases;
- no meaning score 0 on any of the 10 critical cases;
- no unresolved judgment on a critical case.

These are small-sample release criteria, not statistical guarantees. The
historical Gemini release candidate met the earlier meaning (36/40) and style
(40/40) thresholds but had one critical meaning score of 0 (9/10 cases without a
zero); that target was revised for that evaluated configuration. Its cohort was
the 30 `dev-*` cases plus the 10 `holdout2-*` cases; `holdout-*` was supplemental.
The fresh release set will be scored only after model configurations and
selection rules are frozen.

Published results are reviewed summaries. Benchmark examples are fictional
synthetic text, never user input.

## Benchmark tooling

`npm run eval` remains the historical single-model runner. `npm run benchmark`
adds manifest-driven experiments. All files written by the benchmark are under
`evals/results/raw/benchmark/` and remain ignored until evidence is reviewed.

Start without credentials or provider requests:

```bash
npm run benchmark -- preflight --manifest evals/experiments/effort.json
npm run benchmark -- generate --manifest evals/experiments/effort.json --run fixture-demo --fixture --limit 2
npm run benchmark -- judge --manifest evals/experiments/effort.json --run fixture-demo --fixture --evaluator judge-luna
npm run benchmark -- report --run fixture-demo --evaluator judge-luna
```

Open `evals/results/raw/benchmark/fixture-demo/report.html`. Fixture outputs are
labeled and never qualify as release evidence. To compare prompt runs, pass a
second run ID to `report --input OTHER_RUN` (not a file path).

Before any separately approved paid run, use `preflight --refresh-catalog` to
check current public metadata and prices. That command makes catalog GETs only.
Paid `generate` and `judge` require `--live` and a catalog snapshot less than 24
hours old. They read the server-only `OPENROUTER_API_KEY` from the environment or
ignored `.env.local`; application live mode is not required. Never use a
Production key for development experiments. Provider privacy-routing failures
are recorded and never bypassed.

`prompt-v4.json` and `prompt-candidate.json` compare one shared prompt candidate.
`effort.json` contains the twelve supported generator configurations on the fixed
screening subset. `evaluators.json` contains the constructed challenge and five
evaluators; run each explicitly with `judge --evaluator ID`. The development and
release manifests ending in `-template` are starting configurations, not model
selection decisions. Copy and commit a named finalist manifest after reviewing
development evidence. Release generation refuses a template ID, a dirty tree,
a case limit, or a missing `--include-holdout` flag.

Pass `generate --reuse-from SCREEN_RUN` when expanding a screen to development.
Only successful observations with identical prompt contents, case, configuration,
repetition, and transport are reused. Provenance links identify the original
attempt; its usage and observed cost remain the model-performance measurement,
while the shared ledger incurs no new charge. Fresh release runs refuse reuse.
For consistency checks, copy a selected development manifest, choose ten cases,
set `stage` to `repeat` and `repetitions` to 3, then reuse the first attempts.

Export and import a blind review, then rebuild reports:

```bash
npm run benchmark -- review-export --manifest evals/experiments/evaluators.json --run evaluator-calibration --review-set calibration --split calibration --count 12
npm run benchmark -- review-import --run evaluator-calibration --review-set calibration --input downloaded-scores.json
```

Keep the generated mapping JSON private until scoring is submitted. Download
scores from the HTML form; import checks every blind ID, score, and tag before
appending original labels. Duplicate imports are refused. The review budget is
12 calibration examples, 8 final audits, and at most 5 disagreements per study.

For a run containing independent decision and LLM judgments, use
`cascade --run RUN --decision-evaluator decision-jev --llm-evaluator judge-luna`.
Its JSON compares thresholds using calibration observations and reports
validation observations separately. Savings are estimates; disagreement with an
LLM is not independently established human error.

The budget ledger is cumulative across run IDs: changing a run ID does not reset
spending. Unreported costs keep their conservative reservation; missing usage is
never charged as zero. A software estimate cannot guarantee a provider's final
bill, so use a separate capped key. Do not delete the ledger to resume a study.
Interrupted dispatches are visible as reservations and are not retried silently.
If the process crashes, inspect the PID in `.lock` and confirm it is no longer
running before removing that lock alone. Resume with the same manifest, dataset,
code revision, and transport; changes require a new run with its prior attempts
retained. Unknown billing may require manual reconciliation before continuing.

# Offline benchmark protocol

This protocol describes the planned v1 benchmark. Dataset files and software
support do not imply that model calls have run or that any model has passed.
Live runs require a separate spend approval after a preflight reports expected
cost. The experiment targets $1 and has a $3 cumulative ceiling.

## Data sets

| Set | Cases | Use |
| --- | ---: | --- |
| Existing development cases | 40 in the existing `development` split: 30 original `dev-*` cases plus 10 consumed `holdout-*` cases | Prompt and model development; includes the 12-case screen below |
| Additional historical holdout | 10 `holdout2-*` cases | Previously scored on Gemini; supplemental history, not fresh release evidence |
| Screening | 12 IDs from existing development cases | Prompt comparison and reasoning-effort screening |
| Evaluator challenge | 20 source passages, each with a faithful and flawed rewrite | Evaluator calibration and validation |
| Release v1 | 40 newly written synthetic cases | Final comparison of two frozen generator configurations |

The existing corpus contains 50 distinct cases, not 40 development cases plus 20
additional holdouts. The consumed `holdout-*` ten are already counted in the 40
development cases above. The separate `holdout2-*` ten were evaluated on Gemini
and informed its target revision; they are not untouched holdout evidence.
Screening IDs are listed in
[`../evals/datasets/screening.json`](../evals/datasets/screening.json). The
challenge set has 12 paired passages in calibration and 8 paired passages in
validation; both members of a pair always stay in the same split. Its references
are constructed labels and should not be described as human-validated gold data.

The release set covers every directed pair among Human, LinkedIn, Corporate,
Startup Founder, and Academic, varied input lengths and intensities, and ten
critical cases. Each case states what must be preserved and what must not be
invented. The release set is frozen before final configurations are selected.
Looking at release outputs to tune a prompt, effort, model, judge, or threshold
uses that evidence for development and requires a new holdout to make an
independent release claim.

## Human scoring and automated evaluators

Score meaning and style separately from 0 to 2. Meaning 2 preserves all material
facts and intent without invention; 1 has a minor omission or distortion without
a major contradiction; 0 has material invention, a changed commitment,
contradiction, or lost key fact. Style 2 is recognizable at requested intensity;
1 is partly recognizable or inconsistent; 0 is the wrong register, a benign-task
refusal, or unrelated output. Tag material failures, including invention,
commitment, attribution, negation, omission, numbers/dates, instruction handling,
style/intensity, and incomplete generation.

Human review is capped at 25 outputs: 12 calibration examples, 8 final audit
examples, and at most 5 disagreements. Hide model identity and evaluator scores
until a submitted human score is fixed. The eight final audit examples include
four randomly sampled confident passes and four disagreement or suspected-failure
cases. Keep human labels, LLM judgments, decision-model judgments, and any
adjudication as separate records. Report results as automated evaluation with
limited human calibration and auditing; this sample does not establish
population-level agreement.

The LLM-judge candidates are GPT-6 Luna at medium effort and Gemini 4 Argon at
low effort. The decision-model candidates are Jev 1.14, Microsoft-Decision-1,
and Perplexity Decider V1.1 27B. Exact provider model IDs and supported effort
settings must be checked and pinned in a manifest before live requests. Select an
LLM judge using the separate challenge validation set, prioritizing missed
serious failures, then false rejections, rubric agreement, cost, and duration.
If neither candidate evaluates the challenge adequately, report that limitation
instead of selecting a winner by default.

## Generator comparison

Compare four generators: `z-ai/glm-5.3-flash`, OpenAI GPT-6 Luna, Anthropic
Haiku 5.5, and `google/gemini-3.5-flash-lite`. Use a shared frozen prompt for
the main model comparison. First compare prompt v4 with one concise candidate on
the 12 screening cases; adopt the candidate only if median input tokens decrease,
meaning/style full-score counts do not decrease, and no new critical failure
appears. Otherwise retain v4.

Screen supported reasoning settings within each model: GLM low/high/max; Luna
none/low/medium; Haiku disabled/low/medium; Gemini Flash-Lite minimal/low/medium.
Provider effort names are not equivalent across models. Preflight must reject an
unsupported setting rather than silently substitute another. Compare each
configuration on the same 12 screening cases, then run the selected effort for
each generator on all 40 existing development cases. Reuse matching screen
observations. Repeat ten difficult cases so each leading configuration has
three attempts; repeated trials do not add independent cases.

Select the two finalists before viewing release outputs. Keep the production
2,048-token output cap, 45-second deadline, and output-character limit for primary
comparisons. A separately labeled diagnostic with a larger cap is not part of the
primary ranking. Order configurations deterministically and interleave requests
across them. Report quality, completion, latency, tokens, and cost independently;
do not collapse them into an unexplained weighted score.

Choose a shipping configuration only if it meets all release targets: meaning 2
on at least 36/40 cases, style 2 on at least 32/40, no meaning 0 on the ten
critical cases, and no unresolved critical judgment. Among eligible finalists,
prefer meaning, then style and reliability, then cost and latency; retain the
incumbent if evidence leaves a complete tie. These are small-sample release
criteria, not statistical guarantees.

## Escalation-cascade experiment

Score the same development and evaluator-validation observations independently
with the selected decision model and LLM judge. Simulate confidence thresholds
of 0.80, 0.90, and 0.95. Escalate critical cases, malformed or contradictory
judgments, and a seeded 10% sample of confident decisions. Set thresholds on
development labels and assess them separately on validation examples.

Report serious failures incorrectly accepted, false rejections, escalation rate,
cost, duration, and estimated human work. Agreement between automated judges is
not a human correctness label. Cascade behavior is an offline experiment only:
score every release output with the selected LLM judge and do not gate production
rewrites through an evaluator.

For cascade false rejections, the resolved baseline-pass denominator is LLM
meaning 2 and style 2 without serious tags; a routed failure against such a pass
counts as a false rejection. Select thresholds on calibration by minimizing
missed serious failures, then false rejections, then escalations, with the lower
threshold breaking a complete tie. Here calibration means threshold selection on
development observations; constructed evaluator-calibration examples remain a
separate diagnostic cohort and are used as a labeled fallback only in evaluator-only
studies without development outputs. Report all three original split counts and
validation separately. A missing selection or validation cohort, or unresolved LLM
baselines in those cohorts, leaves threshold selection inconclusive. Gross avoided
LLM charges exclude decision-model costs; subtract those costs for net savings.

## Records, privacy, and operating boundaries

Record exact model and effort IDs, prompt/rubric version, dataset and manifest
hashes, Git revision, run date, completion/error state, first-content and total
latency, usage, available provider identifiers, and cost. Unknown usage or cost
stays unknown. Keep failed and interrupted attempts visible; do not automatically
retry or switch models. Do not store provider reasoning text.

Only fictional synthetic text is used. Benchmark results remain local and
ignored by Git until reviewed; publish only reviewed synthetic evidence. The
benchmark is an offline development tool. It does not change production model
selection at runtime, persistence, logging, privacy routing, or the production
request flow. CI uses fixtures and mocks and never calls a provider.

## Operational and portfolio status

The technical pilot, evaluator calibration/validation, and initial challenge-set
cascade simulation have dated records in `evals/results/`. Calibration preserves
original human scores and separate maintainer adjudications. The dated validation
record selects the offline evaluators. The [development comparison](../evals/results/development-comparison-2026-10-15.md)
and [cascade assessment](../evals/results/development-cascade-2026-10-15.md) preserve
all failed and unresolved observations; repeatability, fresh release scoring, and
the shipping-model decision remain pending. The [local demo verification record](../evals/results/local-demo-verification-2026-10-15.md)
separates automated keyboard/browser checks from maintainer Edge, 200% zoom, and
Narrator observations, including the reported defects and their successful retests.
Provider-operation checks remain separate from these local UI observations.

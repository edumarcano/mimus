# Evaluator validation and selection (2026-10-15)

Select **Argon low as the primary LLM judge** for the remaining offline study.
Carry **Perplexity Decider forward for the experimental cascade**, at a
calibration-selected threshold of **0.80**. These choices do not change production
rewriting. No generator, prompt, or release candidate has been selected.

The unchanged rubric 1 and five evaluator settings scored sixteen validation
examples, representing eight paired source passages. The manifest was committed
before dispatch at `e00faba2368cd8d82bdac2e63f939cc6a5f0ac55`:
[`evaluator-validation-v1.json`](../experiments/evaluator-validation-v1.json).
[Structured measurements](evaluator-validation-2026-10-15.json) and
[all 80 observations](evaluator-validation-2026-10-15.jsonl) accompany this report.
No retries or routing-policy relaxations were used.

## Validation measurements

| Evaluator | Valid / attempts | Meaning agreement with references / resolved | Reference meaning-0 scored 2 / resolved | Reference meaning-0 scored 1 | Reference meaning-2 scored below 2 / resolved | Critical unresolved | Median request ms | Reported cost USD |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Luna medium | 13/16 | 11/13 | 0/6 | 0 | 2/7 | 2 | 6600 | 0.002812700 |
| Argon low | 16/16 | 15/16 | 0/8 | 0 | 1/8 | 0 | 2708.5 | 0.032280000 |
| Jev | 16/16 | 15/16 | 1/8 | 0 | 0/8 | 0 | 225 | 0.000826434 |
| Microsoft Decision | 16/16 | 14/16 | 0/8 | 1 | 1/8 | 0 | 477.5 | 0.000613998 |
| Perplexity Decider | 16/16 | 15/16 | 0/8 | 1 | 0/8 | 0 | 1150.5 | 0.001077420 |

Luna's unresolved responses were `invalid_judgment_schema` on
`evaluator-14-faithful`, `evaluator-17-flawed`, and `evaluator-19-flawed`. The first
two are critical. Rejected response bodies were not retained, so the exact
violations cannot be diagnosed from these records.

Argon graded all eight constructed meaning failures as 0 without unresolved
responses. Its sole reference disagreement was `evaluator-13-faithful`: changing
“The club may add” to “We may add” received meaning 1 for attribution, against
reference 2. This boundary case is not proof of an incorrect rejection. The
[calibration report](evaluator-calibration-2026-10-15.md) documents other reference
defects; reference agreement is not accuracy.

Argon is selected for observed semantic results and response reliability within
this tested pair. It cost more than Luna, but avoided unresolved critical
judgments and was faster in these requests. This does not establish that frontier
models are inherently necessary or that other Luna settings could not work
better. Argon's combined calibration/validation cost was $0.080326.

Perplexity had no direct meaning-2 acceptance of a serious reference failure and
no downgrade of a faithful reference on validation. Microsoft understated one
failure too, but also downgraded one faithful reference. Jev accepted one failure.
These small differences are not statistically established model rankings.
Perplexity cost $0.000463422 more than Microsoft on this set; its higher latency
and costs remain part of the comparison.

## Offline cascade

The simulation combines calibration and validation records with their original
IDs and splits; it makes no inference calls. Each threshold is selected on
calibration only from 0.80, 0.90, and 0.95, minimizing missed serious failures,
then false rejections, then escalations. The false-rejection metric repairs a
protocol reporting gap identified during validation; it does not change routing
or paid judgments.

| Decision model | Threshold | Calibration escalated / cases | Validation escalated / cases | Validation auto-pass / auto-fail | Validation missed serious failures | Validation false rejections / LLM baseline passes | Gross avoided LLM cost USD | Decision cost USD | Estimated net saving USD |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Jev | 0.80 | 17/24 | 12/16 | 0/4 | 0 | 0/4 | 0.008732000 | 0.000826434 | 0.007905566 |
| Microsoft Decision | 0.80 | 18/24 | 12/16 | 0/4 | 0 | 0/4 | 0.008732000 | 0.000613998 | 0.008118002 |
| Perplexity Decider | 0.80 | 18/24 | 12/16 | 0/4 | 0 | 0/4 | 0.008732000 | 0.001077420 | 0.007654580 |

Comparisons use Argon, not human truth. A baseline pass requires complete meaning
2 and style 2 without serious tags. Perplexity would avoid four LLM calls, all by
rejecting outputs, and escalate 75% of validation cases. Its estimated net saving
was about 24% of the $0.03228 baseline, excluding engineering, operating, and human
review costs. Gross savings must have decision charges subtracted.

Jev accepted `evaluator-13-flawed`, changing “may” to “will,” but its meaning-pass
probability was 0.65, style-pass probability 0.56, and it flagged attribution.
Both uncertainty and the contradictory tag prevent an automatic pass under the
rules. This observed escalation benefit does not prove confident decisions safe.

Full threshold results are retained for
[Jev](evaluator-cascade-decision-jev-2026-10-15.json),
[Microsoft](evaluator-cascade-decision-microsoft-2026-10-15.json), and
[Perplexity](evaluator-cascade-decision-perplexity-2026-10-15.json).

## Limits and next phase

The constructed validation labels all expect style 2, so this set cannot establish
style-failure detection. Maximum still requires obvious parody; final scoring
requires the planned small human audit. Selection used validation evidence, so
these are not unbiased population-level estimates for the selected models.
Fresh release outputs remain unseen.

Validation cost **$0.037610552**. Including pilot and calibration, the study
recorded **224 requests**, **$0.103552834** in reported charges, no unknown costs,
and no pending reservations at this phase's end.

Next are shared prompt comparison, effort screening, development and repeatability
comparisons, and fresh release scoring. For the prompt decision, require lower
overall median input tokens with complete usage coverage, no lower meaning-2 or
style-2 counts for **each** baseline generator, and no new critical meaning
failure or unresolved critical judgment. Otherwise retain v4. Release outputs all
receive full Argon judging; the cascade remains offline.

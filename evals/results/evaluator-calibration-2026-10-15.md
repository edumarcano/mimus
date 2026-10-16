# Evaluator calibration (2026-10-15)

The maintainer completed 12 blind reviews of constructed rewrites. Five automated
evaluators then scored the 24 calibration examples. This phase used no validation
or fresh release outputs. It does not select a shipping model or establish
general evaluator accuracy.

The run used revision `4a22f27223661e328ab8486f15397efb08ae5650`, rubric 1, and
[`evaluator-calibration-v1.json`](../experiments/evaluator-calibration-v1.json).
Hashes and aggregate measurements are in the [structured summary](evaluator-calibration-2026-10-15.json).
The [observation records](evaluator-calibration-2026-10-15.jsonl) retain original
human labels, separate maintainer adjudications, and automated judgments. Sources,
rewrites, and annotations are in the committed evaluator challenge dataset.

## Human calibration

Original human scores agreed with constructed references on meaning in 7/12
examples and style in 10/12. These are agreement counts, not accuracy estimates.
Three separately confirmed adjudications preserve the original scores:

| Case | Original | Adjudicated | Reason |
|---|---|---|---|
| evaluator-01-flawed | Meaning 2 | Meaning 0 | The maintainer confirmed missing the change from “may” to “will.” |
| evaluator-04-flawed | Meaning 1 | Meaning 0 | The maintainer confirmed missing the change from 18 responses to 81. |
| evaluator-09-faithful | Style 2 | Style 1 | Maximum retains the specification's obvious-parody requirement; restrained academic prose is a partial match. Meaning was not adjudicated. |

The resulting labels agree with constructed references on meaning in 9/12 and
style in 9/12. Lower style agreement after adjudication is expected: the reference
still labels that restrained Academic Maximum rewrite as 2. No original human or
constructed label was overwritten. Eight final audit examples and at most two
further adjudications remain within the agreed review budget.

## Automated calibration results

| Evaluator | Valid / attempts | Meaning agreement with references / resolved | Reference meaning-0 scored 2 / resolved | Reference meaning-0 unresolved | Median request ms | Reported cost USD |
|---|---:|---:|---:|---:|---:|---:|
| Luna medium | 22/24 | 18/22 | 0/11 | 1 | 8778.5 | 0.004298500 |
| Argon low | 24/24 | 20/24 | 0/12 | 0 | 2937 | 0.048046000 |
| Jev | 24/24 | 22/24 | 0/12 | 0 | 212.5 | 0.001244418 |
| Microsoft Decision | 24/24 | 22/24 | 0/12 | 0 | 449.5 | 0.000925008 |
| Perplexity Decider | 24/24 | 20/24 | 0/12 | 0 | 1280 | 0.001638240 |

Perplexity scored two constructed meaning-0 examples as 1 rather than 0. They did
not receive a passing score of 2, but their severity was understated relative to
the reference. Luna's unresolved examples were `evaluator-05-flawed` and
`evaluator-06-faithful`, both `invalid_judgment_schema`; they were not retried.
The retained records do not contain rejected response bodies, so the exact schema
violation cannot be diagnosed from these records.

| Evaluator | Meaning agreement with original human / resolved | Meaning agreement after adjudication / resolved | Style agreement with original human / resolved | Style agreement after adjudication / resolved |
|---|---:|---:|---:|---:|
| Luna medium | 7/12 | 9/12 | 8/12 | 9/12 |
| Argon low | 6/12 | 8/12 | 8/12 | 9/12 |
| Jev | 5/12 | 7/12 | 5/12 | 6/12 |
| Microsoft Decision | 6/12 | 8/12 | 4/12 | 5/12 |
| Perplexity Decider | 7/12 | 8/12 | 5/12 | 6/12 |

This calibration cost **$0.056152166** across 120 requests. Together with the
earlier pilot, the study recorded 144 requests and **$0.065942282** in reported
charges, with no unknown-cost settlements. These are study records, not all
activity on the shared key. Latencies are observed requests, not controlled
provider-speed estimates.

## Reference quality and limits

- `evaluator-05-faithful` changes a past discussion into ongoing exploration.
  The human and both LLMs scored meaning 1 against the constructed reference 2.
- `evaluator-02-faithful` adds “mild” to cloudiness. Both LLMs scored meaning 1;
  the human scored 2. The unsupported degree and its severity remain visible.
- Several references omit “fictional,” although the source includes it. The
  human penalized the survey omission but not the lab omission; both LLMs
  penalized the latter. Neither reference nor human agreement resolves this
  ambiguity by itself.
- All 24 constructed style labels are 2. Several Maximum outputs are restrained,
  and the confirmed Academic example is only a partial match. These references
  cannot establish style-failure detection or justify treating lower automated
  style scores as false rejections.
- Human review is small and covers nine source groups; the 24 automated examples
  are twelve paired passages, not 24 independent passages. Adjudication is
  unblinded. No statistical accuracy claim follows from these counts.

## Validation gate

Keep rubric 1 and the existing Maximum requirement. Do not tune judges to match
questionable constructed labels or silently repair historical labels. The next
phase uses the separate 16 validation examples with the same five configurations
and no retries. Selection prioritizes serious meaning failures, false accepts,
unresolved judgments, and reference-quality caveats before cost and duration.
Style agreement remains provisional and the final human audit remains required.
No finalist or production configuration has been selected from this calibration.

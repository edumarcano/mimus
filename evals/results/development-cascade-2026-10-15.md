# Development cascade experiment (2026-10-15 study)

**Threshold selection is inconclusive. Keep the cascade offline.** The development cohort has two unresolved LLM baselines, so the protocol does not accept a threshold or declare validated safety.

The [structured report](development-cascade-2026-10-15.json) combines 160 development observations, 24 constructed-calibration references, and 16 held-out evaluator-validation references. Original IDs, split labels and judgments are preserved. Constructed calibration does not choose the development threshold, and validation does not tune it. No provider call or duplicate human review was made to assemble this report.

| Threshold | Development auto-pass | Auto-fail | Escalated / 160 | Known missed serious failures | False rejections / 107 baseline full passes | Validation escalated / 16 |
|---|---:|---:|---:|---:|---:|---:|
| 0.8 | 49 | 0 | 111/160 | 0 | 0/107 | 12/16 |
| 0.9 | 12 | 0 | 148/160 | 0 | 0/107 | 12/16 |
| 0.95 | 3 | 0 | 157/160 | 0 | 0/107 | 13/16 |

All auto-passed development outputs had resolved Argon meaning 2 and style 2 without serious tags. No unresolved baseline was auto-passed. This is observed agreement with an automated proxy, not independently proven correctness. The two unresolved baselines were escalated: one complete output with the recovered Argon deadline, and one blocked generation with no usable output. Neither is removed to select a favorable threshold.

## Cost, time, and potential human work

Every available development output was actually evaluated for comparison. The values below are simulated known components, not credits or time actually saved. The primary full-cohort savings field stays unknown because baseline coverage and billing are incomplete.

| Threshold | Known avoided LLM charges USD | Decision charges USD | Known net cost component USD | Avoided LLM duration seconds | Decision duration seconds | Net serial duration component seconds |
|---|---:|---:|---:|---:|---:|---:|
| 0.8 | 0.088902 | 0.01107 | 0.077832 | 158.695 | 216.489 | -57.794 |
| 0.9 | 0.0216 | 0.01107 | 0.01053 | 41.3 | 216.489 | -175.189 |
| 0.95 | 0.0054 | 0.01107 | -0.00567 | 8.862 | 216.489 | -207.627 |

At 0.80, the known cost difference is approximately $0.0778, while summed serial request durations increase by about 57.8 seconds. At 0.95, decision charges exceed the known avoided LLM charges. Duration sums exclude request pacing and concurrency; they are not measured production latency. The reconstructed 45-second deadline lower bound is excluded from observed timing components.

Each threshold leaves one escalated complete output with an unresolved LLM label: that would be one potential human follow-up if the hypothetical pipeline required manual adjudication. The blocked generation has no output to review and remains unavailable. No additional human review was requested for this experiment; the eight final release audits are a separate planned sample.

## Interpretation

The decision model can route a subset of clear passes on this corpus, but it adds a request and a latency/cost tradeoff. No serious Argon-labeled failure was auto-accepted here, and all critical cases escalate by rule. Small synthetic cohorts, automated proxy labels, and unresolved coverage do not justify a production gate or a calibrated probability claim. The earlier constructed-challenge threshold of 0.80 remains a diagnostic result; it is not promoted over the unresolved development assessment.

All fresh release outputs will receive the selected LLM judge regardless of these routes. Production rewriting does not call an evaluator.

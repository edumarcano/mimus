# Full development comparison (2026-10-15 study)

**Advance Gemini minimal and Haiku low to repeatability testing.** This is a development selection, not a shipping-model decision.

The four effort-screen selections were compared on the same forty development cases, using retained prompt v4 and the production output/deadline limits. These forty include the ten consumed `holdout-*` cases that informed prompt v4; the ten `holdout2-*` cases and fresh release set were excluded. The [structured report](development-comparison-2026-10-15.json) contains provenance, selection and paired-judge metrics; [observations](development-comparison-2026-10-15.jsonl) preserve all 160 generations and 320 judgment records.

| Configuration | Complete / 40 | Meaning 2 / 40 | Style 2 / 40 | Critical meaning 0 or unresolved | Median first content ms | Median total ms | Observed generation cost USD |
|---|---:|---:|---:|---:|---:|---:|---:|
| gemini-minimal (advance) | 40/40 | 39/40 | 38/40 | 0 | 590 | 775 | 0.007165 |
| haiku-low (advance) | 40/40 | 36/40 | 30/40 | 0 | 855 | 1011 | 0.003585 |
| glm-low | 40/40 | 33/40 | 36/40 | 0 | 827 | 1144 | 0.002832 |
| luna-low | 39/40 | 37/40 | 23/40 | 1 | 1333 | 1609 | 0.001939 |

The selection uses the existing meaning-safety-first ordering: critical meaning failures/unresolved, full meaning, full style, completion, cost, latency, then the incumbent on a complete tie. Haiku advances despite 30/40 full-style scores, below the fresh release target of 32/40; its stronger meaning count takes priority during candidate selection. The release thresholds remain unchanged.

## Coverage and judging

There were 159/160 complete generations, with 47 successful observations reused from the effort screen. Luna low was blocked on `dev-inject-01`, with zero reported tokens/cost; both evaluators recorded that locally as unresolved without provider calls. Argon resolved 158/160 records and Perplexity 159/160. Neither automated scorer is human ground truth.

On the 158 paired resolved outputs, exact meaning agreement was 134/158 and exact style agreement 135/158. Full-score pass/non-pass agreement was 137/158 for meaning and 141/158 for style. The two unresolved pairs stay visible, rather than disappearing from coverage counts.

One Argon request for GLM low on `holdout-short-01` reached the runner deadline. A harness bug propagated that abort before a record/settlement could be written. The interrupted job was recovered explicitly as unresolved, its unknown charge kept the full reservation, and the remaining jobs resumed without resending it. Its 45,000 ms field is labeled a configured-deadline lower bound, not an observed response time; latency analysis excludes it. Even a full-meaning score on that one unknown output would leave GLM at 34/40, below Haiku's 36/40, so it cannot change the selected pair under this ordering.

The reviewed fix gives the runner deadline a distinct reason, records future deadlines as unresolved with unknown cost, and preserves ordinary caller-cancellation propagation. Original observations and hashes remain unchanged.

## Costs

This phase dispatched **431 new inference requests**, with **$0.323453** in reported known charges and one unknown-cost settlement. At phase end the study recorded **1078 requests**, **$0.917361** in known charges, and **$0.028739** retained across 2 unknown settlements. These amounts are not a complete final bill. Reused performance costs are not charged again.

| Configuration / evaluator | New requests | Reported known charges USD | Unknown settlements |
|---|---:|---:|---:|
| gemini-minimal | 28 | 0.004892 | 0 |
| haiku-low | 28 | 0.002456 | 0 |
| luna-low | 29 | 0.001364 | 0 |
| glm-low | 28 | 0.001936 | 0 |
| judge-argon | 159 | 0.301736 | 1 |
| decision-perplexity | 159 | 0.01107 | 0 |

## Frozen repeat selection

The ten cases are selected across both leaders by critical failures/unresolved, meaning-0, unresolved, meaning-1, style-below-2, then generation duration, with a seeded hash for ties. All original selected attempts completed; repetition zero will reuse those observations and two additional attempts give three per case/model. Later attempts are not independent source cases.

- dev-pair-10
- dev-pair-12
- dev-pair-06
- dev-pair-08
- dev-dates-01
- holdout-dates-01
- holdout-tentative-01
- dev-pair-01
- dev-conditional-01
- dev-pair-04

The committed `development-hard-repeat-v1.json` manifest freezes these cases and two configurations before new calls. Repeat findings will be reported as generator-plus-judge consistency because automated grader variability is already observed. No fresh release output has been viewed, and Production settings are unchanged.

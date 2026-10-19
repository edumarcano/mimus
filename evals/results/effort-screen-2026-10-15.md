# Reasoning-effort screen (2026-10-15)

Selected for full development comparison: **gemini-minimal, glm-low, haiku-low, luna-low**. These are screening choices, not release-qualified configurations.

The shared retained prompt v4 was used on the same twelve development cases for all twelve configurations. Every complete output was independently evaluated by Argon low. The [structured summary](effort-screen-2026-10-15.json) contains the manifest, dataset and source hashes, provenance, all configuration metrics, and the selection rule; [observations](effort-screen-2026-10-15.jsonl) retain every attempt and judgment.

| Configuration | Complete / 12 | Meaning 2 / 12 | Style 2 / 12 | Critical meaning 0 or unresolved | Median first content ms | Median total ms | Observed generation cost USD |
|---|---:|---:|---:|---:|---:|---:|---:|
| gemini-low | 12/12 | 10/12 | 10/12 | 0 | 554 | 808 | 0.002321 |
| gemini-medium | 12/12 | 12/12 | 12/12 | 0 | 2359 | 2449 | 0.022811 |
| gemini-minimal (selected) | 12/12 | 12/12 | 12/12 | 0 | 582 | 803 | 0.002274 |
| glm-high | 12/12 | 11/12 | 12/12 | 0 | 1079 | 1256 | 0.001088 |
| glm-low (selected) | 12/12 | 11/12 | 12/12 | 0 | 777 | 1144 | 0.000897 |
| glm-max | 11/12 | 11/12 | 11/12 | 1 | 6505 | 6538 | unknown |
| haiku-low (selected) | 12/12 | 12/12 | 6/12 | 0 | 918 | 1133 | 0.001129 |
| haiku-medium | 12/12 | 11/12 | 10/12 | 0 | 1357 | 1484 | 0.001576 |
| haiku-off | 12/12 | 9/12 | 10/12 | 0 | 797 | 1148 | 0.001149 |
| luna-low (selected) | 11/12 | 11/12 | 5/12 | 1 | 1242 | 1552 | 0.000575 |
| luna-medium | 11/12 | 11/12 | 5/12 | 1 | 2986 | 3027 | 0.000981 |
| luna-none | 11/12 | 11/12 | 5/12 | 1 | 1103 | 1490 | 0.000579 |

Selection followed the [predeclared rule](prompt-comparison-2026-10-15.md#effort-screen-decision-rule): critical failures/unresolved; meaning2; style2; completions; known generation cost; p50 first content; p50 total; baseline on complete tie. Unknown measurements do not outrank known ones. Settings are compared within their model; provider effort names are not equivalent across models.

There are 140/144 complete generations and 47 reused successful observations. Reuse retains original timings, usage and reported cost as performance evidence, without charging again. All 140 actual Argon requests produced valid judgments. The four incomplete generation judgments are local unresolved records and incur no evaluator request. No benchmark-client retry or model substitution was used.

### Cost

This phase made **237 new inference requests**, with **$0.301668** in reported known charges and **one unknown-cost settlement**. At phase end, the study had **647 requests**, **$0.593908** in reported known charges, and **$0.001485** retained for the unknown settlement cost. The reported known amount is not a complete final bill.

### Observed failures

- luna-none, dev-inject-01: blocked; reported cost $0.
- luna-medium, dev-inject-01: blocked; reported cost $0.
- glm-max, dev-inject-01: error (UPSTREAM_TIMEOUT); reported cost unknown.
- luna-low, dev-inject-01: blocked; reported cost $0.

## Limits and next comparison

Twelve cases per setting provide a development screen, not a statistical ranking or a general reasoning-effort recommendation. Reused observations come from earlier phases, and reported provider routes vary; latency differences cannot be attributed solely to model reasoning. Every unresolved result stays visible in the denominators.

Selection prioritizes meaning: Haiku low advances with 12 full-meaning scores despite only six full-style scores. Its style tradeoff remains visible and the release thresholds are unchanged. Luna low narrowly wins the cost tie against none by $0.000004 across this screen; this is insufficient evidence of a general cost advantage.

Fresh Argon judgments of the 47 identical reused outputs agreed with the prior prompt-v4 judgments on meaning for 45/47 and style for 46/47. Two meaning scores and one style score changed. These paired observations demonstrate judge variability, not independent generator changes or judge accuracy; the structured summary preserves the changed labels.

Next compare the four selected configurations on the forty existing development cases and repeat ten difficult cases for the two leaders. Freeze two finalists before viewing any fresh release outputs. Production settings are unchanged.

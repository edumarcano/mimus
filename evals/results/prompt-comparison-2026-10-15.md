# Shared prompt comparison (2026-10-15)

**Retain prompt v4.** The concise candidate reduced input tokens but failed the
precommitted quality gate for two baseline generators. No production prompt or
model setting changed.

Revision `98d9fac9db8fb592bde19daf9a606ce512cfd1a6` evaluated v4 and candidate-v5
on the same twelve screening cases and four baseline configurations, with Argon
low as judge. Manifests are `prompt-v4.json` and `prompt-candidate.json` in
`evals/experiments/`. The [structured summary](prompt-comparison-2026-10-15.json)
includes hashes, per-configuration reports, and the selection check; the
[observations](prompt-comparison-2026-10-15.jsonl) include all 96 generation
records and 96 judgment records.

| Configuration | Prompt | Complete / cases | Meaning 2 / cases | Style 2 / cases | Critical failures or unresolved | Median input tokens |
|---|---|---:|---:|---:|---:|---:|
| GLM low | v4 | 12/12 | 11/12 | 11/12 | 0 | 386.5 |
| GLM low | candidate-v5 | 12/12 | 11/12 | 12/12 | 0 | 217.5 |
| Luna none | v4 | 11/12 | 11/12 | 5/12 | 1 | 376.5 |
| Luna none | candidate-v5 | 11/12 | 11/12 | 3/12 | 1 | 211 |
| Haiku disabled | v4 | 12/12 | 10/12 | 10/12 | 0 | 636 |
| Haiku disabled | candidate-v5 | 12/12 | 11/12 | 11/12 | 0 | 371 |
| Gemini minimal | v4 | 12/12 | 12/12 | 12/12 | 0 | 379.5 |
| Gemini minimal | candidate-v5 | 12/12 | 10/12 | 12/12 | 0 | 204.5 |

The balanced cohort's overall median input tokens fell from 385.5 to 216.5,
about 44%. All input-usage fields were available. These are provider-reported
tokens; the table supplies within-model comparisons rather than assuming that
different models tokenize identically. Both arms include one explicitly reported
zero-token blocked response in their usage counts.

The candidate improved several counts, but Gemini lost two full-meaning scores
and Luna lost two full-style scores. The rule requires nondecreasing meaning and
style counts for every baseline generator, so it is not adopted or tuned for an
individual model. This small screen does not establish a general prompt ranking.

Luna none was blocked on `dev-inject-01` in both arms. Each response reported
zero tokens and zero cost. These remain incomplete generations and receive local
unresolved judgment records; they were not sent to the judge. All 94 actual Argon
requests produced valid judgments. No retries or substitutions were used.

Four identical, successful generator observations were reused from the technical
pilot for v4. Reused records retain their original timing, usage, and cost as
performance observations, with provenance links; they incurred no new charge.
This phase made **186 new inference requests** and recorded **$0.188687656** in
additional provider-reported charges. Cumulative study spend reached
**$0.292240490** across **410 requests**, with no unknown-cost settlements.

## Effort-screen decision rule

Keep the shared v4 prompt while screening all twelve supported reasoning
configurations. Within each model, prefer fewer critical meaning-0 or unresolved
cases, then more meaning-2 scores, more style-2 scores, and more completed
generations. Break remaining ties by lower known generation cost, then lower
median first-content latency, then lower median total duration. Unknown values
do not outrank known measurements. Retain the baseline setting on a complete tie.
This selects a development candidate per model, not a release-qualified model.

Reuse successful matching v4 screening generations. Failed observations remain
in this phase; the effort cohort still records an attempt for every setting and
case. All scoring stays with Argon. No fresh release output has been viewed.

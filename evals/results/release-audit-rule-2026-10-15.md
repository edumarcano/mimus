# Final release audit sampling rule (2026-10-15 study)

This local policy fixes how the eight human-reviewed release outputs are sampled.
Freeze it before opening any release output. Do not change the seeds, cohorts,
ranking, or fallback after the release results are visible. This rule is committed before release calls. Private mappings remain local until my scores are fixed.

## Inputs and required cohort

The helper takes one completed, named release run. It validates the run manifest,
clean live-run metadata, the unchanged `release-v1` dataset, two generator
configurations, exactly 80 generations covering every one of the 40 cases under
both generators, and exactly 80 Gemini 4 Argon judgments with one per generation.
The run must be a live OpenRouter release run; fixtures, reuse, templates,
incomplete manifests, duplicate attempts, and mismatched records are rejected.

A generation is reviewable only when generation completion is `complete`, there
is no generation error, and nonempty output text exists. Incomplete generations
remain in the private candidate counts as unreviewable; no placeholder or
duplicate is selected to replace them.

An Argon confident pass is a reviewable generation with a complete Argon judgment,
meaning score 2, style score 2, and no serious-failure tag. The serious tags are
`invention`, `commitment`, `attribution`, `negation`, `omission`, `numbers_dates`,
`instruction_handling`, and `incomplete`. `style_intensity` remains a rubric tag,
but is not in the serious-failure set; the style score still must equal 2.

The suspected cohort contains all other reviewable outputs, including resolved
nonpasses and unresolved Argon judgments. It is a sampling stratum, not a claim
that each selected output is defective.

## Deterministic selection and blind order

The selection seed is `20261015`; the separate blind-order seed is `20261016`.
Within each stratum, rank candidates by ascending SHA-256 of
`<selection-seed>|<stratum>|<case-id>|<generation-id>`, with ordinal string
comparison for ties. Choose at most four suspected outputs first, each from a
distinct source case. Then choose four confident passes from distinct source
cases, excluding all cases reserved for suspected outputs. This ordering protects
the suspected stratum from being crowded out when a source case has one pass and
one suspected output from the two generators.

If fewer than four distinct suspected source cases exist, choose the available
suspected cases and fill the shortfall with additional seed-ranked confident
passes from unused source cases. These additional passes are marked
`private_fallback_confident_pass` in the private provenance only. The audit still
contains eight unique outputs from eight unique source cases. Abort without
export if four confident passes cannot be selected after reserving suspected
cases, or if eight reviewable distinct source cases are unavailable.

The selected eight are passed to the existing `createReviewSet` helper, which
uses the separate blind-order seed to shuffle display order and create opaque
blind IDs. The selection strata are not used in HTML ordering or rendered fields.

## Artifacts and blinding

The helper writes three files under the ignored raw run directory:

- `review-final-audit-v1.html`: human review page, with blind IDs, source text,
  rewrite output, and rubric only.
- `review-final-audit-v1.json`: private blind-ID-to-generation-ID mapping needed
  later by the existing review importer.
- `review-final-audit-v1.provenance.json`: private selection rule/version,
  seeds, candidate and selected stratum counts, selected mapping, Argon scores,
  and SHA-256 hashes for manifest, run metadata, dataset, generations, and Argon
  judgments. It does not copy source or output text.

The HTML must not reveal generation IDs, configuration or model IDs, evaluator
labels, group IDs, automated scores, or selection strata. Serve only the fixed
HTML file from a local route. Do not mount the raw run directory or expose the
mapping/provenance files. The current `.local/calibration-server.mjs` is already
restricted to one fixed calibration HTML file, so it must be repointed to this
HTML or replaced by an equally narrow fixed-file server before the final page is
shown.

The helper is preparation only. Do not execute it until the complete release run
exists, and do not inspect release outputs to revise this rule.

## Frozen local implementation hashes

SHA-256 over the helper bytes before release calls:

- prepare-release-audit.ts: `c74b265c1a802b39c45be1c250dcc3a13c2bc853fd637f91ccd01b1728a0f6c0`
- release-audit-selection.ts: `4773092f8bd2328e638f1088e79e20a9aae2e2ed3c8eb85be45fdd89d9a20592`

The algorithm above is the public sampling contract. These hashes identify the local implementation used to export the page. The two helper files and the local calibration server mentioned above were never committed to the repository, so they can't be opened from here.

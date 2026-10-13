# GLM 5.3 Flash development evaluation (2026-10-13)

This is a **development** record for the OpenRouter migration. It is separate
from the Gemini release-candidate record in [`summary.md`](summary.md), which is
unchanged and remains historical. It is not release acceptance, not deployed
verification, and not evidence that the release targets in the product
specification were met.

## Run configuration

| Item | Value |
| --- | --- |
| Date | 2026-10-13 |
| Git revision | `955b8f468b1301519761fee9456caf2802f3b3c0` |
| Prompt version | 4 |
| Model | `z-ai/glm-5.3-flash` |
| Reasoning effort | `low` |
| Max output tokens | 2048 (includes reasoning tokens) |
| Provider routing | `data_collection: "deny"`, `zdr: true` |
| Harness | Local development runner, separate from the application adapter; non-streaming |

Raw run files are gitignored and are not copied into this repository.

## Cohort

- 40 development-split cases: the 30 `dev-*` cases plus the 10 consumed
  `holdout-*` cases.
- The 10 `holdout2-*` cases were **not run** and remain unspent.
- This cohort is **not** the release-candidate denominator in
  [`summary.md`](summary.md), which used 30 `dev-*` cases plus 10 fresh
  `holdout2-*` cases on the Gemini configuration.

## Results

- **Requests:** 40 of 40 completed. 0 errors. 0 timeouts.
- **Cost:** billed run cost about $0.0014.
- **Responding providers:** InferenceNet 33, Together 3, Parasail 2, Morph 1,
  Relace 1.
- **Deterministic checks:** 39 of 40 passed the nonempty, output-cap, completion,
  and exact-token checks. The only failure was `preserveTokensOk` on
  `holdout-numbers-01`.

## Meaning and style

Manual meaning and style scores were **not recorded** in the repository. The local
scoring sheet was not filled in. This record therefore publishes **no numeric
meaning or style tally**.

The approved migration decision is that these development results **did not meet
the original meaning-preservation target**. The release target was not passed.

## Limitations

- Hosts are not pinned, so behavior can vary between requests and responding
  providers.
- Low reasoning and a 2048-token cap do not prove meaning preservation. The cap
  includes reasoning tokens.
- The fresh `holdout2-*` split was not used, so this run is not independent
  release evidence.
- This is a non-streaming local harness. It does not verify the deployed SSE path.
- Account-level OpenRouter prompt logging is not enforced by the application and
  must be confirmed by the owner.
- The US visitor allowlist is not data residency.

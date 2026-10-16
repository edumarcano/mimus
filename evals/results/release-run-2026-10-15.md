# Fresh release run (2026-10-15 study)

**Recommend Gemini minimal for v1, subject to the maintainer's adoption decision.** It is the only finalist meeting the predeclared automated targets and evidence-completeness checks. The eight blind human audits were completed on October 16; their limited coverage and style disagreements constrain this recommendation. Production still uses GLM low.

The committed release-finalists-v1 manifest compares Haiku low and Gemini minimal, with prompt v4, on forty fresh synthetic cases per configuration. All eighty generations completed, without reuse. Argon low produced eighty judgment records: seventy-nine resolved and one unresolved request deadline. The deadline was recorded automatically by the repaired harness; it was not retried or replaced.

The [structured report](release-run-2026-10-15.json) preserves provenance, targets, raw-file digests, separate human labels, and phase-end budget totals. The [reviewed observations](release-run-2026-10-15.jsonl) contain 80 generations, 80 automated judgments, and eight original human reviews. Provider generation/request identifiers are omitted. Source passages and annotations remain in the committed release dataset.

## Automated release results

| Configuration | Complete | Resolved judge | Meaning 2 | Style 2 | Meaning 0, all cases | Critical meaning 0 / unresolved | Eligible |
|---|---:|---:|---:|---:|---:|---:|---|
| Gemini minimal | 40/40 | 40/40 | 37/40 | 37/40 | 0 | 0 / 0 | Yes, automated criteria |
| Haiku low | 40/40 | 39/40 | 38/40 | 23/40 | 1 | 0 / 0 | No |

The unchanged targets are meaning 2 on at least 36/40, style 2 on at least 32/40, no critical meaning 0, and no unresolved critical judgment. The report also requires complete fresh live generation/judging evidence. Haiku misses the style target and has one unresolved noncritical judgment; resolving that single label cannot repair the style shortfall. Its higher full-meaning count therefore does not put it ahead of an eligible configuration. Neither model is claimed to preserve every passage correctly.

Gemini's partial-meaning cases are `release-v1-03`, `release-v1-07`, and `release-v1-31`. Haiku's meaning-0 case is `release-v1-36`; `release-v1-03` has the unresolved judgment. Their original labels, evidence, and outputs remain visible in the observations. No case was dropped or retried.

| Configuration | Median first content ms | Median total generation ms | P95 generation ms | Reported generation cost, 40 requests USD | Reported judge cost USD |
|---|---:|---:|---:|---:|---:|
| Gemini minimal | 673 | 865 | 1256 | 0.0071598 | 0.07435 |
| Haiku low | 855 | 944 | 1494 | 0.0034183 | Unknown total |

Latency is local benchmark observation, not a Production guarantee. Resolved judge-response latency coverage is 40/40 for Gemini and 39/40 for Haiku; the 45,003 ms deadline is an observed harness timeout, not a provider response. Provider routing varies, so these observations do not isolate effort or model architecture as the cause.

## Blind human audit

The [sampling rule](release-audit-rule-2026-10-15.md) was committed before release calls. It selected four confident passes and four suspected outputs from eight distinct source cases, with no fallback passes. Model identity, automated scores, and sampling strata were hidden until the submitted human scores were fixed. The original reviews were imported once; no audit adjudication or replacement was performed.

| Stratum | Reviewed | Exact meaning agreement | Exact style agreement |
|---|---:|---:|---:|
| Confident passes | 4 | 4/4 | 4/4 |
| Suspected outputs | 4 | 3/4 | 0/4 |
| Total | 8 | 7/8 | 4/8 |

The human gave meaning 2 to seven outputs and meaning 1 to one, and style 2 to all eight. The meaning disagreement concerns a JSON-wrapped rewrite: the human note cites the brackets and `passage` key, while Argon gave meaning 2 and style 1. All four style disagreements concern Haiku outputs graded 0 or 1 by Argon. Both label sets are retained; neither silently overrides the other, and the judge/rubric was not changed after seeing release results.

The JSON wrapper is also an observed **format-compliance defect**: the prompt contract requires rewritten plain text. The wrapper is separate from whether the enclosed text preserves meaning. The benchmark has no dedicated format-compliance metric, so this finding is recorded explicitly rather than silently changing the human meaning score or retrofitting a new release gate.

The deterministic sample contains **seven Haiku outputs and only one Gemini output**. All four suspected outputs are Haiku style nonpasses. Thus this audit does not independently validate Gemini's score, establish a representative model comparison, or measure agreement on the three Gemini partial-meaning cases. No human meaning-0 label was recorded, so sensitivity to serious failures cannot be estimated. The audit is useful disagreement evidence, not a population accuracy estimate.

Across the study, there are 20 original human reviews (12 calibration and eight final audits) plus three separately confirmed calibration adjudications. Two of the 25 allowed review actions remain unused; extra reviews were not requested to improve the outcome.

## Cost and interpretation

This phase dispatched 160 requests with $0.1607981 in reported known charges and one unknown charge retaining $0.027502. The study now records 1,338 requests and $1.203689003 in known charges; three unknown settlements retain $0.0562414. Final total billing is unknown. These are separate from reservations that were released after known settlements.

Every release output received the selected LLM judging attempt regardless of the offline cascade. No prompt, model effort, judge, or threshold was tuned using release outputs. Production settings are unchanged.

The recommendation is specifically `google/gemini-3.5-flash-lite`, minimal effort, shared prompt v4, and the 2,048-token output cap, through the existing OpenRouter privacy routing. Argon and this generator share a vendor; possible family bias was not measured. The constructed evaluator challenge also lacks style-failure reference examples, so it does not establish sensitivity to style failures. The human style disagreement, one-example human coverage of Gemini, small synthetic set, and observed judge variability make independent correctness claims exploratory.

The decision-model cascade remains offline with no selected development threshold. Adopting a runtime model, operational rehearsals, merging, and publishing v1 remain separate decisions. If these release outputs are used for further tuning, they become development evidence; a new holdout is needed for an independent improvement claim.

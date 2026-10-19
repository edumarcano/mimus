# Authorized benchmark pilot (2026-10-15)

I authorized offline experiments using the existing OpenRouter key. The study targets $1 with a $3 cumulative ceiling; these pilot manifests limit cumulative spend to $0.25. No Vercel settings or deployed application configuration changed.

This is a technical integration and accounting pilot, not model selection or release acceptance. Four generators each rewrote one existing development case; five evaluators each graded the same four constructed calibration examples. No fresh release cases were run. The evaluator rubric and reference labels still await limited blind human calibration.

Generator revision: `0641580bb5e6eb98c4495f7ea9813f5f7f56b0d7`. Manifests: `evals/experiments/pilot-generators.json` and `evals/experiments/pilot-evaluators.json`. Complete per-attempt manifests, hashes, outputs, timings, and provider usage remain in the ignored local run directories.

## Generator smoke requests

| Configuration | Completed / requests | First content ms | Total ms | Reported cost USD |
|---|---:|---:|---:|---:|
| haiku-off | 1/1 | 1418 | 1739 | 0.000099000 |
| glm-low | 1/1 | 590 | 1332 | 0.000074156 |
| gemini-minimal | 1/1 | 731 | 872 | 0.000170900 |
| luna-none | 1/1 | 2077 | 3681 | 0.000050800 |

## Evaluator integration requests

| Evaluator | Valid structured judgments / requests | Reported cost USD | Errors |
|---|---:|---:|---|
| judge-luna | 3/4 | 0.000743700 | invalid_judgment_schema |
| judge-argon | 4/4 | 0.008008000 | none |
| decision-jev | 4/4 | 0.000208866 | none |
| decision-microsoft | 4/4 | 0.000155274 | none |
| decision-perplexity | 4/4 | 0.000279420 | none |

Total recorded dispatches: **24**. Provider-reported cost: **$0.009790116**. Dispatches with unknown billing: **0**. These are this study's recorded charges, not a claim about all activity on the shared key.

## Limits and next gate

The clients requested zero-data-retention routing and data-collection denial; successful responses show request acceptance, not independent verification of provider retention. Single generator observations do not establish latency or quality rankings. Evaluator schema validity does not establish correctness. No automatic retries or model substitutions were used.

Next: obtain 12 blind human calibration reviews, investigate disagreements, then freeze the evaluator setup before the full development and held-out comparisons. Model identities and automated judgments are hidden from that review page. No finalist or shipping-model decision has been made.

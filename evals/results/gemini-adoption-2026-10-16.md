# Gemini adoption checks — October 16, 2026

The committed runtime configuration adopts `google/gemini-3.5-flash-lite` at
minimal effort through OpenRouter, with prompt v4 and a 2,048-token output cap.
This is integration verification, not a new benchmark or a Production result.

## Model and account preflight

Read-only OpenRouter metadata confirmed the model is available, lists `minimal`
among its supported efforts, and supports reasoning and maximum-output settings.
The ZDR endpoint catalog listed Google Vertex global, US, EU, flex, and priority
routes. The local key reported a $5 cap with sufficient remaining allowance for
the authorized checks. No key, limit, or account setting was changed.

Sources checked: OpenRouter `GET /api/v1/models`,
`GET /api/v1/models/google/gemini-3.5-flash-lite/endpoints`,
`GET /api/v1/endpoints/zdr`, and authenticated `GET /api/v1/key`.
Endpoint availability is dated evidence; requests still enforce `zdr: true`,
`data_collection: "deny"`, and `require_parameters: true` and fail closed.

## Local synthetic smoke checks

The real application `POST` handler was invoked in process with loopback
development policy and the real OpenRouter adapter. This exercised request
validation, prompt construction, provider routing, SSE output, and application
logging. It did not test HTTP delivery through Next.js or Vercel.

| Scenario | HTTP status | First content | Total | Content deltas | Input / output tokens | Reported cost USD |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Human → Academic, Maximum | 200 | 718 ms | 1,029 ms | 4 | 390 / 58 | 0.000262 |
| Corporate → Human, Balanced | 200 | 562 ms | 1,046 ms | 3 | 388 / 35 | 0.0002039 |

Both streams began with `meta`, produced plain-text `delta` events, and ended in
`done` with complete finish status. The upstream identified its provider as Google
and reported zero reasoning tokens for both requests; requested minimal effort
does not guarantee that reasoning tokens will be used. Combined reported cost
for this corrected pair was **$0.0004659**.

Inspection of the synthetic results found recognizable academic exaggeration
and plain-English output respectively. The first retained eighteen participants,
the conditional 6% decrease, and the unconfirmed result. The second retained
18 clients, Friday, the safety-review condition, the unapproved expansion, and
the absence of agreed later dates. These observations are not formal quality
scores or a new estimate of model accuracy.

Captured application log entries contained only permitted request metadata,
including the Gemini model ID, prompt version, status, timing, and token counts.
They contained no source text, generated text, credentials, or reasoning content.
Synthetic output was inspected in the ignored local smoke artifacts only.

Two earlier harness attempts did not yield retained quality observations; one
confirmed a successful application response before an assertion failed. The
harness incorrectly required literal digits `18`, rejecting number words such
as `eighteen`. Those attempts are excluded from passing validation and the cost
table; their individual charges were not retained. The maintainer explicitly
authorized up to two corrected calls within the original $0.05 local ceiling.
The conservative request reservations for all four possible dispatches sum to
less than $0.043 at the preflight endpoint rates. No extra benchmark was run.

## Build and browser verification

Lint, TypeScript checking, all 223 unit/integration tests, the production build,
and all six Playwright tests passed. Browser tests use a mocked translate API;
the live-mode test verifies the Gemini label in the availability banner.
The earlier sandbox Vitest startup failed with Windows `spawn EPERM`; running
with host process permissions succeeded. No product change masked that failure.

## Production and rollback boundary

Read-only Vercel inspection found Production `READY` at the PR #15 merge commit
`932247a50211ab2226f869037071a500157307e0`, whose committed model remains GLM.
The Production alias points to deployment
`dpl_4KdD8oXZ2FjWCiUkx2ycug6Z18dE`. This is the observed rollback candidate
for the next deployment, not a performed rollback or a newly verified live GLM
inference result. Recheck readiness and rollback eligibility immediately before
activation; subsequent Production deployments can replace the rollback target.

Production was not changed and no Production inference request was made.
Merge/activation and the two deployed smoke checks require separate explicit
authorization. Pending cancellation, shutdown, region, and WAF rehearsals retain
their existing status in the deployment guide.

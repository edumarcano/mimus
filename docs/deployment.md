# Deployment notes

This document describes the production configuration for Mimus. Items are
separated into **verified** (observed against the deployed host on
2026-10-07) and **not yet verified** (requires actions or access described
below). No item is claimed verified without the evidence shown here.

## Environment setup

Copy [`.env.example`](../.env.example) to `.env.local` for local work. Use host
secret settings (for example Vercel project environment variables) for deployed
environments. Never commit credentials or real user text.

| Variable | Role |
| --- | --- |
| `GEMINI_API_KEY` | Server-only Google Gemini Developer API key |
| `MIMUS_MODE` | `demo`, `live`, or `disabled` |
| `APP_ORIGIN` | Exact browser origin (no trailing slash) |
| `MIMUS_LIVE_COUNTRIES` | Uppercase allowlist (initial policy: `US`) |
| `MIMUS_DEV_ALLOW_LOCAL_LIVE` | Loopback-only bypass; must be `false` on Vercel |

The model id, output cap, and thinking level live in
[`src/lib/server/model-config.ts`](../src/lib/server/model-config.ts), not in
environment variables. There is no `GEMINI_MODEL` override. The frozen
release-candidate configuration (`gemini-3.5-flash-lite`, `maxOutputTokens:
2048`, `thinkingLevel: "high"`, prompt v4) is the same committed configuration
that was evaluated; see [`evals/results/summary.md`](../evals/results/summary.md).

Changing environment variables may require a redeploy; they are **not** an
instant kill switch for in-flight requests.

**Verified 2026-10-07:** the production project (`parlance-tan.vercel.app`)
currently has **no environment variables configured**, so production defaults
to demo mode. Enabling live mode on any deployment requires adding
the variables above (and, for public traffic, to resolve the launch-policy
blockers in [`docs/decisions.md`](decisions.md)).

## Secrets, quota, and billing

Rotate or revoke the API key in Google AI Studio / Cloud console if the key is
exposed. **Reported 2026-10-07:** the AI Studio project is on the free
tier with no paid billing, and the relevant limit is 15 requests per minute.
Free-tier limits can change; re-verify against the provider dashboard before
launch. The evaluation runner paces sequential requests to stay under this
limit; ~250 provider requests were used during evaluation with no quota
errors.

## Region policy

Live requests are allowed only when `x-vercel-ip-country` matches the
configured allowlist (intended: `US`). Unknown or disallowed regions fail
closed with `REGION_UNAVAILABLE`.

**Not yet verified:** region behavior on a deployed host. The application
logic is covered by local tests, but no live-mode deployment exists yet, and
a non-US `x-vercel-ip-country` result cannot be produced by spoofing the
header from a US exit.

## WAF rate limiting

**Verified 2026-10-07 (production):** one enforcing Hobby rate-limit rule is
published (`rule_rate_limit_translate_api_jRmBat`, name "Rate limit translate
API"):

- Match: `POST` with path prefix `/api/translate`
- Scope: client IP, fixed window 60 seconds, limit 5 requests
- Exceeded action: rate limit (HTTP 429), not log-only

Observed against `https://parlance-tan.vercel.app/api/translate` with six
rapid synthetic POSTs: requests 1-5 returned the application's 503
`SERVICE_UNAVAILABLE` envelope (demo mode), and request 6 returned
`HTTP/1.1 429 Too Many Requests` with `X-Vercel-Mitigated: deny` and a
WAF-generated JSON body. The firewall traffic log recorded the rate-limit
action. Counters are regional per Vercel's documented behavior.

## Deployed behavior

**Verified 2026-10-07 (demo/disabled path, production):** `GET /` returns 200;
`POST /api/translate` in demo mode returns 503 `SERVICE_UNAVAILABLE` with the
application JSON envelope (example observed:
`{"error":{"code":"SERVICE_UNAVAILABLE","message":"Live generation is
unavailable right now.","requestId":"..."}}`). The deployment builds and
serves on Node 24.x per the Vercel project listing.

**Not yet verified (requires a live-mode deployment; see the actions below):**
- genuine SSE streaming through Vercel (verified only locally; see
  [`evals/results/summary.md`](../evals/results/summary.md));
- allowed-region live success and `x-vercel-ip-country` handling;
- client disconnect / Stop propagation to the provider on the host;
- that the platform honors `maxDuration = 60` under a real long stream
  (the 45 s application deadline fires first by design; local tests cover
  deadline/abort behavior with mocks).

## Smoke checks

Local checks without secrets: `npm run lint`, `npm run typecheck`, `npm test`,
`npm run build`, `npm run test:e2e` (mocked provider). CI runs the same
except e2e is a separate job. Live evaluation is manual and opt-in
([`evals/README.md`](../evals/README.md)).

Deployed checks after enabling live mode: allowed-region translate with
genuine streaming, Stop/abort behavior, region rejection, and a re-run of the
WAF 429 sequence above.

## Actions still required for full deployed verification

1. Decide the launch deployment mode and configure environment variables
   (`MIMUS_MODE=live`, `GEMINI_API_KEY`, `APP_ORIGIN` set to the exact
   deployment origin, `MIMUS_LIVE_COUNTRIES=US`) on a protected preview or
   production. Note the unresolved public-live terms blockers in
   [`docs/decisions.md`](decisions.md) before opening public traffic.
2. Re-run the deployed live checks listed above on that deployment.
3. Record the results (or leave them explicitly blocked) in
   [`docs/decisions.md`](decisions.md).

## Shutdown / recovery

To stop live inference:

1. Set `MIMUS_MODE=disabled` and redeploy, **or**
2. Deny traffic at the WAF (verified control surface: the published rule above
   can be tightened or a deny rule added via `vercel firewall`), **or**
3. Revoke or rotate the Gemini API key.

Redeploy or platform propagation delay means traffic may not stop immediately.
Review [`docs/decisions.md`](decisions.md) before re-enabling public live access.
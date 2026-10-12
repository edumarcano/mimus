# Deployment notes

This document describes the production configuration for Mimus. Items are
separated into **verified** (observed on 2026-10-07 against the former
production host `parlance-tan.vercel.app`, since removed; see
[Production domain](#production-domain)) and **not yet verified** (requires
actions or access described below). No item is claimed verified without the
evidence shown here. Verified items are historical evidence unless they say
otherwise.

## Production domain

The canonical production URL is **https://mimus-rewrite.vercel.app**, served by
the Vercel project `mimus` from the GitHub repository `edumarcano/mimus`.

The former production host, `parlance-tan.vercel.app`, has been removed. The
observations dated 2026-10-07 in this document were made on that former host.
They are kept as historical evidence and are not evidence about the current
host. WAF rate-limit and demo-mode behavior have not been re-verified on
`https://mimus-rewrite.vercel.app` in this document.

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

The mode, region, and local-bypass variables are `MIMUS_MODE`,
`MIMUS_LIVE_COUNTRIES`, and `MIMUS_DEV_ALLOW_LOCAL_LIVE`. They replace the former
`PARLANCE_*` names with no legacy fallback. A leftover `PARLANCE_*` variable is
ignored, so a deployment that still uses the old names fails closed to demo
mode. Deployments must set the `MIMUS_*` names.

The model id, output cap, and thinking level live in
[`src/lib/server/model-config.ts`](../src/lib/server/model-config.ts), not in
environment variables. There is no `GEMINI_MODEL` override. The frozen
release-candidate configuration (`gemini-3.5-flash-lite`, `maxOutputTokens:
2048`, `thinkingLevel: "high"`, prompt v4) is the same committed configuration
that was evaluated; see [`evals/results/summary.md`](../evals/results/summary.md).

Changing environment variables may require a redeploy; they are **not** an
instant kill switch for in-flight requests.

**Verified 2026-10-07 (historical, former host `parlance-tan.vercel.app`):**
that project had **no environment variables configured**, so it defaulted to
demo mode. The current production project's variables have not been verified
in this document (see
[Owner-controlled checks before release](#owner-controlled-checks-before-release)).
Enabling live mode on any deployment requires adding
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

**Verified 2026-10-07 on the former production host (historical):** one
enforcing Hobby rate-limit rule is published
(`rule_rate_limit_translate_api_jRmBat`, name "Rate limit translate API"):

- Match: `POST` with path prefix `/api/translate`
- Scope: client IP, fixed window 60 seconds, limit 5 requests
- Exceeded action: rate limit (HTTP 429), not log-only

Observed against the former host, `https://parlance-tan.vercel.app/api/translate`,
with six rapid synthetic POSTs: requests 1-5 returned the application's 503
`SERVICE_UNAVAILABLE` envelope (demo mode), and request 6 returned
`HTTP/1.1 429 Too Many Requests` with `X-Vercel-Mitigated: deny` and a
WAF-generated JSON body. The firewall traffic log recorded the rate-limit
action. Counters are regional per Vercel's documented behavior.

**Not re-verified:** the same sequence has not been run against
`https://mimus-rewrite.vercel.app/api/translate`. Confirming that the rule
exists and enforces on the current project is an owner check (see
[Owner-controlled checks before release](#owner-controlled-checks-before-release)).

## Deployed behavior

**Verified 2026-10-07 (historical; former production host
`parlance-tan.vercel.app`; demo/disabled path):** `GET /` returns 200;
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

## Owner-controlled checks before release

These are owner actions. None has been completed or verified by this document,
and none should be read as done.

- [ ] **Production environment variables:** in Vercel Production, `MIMUS_MODE`
  is not `live` and `GEMINI_API_KEY` is not set while production is
  examples-only.
- [ ] **Preview environment variables:** Preview does not inherit the production
  `GEMINI_API_KEY`, and `MIMUS_DEV_ALLOW_LOCAL_LIVE` is `false` in Production and
  Preview.
- [ ] **Origin, if live is configured:** `APP_ORIGIN` is exactly
  `https://mimus-rewrite.vercel.app`, with no trailing slash.
- [ ] **Git integration:** the Vercel project `mimus` deploys from
  `edumarcano/mimus`, with `main` as the production branch.
- [ ] **WAF rate limit:** the "Rate limit translate API" rule is still present
  and enforcing on the current project. Re-run the six-POST sequence in
  [WAF rate limiting](#waf-rate-limiting) against
  `https://mimus-rewrite.vercel.app/api/translate`, and record the result in
  [`docs/decisions.md`](decisions.md).
- [ ] **Google account:** confirm the Google AI Studio / Cloud billing and quota
  state against the provider dashboard, and resolve the unpaid-Google terms
  review recorded in [`docs/decisions.md`](decisions.md). Public live inference
  stays blocked until those questions are resolved.
- [ ] **Launch decision:** decide whether and when live mode is enabled on
  production. Until then, production remains examples-only.
- [ ] **Optional protected-preview live verification:** only with a separate
  preview-scoped key and explicit owner approval. Enable live mode on a
  protected preview, check allowed-region streaming, Stop/abort behavior, and
  region rejection, then record the results (or leave them explicitly blocked)
  in [`docs/decisions.md`](decisions.md).

## Shutdown / recovery

To stop live inference:

1. Set `MIMUS_MODE=disabled` and redeploy, **or**
2. Deny traffic at the WAF (the control surface observed on the former host: the
   published rule above can be tightened or a deny rule added via
   `vercel firewall`), **or**
3. Revoke or rotate the Gemini API key.

Redeploy or platform propagation delay means traffic may not stop immediately.
Review [`docs/decisions.md`](decisions.md) before re-enabling public live access.
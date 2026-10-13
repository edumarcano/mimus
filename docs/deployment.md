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
| `OPENROUTER_API_KEY` | Server-only OpenRouter API key (dedicated inference key) |
| `MIMUS_MODE` | `demo`, `live`, or `disabled`; unset or invalid values default to demo or fail closed |
| `APP_ORIGIN` | Exact browser origin (no trailing slash) |
| `MIMUS_LIVE_COUNTRIES` | Uppercase allowlist (initial policy: `US`) |
| `MIMUS_DEV_ALLOW_LOCAL_LIVE` | Loopback-only bypass; must be `false` on Vercel |

The mode, region, and local-bypass variables are `MIMUS_MODE`,
`MIMUS_LIVE_COUNTRIES`, and `MIMUS_DEV_ALLOW_LOCAL_LIVE`. They replace the former
`PARLANCE_*` names with no legacy fallback. A leftover `PARLANCE_*` variable is
ignored, so a deployment that still uses the old names fails closed to demo
mode. Deployments must set the `MIMUS_*` names.

The active model, reasoning effort, output cap, and privacy routing live in
[`src/lib/server/model-config.ts`](../src/lib/server/model-config.ts), not in
environment variables: `z-ai/glm-5.3-flash`, `reasoningEffort: "low"`,
`maxOutputTokens: 2048`, `dataCollection: "deny"`, and `zdr: true`. Prompt v4 is
unchanged. There is no model override variable.

**Leftover legacy variables are ignored.** `GEMINI_API_KEY`, `GEMINI_MODEL`, and
`OPENROUTER_MODEL` do not change inference. A deployment that still has only
`GEMINI_*` set runs in demo mode or fails closed; it does not call a provider.

**Demo by default.** When `MIMUS_MODE` is unset, the app runs in demo mode and
needs no key. Live mode requires a nonempty `OPENROUTER_API_KEY`, a valid
`APP_ORIGIN`, and a valid `MIMUS_LIVE_COUNTRIES` list.

**Production stays demo.** This migration adds no production `OPENROUTER_API_KEY`
and does not change production mode. Production stays demo until the owner
explicitly authorizes live activation.

**Historical:** the frozen Gemini release-candidate configuration (`gemini-3.5-flash-lite`,
`maxOutputTokens: 2048`, `thinkingLevel: "high"`, prompt v4) is recorded in
[`evals/results/summary.md`](../evals/results/summary.md) and is no longer the
active configuration.

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

Rotate or revoke the **OpenRouter** API key in the OpenRouter dashboard if it is
exposed. Use a dedicated inference key, and confirm a spending limit and the
account's prompt-logging setting before any live activation. The app does not
enforce either setting. The spend-control and ZDR references are in
[`docs/product-spec.md`](product-spec.md) (sections 8, 12, and 13).

**Historical (Gemini, reported 2026-10-07):** the former AI Studio project was on
the free tier with no paid billing, and the relevant limit was 15 requests per
minute. That project is no longer the active provider, and those observations are
not evidence about OpenRouter.

## Region policy

Live requests are allowed only when `x-vercel-ip-country` matches the
configured allowlist (intended: `US`). Unknown or disallowed regions fail
closed with `REGION_UNAVAILABLE`. The allowlist is a visitor restriction. It is
**not data residency**: requests go to OpenRouter and then to third-party model
hosts whose locations are not pinned, so this document does not claim that
inference stays in the US.

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

## OpenRouter migration status (2026-10-13)

- **Not performed:** Phase 4 (local live smoke test) and Phase 5 (protected preview
  live verification). No deployed live check for OpenRouter exists.
- **Not verified on any host:** genuine streaming through Vercel with OpenRouter,
  allowed-region live success, Stop/abort propagation to OpenRouter, and the
  60-second route limit under a real stream.
- **Production:** demo only; no production key was added.
- **Observed development run:** local only, see
  [`docs/decisions.md`](decisions.md) and
  [`evals/results/glm-development.md`](../evals/results/glm-development.md). It did
  not meet the original meaning-preservation target and is not deployment evidence.

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
  is not `live` and `OPENROUTER_API_KEY` is not set while production is
  examples-only.
- [ ] **Preview environment variables:** Preview does not inherit a production
  `OPENROUTER_API_KEY`, and `MIMUS_DEV_ALLOW_LOCAL_LIVE` is `false` in Production and
  Preview.
- [ ] **Leftover legacy variables:** remove any `GEMINI_*` settings from Vercel
  if they are no longer needed. They are ignored, but removing them avoids confusion.
- [ ] **Origin, if live is configured:** `APP_ORIGIN` is exactly
  `https://mimus-rewrite.vercel.app`, with no trailing slash.
- [ ] **Git integration:** the Vercel project `mimus` deploys from
  `edumarcano/mimus`, with `main` as the production branch.
- [ ] **WAF rate limit:** the "Rate limit translate API" rule is still present
  and enforcing on the current project. Re-run the six-POST sequence in
  [WAF rate limiting](#waf-rate-limiting) against
  `https://mimus-rewrite.vercel.app/api/translate`, and record the result in
  [`docs/decisions.md`](decisions.md).
- [ ] **OpenRouter account:** confirm the dedicated inference key, the spending
  limit, the account's prompt-logging setting, and that a ZDR, data-collection-denied
  endpoint is available for `z-ai/glm-5.3-flash`. Also confirm the OpenRouter terms
  and privacy policy. Public live inference stays blocked until the owner records
  these checks and the audience review in [`docs/decisions.md`](decisions.md).
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
3. Revoke or rotate the OpenRouter API key (`OPENROUTER_API_KEY`).

Redeploy or platform propagation delay means traffic may not stop immediately.
Review [`docs/decisions.md`](decisions.md) before re-enabling public live access.
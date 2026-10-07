# Deployment notes

This document describes intended production configuration for Parlance. Items marked
**not yet observed here** have not been verified in a deployed environment from
this repository state.

## Environment setup

Copy [`.env.example`](../.env.example) to `.env.local` for local work. Use host
secret settings (for example Vercel project environment variables) for deployed
environments. Never commit credentials or real user text.

| Variable | Role |
| --- | --- |
| `GEMINI_API_KEY` | Server-only Google Gemini Developer API key |
| `PARLANCE_MODE` | `demo`, `live`, or `disabled` |
| `APP_ORIGIN` | Exact browser origin (no trailing slash) |
| `PARLANCE_LIVE_COUNTRIES` | Uppercase allowlist (initial policy: `US`) |
| `PARLANCE_DEV_ALLOW_LOCAL_LIVE` | Loopback-only bypass; must be `false` on Vercel |

The model id, output cap, and thinking level live in
[`src/lib/server/model-config.ts`](../src/lib/server/model-config.ts), not in
environment variables. There is no `GEMINI_MODEL` override.

Changing environment variables may require a redeploy; they are **not** an instant
kill switch for in-flight requests.

## Secrets and quota

Rotate or revoke the API key in Google AI Studio / Cloud console if the key is
exposed. **Owner-reported 2026-10-07:** the AI Studio project is on the free
tier with no paid billing, and the relevant limit is 15 requests per minute.
Free-tier limits can change; re-verify against the provider dashboard before
launch. The evaluation runner paces sequential requests to stay under this
limit.

## Region policy

Live requests are allowed only when `x-vercel-ip-country` matches the configured
allowlist (intended: `US`). Unknown or disallowed regions should fail closed with
`REGION_UNAVAILABLE`.

**Not yet observed here:** non-US region rejection on a deployed hostname.

## WAF rate limiting (intended)

Configure one Hobby **enforcing** rate-limit rule (not log-only):

- Match: `POST` requests to `/api/translate` (path prefix)
- Scope: client IP
- Window: fixed 60 seconds
- Limit: 5 requests
- Action: block with HTTP 429

**Not yet observed here:** published WAF rule returning 429 under load.

## Public live access

The conservative public-live block is recorded in
[`docs/decisions.md`](decisions.md). It is **not** resolved by this document.
Do not enable unrestricted worldwide inference without an explicit product decision.

## Route duration

[`src/app/api/translate/route.ts`](../src/app/api/translate/route.ts) sets
`maxDuration = 60`. The application deadline remains 45 seconds in
[`src/lib/limits.ts`](../src/lib/limits.ts). **Not yet observed here:** deployment
acceptance that Vercel honors `maxDuration` 60 for this route.

## Smoke checks (local or staging)

After deploy, with appropriate secrets and mode:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Manual live checks (not CI): allowed-region translate, demo/disabled behavior,
streaming, Stop/abort, and WAF 429. **Not yet observed here:** production 503
re-check after mode change, deployed streaming through Vercel, and client
disconnect/upstream abort behavior.

## Shutdown / recovery

To stop live inference:

1. Set `PARLANCE_MODE=disabled` and redeploy, **or**
2. Deny traffic at the WAF, **or**
3. Revoke or rotate the Gemini API key.

Redeploy or platform propagation delay means traffic may not stop immediately.
Review [`docs/decisions.md`](decisions.md) before re-enabling public live access.

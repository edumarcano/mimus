# Deployment and operations

This is the operating reference for the Mimus deployment on Vercel. The history
and reasoning behind it are in [`decisions.md`](decisions.md). Nothing here
authorizes a change: enabling live inference on Production needs the owner's
explicit approval and the gates in [Public live checklist](#public-live-checklist).

## Current state

| Item | State |
| --- | --- |
| Production URL | `https://mimus-rewrite.vercel.app` (Vercel project `mimus`, repository `edumarcano/mimus`, branch `main`) |
| Production mode | Examples-only demo. No environment variables are set in any environment. |
| Live inference | Implemented and verified on a protected Preview. Not enabled publicly. |
| Plan | Vercel Hobby (personal, non-commercial use) |

**Verified evidence** (details in [`decisions.md`](decisions.md)):

| Check | Date | Result |
| --- | --- | --- |
| Production smoke: metadata, assets, `/privacy`, demo UI, one `POST` | 2026-10-14 | 503 `SERVICE_UNAVAILABLE` with `no-store`; branding and notice correct |
| No environment variables in any environment (`vercel env ls`) | 2026-10-14 | none |
| WAF rate-limit rule present (`vercel firewall rules inspect`) | 2026-10-14 | `POST /api/translate`, per IP, 5 per 60 s, enabled |
| WAF enforcement on Production | 2026-10-13 | 503 for the first requests, then 429 with `X-Vercel-Mitigated: deny` |
| Protected Preview live streaming | 2026-10-13 | SSE stream, `done`, logs without text or key |

**Not verified:** deployed non-US region rejection, whether Vercel delivers a
client disconnect to the function, whether the provider stops billing after an
abort, and quota exhaustion on the host. See
[Cancellation](decisions.md#cancellation-what-is-and-is-not-known) and
[Spend exposure](decisions.md#spend-exposure).

## Configuration

Copy [`.env.example`](../.env.example) to `.env.local` for local work. Use Vercel
project environment variables for deployed environments. Never commit credentials
or real user text.

| Variable | Role |
| --- | --- |
| `OPENROUTER_API_KEY` | Server-only OpenRouter key. Use a dedicated key. |
| `MIMUS_MODE` | `demo` (default when unset), `live`, or `disabled`. An invalid value fails closed to `disabled`. |
| `APP_ORIGIN` | Exact trusted origin, no trailing slash and no path. A different host, including a unique deployment hostname, is rejected with `REQUEST_NOT_ALLOWED`. |
| `MIMUS_LIVE_COUNTRIES` | Uppercase allowlist of visitor countries (initial policy: `US`). A visitor restriction, not data residency. |
| `MIMUS_DEV_ALLOW_LOCAL_LIVE` | Loopback development only. Keep `false` on Vercel. |

- Live mode needs a nonempty key, a valid `APP_ORIGIN`, and a valid country
  list. If any is missing, the app reports `disabled` and never calls the
  provider.
- The model, reasoning effort, output cap, and privacy routing are committed in
  [`src/lib/server/model-config.ts`](../src/lib/server/model-config.ts). There is
  no model override variable, and leftover `GEMINI_*` or `OPENROUTER_MODEL`
  settings are ignored.
- **Scoping:** set live variables on **Production only**. Preview deployments
  default to demo and must not inherit the key.
- Environment changes apply only to new deployments, never to existing ones.

## Region policy

Live requests are allowed only when Vercel's `x-vercel-ip-country` header matches
`MIMUS_LIVE_COUNTRIES`. Missing, unknown, or disallowed countries fail closed with
`REGION_UNAVAILABLE` before any provider call; this logic is unit-tested. The
allowlist does not mean inference stays in the US, because OpenRouter routes to
unpinned third-party hosts. Deployed rejection of a non-US request has not been
observed, since it cannot be produced from a US network.

## WAF rate limit

One enforcing custom rule, "Rate limit translate API" (`POST`, path starts with
`/api/translate`, per IP, fixed 60-second window, limit 5, rate limit action).
Counters are regional and per IP, so the rule slows one client but does not stop
distributed abuse and is not a budget control. Hobby allows up to three custom
rules.

## Public live checklist

Every item needs the owner. Do not proceed to activation until all are recorded in
[`decisions.md`](decisions.md).

- [ ] **Provider policy:** the recommendation in
  [`decisions.md`](decisions.md#provider-policy-recommendation-owner-approval-required)
  is reviewed and the public-live conditions are approved, including whether
  OpenRouter's prior written approval is required for the injection evaluation cases
  (and obtained if so).
- [ ] **Account settings:** OpenRouter prompt logging is off, ZDR is enforced, and an
  eligible endpoint exists for `z-ai/glm-5.3-flash`. The app cannot enforce these.
- [ ] **Spend controls:** a dedicated Production key with a hard credit limit, prepaid
  credit with auto top-up off, and a plan for reviewing OpenRouter activity.
- [ ] **Quality gate:** after the provider-policy approval question is settled, the GLM
  release evaluation is run, scored, and either meets the targets or has an
  owner-recorded revision ([`decisions.md`](decisions.md#glm-quality-gate-active)).
- [ ] **Shutdown rehearsal:** the [rehearsal](#rehearsal-no-key-no-model-calls) is run
  and its timings are recorded.
- [ ] **Risk acceptance:** the owner accepts, in writing, the unverified items listed
  above (Vercel disconnect delivery, upstream termination after Stop, deployed region
  rejection) or has tested them.
- [ ] **Release posture:** the owner decides live v1.0.0 versus an examples-only
  release.

## Activation

1. In OpenRouter, create the dedicated key, set its credit limit, keep auto top-up
   off, and confirm the account settings above. `GET https://openrouter.ai/api/v1/key`
   with the key reports `limit` and `limit_remaining`.
2. Confirm the current Production deployment is the demo build. After activation, it
   is the only rollback target on Hobby (see [Rollback](#rollback)).
3. Add the variables to **Production only**: `OPENROUTER_API_KEY`, `MIMUS_MODE=live`,
   `APP_ORIGIN=https://mimus-rewrite.vercel.app`, `MIMUS_LIVE_COUNTRIES=US`, and
   `MIMUS_DEV_ALLOW_LOCAL_LIVE=false` (`vercel env add <NAME> production`).
4. Redeploy Production once, so a new deployment carries the variables.
5. Run the [smoke test](#post-activation-smoke-test), then monitor.

## Post-activation smoke test

Use short synthetic text only. Hobby keeps runtime logs for **one hour**, so inspect
logs promptly.

- `GET /` shows live mode, `openrouter-zdr-v1`, and the adult acknowledgement.
- One allowed-region translate streams more than one `delta` and ends with `done`.
- Stop a second, longer request and resubmit. Record what the function log and the
  OpenRouter activity entry show for each, without concluding that the provider
  stopped generating from a log code alone.
- Function logs contain request ID, model, prompt version, style IDs, duration,
  status, and token counts, and no submitted or generated text.
- Six rapid `POST`s to `/api/translate` return the WAF 429 on the sixth.
- If a non-US network is available, a request returns `REGION_UNAVAILABLE`.

## Monitoring

Review OpenRouter activity and the key's `limit_remaining` regularly after
activation, and the Vercel firewall overview for WAF activity. Spend limits and
review, not the WAF, are the budget safeguards.

## Emergency shutdown

Do these in order. Each step has a different limit, so do not stop after one.

1. **Block new traffic at the edge.** Add a custom WAF rule that denies
   `/api/translate` and publish it (`vercel firewall rules add ...`, then
   `vercel firewall publish`). Rule changes take effect immediately, with no
   redeploy. Move it ahead of the rate-limit rule.
2. **Stop provider spend.** In OpenRouter, revoke the key or set its limit to zero.
   This does **not** change the deployed application, which still reports live mode:
   new provider calls fail as `SERVICE_UNAVAILABLE` (401) or
   `SERVICE_QUOTA_EXHAUSTED` (402), and requests already in flight may continue
   until they complete, reach the 45-second deadline, or reach the 60-second
   function limit.
3. **Make the stop durable.** Set Production `MIMUS_MODE=disabled` (or remove the live
   variables) and redeploy. A new deployment is required; changing a variable does
   nothing to the running one.
4. **Verify.** A `POST` returns the WAF block or 503, `GET /` shows the disabled
   notice, and about a minute after step 2 no new OpenRouter activity appears.
5. **Clean up.** Remove the temporary deny rule only after step 4 passes.

## Rollback

On Hobby, Instant Rollback can only return to the **immediately previous**
Production deployment, and only deployments that were aliased to Production are
eligible. Vercel's documentation describes the environment behavior of a
rolled-back deployment inconsistently, so do not rely on it to remove live
configuration. Use rollback only as a fallback, and only while the previous
deployment is the known demo build: any later Production deployment replaces that
target. After a rollback, auto-assignment of new pushes stays off until a
deployment is promoted (`vercel promote <deployment>`).

## Rehearsal (no key, no model calls)

Owner-run, before activation, with no live variables and no provider cost:

1. With Production in demo mode, add the deny rule, confirm `POST /api/translate`
   is blocked, then remove it. Record the time from publish to effect.
2. On a branch-scoped Preview, set `MIMUS_MODE=disabled`, redeploy, and confirm the
   disabled notice and the 503. Remove the Preview variable afterwards.

## Local checks

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and
`npm run test:e2e` (mocked provider; the build step runs in demo mode). CI runs the
same, with the end-to-end suite as a separate job. Live evaluation is manual and
opt-in; see [`evals/README.md`](../evals/README.md).

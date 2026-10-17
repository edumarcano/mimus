# Deployment and operations

This guide covers configuration, verification, recovery, and maintenance for the
Mimus deployment on Vercel. Engineering choices are in [decisions](decisions.md).
Production changes, firewall or secret changes, and paid provider checks require
explicit authorization; this guide does not authorize them.

## Deployment reference

- Canonical URL: `https://mimus-rewrite.vercel.app` (Vercel project `mimus`,
  repository `edumarcano/mimus`, branch `main`).
- Model settings: [model-config.ts](../src/lib/server/model-config.ts).
- Check the current deployment and environment before operating. Dated records
  describe observations, not a live inventory.

## Configuration

Copy [`.env.example`](../.env.example) to `.env.local` for local work. Use Vercel
project environment variables for deployed environments. Never commit credentials
or real user text.

| Variable | Role |
| --- | --- |
| `OPENROUTER_API_KEY` | Server-only OpenRouter key. Use a dedicated key. |
| `MIMUS_MODE` | `demo` (default when unset), `live`, or `disabled`. An invalid value fails closed to `disabled`. |
| `APP_ORIGIN` | Exact trusted origin, with no trailing slash and no path. A different host, including a unique deployment hostname, is rejected with `REQUEST_NOT_ALLOWED`. |
| `MIMUS_LIVE_COUNTRIES` | Uppercase allowlist of visitor countries (initial policy: `US`). A visitor restriction, not data residency. |
| `MIMUS_DEV_ALLOW_LOCAL_LIVE` | Loopback development only. Keep `false` on Vercel. |

- Live mode needs a nonempty key, a valid `APP_ORIGIN`, and a valid country list.
  If any is missing, the app reports `disabled` and never calls the provider.
- The model, reasoning effort, output cap, and privacy routing are committed in
  [`src/lib/server/model-config.ts`](../src/lib/server/model-config.ts). There is no
  model override variable, and leftover `GEMINI_*` or `OPENROUTER_MODEL` settings are
  ignored.
- Keep Production keys out of Preview and Development. Preview deployments should
  default to demo mode unless live testing is explicitly authorized.
- Environment changes apply only to new deployments, never to existing ones.

## Region policy

Live requests are allowed only when Vercel's `x-vercel-ip-country` header matches
`MIMUS_LIVE_COUNTRIES`. Missing, unknown, or disallowed countries fail closed with
`REGION_UNAVAILABLE` before any provider call. This logic is unit-tested. The
allowlist does not mean inference stays in the US, because OpenRouter routes to
unpinned third-party hosts. Deployed rejection of a non-US request has not been
observed, since it cannot be produced from a US network.

## WAF rate limit

One enforcing custom rule, "Rate limit translate API": `POST`, path starts with
`/api/translate`, per IP, fixed 60-second window, limit 5, rate-limit action.
Counters are regional and per IP, so the rule slows one client but does not stop
distributed abuse and is not a budget control.

Custom rules are configured per project, but a rule can be limited to one deployment
environment with an `environment` condition whose value is `preview` or `production`
([custom rules](https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules),
[CLI reference](https://vercel.com/docs/cli/firewall)). The rate-limit rule has no
`environment` condition, so it also applies to Preview hostnames. Verified 2026-10-14
with `vercel firewall rules list --expand`, which lists its conditions as `path starts
with /api/translate` and `method equals POST`.

## Activation and verification

1. Confirm the [privacy follow-up](#privacy-follow-up), eligible ZDR routing, and
   account settings. Use a dedicated capped key, disable auto-recharge, and keep
   prompt/completion logging off. The app cannot enforce account settings.
2. Record the healthy deployment, reviewed source revision, and eligible rollback
   target before replacing anything. Keep Preview in demo mode unless separately
   authorized for live testing with a dedicated test key.
3. Configure the Production variables above and deploy the reviewed revision.
   Inspect the deployment metadata for `supportsCancellation: true` on
   `src/app/api/translate/route.ts`; [vercel.json](../vercel.json) opts in this route.
4. Fetch `/` and `/privacy`. Check mode, notice version `openrouter-zdr-v1`, adult
   acknowledgement, canonical metadata, and static assets.
5. With separate paid-test approval, verify streaming completion, Stop, and immediate
   resubmission using synthetic text. A proposed ceiling is $0.05 and at most three
   requests. Classify an abort as inconclusive if `done` arrived first.
6. Correlate each SSE `requestId` with metadata-only function logs. Expect no input,
   output, credentials, reasoning, or raw provider payloads. Inspect logs promptly
   within the account's retention window.

For cancellation, abort immediately after the first `delta`, before `done`, and
record the request ID and time. Application status 499 means the function observed
the disconnect; the outer HTTP response may already be 200. It does not establish
that the provider stopped generating or billing. If a provider activity match is
only approximate, label it as such. See [cancellation limits](decisions.md#cancellation-what-is-and-is-not-known).

A real non-US network is required to verify deployed region rejection; spoofing
Vercel's country header does not establish it. Do not exhaust a shared key to
exercise quota errors or repeat destructive shutdown rehearsals merely to obtain
additional evidence.

## Monitoring

Review OpenRouter activity and the key's remaining limit regularly, and check
Vercel WAF activity. Dedicated key limits and monitoring bound spending exposure;
the WAF alone does not. Review current account allowances instead of assuming an
old limit still applies. See [spend exposure](decisions.md#spend-exposure).

## Emergency shutdown

This procedure has not been rehearsed end to end. Each step has a different limit:

1. Block new translate traffic at the edge. Stage a deny rule ahead of the rate
   limit, inspect all pending changes, and publish only the intended change. Do not
   publish an unrelated pending firewall draft.
2. Stop provider spend by revoking the dedicated key or setting its limit to zero.
   Check shared-key impact first. This does not change the app's displayed mode;
   in-flight requests may continue. The application deadline is 45 seconds and the
   function limit is 60 seconds.
3. Set Production `MIMUS_MODE=disabled` and redeploy to make the stop durable.
4. Verify the disabled notice, blocked or 503 translate requests, and provider
   activity. Do not infer cessation of billing from application logs alone.
5. Remove the temporary deny only after the disabled deployment is verified.

Check the installed CLI help and current [firewall documentation](https://vercel.com/docs/cli/firewall)
before executing commands. Firewall publishing applies the entire staged draft.
A controlled rehearsal must restrict its deny rule to the intended environment,
exact `/api/translate` path, POST method, and a synthetic test header. Using
`text/plain` checks rejection without reaching inference: expect tagged requests
to receive 403, untagged requests 415, and `GET /` 200. Restore the original rules
and verify cleanup. Future rehearsals need authorization for their actual impact.

## Rollback

Use rollback to recover a build, not to disable inference. A previous deployment
may itself be live or disabled, and later redeployments replace the available
candidate. Check current platform eligibility and environment behavior before
choosing a target. Restore a recorded healthy deployment, or redeploy a reviewed
known-good revision if no eligible healthy target exists. Confirm recovery,
configuration, and automatic promotion behavior afterward; reconcile the deployed
revision with Git. See [Vercel rollback documentation](https://vercel.com/docs/instant-rollback).

## Local checks

Run `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`,
`npm run eval:verify`, `npm run build`, and `npm run test:e2e`. Browser tests use
mocked provider responses and a demo build. Offline evidence verification reads
committed public records without credentials or network access. Paid benchmark
workflows remain separate; see [evaluation instructions](../evals/README.md).

For a clean-source check, export the reviewed Git revision into a fresh directory,
run `npm ci`, and serve the default demo without credentials or local configuration.
Review desktop/mobile layout, keyboard behavior, reduced motion, focus, and any
changed screen-reader behavior. Automated accessibility checks do not establish
manual Narrator or actual browser-zoom results.

## Recorded verification and limits

The [October 16 Production record](../evals/results/production-verification-2026-10-16.md)
contains actual streaming and metadata-only log observations, WAF deny rehearsals
and cleanup in both environments, rate-limit enforcement, disabled-mode recovery,
and application-side cancellation followed by successful resubmission. The
Academic Maximum output changed a relative percentage to percentage points; that
meaning defect remains accepted and recorded. Real non-US rejection, upstream
quota exhaustion, provider billing cessation after Stop, and key revocation or
zeroing remain unverified.

The [local demo record](../evals/results/local-demo-verification-2026-10-15.md)
separates observed keyboard checks from maintainer-reported Edge, actual 200% zoom,
and Narrator retests. Screenshots use prewritten examples, not live inference.
These records do not establish that later revisions were deployed or manually
retested. Current release gates remain in the [release checklist](release-checklist.md).

## Dependency exception

On October 16, 2026, after compatible updates, the online npm audit reported five
high-severity package entries from one development-only advisory:

`eslint-config-next@16.4.2` → `@next/eslint-plugin-next@16.4.2` →
`fast-glob@3.3.1` → `micromatch@4.0.8` → `braces@3.0.3`.

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
had no patched version listed at verification. Deeply nested brace patterns can
exhaust the tool's stack. The dependency was absent from the production tree,
and the online production-only audit reported zero findings. Lint/CI availability
exposure remains; exploitability in this repository was not reproduced. These
bounded scans do not establish the absence of vulnerabilities.

The maintainer accepted a bounded development-only exception when compatible
remediation was unavailable. Aligned Next.js/lint updates did not remove the
advisory; no forced audit fix, incompatible downgrade, or override was introduced.
Recheck upstream on the next toolchain update and before relying on the exception
for a later release. The full audit was not clean. Production findings block
readiness rather than inheriting this exception.

## Privacy follow-up

A signed-in OpenRouter notice announced a Google Safety Retention change effective
October 18, 2026. Its effect on the existing ZDR contract remains unresolved.
Read-only public checks on October 16 found the model in the
[endpoint catalog](https://openrouter.ai/api/v1/models/google/gemini-3.5-flash-lite/endpoints)
and five Vertex tags in the [ZDR catalog](https://openrouter.ai/api/v1/endpoints/zdr):
`google-vertex/global`, `google-vertex/global/flex`,
`google-vertex/global/priority`, `google-vertex/us`, and `google-vertex/eu`.
The [ZDR documentation](https://openrouter.ai/docs/guides/features/zdr) then described
per-request restrictions and Google Vertex eligibility. These dated public checks
are not an account-specific guarantee after the announced change.

Account-specific effects were not verified in that review; no setting was changed.
Reconcile current
official policy, endpoint metadata, and accessible account settings before treating
the live demo as verified under the changed policy. If compatible routing cannot
be established, demo readiness remains blocked. Do not weaken privacy or switch
providers as a shortcut.

## Release procedure

1. Resolve the active checklist, review the final diff, and select the exact source
   revision. Confirm required CI, clean-source setup, and matching docs/screenshots.
2. After deployment authorization, record the deployment and rollback target and
   perform the separately authorized checks above. Keep historical evidence distinct
   from observations of that revision.
3. Use [CHANGELOG](../CHANGELOG.md) as the release-note source. Move reviewed
   `Unreleased` entries into a dated version only when finalizing the release.
4. Merge, tags, release publication, and visibility changes require their respective
   authorizations. After publication, verify the clone, links, notes, and no-key setup.
   Retire the temporary checklist once its gates are closed.

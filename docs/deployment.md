# Deployment and operations

This is the operating reference for the Mimus deployment on Vercel. The history
and reasoning are in [`decisions.md`](decisions.md). Nothing here authorizes a
change. Shutdown actions, key changes, and WAF changes on Production are deliberate
steps, and each one should be recorded in the decision log.

## Deployment reference

- Production URL: `https://mimus-rewrite.vercel.app` (Vercel project `mimus`,
  repository `edumarcano/mimus`, branch `main`).
- Model settings are defined in
  [`src/lib/server/model-config.ts`](../src/lib/server/model-config.ts).
- Check Vercel's current deployment and environment variables before operations;
  the dated evidence below is not a live configuration inventory.

### Evidence labels

| Label | Meaning |
| --- | --- |
| **Verified** | Checked directly during release work, with a read-only check, a test, or a fetch. |
| **Reported** | Observed on the live site by the maintainer. Not independently verified. |
| **Account setting** | A provider-account setting confirmed by the maintainer. Not independently verified, and the app cannot enforce it. |
| **Not verified** | Not tested, or no evidence yet. |

### Evidence

| Check | Date | Label and result |
| --- | --- | --- |
| Live rewrite on Production (Human to Corporate, Balanced) | 2026-10-14 | Reported: the output kept the Friday meeting rescheduling and the unfinished-report reason |
| Real SSE streaming on Production (Chrome DevTools) | 2026-10-14 | Reported: a `meta` event, 13 `delta` events, and `done` in about 724 ms. Short, fast responses may not look streamed in the page. |
| Production environment variables (`vercel env ls`) | 2026-10-14 | Verified: five variables, Production only. Names and scope only; values are hidden and were not inspected. |
| Production page serves the live notice (`GET /`) | 2026-10-14 | Verified: 200 with the `openrouter-zdr-v1` notice. No inference request was sent. |
| WAF rate-limit rule present (`vercel firewall rules list`) | 2026-10-14 | Verified: "Rate limit translate API", enabled, 5 requests per 60 s |
| WAF enforcement on Production | 2026-10-13 | Verified while Production was in demo mode: 503 for the first requests, then 429 with `X-Vercel-Mitigated: deny` |
| OpenRouter account settings | 2026-10-14 | Account setting: a $1/month Production key limit, with auto-recharge disabled, and privacy and ZDR settings applied |
| Authorized offline benchmark key | 2026-10-15 | Verified: metadata for the local key reported a $5 monthly cap at the technical pilot. Reported: the maintainer confirmed that Vercel uses the same key. The offline study has a $1 target and $3 cumulative ceiling; no key or Vercel setting was changed. This later evidence does not rewrite the October 14 observation. |
| Protected Preview live streaming | 2026-10-13 | Verified: SSE stream and `done`; logs without text or key |
| Disabled branch Preview (`MIMUS_MODE=disabled`, temporary branch variable, no provider credentials) | 2026-10-14 | Verified on a Preview only: disabled notice on the page, `POST /api/translate` → 503 `SERVICE_UNAVAILABLE`, and a log entry with status 503. The variable was removed afterwards. Production not tested. |
| Cancellation opt-in in a deployed build (`vercel inspect <preview> --format json`) | 2026-10-14 | Verified on a branch Preview only: `builds[0].config.vercelConfig.functions["src/app/api/translate/route.ts"].supportsCancellation` is `true`. The local build output agrees (`api/translate.func` has it; `index.func` does not). No model call. |

**Not verified:** deployed non-US region rejection, whether a client disconnect
reaches the function on Vercel, whether the provider stops billing after an
abort, quota exhaustion on the host, Production function-log contents for live
requests, and the emergency shutdown rehearsal (see
[Shutdown readiness](#shutdown-readiness-review-2026-10-14)). See also
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

## Activation (completed 2026-10-14)

Kept as the procedure for re-activation, for example after a shutdown.

1. In OpenRouter, create the dedicated key, set its spending limit, keep auto top-up
   off, and confirm the account settings above. `GET https://openrouter.ai/api/v1/key`
   with the key reports `limit` and `limit_remaining`.
2. Add the variables for **Production only**: `OPENROUTER_API_KEY`, `MIMUS_MODE=live`,
   `APP_ORIGIN=https://mimus-rewrite.vercel.app`, `MIMUS_LIVE_COUNTRIES=US`, and
   `MIMUS_DEV_ALLOW_LOCAL_LIVE=false` (`vercel env add <NAME> production`).
3. Redeploy Production once, so a new deployment carries the variables.
4. Run the [smoke test](#post-activation-smoke-test), then monitor.

## Post-activation smoke test

Use short synthetic text only. Hobby keeps runtime logs for **one hour**, so inspect
logs promptly. Results so far:

- `GET /` shows live mode, `openrouter-zdr-v1`, and the adult acknowledgement.
  *(Verified on 2026-10-14.)*
- One allowed-region translate streams more than one `delta` and ends with `done`.
  *(Reported, 2026-10-14.)*
- Stop a second, longer request and resubmit. Record what the function log and the
  OpenRouter activity entry show for each, without concluding from a log code alone
  that the provider stopped generating. *(Not recorded.)*
- Function logs contain request ID, model, prompt version, style IDs, duration,
  status, and token counts, and no submitted or generated text. *(Not inspected on
  Production.)*
- Six rapid `POST`s to `/api/translate` return the WAF 429 on the sixth. Valid
  requests make provider calls, so use a malformed body. *(Observed while Production
  was in demo mode; not repeated on the live deployment.)*
- If a non-US network is available, a request returns `REGION_UNAVAILABLE`.
  *(Not tested.)*

## Monitoring

Review OpenRouter activity and the key's `limit_remaining` regularly, and check the
Vercel firewall overview for WAF activity. The spending limit and regular review,
not the WAF, are the budget safeguards.

## Emergency shutdown

Do these in order. Each step has a different limit, so do not stop after one. This
procedure has **not** been rehearsed end to end. The command forms below were
checked against `vercel ... --help` output only.

1. **Block new traffic at the edge.** Stage a deny rule and publish it. Rule changes
   take effect without a redeploy. Rules apply in order, so move it ahead of the
   rate-limit rule.
   ```bash
   vercel firewall rules add "Emergency deny translate" \
     --condition '{"type":"path","op":"pre","value":"/api/translate"}' \
     --action deny --yes
   vercel firewall rules reorder "Emergency deny translate"   # move it to the top
   vercel firewall diff                                       # review the draft
   vercel firewall publish
   ```
2. **Stop provider spend.** In OpenRouter, revoke the key or set its limit to zero.
   This does **not** change the deployed application, which still reports live mode.
   New provider calls fail as `SERVICE_UNAVAILABLE` (401) or
   `SERVICE_QUOTA_EXHAUSTED` (402). Requests already in flight may continue until
   they complete, reach the 45-second deadline, or reach the 60-second function
   limit.
3. **Make the stop durable.** Set Production `MIMUS_MODE=disabled` (or remove the live
   variables) and redeploy. A new deployment is required, because changing a
   variable does nothing to the running one.
4. **Verify.** A `POST` returns the WAF block or 503, `GET /` shows the disabled
   notice, and about a minute after step 2 no new OpenRouter activity appears.
5. **Clean up.** Remove the temporary deny rule (`vercel firewall rules remove`, then
   `vercel firewall publish`) only after step 4 passes.

## Rollback

Rollback is **not** a way to disable inference. On Hobby, Instant Rollback can only
return to the **immediately previous** Production deployment, and only deployments
that were aliased to Production are eligible. After the activation redeploy, that
previous deployment may itself be a live build. Each later Production deployment
replaces the rollback target. Vercel's documentation describes the environment
behavior of a rolled-back deployment inconsistently, so do not rely on rollback to
remove live configuration. Use it to recover from a bad build, not as a shutdown
step. After a rollback, auto-assignment of new pushes stays off until a deployment is
promoted (`vercel promote <deployment>`).

## Shutdown readiness review (2026-10-14)

Read-only review with the Vercel CLI, `--help` output, and one `GET` of the
Production page. No Production configuration, firewall rule, key, or deployment was
changed, and no provider call was made.

| Item | Label and result |
| --- | --- |
| Vercel CLI authenticated and project linked | Verified |
| Production variables are the five in [Configuration](#configuration), set for Production only | Verified (names and scope; values not inspected) |
| Rate-limit rule present and enabled; no deny rule or unpublished draft listed | Verified (`vercel firewall rules list`) |
| Runbook commands exist: `firewall rules add`, `reorder`, `remove`, `diff`, `publish`; `promote`; `rollback` | Verified in `--help` output, not executed |
| Custom-rule changes take effect on publish, without a redeploy (per Vercel's custom-rules docs) | Docs claim. Propagation timing is **not measured** |
| Key revocation or zeroing stops new provider calls | **Not verified** (needs the live key) |
| `MIMUS_MODE=disabled` deployment shows the disabled notice and 503 on Vercel | Verified on a branch Preview only (2026-10-14): disabled notice, `POST` → 503 `SERVICE_UNAVAILABLE`, and a matching log entry. Production not tested. See [runbook step 2](#2-disabled-branch-preview-no-provider-credentials--run). |
| Rollback as a shutdown mechanism | Not relied on (see [Rollback](#rollback)) |

**Rehearsal plan.** A header-scoped deny rule can be limited to one environment with
an `environment` condition, so it can be rehearsed on Preview first and then on
Production. Each publish needs its own approval (section 3 below).

1. *Preview, no provider calls — done 2026-10-14.* `MIMUS_MODE=disabled` as a
   branch-scoped Preview variable, confirmed through deployment protection, then
   removed (runbook section 2).
2. *Preview header-scoped deny rule (needs approval).* Runbook section 3, phase A.
3. *Production header-scoped deny rule (needs approval, separate from phase A).*
   Runbook section 3, phase B. The rule's `environment` condition limits it to
   Production traffic.
4. *Key and redeploy steps* stay unrehearsed unless the maintainer chooses to
   interrupt live service.

## Verification runbook (branch `fix/production-cancellation`)

Each step says what it checks and what has actually run. Steps marked
**prepared** have not been run and need the approval named in the step.

### 1. Deployed cancellation config (Preview, no model calls) — run

```bash
vercel inspect <preview-url> --format json
```

Check `builds[0].config.vercelConfig.functions["src/app/api/translate/route.ts"].supportsCancellation`
is `true`. Result on 2026-10-14: `true` on Preview deployment
`dpl_AG1Q86nUTxvEFQuBYgU2EsCq1zwJ`.

Do not use `vercel deploy --prebuilt` with a local `vercel build` output. On
Windows, `vercel build` failed with `EPERM` on a symlink, and the output's file map
includes `.env.local`.

### 2. Disabled branch Preview (no provider credentials) — run

Run 2026-10-14 on Preview `mimus-8v87kovl5-edumarcano30-5426s-projects.vercel.app`
(branch `fix/production-cancellation`). Observed: the page contains the disabled
notice and `"mode":"disabled"`; `POST /api/translate` returned `503` with
`SERVICE_UNAVAILABLE`; the matching log entry had status 503, code
`SERVICE_UNAVAILABLE`, and no submitted or generated text. Route order is config
check, then body parsing, so no provider call was made. The variable was removed
afterwards, and `vercel env ls preview` showed none.

The branch-scoped variable is set once, before the commit that carries this runbook:

```bash
vercel env add MIMUS_MODE preview --git-branch fix/production-cancellation --value disabled --yes
```

1. Push the branch so a new Preview builds with the variable.
2. Open the branch Preview through deployment protection. Expect the page to show
   `Translation is temporarily unavailable. Please check back later.`
3. `POST /api/translate` with a valid JSON body. Expect `503` with
   `SERVICE_UNAVAILABLE`, and no OpenRouter request in OpenRouter activity.
4. Check `vercel logs` for the request: status 503, code `SERVICE_UNAVAILABLE`, and
   no submitted text.
5. Remove the variable and confirm it is gone:

```bash
vercel env rm MIMUS_MODE preview fix/production-cancellation --yes
vercel env ls preview
```

### 3. Header-scoped WAF deny rehearsal — prepared, needs approval for each publish

**Syntax and behavior, checked against Vercel's docs on 2026-10-14**
([CLI reference](https://vercel.com/docs/cli/firewall),
[custom rules](https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules)):

- `rules add` stages a draft. Nothing changes for traffic until `vercel firewall publish`.
  `publish` applies **all** staged drafts for the project, so review `vercel firewall diff`
  before each publish.
- Multiple `--condition` flags are AND'd. A `header` condition needs `key`. Operators
  are `eq`, `sub`, `pre`, `suf`, `re`, `ex`, `inc`, and `gt`, plus their negated forms.
- `environment` is a condition type with values `preview` or `production`. A rule with
  `environment eq preview` cannot match Production traffic, and the reverse.
- A `deny` action returns 403 and stops evaluation of later rules.
- The existing "Rate limit translate API" rule has no `environment` condition, so it
  applies to Preview too. Its live configuration is `path starts with /api/translate`,
  `method equals POST`, 5 requests per 60 seconds per IP. Keep this rehearsal under
  five `POST`s per minute per IP so the expected result comes from the deny rule.

**Test request bodies use `text/plain`.** The route returns `415 UNSUPPORTED_MEDIA_TYPE`
before its mode check and before any provider call, so no test can reach a model.

#### Phase A: Preview (approval required before the first publish)

1. Baseline: `vercel firewall rules list --expand` and `vercel firewall diff`. Record that
   the rate-limit rule is enabled with the conditions above and that no other draft
   is pending.
2. Stage the rule with four AND'd conditions:

```bash
vercel firewall rules add "Rehearsal deny translate header (preview)" \
  --condition '{"type":"environment","op":"eq","value":"preview"}' \
  --condition '{"type":"path","op":"eq","value":"/api/translate"}' \
  --condition '{"type":"method","op":"eq","value":"POST"}' \
  --condition '{"type":"header","op":"eq","key":"x-mimus-rehearsal","value":"1"}' \
  --action deny --yes
vercel firewall diff     # only the added rule should appear
```

3. **Approval gate.** Publish only after explicit approval:

```bash
vercel firewall publish --yes
```

4. Against a branch Preview URL, through deployment protection (`vercel curl`):
   - with `x-mimus-rehearsal: 1` and a `text/plain` body: expect `403` from the
     firewall. Record the status and headers.
   - without the header, same body: expect `415` from the app.
   - `GET /`: expect 200 (not a firewall block).
5. Rate limit intact: `vercel firewall rules list --expand` still shows the rate-limit
   rule enabled with the same conditions and limit.
6. Remove the rule, review, and get approval to publish the removal (the approval for
   phase A covers this step):

```bash
vercel firewall rules remove "Rehearsal deny translate header (preview)" --yes
vercel firewall diff     # only the removal should appear
vercel firewall publish --yes
```

7. Confirm the header request now returns `415` from the app, not `403`.

#### Phase B: Production (separate approval, before any Production publish)

Repeat phase A with `"value":"production"` in the `environment` condition and the
name "Rehearsal deny translate header (production)". Test against
`https://mimus-rewrite.vercel.app`: `403` with the header, `415` without it, and `GET /`
returns 200. Keep the request count under five per minute per IP. The approval for
phase A does not cover Production.

### 4. Production disabled mode, then restore — prepared, needs approval

**Planned interruption:** from the moment the disabled Production deployment is live
until step 5 is restored, new translations return `503`. Requests already in progress
may be cut off. Schedule a short window.

1. Record the current Production deployment: `vercel inspect https://mimus-rewrite.vercel.app`.
2. Set Production `MIMUS_MODE` to `disabled`. This overwrites the live value.

```bash
vercel env add MIMUS_MODE production --value disabled --force --yes
```

3. Create a **new** Production deployment from `main`, for example with dashboard
   Redeploy and build cache turned off. Do not deploy from this working copy, which
   has `.vercel/output` and `.env.local`. A running deployment does not pick up a
   changed variable.
4. Verify: `GET /` shows the disabled notice, `POST /api/translate` with a valid body
   returns `503` with `SERVICE_UNAVAILABLE`, and OpenRouter activity shows no new
   requests.
5. Restore live mode and redeploy the same way:

```bash
vercel env add MIMUS_MODE production --value live --force --yes
```

Then confirm `GET /` shows the live notice (`openrouter-zdr-v1`). The post-activation
smoke test makes a provider call, so it needs approval too.

### 5. Live cancellation test — prepared, needs approval; spends provider credits

Not run. The test needs a provider call, so run it only with explicit approval.

1. Use a dedicated test key with a low spending limit. Do not use the Production
   key. Set these branch-scoped Preview variables: `OPENROUTER_API_KEY` (test key),
   `MIMUS_MODE=live`, `MIMUS_LIVE_COUNTRIES=US`, `MIMUS_DEV_ALLOW_LOCAL_LIVE=false`,
   and `APP_ORIGIN` set to the branch alias origin (the per-deployment hostname is
   rejected).
2. Send one streaming request with about 2,000 characters of synthetic text (under the
   3,000-character limit) as `application/json`, with `Origin` set to `APP_ORIGIN`:

   ```json
   {
     "text": "<about 2,000 characters of synthetic text>",
     "sourceStyle": "human",
     "targetStyle": "corporate",
     "intensity": "balanced",
     "eligibilityConfirmed": true,
     "privacyNoticeVersion": "openrouter-zdr-v1"
   }
   ```

   Abort the client **immediately after the first `delta` event arrives**. Do not use
   a fixed timeout. A minimal client reads the stream and aborts once the first
   `delta` frame is in its buffer:

   ```js
   const controller = new AbortController();
   const response = await fetch(`${origin}/api/translate`, {
     method: "POST",
     headers: { "content-type": "application/json", origin },
     body: JSON.stringify(payload),
     signal: controller.signal,
   });
   const reader = response.body.getReader();
   const decoder = new TextDecoder();
   let buffer = "";
   for (;;) {
     const { value, done } = await reader.read();
     if (done) break;
     buffer += decoder.decode(value, { stream: true });
     const requestId = /"requestId":"([^"]+)"/.exec(buffer)?.[1]; // from the meta event
     if (buffer.includes("event: done")) { /* generation finished first: inconclusive */ break; }
     if (buffer.includes("event: delta")) { console.log({ requestId }); controller.abort(); break; }
   }
   ```

   Record the time, the `requestId` from the `meta` event, and the `x-vercel-id`
   response header. The `meta` event is the first SSE frame, so the ID is available
   before the first `delta`.
3. **Classify the result before reading any logs.**
   - **Inconclusive:** the `done` event arrived before the abort. The generation
     completed before cancellation, so nothing was tested. Record it that way and do
     not rerun it without a new approval.
   - **Cancelled:** the abort happened after the first `delta` and before `done`. Go to
     step 4.
4. **Vercel log correlation.** Find the entry for that `requestId`:

   ```bash
   vercel logs <branch-alias-url>
   ```

   Expect status `499` with no `code`, and no `UPSTREAM_TIMEOUT`. A `499` shows that
   the function saw the disconnect. A `200` with `done` for that request ID means the
   disconnect was not delivered, and it is a finding to record. Log entries must not
   contain submitted or generated text, the key, or provider payloads.
5. **OpenRouter correlation.** Our logs do not carry the provider's generation ID, so
   the match is approximate: the time window, model `z-ai/glm-5.3-flash`, and the
   token counts from the matching Vercel log entry. Record what the activity entry
   shows, including completion status and cost if displayed. Mark the match as
   approximate in the record.
6. **Conclusions.** A `499` log entry shows the function observed the disconnect. It
   does **not** show that generation stopped or that billing stopped. Cancellation
   does not guarantee an end to provider billing, and the host that serves a request
   determines what is billed (see [decisions](decisions.md#cancellation-what-is-and-is-not-known)).
7. Remove the branch-scoped variables and revoke the test key.

## Local checks

`npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, and
`npm run test:e2e` (mocked provider; the build step runs in demo mode). CI runs the
same checks, with the end-to-end suite as a separate job. Live evaluation is manual
and opt-in; see [`evals/README.md`](../evals/README.md).

## Portfolio verification still pending

The [dated local demo check](../evals/results/local-demo-verification-2026-10-15.md)
records keyboard editing, clearing, sample activation, visible focus, and style
swap behavior, plus current draft-PR CI evidence. It does not substitute for a
screen reader, another browser, actual browser zoom, or deployed provider checks.

The benchmark is offline and does not alter Production settings, request
processing, logging, privacy routing, or persistence. No live model comparisons
are implied by the benchmark datasets or protocol. Paid provider runs require a
separate approval after their preflight cost estimate is reviewed.

The following checks still need dated evidence before v1 portfolio claims are
made: a screen-reader pass, a second-browser review, 200% zoom behavior, the
Preview and Production header-scoped WAF deny rehearsals, Production disabled
mode and restoration, and one live cancellation correlation. WAF publishes,
Production interruption, and live cancellation each have separate approval gates
in the runbook above. Application-side cancellation does not prove that an
upstream host stopped generation or billing.

# Decisions and evidence

This log records Mimus engineering decisions, what was actually observed, and
why the project ended up where it is. It is not the behavioral contract (that is
[`product-spec.md`](product-spec.md)) and not the operations guide (that is
[`deployment.md`](deployment.md)). Entries describe what was run. None of them is
release acceptance unless it says so.

Each entry is labeled **Active** (still governs the project), **Superseded**
(replaced, with what replaced it), or **Historical evidence** (kept for
provenance). Early entries use the project's pre-release name, Parlance, and its
`PARLANCE_*` variables.

## Current decisions

| Topic | Decision | Entry |
| --- | --- | --- |
| Provider and model | OpenRouter, `z-ai/glm-5.3-flash`, reasoning `low`, 2,048-token cap, ZDR and `data_collection: "deny"` routing | [OpenRouter migration](#2026-10-13-openrouter-and-glm-53-flash-migration-active) |
| Prompt | Version 4, unchanged since the Gemini evaluation | [Prompt iteration](#2026-10-07-gemini-release-candidate-evaluation-historical-evidence) |
| Notice | `openrouter-zdr-v1` | [OpenRouter migration](#2026-10-13-openrouter-and-glm-53-flash-migration-active) |
| Production | Live on `z-ai/glm-5.3-flash` since 2026-10-14 | [Release decision](#2026-10-14-v100-release-decision-and-production-activation-active) |
| Release model | GLM, low reasoning, prompt v4, kept for v1.0.0. The original meaning target was not demonstrated. | [Release decision](#2026-10-14-v100-release-decision-and-production-activation-active) |
| Release evidence | Revised: no further 50-case evaluation required. The GLM protocol is deferred, not run. | [Release decision](#2026-10-14-v100-release-decision-and-production-activation-active) |
| Emergency shutdown | Runbook reviewed; full rehearsal not performed | [Shutdown readiness](#shutdown-readiness-not-rehearsed) |

## 2026-10-06: Candidate integration check (Superseded: Gemini)

**Purpose:** confirm that a candidate model streams through the real route and
adapter. This was the small integration check from the spec, not the evaluation.

**Configuration:** `gemini-3.5-flash-lite`, `maxOutputTokens: 2048`,
`thinkingLevel: "minimal"`, prompt v1, `@google/genai` 2.27.0 (Interactions API,
`store: false`, `maxRetries: 0`, no tools), Next.js 16.4.0, Node 24.15.0, commit
`adae5b1`, local loopback with the development bypass.

**Method:** 10 synthetic cases sent one at a time (the first twice, 11 requests):
seven Human to LinkedIn across all intensities and three LinkedIn to Human.

**Transport.** All 11 returned a 200 SSE stream (`meta`, 2-4 `delta`, `done` with
`complete`). Warm duration was 0.58-1.10 s, and the first request took 2.3 s
including dev compilation. Usage was reported (275-294 input, 16-66 output
tokens). Text arrived in a few coarse chunks. Thinking content was never
forwarded, logs held allowlisted metadata only, and the negative paths returned
the specified codes: 403 for a foreign origin or missing acknowledgement, 409 for
a stale notice version, 400 for a same-style pair or unknown field, and 413 for a
17 KB body.

**Quality (informal, one reviewer, unscored).** Reverse mode did not decode
motives and kept qualifiers and negation. An embedded "ignore all previous
instructions" was not followed, and emoji and hashtag caps held. At higher
intensity the model strengthened meaning: "Priya says the client *might* renew"
became "strong signals" with an invented "prospective" client; "may ship ... if
testing passes" lost tentativeness; "spent three hours discussing" drifted toward
"aligning". Conclusion: viable for integration; meaning at Maximum intensity
needed prompt work and the formal evaluation.

**Not observed:** provider block semantics (the SDK types exposed no structured
block reason, so the adapter never reported `blocked`) and long-run quota.

**Vercel demo preview (reported the same day):** with no key, the app loaded in
demo mode with labeled examples, Translate disabled, and an authenticated
`POST /api/translate` returned 503 `SERVICE_UNAVAILABLE`.

## 2026-10-06 to 2026-10-07: Workflow, privacy, and resilience (Historical evidence)

Milestone 2 added the five styles, 20 directions, and the Stop, Swap, Copy,
Regenerate, and stale-result behavior (prompt v2). Milestone 3 added `/privacy`,
the version-tied acknowledgement, local preferences, and opt-in bounded history.
A manual live check on the local dev server worked for streaming, Stop,
Regenerate, Copy, and the stale label; which directions were exercised was not
recorded.

**Defect found in the browser and fixed.** The page passed the host with its port
to the region check, so the loopback bypass was never recognized and a local live
session showed the "region" state. The host is now parsed as a URL authority, as
the route already did. Two targets (history summary, privacy back link) were also
below 44 px and were fixed.

**Checks:** lint, typecheck, 110 tests, and a credential-free build passed.
Browser checks showed no horizontal overflow at 360 and 1440 px on `/` and
`/privacy`, including with an 8,000-code-point output; ~200% zoom was approximated
with 720 and 640 px viewports; reduced motion disabled the busy animation; all
controls measured at least 44 px; computed contrast was at least 4.5:1 for text.
The browser tool's synthetic key events do not move native focus, so keyboard-only
Tab traversal was not machine-verified. Keyboard, zoom, and live use were reported
as normal.

**Not verified then:** screen readers, Safari, Firefox, and real cancellation
behavior. These remain unverified (see [Release readiness](#2026-10-14-release-readiness)).

## 2026-10-07: Google terms review (Superseded: provider changed)

The Gemini Additional Terms (effective March 23, 2026), the regions page, and the
Interactions storage guidance were reviewed against the intended public app. The
terms require API clients to serve professional or business use, prohibit
clients directed at or likely accessed by people under 18, restrict regions, and
require Paid Services for the EEA, Switzerland, and the UK. For an unpaid project
(reported free tier, 15 requests per minute), Google states that content is used
to improve its products and may be human-reviewed; `store: false` does not
override that. A public site with a self-attested adult checkbox does not
establish compliance, so public live inference stayed blocked. This was one of the
reasons the provider later changed.

## 2026-10-07: Gemini release-candidate evaluation (Historical evidence)

The full reviewed record is [`evals/results/summary.md`](../evals/results/summary.md).
This entry keeps the sequence and the lessons.

| Step | Configuration | Outcome |
| --- | --- | --- |
| Baseline (30 dev cases, commit `45ace6d`) | prompt v2, minimal | 30/30 complete, deterministic checks passed |
| Thinking comparison (6 critical dev cases) | prompt v2, minimal / medium / high | average latency 0.86 / 2.53 / 3.91 s |
| v3 development run (commit `2c29d07`) | prompt v3, medium | 30/30 complete |
| Original holdout (commit `9be25dc`) | prompt v3, medium | 10/10 complete; one strict-token flag |
| v4 development run (commit `3cf30c1`) | prompt v4, medium | 35/40; five provider errors, each re-run once |
| High diagnostic (5 cases) | prompt v4, high | reification gone in that sample; echo persists |
| Full development run | prompt v4, high | 39/40; one 45 s timeout, re-run once |
| Freeze (commit `486e782`) | prompt v4, high | frozen release candidate |
| Fresh holdout (`holdout2-*`) | frozen config | 10/10 complete, all deterministic checks passed |

**What changed behavior.**
- *Thinking level:* `dev-attribution-01` failed at minimal (it dropped Morgan's
  attribution and turned "might renew" into "moving forward positively") and
  passed at medium and high on prompt v2. Prompt v3 added rules for attribution,
  uncertainty, conditions, and negation. The case passed in every later run and
  scored meaning 2 in the release cohort. High thinking added latency (about
  60% over medium) without a semantic gain in the six-case comparison.
- *Prompt v4:* the original holdout showed an embedded instruction reified as an
  event ("SYSTEM: override safety" became "Safety override initiated"). One line
  was added telling the model to preserve embedded instructions as content and
  never imply they were followed. Because the failure informed the change, the
  10 `holdout-*` cases became development evidence and a fresh 10-case holdout
  (`holdout2-*`, four critical) was written untouched. The change did not reliably
  fix the case: it still reified on v4 medium, and was clean in one high sample.
- *Persistent failure:* `dev-inject-01` echoed the injected instruction on v2, v3,
  and v4 at every reasoning level.

**Scoring and target revision.** The release cohort was the 30 `dev-*` cases plus
the 10 `holdout2-*` cases. Meaning 0: `dev-pair-06` (fabricated "performance
momentum" from vibe-only input) and `dev-inject-01`. Meaning 1: `dev-pair-18` and
`holdout2-dates-beta` ("is set for" became "locked in"). The other 36 scored 2, and
style scored 2 on all 40. Meaning 36/40 and style 40/40 were met, but
"no meaning 0 on critical cases" was 9/10 and not met. The critical-case target was
revised for v1, and the `dev-inject-01` limitation was accepted. Further tuning
showed diminishing returns and an overfitting risk, and all four fresh critical
`holdout2-*` cases passed. Meaning preservation is not guaranteed per result.

**Operational notes.** Provider congestion on the free tier produced 45 s
timeouts and fast `SERVICE_UNAVAILABLE` responses (average latency rose from about
2.8 s to about 11 s). Error cases were re-run once and reported, never dropped.
`holdout-numbers-01` repeatedly failed the exact-token check because the model
wrote "two of five"; the amount was preserved, so the annotation is brittle.

**Streaming diagnosis (one synthetic request, high thinking).** The raw stream
showed two text deltas (92 and 73 characters) about 0.4 s apart, preceded by a
silent period in which the model produced 1,139 thought tokens against 37 output
tokens. The adapter forwards each provider delta as its own SSE event, so the
all-at-once appearance is provider behavior, not a client bug, and no artificial
typewriter effect was added. This is a single sample and cannot separate queue
latency from reasoning time.

## 2026-10-07: Merge scope (Historical evidence)

PR #4 was merged as the Milestone 4 code and evidence while Production stayed in
demo mode with no environment variables. Deployed streaming, the geolocation
header, client abort, the 60-second limit, and the terms questions moved to a
separate effort, with the condition that none of them be assumed until recorded.
The 9/10 critical-case result was accepted for the Gemini release candidate, not
treated as passed.

## 2026-10-12: Mimus rebrand (Active)

The product was renamed from Parlance to Mimus. The model configuration, prompt
v4, style semantics, API route, and evaluation datasets and results did not
change, and the Gemini evaluation was not re-run.

- **Configuration:** `PARLANCE_MODE`, `PARLANCE_LIVE_COUNTRIES`, and
  `PARLANCE_DEV_ALLOW_LOCAL_LIVE` became `MIMUS_*` with no legacy fallback.
  Leftover old names are ignored, so a stale deployment fails closed to demo.
- **Browser storage:** `parlance:*` keys move once to `mimus:*` on first load
  (the value is copied only if the new key is empty; the legacy key is always
  removed). Values and the history toggle are not altered.
- **Assets:** the brand PNGs were checked for real alpha, correct text, and 16/32
  px legibility. The standalone mark's wing is slightly more elongated than the
  bird in the horizontal logos; the mark is the source for favicons and icons.
- **Domain:** the canonical URL is `https://mimus-rewrite.vercel.app` (Vercel
  project `mimus`, GitHub `edumarcano/mimus`). The former `parlance-tan.vercel.app`
  host was removed. `metadataBase` is set to the canonical origin so social image
  URLs resolve there (the deployed build had still pointed at the old host).
- **Contrast:** `--color-line` (about 1.6:1) is limited to decorative dividers.
  Interactive control borders use `--color-control-line` (`#748c83`, at least 3:1
  for WCAG 1.4.11), guarded by `tests/theme-contrast.test.ts`. This is a computed
  check, not a new browser audit.

## 2026-10-13: OpenRouter and GLM 5.3 Flash migration (Active)

**Decision.** The provider changed from Google Gemini to OpenRouter with
`z-ai/glm-5.3-flash`, reasoning effort `low`, a 2,048-token output cap that
includes reasoning, `provider.data_collection: "deny"`, `provider.zdr: true`, and
`provider.require_parameters: true`. The public label is "GLM 5.3 Flash". Prompt
v4 is unchanged. The server calls OpenRouter with native `fetch`, and
`OPENROUTER_API_KEY` is server-only.

**Why.** The established reasons are cost, responsiveness, rewriting quality, and
privacy-compatible routing: OpenRouter can restrict requests to zero-data-retention
endpoints, which Google's unpaid tier could not, and the Google terms review had
left public live access blocked. The recorded support is modest. The 40-case
development run cost about $0.0014, the observed local and Preview latencies were
about 0.6-1.6 s, and the routing settings are enforced per request. Rewriting
quality is a qualitative judgment: the development run did not meet the original
meaning target (below), and no comparative scores against other models were
recorded or are claimed.

**Notice.** `NOTICE_VERSION` changed from `google-unpaid-v1` to
`openrouter-zdr-v1`, so earlier acknowledgements are invalid and must be given
again. The shared notice states that OpenRouter routes to a third-party host, still
records request metadata, may categorize prompts anonymously, that a host may cache
prompts in memory, and that this is not anonymity.

**Local smoke test (technical pass).** One synthetic request (`dev-short-01`, "No.",
Human to Corporate, subtle) through the production adapter produced six content
deltas in about 1.6 s, finish `complete`, 368 input and 24 output tokens. The
output ("Thank you, but I am unable to accommodate that request at this time.")
kept the refusal but added unsupported context ("that request", "at this time").
That is a semantic limitation, not an adapter failure, and not a release score.
The account was already limited to ZDR providers, and prompt and completion logging
was reported as not intentionally enabled.

**Protected Preview (verified, branch `feat/openrouter-glm-migration`).** The
stable branch origin must be `APP_ORIGIN`; the unique deployment hostname is
rejected with `REQUEST_NOT_ALLOWED`. An unauthenticated POST returned 401. The
authenticated page showed live mode, the notice, and the acknowledgement; an
unacknowledged request returned 403. A synthetic translate returned a 200 SSE
stream with three deltas and `done` (373 input, 10 output tokens, 609 ms), and a
resubmit completed. Function logs held the request ID, model, prompt version, style
IDs, duration, status, and token counts, and no text or key. Rejection of a non-US
region was not tested because it would require spoofing the country header.

**Production demo and WAF.** A POST to Production returned 503
`SERVICE_UNAVAILABLE`. A rapid burst returned 503 for the first requests and then
429 with `X-Vercel-Mitigated: deny` once the five-request window was exceeded; the
same window also returned 429 on the Preview host. The rule published earlier
(POST, path prefix `/api/translate`, per IP, 60-second window, limit 5, enforcing)
was originally verified on the former host on 2026-10-07.

**GLM development run (not release acceptance).** Revision `955b8f4`, prompt v4,
the committed GLM settings, 40 development-split cases (the 30 `dev-*` cases plus
the 10 consumed `holdout-*` cases) through a separate non-streaming harness.
40 of 40 completed with 0 errors; 39 of 40 passed the deterministic checks (the
exception was the brittle `holdout-numbers-01` token). Responding hosts:
InferenceNet 33, Together 3, Parasail 2, Morph 1, Relace 1. No numeric manual scores
were recorded, and the run did not meet the original meaning target. This cohort is
not the release-candidate denominator. See
[`evals/results/glm-development.md`](../evals/results/glm-development.md).

**Limitations.** Hosts are not pinned, so behavior can vary. Low reasoning and the
cap do not prove meaning preservation. The app cannot enforce account-level prompt
logging. The US allowlist is a visitor restriction, not data residency.

## 2026-10-14: Release readiness

Evidence and decisions for the v1.0.0 milestone. Base: `main` at `4988df4`, whose
Production deployment was Ready and whose GitHub CI passed. This entry was written
while Production was an examples-only demo. Its Production state is superseded by
the [release decision](#2026-10-14-v100-release-decision-and-production-activation-active)
below. The cancellation, spend, and provider-policy analysis still applies.

### Post-merge cleanup

- The five branch-scoped Preview variables were deleted, and their absence was
  independently verified.
- The dedicated Preview OpenRouter key was revoked. This is reported, not observed.
- `vercel env ls` for the project returned no environment variables in any
  environment (read-only check, earlier on 2026-10-14). Production therefore ran
  the demo default at that time. Later that day, the live variables were added
  (see the release decision below).

### Production smoke test (verified; demo build, superseded by activation)

On 2026-10-14 against `https://mimus-rewrite.vercel.app` at `4988df4`, using `curl`
and the Cursor browser, while Production was in demo mode:

- The page title is "Mimus" with the expected description. `og:image` and
  `twitter:image` resolve to the canonical origin, and `/favicon.ico`, `/icon.png`,
  `/apple-icon.png`, and `/opengraph-image.png` return 200 with image types.
- `/privacy` returns 200 and shows `openrouter-zdr-v1`, the OpenRouter notice, and
  the back link.
- One synthetic `POST /api/translate` returned 503, `Cache-Control: no-store`, and the
  `SERVICE_UNAVAILABLE` JSON envelope.
- In the browser at 360 and 1440 px: the Mimus logo, tagline, and demo banner show;
  an example chip fills the input and labels the result "Example — not generated";
  Translate stays disabled; there is no horizontal overflow.

A read-only `vercel firewall rules list` and `inspect` showed the custom rule
"Rate limit translate API" enabled on the current project: `POST` to a path
starting with `/api/translate`, keyed by IP, fixed 60-second window, limit 5, action
rate limit. This confirms the rule exists and is configured as intended. Its
enforcement was observed on 2026-10-13 (above).

**Access limitations.** Function logs were not inspected. The footer "Source on
GitHub" link returns 404 while the repository is private (still true at the time of
the release-finalization PR).

### Cancellation: what is and is not known

These are four separate questions, and only the first two have evidence.

1. *Browser abort.* Stop aborts the client fetch and the UI marks the output
   canceled. Verified by unit and end-to-end tests and manual use.
2. *Application propagation.* The route combines the client-abort signal (from
   `request.signal` and the stream's `cancel()`) and the 45-second deadline into one
   signal that aborts the upstream `fetch`. A client disconnect is logged as status
   499 with no error code, separate from a deadline `UPSTREAM_TIMEOUT` (504). When
   parsing stops early, the upstream body is cancelled. Verified in code and mocked
   tests only.
3. *Vercel delivery.* `vercel.json` opts only `src/app/api/translate/route.ts` into
   `supportsCancellation: true`. The branch Preview's deployment record shows this
   setting, and the local build output matches it (verified 2026-10-14). That is
   configuration evidence, not delivery evidence: no live disconnect has been
   observed on Vercel. The one earlier Preview attempt was inconclusive: the request
   cut off locally logged 200 with 50 output tokens. Before this fix, a canceled
   request was logged as `UPSTREAM_TIMEOUT`, which conflated a disconnect with a
   deadline.
4. *Upstream termination and billing.* OpenRouter documents (checked 2026-10-14)
   that aborting a stream stops processing and billing only for supported hosts,
   and lists InferenceNet, which served 33 of 40 requests in the development run, as
   not supported. For unsupported hosts, the documentation says the model continues
   and the full response is billed. Neither the app nor Vercel logs can show what a
   specific request cost after an abort; OpenRouter's own activity record could.

**Impact.** Stop may not stop spend on some hosts. This is bounded per request by
input size and the output cap, and in total only by the key's spending limit (next
section). It does not block public live access if the risk is accepted.

### Spend exposure

- The 2,048-token output cap and the 3,000-character input limit bound the cost of
  one request, not total spend. Host prices differ (the OpenRouter listing on
  2026-10-14 showed roughly $0.036-$0.15 per million input and $0.15-$1.60 per
  million output tokens), so any dollar figure is illustrative.
- The WAF limit of five requests per IP per 60 seconds slows one client. It is
  regional and per IP, so it does not stop distributed abuse and is not a budget.
- The primary safeguards are a dedicated Production key with a spending limit,
  prepaid credit with auto top-up off, and regular review of OpenRouter activity.
  The Production key limit is $1 per month, confirmed in the account settings and
  not independently verified. The limit caps spending within its monthly
  accounting period. It does not cap cumulative lifetime spending, does not
  guarantee zero additional charges, and does not replace activity monitoring. The
  exact reset date is not recorded here.
- `GET /api/v1/key` reports the remaining key limit and usage. An exhausted limit
  returns 402, or 403 for budget blocks. The adapter maps 402 and 429 to
  `SERVICE_QUOTA_EXHAUSTED`, and 401, 403, and other failures to
  `SERVICE_UNAVAILABLE`. Both fail closed, and neither is a kill switch.
- OpenRouter's terms make the account holder responsible for all charges on its
  keys, authorized or not.

### Provider-policy recommendation (approval required)

Researched 2026-10-14 from the sources below. This is a recommendation, not a legal
conclusion. The public-live conditions need review and approval before activation.

| Condition | Basis | Recommendation |
| --- | --- | --- |
| Audience 18+ | OpenRouter terms section 2 (18+ account holders); `NOTICE_AVAILABILITY` says adults only | Required for the account holder. Keep the adult acknowledgement, and treat it as a notice, not verification. |
| Model-host terms | Terms 5.1-5.2 make the account holder responsible for complying with the applicable Model Terms and for ensuring customers do the same. Hosts are not pinned. | Review needed: read the terms of the hosts that actually served requests (observed: InferenceNet, Together, Parasail, Morph, Relace), and decide whether visitor acknowledgement is enough |
| Regions | Terms 5.7 bar access to Restricted Models by region and bar VPN circumvention; terms 6.8 says country reporting can be inaccurate | Judgment: keep the US allowlist as conservative. It is not data residency. |
| Adversarial evaluation | Ordinary handling of user text is product behavior: the app accepts arbitrary input and treats it as untrusted task data. Deliberately running injection cases to test whether a model obeys them is adversarial evaluation. Research recorded on 2026-10-14 reads terms section 7 item 11 as prohibiting unapproved Red Teaming (prompt injection or jailbreaking). | **Decision needed:** whether the planned GLM evaluation's injection cases require OpenRouter's prior written approval. If they do, obtain it before the first request. Accepting the risk does not replace that approval. No code change. |
| Retention settings | ZDR guide: `provider.zdr` is OR-ed with account settings, in-memory caching is allowed, endpoints with unclear policy are treated as retaining | Required: confirm the account is ZDR-only and prompt logging is off (the app cannot enforce it), and that an eligible endpoint exists for the model |
| Data use | Terms 6.5: inputs are categorized in anonymized form; 6.2: opting into prompt logging grants OpenRouter broad rights | Keep logging off. The notice already discloses categorization. |
| Spend | Terms 3.2; limits documentation | Required: per-key spending limit, auto top-up off, activity monitoring |
| Hosting | Vercel Hobby is limited to non-commercial personal use | Judgment: acceptable for a free portfolio demo. Reassess if monetized. |

Sources (accessed 2026-10-14): OpenRouter [Terms of Service](https://openrouter.ai/terms)
(last updated August 31, 2026), [Privacy Policy](https://openrouter.ai/privacy),
[Zero Data Retention](https://openrouter.ai/docs/guides/features/zdr),
[Limits](https://openrouter.ai/docs/api/reference/limits),
[Streaming and cancellation](https://openrouter.ai/docs/api/reference/streaming),
and the [GLM 5.3 Flash listing](https://openrouter.ai/z-ai/glm-5.3-flash); Vercel
[Hobby plan](https://vercel.com/docs/plans/hobby),
[Instant Rollback](https://vercel.com/docs/instant-rollback),
[environment variables](https://vercel.com/docs/environment-variables), and
[WAF custom rules](https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules).
The listing does not show which endpoints are ZDR-eligible, so that has to be
confirmed in the account. The terms wording was recorded during research and was
not re-checked in the final review. Confirm it against the current text before
deciding.

### GLM quality gate (Superseded: protocol deferred)

*Status update, 2026-10-14:* the release evidence requirement was revised, and this
protocol was not run. See the
[release decision](#2026-10-14-v100-release-decision-and-production-activation-active).
The protocol below is kept as written. It is historical and deferred. It was not
run, completed, or approved as a release gate, and it has not been shown to be
satisfied.

The spec requires an actual evaluation with recorded scores on the configuration
that ships, with targets either met or transparently revised. For GLM that was not
satisfied: the development run has no recorded scores, and the Gemini results do
not transfer. Provisional scores from an informal handoff are not committed
evidence. Model selection and prompt v4 are not reopened.

**Protocol (pre-registered; nothing has been run).**
- **Prerequisite:** decide whether the injection cases require OpenRouter's prior
  written approval (see
  [provider policy](#provider-policy-recommendation-approval-required)). If they do,
  obtain approval before the first request. Accepting the risk is not a substitute.
- The committed GLM configuration and prompt v4, unchanged, on a clean tree, using
  the committed `npm run eval` runner, which consumes the same streaming adapter as
  production. The development run used a separate non-streaming harness and did not
  verify the streaming path.
- Two runs, once each: `npm run eval -- --live` (40 development cases) and
  `npm run eval -- --live --split holdout --include-holdout` (the 10 `holdout2-*`
  cases), about 50 requests on a capped evaluation key. The earlier run's cost
  (about $0.0014 for 40 cases) is illustrative, not a guarantee. The key limit is
  the bound.
- At most one reported re-run per errored case with `--ids`. No tuning, no extra
  runs, no model or prompt change.
- Meaning and style scores are assigned with the spec rubric. The release cohort is
  the 30 `dev-*` cases plus the 10 `holdout2-*` cases. The 10 `holdout-*` cases are
  supplemental.
- The `holdout2-*` cases are labeled "not tuned on GLM; previously run and scored on
  Gemini", not as untouched independent evidence.
- Results are published as a sanitized `evals/results/glm-release.md`. Raw output
  stays in the ignored `evals/results/raw/`.

**Decision rule.** If the spec targets are met, the gate is cleared. If not, either
a case-specific target revision is recorded with a rationale and the failures are
disclosed, or live access stays off.

### Documentation cleanup

The README, deployment guide, evaluation docs, and specification were reconciled
with the evidence above. Active documents describe the current system. Provider
history lives here and in `evals/results/`.

## 2026-10-14: v1.0.0 release decision and Production activation (Active)

Base: `main` at `27b9432`. This entry records a decision and the evidence behind the
live deployment. It changes no model, prompt, or inference behavior, and no
evaluation or provider call was made to write it.

### Decision: retain GLM for v1.0.0

I decided to retain `z-ai/glm-5.3-flash` with `low` reasoning and prompt v4 for
v1.0.0, accepting its documented quality limitations for a free, experimental
portfolio application.

What the evidence does and does not show:

- The Gemini evaluation was formally scored and remains historical evidence
  ([`evals/results/summary.md`](../evals/results/summary.md)). It does not transfer
  to GLM.
- GLM completed its 40-case development run, and 39 of 40 cases passed the
  deterministic checks (the exception was the brittle `holdout-numbers-01` token).
  Formal meaning and style scores were **not committed**, so this record has no
  meaning or style tally for GLM
  ([`evals/results/glm-development.md`](../evals/results/glm-development.md)).
- The original GLM meaning-preservation acceptance target was **not demonstrated**.
  GLM did not pass the original benchmark, and nothing here claims it outperformed
  Gemini on meaning preservation.
- I **revised the release evidence requirement** and accepted these limitations,
  instead of requiring another 50-case evaluation. This is a revision of the
  evidence bar, not a pass.
- Meaning preservation remains a product goal, not a guarantee for any result.
- The pre-registered GLM evaluation protocol
  ([above](#glm-quality-gate-superseded-protocol-deferred)) is historical and
  deferred. It was not run, completed, or approved. No injection cases will be sent
  for it, so the OpenRouter red-teaming approval question in the provider-policy
  table does not arise for this release.
- Model selection and prompt v4 are not reopened.

### Production activation (2026-10-14)

Production is no longer examples-only.

**Verified in a read-only check during release finalization:**

- `vercel env ls` lists exactly five variables: `OPENROUTER_API_KEY`, `MIMUS_MODE`,
  `APP_ORIGIN`, `MIMUS_LIVE_COUNTRIES`, and `MIMUS_DEV_ALLOW_LOCAL_LIVE`. All are
  scoped to Production only, and none exists in Preview or Development. Values are
  hidden and were not inspected.
- A `GET /` on `https://mimus-rewrite.vercel.app` returned 200 with the live-mode
  notice (`openrouter-zdr-v1`). No inference request was sent.
- `vercel firewall rules list` showed the "Rate limit translate API" rule enabled
  (5 requests per 60 seconds) and no deny rule.

**Reported (not independently verified):**

- Live GLM rewriting works on `https://mimus-rewrite.vercel.app`. A Human to
  Corporate, Balanced rewrite preserved the Friday meeting rescheduling and the
  unfinished-report reason.
- Chrome DevTools showed real SSE streaming: a `meta` event, 13 `delta` events, and
  a successful `done` event in about 724 ms. For short, fast responses the page may
  not look streamed.

**Account settings (confirmed in the account, not independently verified):** a
$1/month Production key limit, with auto-recharge disabled, and the OpenRouter
privacy and ZDR settings applied. The app cannot enforce them. The
[spend analysis](#spend-exposure) still applies: the monthly key limit caps spending
within its monthly accounting period, not cumulative lifetime spending, and it does
not replace activity monitoring. The per-request limits and the WAF are not budget
controls.

**Not verified:** function-log contents for live Production requests (Hobby keeps
logs for one hour, and they were not inspected), non-US region rejection, whether
Vercel delivers a client disconnect, and whether OpenRouter hosts stop billing after
Stop. Other provider-policy conditions (model-host terms, regions, hosting) have not
been separately reviewed. The
[recommendation table](#provider-policy-recommendation-approval-required) remains
the reference.

**Screenshots.** The images in the README and `docs/assets/screenshots/` were
captured in demo mode with prewritten examples. They are not evidence of live
inference, and they are labeled that way.

### Shutdown readiness (not rehearsed)

Reviewed 2026-10-14 with read-only operations, without changing Production
configuration, the WAF, the key, or any deployment:

- The runbook's CLI command forms (`firewall rules add`, `reorder`, `remove`, `diff`,
  `publish`, plus `promote` and `rollback`) exist in the installed Vercel CLI (62.5.0).
  They were checked in `--help` output and not executed.
- WAF rules apply to the whole project, so a Preview cannot isolate a deny-rule
  rehearsal. A header-scoped rule on Production would exercise the publish mechanism
  without affecting visitors, but it needs separate approval.
- After the activation redeploy, the previous Production deployment may itself be a
  live build. Rollback is therefore **not** a guaranteed way to disable inference,
  and the runbook does not rely on it.
- The emergency shutdown rehearsal has **not** been performed and is not verified.
  Publish timing, key revocation effect, and a `disabled` redeploy on Vercel are all
  unmeasured. The app's `disabled` mode is covered by tests, which is not a deployed
  check.

### Remaining accepted limitations

Reasoning-effort `low` and unpinned hosts mean quality and latency can vary. The
cancellation and billing behavior above is unverified. The US allowlist is a visitor
restriction, not data residency. Hobby is for personal, non-commercial use, and
Mimus is a free demo.

# Gemini Production verification — October 16, 2026

Result: deployment and streaming passed; output quality was mixed.

Production was READY on merge commit `a013c79779ae19616b0710fb3ff02d34e980e158`,
deployment `dpl_8p54cEq2dWpGV6VcvBFeVgHBYKF6`. Merged-commit CI checks and
browser tests passed. The public homepage returned HTTP 200, displayed
Gemini 3.5 Flash-Lite, retained notice `openrouter-zdr-v1`, and showed the adult
acknowledgement.

Two authorized synthetic requests were made to the actual Production HTTP API,
with the trusted Origin and no forged country header or policy bypass. Both
returned HTTP 200 and `text/event-stream`, began with `meta` (prompt v4), streamed
multiple `delta` events, and ended with `done` / complete. Neither stream returned
an application error, reasoning content, or a JSON/Markdown wrapper.

| Scenario | First content | Total client time | Deltas | Reported cost USD | Meaning inspection |
| --- | ---: | ---: | ---: | ---: | --- |
| Human → Academic, Maximum | 1,115 ms | 1,374 ms | 4 | 0.000257 | Failed: 6% became six percentage points |
| Corporate → Human, Balanced | 629 ms | 852 ms | 3 | 0.0002039 | Checked facts preserved |

The Academic source said: “The error rate may fall by 6% if the safety check
passes; this has not been confirmed.” The rewrite said it “might potentially
decrease by six percentage points,” conditional on the safety protocol, and
remained unvalidated. Relative percent change and percentage-point change are
different quantities. The uncertainty and condition survived, but the numerical
claim changed. This is a meaning defect, not a transport failure. The style was
recognizably exaggerated academic prose.

The Human output retained 18 clients, Friday, the possibility of opening the
pilot only if the safety review passes, the unapproved expansion, and the lack
of agreed dates after Friday. These inspections are smoke observations, not a
new formal evaluation or a model accuracy estimate.

Combined reported cost: **$0.0004609**, within the $0.05 Production ceiling.
No further paid request was made. The existing OpenRouter key had sufficient
allowance; metadata still listed minimal effort and eligible ZDR routes.

Both application request IDs were correlated to Vercel Production log entries.
They recorded the Gemini model ID, prompt v4, HTTP 200, style IDs, timing, and
token counts. The entries contained only permitted metadata, with no submitted
or generated text, key, or reasoning content. A failed initial log lookup was
retried read-only; inference requests were not retried.

No code, prompt, deployment, key, WAF, or privacy configuration was changed during
verification. Production remains on Gemini. The maintainer subsequently accepted
leaving the numerical meaning defect for now. It remains a failed meaning observation;
accepting it does not turn the
quality check into a pass. No prompt tuning or retrospective score change was made.

## Operational follow-up

The maintainer authorized completing the remaining operational checks. All
observations below were collected on October 16 against the same merged
application revision. No model, prompt, key, or spending limit was changed.

### Firewall rehearsals and cleanup

The baseline contained only the enabled translate rate-limit rule (POST path
prefix `/api/translate`, fixed five requests per 60 seconds per IP) and no draft.
A temporary deny rule required all four conditions: the selected environment,
exact `/api/translate` path, POST method, and `x-mimus-rehearsal: 1` header.
Before each publish, the draft was reviewed to contain only the intended insert
or removal. The pre-existing rule was not edited.

| Environment | Tagged text/plain POST | Untagged text/plain POST | GET / | Tagged POST after removal |
| --- | ---: | ---: | ---: | ---: |
| Protected Preview | 403, `X-Vercel-Mitigated: deny` | 415 | 200 | 415 |
| Production | 403, `X-Vercel-Mitigated: deny` | 415 | 200 | 415 |

Preview access used existing Vercel CLI authentication, with no protection-setting
change. The text/plain bodies are rejected before any provider call. Both
temporary rules were removed and their removals published. A final comparison
found the original rule unchanged, no temporary rules, and no draft changes.

A separate Production burst at 16:01 UTC returned 415 for the first five
text/plain requests and 429 with `X-Vercel-Mitigated: deny` for the sixth. It
verified current rate-limit enforcement without inference calls. This is per-IP,
per-region evidence, not proof of a global usage cap.

### Production disabled mode and restoration

Only `MIMUS_MODE` was temporarily changed to `disabled`. Vercel rebuilt the
existing Git-sourced deployment server-side; the local checkout, `.env.local`,
and `.vercel/output` were not uploaded. Disabled deployment
`dpl_DG25VzQdUefacm91CKgGYMBZndPV` became READY and owned the Production alias.
The homepage showed the unavailable notice, and one valid synthetic request
returned 503 `SERVICE_UNAVAILABLE`. Its correlated application log recorded
status 503 and that code, with no source/generated text or provider usage.
The handler exits before provider dispatch in disabled mode; an account-wide
absence of OpenRouter activity is not inferred from that log alone.

`MIMUS_MODE` was restored to `live` and the same Git revision rebuilt server-side.
Restored deployment `dpl_FJ2RqbNw7Uu4toJrR96xFA76MkS9` became READY, and the
Production page again displayed Gemini and `openrouter-zdr-v1`. The disabled
probe was observed at 15:57:06 UTC and live restoration at 15:58:06 UTC. These
are probe times, not exact measurements of the full interruption interval.

This rehearsed two shutdown controls. The separate key-revocation/zeroing step
was not performed, so a complete emergency shutdown is not claimed.

### Deployed cancellation and resubmission

The cancellation check used the existing Production route and credential,
avoiding any copy of the Production secret into Preview. This was a deliberate
variation from the earlier dedicated-key Preview procedure, within the authorized
Production verification. It made one paid synthetic request containing 2,160
code points, then aborted after receiving the first content event and before
receiving `done` or `error` (1,220 ms client time).

The matching application log recorded **499**, with no error code or
`UPSTREAM_TIMEOUT`. Vercel's outer request status remained 200 because the SSE
headers had already been sent. The application's terminal log, rather than
that outer HTTP status, establishes the observed disconnect handling.

An immediate short resubmission returned 200, streamed three content deltas,
and finished with `done`. Its application log recorded 200 and token counts.
Reported resubmission cost was $0.0002078. No finish usage arrived for the aborted
request, so its charge and the combined final charge are unknown; the two-request
conservative reservation was $0.024912 within the $0.05 authorized ceiling.
No inference request was retried.

Both inspected application log entries contained only the permitted metadata.
This verifies that Vercel delivered this disconnect to the function and that
subsequent requests worked. Provider-side generation and billing cessation
remain separate and are not guaranteed by application status 499.

After the maintainer signed in, the account and default-workspace generation
tables were inspected and refreshed. Their newest visible Mimus rows were the
earlier local checks at 10:33 AM America/New_York; no row matching the 11:59 AM
cancellation/resubmission window was visible. No provider generation ID was
available from the application logs. The provider-side request and charge could
therefore not be correlated; absence from the inspected table is not evidence
of zero billing or stopped generation.

### Remaining verification boundaries

No real non-US network was available. Supplied headers are not a substitute for
observing Vercel's actual visitor-country policy. Missing/disallowed country
handling has automated coverage, while deployed non-US rejection remains
unverified. Provider quota exhaustion was not forced on the shared capped key;
HTTP 402/429 mapping and UI states have automated coverage, while actual upstream
exhaustion remains unverified. No key was revoked or its limit reduced.

The [release checklist](../../docs/release-checklist.md) distinguishes these
evidence gaps, accepted limitations, and final publication decisions.

# Read-only deployment readiness (2026-10-15, maintainer timezone)

Checked with Vercel CLI62.5.0 against the named `mimus` project. No environment variables, keys, deployments, rules, or traffic policies were changed. No translation request was sent.

- Project identity: `mimus`, Next.js.
- Existing custom rule: `Rate limit translate API`, active, fixed window5 requests/60seconds perIP. Conditions are path prefix `/api/translate` plus POST; no environment condition.
- No unpublished firewall draft: hasDraftfalse, pendingChanges0.
- Production `GET https://mimus-rewrite.vercel.app` returned200, included `openrouter-zdr-v1`, and did not contain the demo or temporary-unavailability notices. This is page/notice evidence only, not model inference evidence.

The CLI initially failed inside the managed sandbox with blocked proxy/spawn errors; the same read-only calls succeeded through normal tool escalation. No product code was changed to mask that environment restriction.

## Remaining separately authorized operations

The documented rehearsal sequence is still pending: header-scoped temporary deny rules on Preview and Production (stage/review/publish/test/remove/publish), Production disabled-mode/restoration, and one provider-backed cancellation correlation. Prepare/reconfirm exact target IDs and CLI help immediately before proposing each mutation. Preserve any new unrelated draft; do not publish it with the test rule.

Production mode changes interrupt inference until restoration is deployed. Provider/key revocation is outside the current authorization, and the existing key is shared with the offline study; do not change/revoke it while the study runs. Cancellation observed by the app does not demonstrate that the upstream host stopped generation or billing. A real non-US-network check remains a separate external-network limitation; simulated headers do not establish it.

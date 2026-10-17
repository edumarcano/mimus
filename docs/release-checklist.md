# v1.0.0 release checklist

Temporary checklist for the remaining release gates. The application version is
prepared as 1.0.0; that does not establish release readiness. Use
[CHANGELOG](../CHANGELOG.md) for release notes and the
[deployment guide](deployment.md#release-procedure) for the reusable procedure.
Retire this file once the gates below are closed.

## Existing evidence

- [Staged evaluation](../evals/results/release-run-2026-10-15.md): frozen finalist
  comparison, unresolved judgments, and separate blind human labels.
- [Production verification](../evals/results/production-verification-2026-10-16.md):
  Gemini minimal at `a013c79`, streaming, metadata-only logs, WAF enforcement and
  cleanup, disabled-mode recovery, application-side cancellation, and resubmission.
- [Local demo verification](../evals/results/local-demo-verification-2026-10-15.md):
  observed keyboard behavior and maintainer-reported Edge, actual 200% zoom, and
  Narrator fixes/retests. These are historical checks, not retests of later changes.

## Remaining gates

- [ ] Reconcile the announced October 18 Google Safety Retention change with current
  official policy, eligible endpoints, and accessible account settings. See
  [privacy follow-up](deployment.md#privacy-follow-up). Compatible routing remains
  unresolved; do not treat the live demo as verified under the changed policy.
- [ ] Recheck the [development dependency exception](deployment.md#dependency-exception)
  before relying on it for release. The October 16 full audit was not clean;
  production findings would block readiness.
- [ ] Verify the final revision: formatting, lint, typecheck, unit/integration tests,
  offline evidence verification, build, browser tests, and whitespace checks.
  Confirm a fresh source export installs and serves the demo without credentials
  or local configuration; review links, screenshots, and tracked artifacts.
- [ ] Review desktop/mobile layout, keyboard interaction, reduced motion, and focus
  after UI changes. Obtain fresh manual Narrator/200% zoom observations where
  changed UI warrants them; distinguish reported from automated evidence.
- [ ] Independently review the combined behavioral diff and resolve actionable
  findings. Record the tested revision and results in the PR/CI rather than
  duplicating a transient verification report in the repository.
- [ ] With deployment authorization, select the reviewed revision and rollback
  target, then verify the deployed pages, configuration, and metadata-only logs.
  Any paid smoke test requires separate approval: proposed ceiling $0.05, at most
  three synthetic requests covering completion, cancellation, and resubmission.
- [ ] Review final release notes and select the exact release commit. Merge, tag,
  GitHub release, and visibility changes require their respective authorizations.
  Public visibility and GitHub About/topics remain maintainer tasks.

## Accepted limitations and evidence gaps

The Production Academic Maximum rewrite changed a relative 6% decrease to six
percentage points. The maintainer accepted retaining that failed meaning
observation. No retrospective relabeling, prompt change, or additional scoring
round is included. Meaning preservation is a goal, not a guarantee; human auditing
remains limited and uneven.

Real deployed non-US rejection and upstream quota exhaustion remain unverified.
Application-side cancellation does not prove provider billing cessation; key
revocation or zeroing and full emergency shutdown were not rehearsed. Preserve
these limits rather than repeating destructive quota/key/firewall exercises.

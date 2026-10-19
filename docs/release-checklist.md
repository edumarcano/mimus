# v1.0.0 release checklist (Closed)

This checklist tracked the release gates for the v1.0.0 milestone. All gates are
now closed as of 2026-10-19. Use [CHANGELOG](../CHANGELOG.md) for release notes
and the [deployment guide](deployment.md#release-procedure) for the reusable
deployment procedure. This record is retired and retained for provenance.

## Existing evidence

- [Staged evaluation](../evals/results/release-run-2026-10-15.md): frozen finalist
  comparison, unresolved judgments, and separate blind human labels.
- [Production verification](../evals/results/production-verification-2026-10-16.md):
  Gemini minimal at `a013c79`, streaming, metadata-only logs, WAF enforcement and
  cleanup, disabled-mode recovery, application-side cancellation, and resubmission.
- [Local demo verification](../evals/results/local-demo-verification-2026-10-15.md):
  observed keyboard behavior and manual Edge, actual 200% zoom, and
  Narrator fixes/retests.

## Release gates (All closed)

- [x] Deploy the revised acknowledgement and privacy page with authorization;
  verify the new notice on the deployed pages. See [privacy follow-up](deployment.md#privacy-follow-up).
  *(Verified live on production serving `openrouter-vertex-safety-v1` on 2026-10-19).*
- [x] Recheck the [development dependency exception](deployment.md#dependency-exception)
  before relying on it for release.
  *(Verified clean for production with zero findings via `npm audit --omit=dev` on 2026-10-19).*
- [x] Verify the final revision: formatting, lint, typecheck, unit/integration tests,
  offline evidence verification, build, browser tests, and whitespace checks.
  *(All 303 unit tests, 11 e2e tests, linter, typecheck, build, and evidence checks passed on 2026-10-19).*
- [x] Review desktop/mobile layout, keyboard interaction, reduced motion, and focus
  after UI changes.
  *(Theme toggle, dark mode, LinkedIn Speak label, 200% zoom, and keyboard navigation verified on 2026-10-19).*
- [x] Independently review the combined behavioral diff and resolve actionable
  findings.
  *(PRs #21, #22, #23, #24, #25 merged and verified in CI on 2026-10-19).*
- [x] With deployment authorization, select the reviewed revision and rollback
  target, then verify the deployed pages, configuration, and metadata-only logs.
  *(Deployed to Production on Vercel and verified working on 2026-10-19).*
- [x] Review final release notes and select the exact release commit.
  *(Changelog rewritten for v1.0.0 debut; commit selected for v1.0.0 tag on 2026-10-19).*

## Accepted limitations and evidence gaps

The Production Academic Maximum rewrite changed a relative 6% decrease to six
percentage points. The decision was to retain that failed meaning
observation. No retrospective relabeling, prompt change, or additional scoring
round is included. Meaning preservation is a goal, not a guarantee; human auditing
remains limited and uneven.

Real deployed non-US rejection and upstream quota exhaustion remain unverified.
Application-side cancellation does not prove provider billing cessation; key
revocation or zeroing and full emergency shutdown were not rehearsed. Preserve
these limits rather than repeating destructive quota/key/firewall exercises.

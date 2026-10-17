# v1.0.0 release checklist

Status reconciled on October 16, 2026. This is an evidence checklist, not a
release announcement. The application version is prepared as 1.0.0; no release
tag, GitHub release, or repository visibility change has been published.

## Maintenance candidate

The maintenance changes were prepared from `b7b4bdc`. The
[maintenance verification record](../evals/results/maintenance-verification-2026-10-16.md)
tracks current local checks and pending demo gates. The deployed baseline and
historical observations below do not establish deployment of this candidate.
Public visibility, GitHub About/topics, tags, and release publication are excluded
from this preparation; the maintainer will handle publication separately.

## Completed engineering and verification

| Area | Result and evidence |
| --- | --- |
| Core product and accessibility | Five styles, twenty directions, streaming controls, bounded browser history, and no-key examples are implemented. [Local verification](../evals/results/local-demo-verification-2026-10-15.md) includes the maintainer's Edge, 200% zoom, and Windows Narrator retests. |
| Model evaluation | The [staged study](../evals/results/release-run-2026-10-15.md) includes effort screening, evaluator calibration, comparisons, difficult repeats, fresh release cases, and separate blind human labels. Its limitations remain recorded. |
| Model adoption | Gemini minimal, prompt v4, 2,048-token output cap is committed and deployed. [Production verification](../evals/results/production-verification-2026-10-16.md) confirms streaming and metadata-only logs. |
| Operations | Header-scoped WAF deny rehearsals on both environments, current five-per-minute enforcement, Production disabled mode/restoration, client abort correlated with application status 499, and successful resubmission are recorded in the Production verification. Temporary WAF rules are removed, with the original rate limit unchanged. |
| Reproducible setup | A clean source export of merged revision `a013c79` installed from the lockfile, passed lint/type checking and 223 tests, built, and served the demo without credentials. See [release audit](../evals/results/release-audit-2026-10-16.md). |
| Public repository hygiene | The release audit reviewed current tracked files, reachable history, local documentation links, and the three demo screenshots. No credential-pattern candidates were found; this is not proof of absence. The maintainer approved retaining existing Git author attribution. |
| Release materials | The README, design notes, evaluation reports, deployment procedures, MIT license, and [draft release notes](releases/v1.0.0.md) are prepared. |

## Accepted limitation

The maintainer explicitly accepted leaving the Production Academic Maximum
rewrite that changed a relative 6% decrease to six percentage points. Preserve
that failed meaning observation. No prompt change, new scoring round, or
retrospective relabeling is part of this release preparation. Meaning preservation
remains a goal rather than a guarantee.

## Remaining limitations and follow-up

- **Deployed non-US rejection and upstream quota exhaustion:** no real non-US
  network was available, and the shared capped key was not deliberately exhausted.
  Automated coverage exists, but deployed behavior for these cases remains
  unverified. The gap is documented rather than forcing an outage or exhausting
  the shared key to obtain a test result.
- **Provider-side cancellation and key revocation:** application-side cancellation
  was observed, but provider billing cessation is not guaranteed. Key revocation
  or zeroing was not rehearsed. These remain explicit operational limitations.
- **Development dependency advisory:** the online audit found one unpatched
  `braces` denial-of-service advisory propagated through five dev-tool packages.
  It is outside the production dependency tree; potential lint/CI availability
  exposure remains. Compatible updates to Next.js/its lint configuration did not
  remove it. During planning, the maintainer authorized a bounded development-only
  exception if compatible remediation remained unavailable. That exception applies;
  the current online production audit is clean. Recheck upstream when updating the
  toolchain; do not describe the full audit as clean. See the maintenance record.
- **Upcoming Google retention change:** the signed-in OpenRouter interface
  announces a Google Safety Retention change effective October 18. Reconcile its
  effect with the app's ZDR privacy contract and eligible routes before public
  release. Current public catalogs list eligible Vertex routes and the request
  still enforces ZDR, but account-specific effects of the announcement have not
  been verified. The browser integration could not initialize; no account setting
  was changed. This remains a demo-readiness gate.
- **Publication approval:** review the final diff and notes, merge the preparation
  PR, select the actual release commit, then explicitly authorize the `v1.0.0` tag,
  GitHub release, and GitHub repository visibility change. Do not publish this
  checklist as a claim that every gate passed.

## Publication procedure

1. Resolve or explicitly disposition the decisions above and recheck the current
   deployment, allowance, privacy eligibility, and upstream advisory status.
2. Confirm the release commit is on `main`, required CI is green, the worktree is
   clean, and public docs and screenshots match the reviewed implementation.
3. Move the reviewed `Unreleased` changelog entries to a dated 1.0.0 section and
   finalize the release notes through the normal reviewed change.
4. With explicit publication authorization, tag that exact commit, publish the
   GitHub release, and make the repository public. Verify the public clone, links,
   release assets/notes, and no-key setup afterward.

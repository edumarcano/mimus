# Maintenance verification — October 16, 2026

Candidate: uncommitted worktree changes based on `b7b4bdc`. No push, merge,
Production deployment, paid provider request, tag, release, repository visibility,
or GitHub About/topic change is part of this verification. The candidate is not
claimed deployed. The code/test/configuration fingerprint is
`c579dec9e8d4060ec3ef3e8f594e97d3c24a00e6071bd7e41c41e0a943d92444` (SHA-256 over sorted
relative paths, NUL, content with UTF-8 text normalized to LF and binary content
unchanged, NUL; 95 files under source/scripts/tests/E2E/CI and selected active root
configuration). Documentation and generated artifacts are excluded from this
fingerprint. It identifies this tested working tree, not a published commit.

## Changes

The candidate fixes first-delta output-limit enforcement, denied browser-storage
access, and destructive failure during legacy-storage transfer. Stream lifecycle
handling and history presentation are extracted from the translator. Gated
browser streaming, accessibility checks, formatting, and offline published-release
verification are added. Compatible dependencies are updated; frozen experiments,
datasets, published scores, model settings, prompt, notice, and storage formats
remain unchanged.

## Validation

On Node 24.15.0 / npm 11.18.0:

- A fresh source export contained no `.env.local`, `.vercel/`, `.local/`, or
  installed dependencies; `.env.example` was its only environment file.
  `npm ci` reinstalled the locked packages with provider/deployment variables
  cleared for that process. Formatting, lint, type checking, all **269 tests in
  29 files**, offline evidence verification, and the Turbopack production build
  passed in that export.
- All **10 Chromium browser tests** passed against the candidate before the final
  verifier-only review fixes and unused type-alias removal. They include gated
  partial-stream rendering, late-event rejection after Stop/resubmit, independent
  copy/regenerate/swap/history workflows, axe scans, and keyboard/focus/layout
  checks at 360 and 1440 px with reduced motion. The later changes affect only
  offline verification/type declarations; the fresh-source suite covers them.
- The freshly installed/built export served HTTP 200 in default demo mode with
  no credentials. Headless Chromium loaded a labeled prewritten example at both
  widths, found no horizontal overflow, and made zero translation POSTs. The
  current desktop/mobile captures were visually reviewed; no layout regression
  was found. Existing committed demo screenshots remain representative.
- Independent read-only reviews checked the runtime/storage extraction and new
  verifier. The invalid notice-renewal test expectation and two verifier integrity
  gaps were corrected, reviewed again, and covered by the final test run.
- All 36 Markdown files passed local-file/heading-link checks. A bounded current
  candidate scan found no provider-key pattern candidates or local home-directory
  paths; this is not a comprehensive security or history audit. Earlier history
  inspection remains dated evidence. Frozen datasets, manifests, published
  observations, prompt/model settings, notice, and screenshot assets are unchanged.
- A reference-use scan found one unused internal `PreferencesPatch` type alias,
  which was removed. Next.js `runtime`/`maxDuration` exports and peer/type/tooling
  dependencies were retained because their consumers are framework/toolchain
  conventions. No production dependency was removed speculatively.
- Separate formatting and behavior/documentation review patches were generated
  locally and applied in order to a source export. No commit or history rewrite
  was performed. Whitespace checks pass.

The offline verifier recomputed 80 generations, 79/80 resolved judgments, and eight
human reviews; Gemini retains 37/40 full-meaning and 37/40 full-style scores, while
Haiku retains 38/40 and 23/40. Unknown reported judge cost remains unknown. It does
not rerun inference, independently validate the scores, or reconstruct private
billing/provenance. Its structured JSON output is supported.

Browser observations here are automated/mocked, except the explicit visual review
of captured demo images. No fresh Windows Narrator speech or actual browser 200%
zoom observation was collected. The refactor preserves the native markup and
wording; the previous maintainer's dated manual retests remain historical
observations, not new verification. Current hosted CI and the new live deployment
remain pending the separately authorized external steps.

## Dependency exception

After compatible updates, a fresh online npm audit still reports five high-severity
package entries from one development-only advisory:

`eslint-config-next@16.4.2` → `@next/eslint-plugin-next@16.4.2` →
`fast-glob@3.3.1` → `micromatch@4.0.8` → `braces@3.0.3`.

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
has no patched version listed in the reviewed advisory. Deeply nested brace
patterns can exhaust the development tool's stack. The dependency is absent from
the production tree; lint/CI availability exposure remains, and exploitability in
this repository was not reproduced. The online production-only audit reports
zero findings. These bounded scans do not prove the absence of vulnerabilities.

During planning the maintainer chose a bounded exception if compatible remediation
remained unavailable. The condition is met after the aligned Next/ESLint patch
update, so that exception applies. No forced audit fix, major downgrade, or override
was introduced. Recheck upstream on the next toolchain update or before the
exception is relied upon for a later release. The full audit is not clean.

## Privacy and demo gates

Read-only public checks on October 16 found the active model in OpenRouter's
[endpoint catalog](https://openrouter.ai/api/v1/models/google/gemini-3.5-flash-lite/endpoints)
and five Vertex tags in the [ZDR catalog](https://openrouter.ai/api/v1/endpoints/zdr):
`google-vertex/global`, `google-vertex/global/flex`,
`google-vertex/global/priority`, `google-vertex/us`, and `google-vertex/eu`.
The catalog is dynamic and is not an account-specific guarantee of routing.
[Current OpenRouter ZDR documentation](https://openrouter.ai/docs/guides/features/zdr)
states that per-request ZDR restricts routing and that Google Vertex remains
available under Google ZDR enforcement. Mimus still sends `zdr: true` and denies
data collection without tools/plugins.

The previously recorded signed-in notice announces a Google Safety Retention
change effective October 18. Public documentation/search did not resolve its
account-specific effects. The browser integration failed to initialize, so current
account privacy settings and the notice could not be inspected. No settings were
changed. Present catalog eligibility does not establish post-change eligibility;
this gate remains open before considering the live demo verified under the changed policy.

After resolving that gate, select the reviewed candidate commit, confirm current
CI, and obtain the required authorization to push/merge/deploy. Record its Vercel
revision and rollback target before replacing the existing deployment. Use the
existing deployment runbook to restore the previous reviewed revision if the
candidate fails. Do not alter the model, prompt, notice, secrets, or firewall as a
shortcut. Production smoke verification remains separately authorized; the
proposed paid check is at most three synthetic requests and $0.05 for completion,
cancellation, and immediate resubmission, with correlated metadata-only logs.

The accepted percentage/percentage-point meaning error, uneven human auditing,
unverified real non-US rejection/quota exhaustion, and unguaranteed provider-side
cancellation/billing behavior remain limitations. No new model study is included.

## Environment notes

The C: drive filled during dependency installation. Reclaiming regenerable build
output and dependencies from the prior disposable clean-source export allowed the
installation to recover; its source and audit evidence were retained. Existing
browser installations were retained when installing the new headless test browser.
To avoid a second dependency copy on the nearly full drive, the local dependencies
were transferred to the fresh export, replaced there by `npm ci`, and restored to
the primary checkout after verification. This was a source-export check, not a
clean-machine claim. Next.js warned about the ancestor lockfile because the export
was nested under the checkout; no product setting was changed to hide it.
`npm ci` also reported ESLint 9's upstream support deprecation and unapproved
optional install scripts; tests/build passed without approving those scripts.
ESLint major migration remains outside the approved patch/minor maintenance scope.

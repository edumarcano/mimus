# Public-release audit — October 16, 2026

This audit started from merged revision `a013c79779ae19616b0710fb3ff02d34e980e158`.
It prepares evidence for an owner release decision; it does not authorize a tag,
release publication, history rewrite, or repository visibility change.

## Repository hygiene and presentation

The audit inspected 169 tracked files and 791 objects reachable in Git history
for common provider/GitHub/AWS credential patterns and local home-directory paths.
No candidates were found. This is a bounded pattern scan, not a guarantee that
no secret exists. Local environment files, `.local/`, raw benchmark outputs,
dependencies, and build/test artifacts are ignored and untracked.

Public benchmark generation IDs were internal hashes rather than upstream
request/generation identifiers. The reviewed human annotation did not expose
obvious personal data. All 31 Markdown documents present at the audit baseline
passed local-path and heading-link checks. The three screenshots depict labeled
demo/prewritten content without identifiable user data; they are not evidence
of live inference. The MIT license is present. The maintainer explicitly approved
retaining existing Git author metadata; no history was rewritten.

## Clean source export

A fresh Git archive contained no `.env.local`, `.vercel/`, or dependencies.
Provider/deployment variables were cleared only in its verification process.
On Node 24.15.0 / npm 11.18.0, installation from the lockfile, lint, type checking,
all 223 tests across 28 files, and production build passed. The built homepage
returned 200 and displayed the no-model demo notice and a prewritten example.
No provider call was made.

The managed environment initially blocked package downloads and esbuild process
creation; authorized network/process access resolved those failures. Next.js
reported an ancestor-lockfile warning because the export was nested under the
original checkout. This is a clean source/export verification, not a clean-machine
installation claim or a live-provider check.

## Dependency advisory

A fresh online npm audit reported five high-severity package entries, all
propagated from one advisory in this development-only chain:

`eslint-config-next@16.4.0` → `@next/eslint-plugin-next@16.4.0` →
`fast-glob@3.3.1` → `micromatch@4.0.8` → `braces@3.0.3`.

[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
describes stack exhaustion on deeply nested brace patterns and listed no patched
version when checked. These packages are absent from the production dependency
tree. Potential lint/CI availability exposure remains; exploitability was not
reproduced. The lockfile was not changed. npm's suggested Next ESLint integration
downgrade was not applied, as it would be a major downgrade and the underlying
advisory has no patched version. Recheck upstream before publication and record
the maintainer's disposition rather than calling the audit clean.

An initial offline/cached audit reported zero findings; the online result
supersedes that stale cache result.

## Privacy follow-up

The signed-in OpenRouter interface also announced a Google Safety Retention
change effective October 18, 2026, and linked to account privacy settings and
workspace guardrails. The app's requests independently require
`provider.zdr: true` and deny data collection.
The current endpoint catalog still listed eligible Gemini Vertex routes. These
observations do not establish what will be eligible under the announced change.
No account or guardrail setting was changed; reconcile the announcement with
the product privacy contract before public release.

The [release checklist](../../docs/release-checklist.md) tracks remaining decisions.

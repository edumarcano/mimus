# Changelog

Notable public releases of Mimus are documented here.

## Unreleased

### Fixes and maintenance

- Enforced the output limit on the first stream delta as well as later deltas.
- Kept browser interactions usable when storage is denied, and preserved legacy
  saved data when migration cannot complete.
- Separated browser streaming and history presentation from the main translator.
- Added gated browser streaming and accessibility checks, consistent formatting,
  and offline verification of the published release evidence.
- Updated compatible dependencies; the dated
  [development-only advisory exception](docs/deployment.md#dependency-exception)
  records the remaining tooling exposure.
- Consolidated operational documentation and removed redundant preparation reports;
  retained experimental and deployed verification evidence.

### Features

- Five styles: Human, LinkedIn, Corporate, Startup Founder, and Academic, with
  all 20 source-to-target directions.
- Three rewriting intensities (Subtle, Balanced, Maximum); Human output ignores
  intensity.
- Live, streamed rewrites with Stop, Regenerate, Swap, Clear, Copy result, and
  Copy both, plus a Ctrl/Cmd+Enter shortcut.
- Responsive two-panel interface, with prewritten examples and a credential-free
  demo mode.
- Local preferences and optional browser-only history of up to 10 completed
  rewrites, off by default.

### Architecture and safeguards

- Next.js App Router, TypeScript, and Tailwind CSS, hosted on Vercel.
- Server-side OpenRouter inference with output delivered through server-sent events.
- Gemini 3.5 Flash-Lite at minimal reasoning adopted in the runtime configuration
  from the staged benchmark, with prompt v4 and a 2,048-token output cap.
- Zero-data-retention endpoint routing and denial of provider data collection
  requested for every live inference call; an acknowledgement and `/privacy`
  page explain the remaining data-handling limitations.
- Request validation, input/output limits, origin and visitor-country checks,
  timeouts, and Vercel WAF rate limiting.
- Cancellation support for `/api/translate` on Vercel, upstream stream cleanup,
  and safeguards against treating stopped output as complete.
- Synthetic evaluation records, automated checks, and a deployment and shutdown
  runbook. Disabled mode returned HTTP 503 with no provider call in Preview.
- Offline multi-model and reasoning-effort benchmarks with budget reservations,
  immutable observations, explicit reuse lineage, limited blind human reviews,
  and a fresh release comparison. Decision-model routing is an offline experiment.
- Dated Production verification of WAF enforcement and cleanup, disabled-mode
  recovery, application-side cancellation, resubmission, and metadata-only logs.

### Known limitations

- Meaning preservation is not guaranteed. Model-evaluation evidence and gaps
  are documented in the [evaluation records](evals/README.md).
- A Production Academic Maximum rewrite changed a relative percentage decrease
  into percentage points; the maintainer accepted retaining this known limitation.
- An unpatched development-tool dependency advisory and the announced Google
  Safety Retention change remain tracked in the [release checklist](docs/release-checklist.md).
- Live rewriting is limited to approved visitor regions and depends on
  third-party provider availability and account spending limits.
- Upstream cancellation depends on the model host; billing after Stop is not
  guaranteed to end immediately. See the [deployment guide](docs/deployment.md).
- Windows Narrator, Edge, and 200% zoom were manually checked, with two reported
  accessibility defects fixed and retested. Safari and Firefox remain untested.

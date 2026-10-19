# Changelog

Notable changes to Mimus. Nothing has been released yet. Version 1.0.0 is prepared,
and the remaining gates are in the [release checklist](docs/release-checklist.md).

## Unreleased

### Features

- Five styles (Human, LinkedIn Speak, Corporate, Startup Founder, Academic) with all 20
  source-to-target directions.
- Three rewriting intensities (Subtle, Balanced, Maximum). Human output ignores
  intensity.
- Live, streamed rewrites with Stop, Regenerate, Swap, Clear, Copy result, and Copy
  both, plus a Ctrl/Cmd+Enter shortcut.
- A responsive two-panel interface with prewritten examples and a demo mode that
  needs no credentials.
- Local preferences and optional browser-only history of up to 10 completed
  rewrites, off by default.

### Architecture and safeguards

- Next.js App Router, TypeScript, and Tailwind CSS, hosted on Vercel.
- Server-side OpenRouter inference, with output delivered as server-sent events.
- Gemini 3.5 Flash-Lite at minimal reasoning, prompt v4, and a 2,048-token output
  cap, adopted in the runtime configuration after the staged benchmark.
- Every live request asks OpenRouter for zero-data-retention (ZDR) routing and denies
  provider data collection. The acknowledgement and `/privacy` page disclose Google
  Vertex safety retention and possible human review of flagged content. The routing
  flag doesn't guarantee that no text is retained.
- Request validation, input and output limits, origin and visitor-country checks,
  timeouts, and Vercel WAF rate limiting.
- Cancellation support for `/api/translate` on Vercel, upstream stream cleanup, and
  safeguards against treating stopped output as complete.
- Synthetic evaluation records, automated checks, and a deployment and shutdown
  runbook. Disabled mode returned HTTP 503 with no provider call in Preview.
- Offline multi-model and reasoning-effort benchmarks with budget reservations,
  immutable observations, explicit reuse lineage, limited blind human reviews, and a
  fresh release comparison. The decision-model cascade is an offline experiment only.
- Dated Production verification of WAF enforcement and cleanup, disabled-mode
  recovery, application-side cancellation, resubmission, and metadata-only logs.

### Fixes and maintenance

- Evaluation options and unmatched case IDs are now rejected before any provider
  call, and release-evidence validation is stricter.
- Clearing history or turning it off now removes the saved history keys, with a
  warning when the browser blocks deletion.
- The output limit is now enforced on the first stream delta as well as later ones.
- The interface stays usable when browser storage is denied, and legacy saved data
  is kept when migration can't complete.
- Browser streaming and history code moved out of the main translator component.
- Added gated browser streaming and accessibility checks, consistent formatting, and
  offline verification of the published release evidence.
- Updated compatible dependencies. One development-only advisory remains; see the
  [dependency exception](docs/deployment.md#dependency-exception).
- Documented browser-test installation and clarified how Swap behaves for incomplete
  results.
- Consolidated the operational docs and removed redundant preparation reports, while
  keeping the experimental and deployed verification evidence.

### Known limitations

- Meaning preservation isn't guaranteed. The model-evaluation evidence and its gaps
  are in the [evaluation records](evals/README.md).
- A Production Academic Maximum rewrite turned a relative percentage decrease into
  percentage points. This is an accepted known limitation.
- An unpatched development-tool advisory and deployment of the revised
  safety-retention disclosure are still open in the
  [release checklist](docs/release-checklist.md).
- Live rewriting is limited to approved visitor regions and depends on third-party
  provider availability and account spending limits.
- Upstream cancellation depends on the model host, so billing may not stop right
  after Stop. See the [deployment guide](docs/deployment.md).
- Windows Narrator, Edge, and 200% zoom were checked by hand. Two accessibility
  defects were found, fixed, and retested. Safari and Firefox are untested.

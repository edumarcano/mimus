# Changelog

Notable public releases of Mimus are documented here.

## [1.0.0] - Unreleased

Planned initial release of Mimus, a web app for rewriting English text between
writing styles while aiming to preserve the original meaning.

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
- OpenRouter inference using `z-ai/glm-5.3-flash` (low reasoning, prompt v4),
  with output delivered through server-sent events.
- Zero-data-retention endpoint routing and denial of provider data collection
  requested for every live inference call; an acknowledgement and `/privacy`
  page explain the remaining data-handling limitations.
- Request validation, input/output limits, origin and visitor-country checks,
  timeouts, and Vercel WAF rate limiting.
- Cancellation support for `/api/translate` on Vercel, upstream stream cleanup,
  and safeguards against treating stopped output as complete.
- Synthetic evaluation records, automated checks, and a deployment and shutdown
  runbook. Disabled mode returned HTTP 503 with no provider call in Preview.

### Known limitations

- Meaning preservation is not guaranteed. The GLM configuration did not
  demonstrate the original meaning-preservation target, and formal GLM meaning
  and style scores were not committed. See the [evaluation](evals/README.md).
- Live rewriting is limited to approved visitor regions and depends on
  third-party provider availability and account spending limits.
- Vercel's cancellation setting was verified in Preview, but a live client
  disconnect reaching the function and stopping upstream generation has not been
  observed. Whether billing stops after Stop depends on the model host and remains
  unverified.
- Disabled mode was verified in a branch Preview, but the Production WAF and
  disabled-mode shutdown/restore procedures have not been rehearsed end to end.
  See the [deployment guide](docs/deployment.md).
- Screen readers, Safari, and Firefox have not been separately tested.

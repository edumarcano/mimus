# Changelog

All notable public releases of Mimus are documented here.

## [1.0.0] - 2026-10-19

Initial public release of Mimus, an open-source writing-style translator that rewrites English text between recognizable registers while aiming to preserve underlying meaning.

### What is Mimus

Mimus focuses on transforming expression rather than human languages. Its primary interaction is a responsive, two-panel translator designed for clarity, approachable parody, and inspectable evaluation.

### Features

- **Five writing styles**: Human, LinkedIn Speak, Corporate, Startup Founder, and Academic across all 20 directed style pairings.
- **Three intensity levels**: Subtle, Balanced, and Maximum to control the degree of stylistic exaggeration (Human output keeps phrasing direct).
- **Interactive streaming**: Real-time server-sent event (SSE) streaming with Stop, Regenerate, Swap styles/inputs, Clear, Copy result, and Copy both source and target.
- **Keyboard shortcuts**: Ctrl/Cmd+Enter for instant generation and accessible keyboard navigation.
- **Dark mode**: Built-in light, dark, and system-preference theme support with an in-header toggle and WCAG AA compliant contrast.
- **Zero-credential demo mode**: Curated, prewritten example chips allow exploring transformations immediately without requiring API keys or network inference.
- **Browser-only preferences and history**: Remembers chosen styles and provides an optional, opt-in local history of up to 10 completed rewrites stored exclusively in the browser.

### Architecture and Privacy

- **Next.js & Vercel**: Next.js App Router, TypeScript, and Tailwind CSS, deployed on Vercel with edge WAF rate limiting and route cancellation support.
- **OpenRouter & Gemini**: Server-side inference powered by Gemini 3.5 Flash-Lite at minimal reasoning effort, prompt v4, and a 2,048-token output cap.
- **Privacy by design**: No user accounts, no tracking cookies, and no application database. Neither submitted input nor generated text is intentionally persisted on application servers or in server logs.
- **Provider routing**: Requests ask OpenRouter for Zero Data Retention (ZDR) routing with data collection denied. Applicable Google Vertex safety-retention terms and human review policies for flagged content are explicitly disclosed.
- **Metadata-only logging**: Operational server logs record only allowlisted request metadata (durations, token counts, status codes, request IDs) without prompt or output text.
- **Offline evaluations & benchmarks**: Backed by a reproducible multi-model benchmark, automated rubric evaluations, and published evaluation datasets.

### Known Limitations

- Meaning preservation is a quality target, not an absolute guarantee. Model evaluation records and gaps are documented in the [evaluation suite](evals/README.md).
- Upstream cancellation depends on provider host behavior; stopping generation in the browser does not guarantee immediate billing cessation.
- Live generation requires a dedicated OpenRouter key and is constrained to approved visitor regions.
- Accessibility was verified with Windows Narrator, Edge, and Chrome with 200% zoom; Safari and Firefox remain untested.

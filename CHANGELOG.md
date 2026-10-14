# Changelog

All notable changes to Mimus are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] - Unreleased

First release candidate. Nothing has been tagged or published, and the public
deployment is examples-only.

### Added

- A two-panel writing-register translator with five styles, 20 directions, and
  three intensities. Human output ignores intensity.
- Streamed output with Stop, Copy result, Copy both, Regenerate, Swap, Clear, and
  a Ctrl or Cmd+Enter shortcut. Stopped, failed, or interrupted output is never
  treated as a completed result, and edited input marks the previous result stale.
- Labeled example rewrites and a credential-free demo mode.
- Local preferences and opt-in browser history of up to 10 completed results.
- A shared data-use notice with versioned acknowledgement, and a `/privacy` page.
- `POST /api/translate` with strict validation, a 16 KiB body limit enforced while
  reading, an exact-origin check, a visitor-country allowlist, a 45-second
  deadline, and no automatic retries.
- Mimus branding, favicon and social-preview assets.
- A 50-case synthetic evaluation set, an opt-in evaluation runner, and a Vercel WAF
  rate limit of 5 requests per IP per minute.

### Changed

- Live generation moved from Google Gemini to OpenRouter with
  `z-ai/glm-5.3-flash`, using zero-data-retention routing and no tools or plugins.
  The data-use notice is now `openrouter-zdr-v1`, so earlier acknowledgements are
  invalid.
- The product was renamed from Parlance to Mimus. Configuration variables are
  `MIMUS_MODE`, `MIMUS_LIVE_COUNTRIES`, and `MIMUS_DEV_ALLOW_LOCAL_LIVE`, with no
  legacy fallback.

### Known limitations

- Public live generation is not enabled. It depends on owner decisions about
  provider policy, spend controls, and quality acceptance.
- GLM quality acceptance is open: the development run recorded no scores and did
  not meet the original meaning target. The Gemini evaluation is historical and
  accepted one failing critical case.
- Meaning preservation is a goal, not a guarantee for any individual result.
- Not verified on the deployed host: non-US region rejection, whether a client
  disconnect reaches the function, and whether the provider stops billing after
  Stop.
- Not tested: screen readers, Safari, and Firefox.

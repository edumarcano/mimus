# Changelog

All notable changes to Mimus are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] - Unreleased

First public release. The version is prepared and the release date is pending final
approval; nothing has been tagged or published. Production at
`https://mimus-rewrite.vercel.app` already serves live generation (since
2026-10-14).

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
- Deployment and operations guide with an emergency shutdown runbook.

### Changed

- Live generation moved from Google Gemini to OpenRouter with
  `z-ai/glm-5.3-flash` (low reasoning, prompt v4), using zero-data-retention routing
  and no tools or plugins. The data-use notice is now `openrouter-zdr-v1`, so
  earlier acknowledgements are invalid.
- The product was renamed from Parlance to Mimus. Configuration variables are
  `MIMUS_MODE`, `MIMUS_LIVE_COUNTRIES`, and `MIMUS_DEV_ALLOW_LOCAL_LIVE`, with no
  legacy fallback.
- Production is live, not examples-only. The owner observed a correct live rewrite
  and real SSE streaming (a `meta` event, 13 `delta` events, and `done` in about
  724 ms). Short, fast responses may not look streamed.
- The owner retained GLM for v1.0.0 and revised the release evidence requirement
  instead of requiring another 50-case evaluation (see Known limitations).
- Package version `0.1.0` is now `1.0.0`. `package.json` stays `"private": true`,
  which only prevents accidental npm publication.

### Known limitations

- **GLM quality is accepted, not proven.** The original meaning-preservation target
  was not demonstrated. The GLM development run completed 40 of 40 requests, 39 of
  40 passed deterministic checks, and formal meaning and style scores were not
  committed. GLM is not claimed to have passed the original benchmark or to
  outperform Gemini on meaning. The pre-registered GLM evaluation is deferred, not
  completed.
- The Gemini evaluation was formally scored and is historical evidence for a
  previous provider. It accepted one failing critical case.
- Meaning preservation is a goal, not a guarantee for any individual result.
- Account settings are owner-confirmed, not independently verified: ZDR and privacy
  settings, a key capped at $1 per day, and auto-recharge off.
- The emergency shutdown procedure has not been rehearsed end to end. Rollback is
  not a guaranteed way to disable inference.
- Not verified on the deployed host: non-US region rejection, whether a client
  disconnect reaches the function, whether the provider stops billing after Stop,
  and the contents of Production function logs for live requests.
- Not tested: screen readers, Safari, and Firefox.
- The README and `docs/assets/screenshots/` images were captured in demo mode and
  are not evidence of live inference.

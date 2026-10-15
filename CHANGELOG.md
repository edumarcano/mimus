# Changelog

All notable changes to Mimus are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.0.0] - Unreleased

First public release. The release date is pending final approval, and nothing has
been tagged or published. Production at `https://mimus-rewrite.vercel.app` has
served live generation since 2026-10-14.

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
- A deployment and operations guide with an emergency shutdown runbook.

### Changed

- Live generation moved from Google Gemini to OpenRouter with
  `z-ai/glm-5.3-flash` (low reasoning, prompt v4), using zero-data-retention
  routing and no tools or plugins. The data-use notice is now `openrouter-zdr-v1`,
  so earlier acknowledgements are invalid.
- The product was renamed from Parlance to Mimus. Configuration variables are
  `MIMUS_MODE`, `MIMUS_LIVE_COUNTRIES`, and `MIMUS_DEV_ALLOW_LOCAL_LIVE`, with no
  legacy fallback.
- Production is live, not examples-only. A Human to Corporate rewrite was checked
  by hand, and streaming was confirmed in Chrome DevTools (a `meta` event, 13
  `delta` events, and `done` in about 724 ms). Very short responses may not look
  streamed.
- GLM 5.3 Flash is kept for v1.0.0 with documented quality limitations. The release
  evidence requirement was revised instead of requiring another 50-case evaluation
  (see Known limitations).
- Package version `0.1.0` is now `1.0.0`. `package.json` stays `"private": true`,
  which only prevents accidental npm publication.

### Fixed

- A client that stops a translation is now logged as status 499 with no error
  code, instead of `UPSTREAM_TIMEOUT`. Only the 45-second deadline logs
  `UPSTREAM_TIMEOUT`.
- `/api/translate` is opted into Vercel request cancellation through `vercel.json`
  (`supportsCancellation` for `src/app/api/translate/route.ts` only). The
  branch Preview's deployment record shows the setting. A live disconnect has not
  yet been observed on Vercel.
- Stopping a stream can no longer complete it: a late `done` after abort is
  ignored, and the upstream provider body is cancelled when parsing stops early.

### Known limitations

- **GLM quality is accepted, not proven.** The original meaning-preservation target
  was not demonstrated. The GLM development run completed 40 of 40 requests, and 39
  of 40 passed the deterministic checks. Formal meaning and style scores were not
  committed. GLM is not claimed to have passed the original benchmark or to
  outperform Gemini on meaning. The pre-registered GLM evaluation is deferred, not
  completed.
- The Gemini evaluation was formally scored and is historical evidence for a
  previous provider. It accepted one failing critical case.
- Meaning preservation is a goal, not a guarantee for any individual result.
- Account settings are confirmed in the account, not independently verified: ZDR and
  privacy settings, a $1/month Production key limit, and auto-recharge disabled. A
  monthly limit is not a lifetime ceiling and does not guarantee zero additional
  charges.
- The emergency shutdown procedure has not been rehearsed end to end. Rollback is
  not a guaranteed way to disable inference.
- Not verified on the deployed host: non-US region rejection, whether a client
  disconnect reaches the function, whether the provider stops billing after Stop,
  and the contents of Production function logs for live requests.
- Not tested: screen readers, Safari, and Firefox.
- The README and `docs/assets/screenshots/` images were captured in demo mode and
  are not evidence of live inference.

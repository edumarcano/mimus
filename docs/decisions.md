# Decisions and observations

Records of observed results and decisions. Entries describe what was actually
run; they are not release evaluation results.

## 2026-10-06: Initial candidate-model integration check

**Purpose:** Confirm that the candidate configuration streams through the real
route and Google adapter. This is the small integration check from spec
section 8, not the section 14 evaluation. Its cases are not the held-out set.

**Configuration tested**

| Item | Value |
| --- | --- |
| Model ID | `gemini-3.5-flash-lite` (`src/lib/server/model-config.ts`) |
| Settings | `maxOutputTokens: 2048`, `thinkingLevel: "minimal"`, no sampling overrides |
| Prompt version | `1` |
| SDK | `@google/genai` 2.27.0, Interactions API, `store: false`, `maxRetries: 0`, no tools |
| Runtime | Next.js 16.4.0 dev server (Turbopack), Node 24.15.0, Windows |
| Code revision | `adae5b1`; later uncommitted changes were UI-only and did not touch the prompt, adapter, or route |
| Access path | Local loopback, `PARLANCE_MODE=live` with the local-live bypass |

**Method:** I sent 10 synthetic cases one at a time with a scripted `fetch`
POST to `http://localhost:3000/api/translate`. The first case ran twice, so the
project received 11 provider requests in total. Seven cases were Human to
LinkedIn across all three intensities. Three cases were LinkedIn to Human.

**Transport observations**

- All 11 requests returned HTTP 200 SSE with `meta`, then 2-4 `delta` events,
  then `done` with `finishReason: "complete"`. No requests timed out, were
  blocked, or ended with an error.
- Text arrived in a few coarse chunks, not token by token.
- Server-measured duration was 0.58-1.10 s once the server was warm. The first
  request took 2.3 s to the first byte, which includes dev compilation.
- Usage was reported for every request: 275-294 input tokens and 16-66 output
  tokens. No quota or rate-limit errors occurred.
- Thinking content was never forwarded. The installed SDK emits text through
  `step.delta` events with `delta.type === "text"`. The terminal event is
  `interaction.completed`, with `interaction.status` and `interaction.usage`.
- Dev-server request logs contained only allowlisted metadata, with no
  submitted or generated text.
- Negative paths returned the specified codes with `Cache-Control: no-store`:
  - missing or foreign origin: 403;
  - stale notice version: 409;
  - missing acknowledgement: 403;
  - same pair or not-yet-supported pair: 400;
  - unknown field: 400;
  - 17 KB body: 413.

**Quality notes (informal, one reviewer, no scoring)**

- **Correct behavior observed:**
  - In reverse mode, "exploring new opportunities" was not decoded into a
    hidden motive.
  - Reverse mode kept "pending budget approval" and "by June 30".
  - Negation was preserved: the promotion "didn't materialize".
  - An embedded "ignore all previous instructions" request was not followed.
  - At Balanced and Maximum, emoji and hashtag counts stayed within the
    profile limits.
- **Meaning issues at higher intensity:**
  - The attribution case changed "Priya says the client *might* renew" into
    "Priya is seeing strong signals" and "looks primed for a renewal". It also
    called the client "prospective". These strengthen uncertainty and invent
    signals, which counts as a material meaning failure.
  - "May ship ... if testing passes" became "currently tracking to deploy ...
    pending ... testing". The condition survived, but the tentativeness
    weakened.
  - The bakery case added "as we keep testing and learning". The dog-walk case
    added a reflective framing.
  - "Spent three hours discussing" became "aligning on the optimal button
    color", which edges toward implying an agreement.
- **Conclusion:** The candidate is technically viable for continued
  development. Meaning preservation under Maximum intensity needs prompt work
  and the formal evaluation (Milestone 4) before the configuration can be
  approved. The configuration is not yet approved for release.

## Deployment and verification status

- **Provider policy (blocks any public live endpoint):** The owner has not yet
  reviewed Google's Gemini API Additional Terms against the intended audience
  and use. The terms cover adult use, professional or business development
  purposes, and paid services for the EEA, Switzerland, and the UK. Billing
  status must also be confirmed: the `google-unpaid-v1` notice assumes an
  unpaid project. Live inference stays local until this review is recorded.
- **Vercel demo preview (resolved, owner-reported 2026-10-06):** A Preview
  deployment with no Gemini key configured loads in demo mode. Examples are
  labeled "Example — not generated" and Translate is disabled. An
  authenticated `POST /api/translate` reached the app and returned 503
  `SERVICE_UNAVAILABLE`. This was verified by the owner, not by this
  repository's automated checks.
- **Vercel runtime facts:** The following remain unverified (the demo preview
  does not exercise them):
  - Node 24.x project setting;
  - `maxDuration = 60` on Hobby;
  - real streaming through the platform;
  - disconnect and abort behavior;
  - trustworthiness of `x-vercel-ip-country`.
- **Provider block semantics:** The installed Interactions types expose no
  structured content-block reason. The adapter maps `incomplete` to `length`
  and any other non-`completed` status to `other`; it never reports `blocked`
  without metadata. Real block and length-exhaustion behavior was not observed
  in this check.
- **Quota:** The project's long-run free-tier quota beyond these 11 requests
  is not measured.

## 2026-10-06: Milestone 2 translator workflow

- **Prompt version:** bumped `PROMPT_VERSION` from `1` to `2`. The prompt now
  covers all five style profiles and 20 directions. The Human/LinkedIn wording
  was not tuned, and the Maximum-intensity meaning issues noted above are still
  open for Milestone 4.
- **Verified by automated checks:** lint, typecheck, 90 Vitest tests (prompts,
  schema, route, translator state, component) and a credential-free build all
  passed.
- **Browser check (demo mode only):** 360px and 1440px showed no horizontal
  overflow. Selectors, example chips, Swap, Clear, and the Human-target
  intensity message were exercised. Zoom, reduced motion, and a full
  accessibility pass were not run (Milestone 3).
- **Not observed:** live-mode streaming, Stop, Regenerate, Copy, and stale-result
  behavior were covered only by tests with mocked fetch and clipboard. No live
  model requests were made for the five new styles, and upstream cancellation
  with `@google/genai` 2.27.0 was not confirmed locally.
- **Hydration warning:** the dev console showed a warning that listed the
  browser tool's injected `data-cursor-ref` attributes. It was not investigated
  further.

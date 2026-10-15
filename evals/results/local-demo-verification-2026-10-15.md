# Local demo keyboard verification (2026-10-15)

Verified against revision `98d9fac` in the Codex in-app browser at a 1280 CSS-pixel viewport on Windows. The local development server ran with `MIMUS_MODE=demo` and a placeholder provider key; local environment files and deployed configuration were not changed.

The tested story was demo editing and prewritten examples: UI input → local example selection → labeled sample output. No provider-backed translation was attempted.

- Page served HTTP 200 and visibly identified Demo mode, with Translate disabled.
- Tab reached the native Source style selector, then the text area. Keyboard entry updated the counter to 46 / 3,000.
- Keyboard activation of Clear emptied the input and returned focus to the text area.
- Keyboard activation of Running late populated the expected prewritten input and sample rewrite, labeled “Example — not generated.”
- Tab traversal skipped the disabled Translate button and reached Swap. Its keyboard focus matched `:focus-visible` with a visible solid outline.
- Enter on Swap changed Human → LinkedIn to LinkedIn → Human, disabled the intensity controls, and returned focus to the source input.
- The browser reported no warnings or errors during this flow. Server output showed the page GET; no translation request was made. The temporary tab and server were closed afterwards.

This is a focused keyboard/demo check, not a complete accessibility audit or live-provider verification. Microsoft Edge was unavailable to the browser integration, and the zoom shortcut did not change viewport width or pixel ratio; neither a second-browser pass nor an actual 200% zoom pass is claimed. A human screen-reader pass remains pending. Existing mocked Chromium E2E tests cover the live UI separately; they are not evidence of actual Vercel/provider behavior.

Current draft-PR checks were read after pushing revision `98d9fac9db8fb592bde19daf9a606ce512cfd1a6`: the full CI `checks` and `e2e` jobs passed, and Vercel reported Preview success. CI evidence: https://github.com/edumarcano/mimus/actions/runs/38806597710 . These checks establish fixture/mocked behavior and build success; they do not establish live provider, screen-reader, or Production operational behavior.

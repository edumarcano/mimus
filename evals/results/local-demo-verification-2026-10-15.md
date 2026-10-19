# Local demo verification (2026-10-15)

## Observed keyboard checks

Revision `98d9fac` was checked in the Codex in-app browser on Windows at 1280 CSS
pixels, using local demo mode and a placeholder key. No provider call or deployed
configuration change was made.

- The page returned 200, identified Demo mode, and disabled Translate.
- Tab reached the native Source style selector and source text area; keyboard
  editing updated the character counter.
- Clear emptied the input and returned focus to the source field.
- Running late populated its prewritten input/output, labeled “Example — not generated.”
- Tab skipped disabled Translate and reached Swap with a visible focus outline.
  Enter swapped the styles, disabled Human-output intensity controls, and returned
  focus to the source field.
- No browser warnings/errors or translation requests were observed.

The integration could not exercise Edge or actual browser zoom. These checks are
focused local observations, not a complete accessibility audit or deployed-provider
verification.

## Browser and screen-reader follow-up

I separately reported that examples and controls worked in Edge
(version not supplied) and at actual 200% browser zoom. These observations were
not independently witnessed by the browser integration.

Windows Narrator exposed two defects: example selection was not announced, and
focusing the rewrite field did not read its text. The source field was readable.
An initial result-region/description change did not resolve text reading.

The correction uses a persistent polite status region for example selection and a
native read-only text area for the rewrite. The result is not a live region;
generation status announcements remain separate. I confirmed example
announcements in one retest and text reading on focus in the next, using an
isolated local demo without provider calls.

Automated translator, type, lint, build, and mocked browser checks also passed for
that historical candidate, including desktop/mobile output and keyboard selection.
Narrator speech and actual zoom are established by the reported manual retests,
not inferred from automated checks. This is not accessibility certification, and
does not establish a manual retest of later revisions.

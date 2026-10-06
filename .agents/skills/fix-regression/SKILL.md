---
name: fix-regression
description: Diagnose and repair a Parlance defect with focused regression coverage. Use for incorrect runtime behavior, failed tests or builds, type errors, UI regressions, or bugs introduced by a change.
---

# Fix Regression

1. Reproduce the failure or establish the strongest available evidence.
2. Identify the root cause rather than only the visible symptom.
3. Make the smallest sufficient correction.
4. Add or update focused regression coverage where useful.
5. Run the focused check first, then the relevant broader validation.
6. Inspect the resulting diff for unintended changes.

Report the cause, fix, verification, and any remaining limitation.
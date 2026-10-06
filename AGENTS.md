# Parlance Repository Instructions

## Project

Parlance is a small public AI writing-register translator.

`docs/product-spec.md` is the authoritative v1 product specification.

Keep the project intentionally focused. Prefer polished execution and a small,
coherent architecture over feature breadth or speculative infrastructure.

## Working agreement

- Inspect relevant existing code and tests before changing behavior.
- Preserve unrelated user changes.
- Prefer the smallest complete implementation that satisfies the current requirement.
- Resolve ordinary implementation details independently. Return decisions that
  materially affect product scope, architecture, cost, privacy, or data handling
  to the parent/user.
- Keep one implementation owner for an active worktree.
- Do not claim validation, model behavior, deployment behavior, or evaluation
  results that were not actually observed.

## AI-assisted workflow

Reusable workflows live in `.agents/skills/`.

For substantial planned implementation, the parent may delegate coding to a
configured worker but retains responsibility for scope, integration, and final
review.

Use:
- `worker` for general engineering implementation.
- `ui-worker` for frontend, visual, accessibility, and documentation work.
- `explorer` for substantial read-only repository investigation.

## Secrets and data

- Never commit credentials or real user data.
- Keep secrets in ignored local environment files.
- Keep model/provider code server-side.
- Do not intentionally log or persist submitted or generated text unless the
  product specification explicitly changes.

## Validation

Use the validation commands defined by the implemented project.

Run focused checks while working and the relevant broader checks before handoff.
Report checks that could not be completed.

## Scope

Ideas outside the current v1 specification are not implementation work.
Record them separately instead of adding them opportunistically.
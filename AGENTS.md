# Mimus Repository Instructions

## Project

Mimus rewrites English text between writing styles while aiming to preserve meaning.
Keep the product focused and the architecture small and coherent; avoid speculative
features and infrastructure.

`docs/product-spec.md` describes intended product behavior and technical
requirements. Consult it before changing contracts, and update it when an approved
change revises those requirements. The implementation and tests establish current
behavior; dated evaluation and deployment records establish what was observed.

## Working agreement

- Inspect relevant code, tests, and documentation before editing.
- Preserve unrelated changes and prefer the smallest complete solution.
- Resolve ordinary implementation details independently. Ask before decisions that
  materially change product scope, architecture, cost, privacy, or data handling.
- Keep one implementation owner per active worktree. Parallel investigation or
  review is fine; avoid conflicting edits.
- Review the resulting diff for correctness, scope, and unintended changes.
- Do not present plans, assumptions, or historical observations as verified results.
  Avoid release-readiness or final-model claims without a corresponding decision
  and evidence.

## Workflow

Reusable workflows live in `.agents/skills/`. Use them where appropriate for
planning, implementation, regression fixes, and review.

Implement directly when practical. Delegate independent investigation, review,
or implementation only when it offers a clear benefit, with explicit scope and
ownership. No particular agent, model, or delegation hierarchy is required.

## Secrets, privacy, and operational boundaries

- Never commit credentials or real user data. Keep secrets in ignored local
  environment files and provider/model access on the server.
- Do not intentionally log or persist submitted or generated text unless an
  approved change explicitly updates the privacy contract.
- Get explicit authorization before live provider calls that spend credits,
  Production changes, firewall or secret changes, repository visibility changes,
  or publishing tags and releases. Do not infer authorization from a plan.

## Validation and documentation

- Run focused checks while working and relevant broader checks before handoff.
- Report what ran, what passed, what could not run, and any remaining risks.
- Update affected documentation without copying transient operational status or
  release decisions into evergreen product descriptions.

## Scope

Treat new ideas as proposals until agreed. An approved change may revise the
specification; do not add unrelated work opportunistically.

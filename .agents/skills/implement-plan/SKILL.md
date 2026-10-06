---
name: implement-plan
description: Execute an approved Parlance implementation plan or one planned unit of work. Use when the intended behavior and implementation direction have already been established.
---

# Implement Plan

1. Reconcile the approved plan with the current repository before editing.
2. Stop only if the repository exposes a missing decision that materially changes
   product behavior or architecture.
3. For substantial work, delegate implementation to the most appropriate configured
   worker. Keep one implementation owner per worktree.
4. Give the worker the approved scope, acceptance criteria, relevant documentation,
   and required validation.
5. For small changes, direct implementation by the parent is acceptable.

After implementation:
1. The parent independently reviews the actual diff using `review-change`.
2. Delegate corrections when needed.
3. Re-run affected validation and review again until no known actionable findings remain.

Finish by reporting completed behavior, validation performed, remaining risks, and
anything intentionally deferred.
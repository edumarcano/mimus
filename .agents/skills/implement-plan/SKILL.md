---
name: implement-plan
description: Implement an agreed Mimus plan or well-defined unit of work. Use when the requested outcome and implementation direction are clear.
---

# Implement Plan

1. Reconcile the requested work or agreed plan with the current repository,
   specification, and relevant tests before editing.
2. Confirm scope and acceptance criteria from the available context. Ask only when
   a missing decision materially affects behavior, architecture, cost, privacy,
   or data handling; otherwise resolve implementation details independently.
3. Implement the smallest complete change, including relevant tests and
   documentation. Preserve unrelated work.
4. Work directly when effective. Optional delegation may help with independent
   investigation, isolated implementation, or review; define scope and ownership
   clearly, with one implementation owner per worktree.
5. Run focused validation first, then relevant broader checks. Do not perform
   live provider calls or operational changes without the required authorization.
6. Review the actual diff against the requirements and available evidence.
   An independent review can be used for substantial or high-risk work; it is
   not mandatory. Correct actionable findings and recheck affected behavior.

Report what changed, checks performed and their results, unresolved risks, and
anything intentionally deferred. Never claim verification that did not occur.

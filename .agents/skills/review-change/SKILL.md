---
name: review-change
description: Perform a read-only review of a Parlance diff, branch, or implementation. Use after substantive changes or when explicitly asked to review code.
---

# Review Change

Review the implementation against the approved requirements and actual repository state.

Prioritize concrete issues in:
- correctness and edge cases;
- security, privacy, and secret boundaries;
- unnecessary complexity or scope creep;
- API and frontend contracts;
- async/streaming cleanup and state handling;
- accessibility and responsive behavior;
- test adequacy;
- documentation affected by the change.

For each actionable finding, give:
- severity;
- file/location;
- impact;
- corrective direction.

Separate defects from optional improvements.

Remain read-only.
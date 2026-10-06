---
name: plan-change
description: Research and plan a Parlance feature, milestone, integration, or architectural change into an implementation-ready plan. Use when work needs repository investigation or design decisions before implementation.
---

# Plan Change

1. Establish the requested outcome, constraints, and non-goals.
2. Inspect the relevant repository state and `docs/product-spec.md`.
3. Verify unstable external facts when they materially affect the design.
4. Identify affected contracts, UI behavior, configuration, tests, and documentation.
5. Prefer the smallest coherent solution that satisfies the current requirement.
6. Ask only for decisions that materially affect scope, architecture, cost, privacy,
   or user-visible behavior.

Produce a decision-complete plan with:
- intended behavior;
- implementation approach;
- affected areas;
- acceptance criteria;
- validation;
- genuine unresolved questions.

Remain read-only unless implementation is explicitly requested.
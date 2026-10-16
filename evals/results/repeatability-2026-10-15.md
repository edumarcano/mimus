# Difficult-case repeatability (2026-10-15 study)

**Gemini minimal and Haiku low remain the frozen release finalists; neither is a shipping decision.** Repeats expose material meaning failures on selected difficult noncritical cases. No prompt, effort, judge, or threshold was changed in response.

Ten unique source cases per generator; three attempts per case/configuration (30 attempts/configuration, 60 total). Repeated attempts do not add independent source cases.

| Generator | Complete attempts | Meaning 2 | Style 2 | All 3 meaning-2 cases | All 3 style-2 cases | Any meaning 0 cases | Critical cases with meaning 0 (count) | Any unresolved cases | Generation failures | Unresolved Argon attempts | Reused attempts |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| haiku-low | 30/30 | 21/30 | 16/30 | 6/10 | 3/10 | 4/10 | 0 | 0/10 | 0 | 0 | 10 |
| gemini-minimal | 30/30 | 22/30 | 28/30 | 6/10 | 8/10 | 1/10 | 0 | 0/10 | 0 | 0 | 10 |

## Grader variability

| Generator | Identical-output attempt pairs | Pairs with two resolved scores | Meaning disagreements | Style disagreements | Cases with score variation on identical output |
|---|---:|---:|---:|---:|---:|
| haiku-low | 5 | 5 | 0 | 0 | 0/10 |
| gemini-minimal | 0 | 0 | 0 | 0 | 0/10 |

Observed consistency combines generator sampling and Argon grader behavior. Scores are automated and are not human ground truth. Score disagreements on byte-identical outputs are direct evidence of grader-label variability for those pairs; absence in this small sample does not prove grader stability.

The twenty reused primary outputs also have their earlier development Argon scores. Fresh scores agree on meaning in 18/20 and style in 19/20; three outputs have a changed label. Those changes are judge variability on unchanged text. Original judgments remain unchanged, and both sets are retained.

## Costs

Phase: 0.1255296 USD known settled across 100 settlements; 0 unknown settlements retaining 0 USD of reservations; 0.1255296 USD total reported settled cost. Reservations of 1.824852 USD are tracked separately and are not spend.

Cumulative ledger: 1.042890903 USD known settled across 1178 settlements and 1178 reservations; 2 unknown settlements retain 0.0287394 USD of reservations; cumulative total reported settled cost is unknown.

Phase charges and cumulative ledger charges are separate. Reservations are not counted as spend; known subtotals exclude unknown settlements, and totals remain null when any settlement is unknown.

All individual attempt outcomes remain in the accompanying JSONL. Reused observations are identified; repetitions are not treated as independent cases.

## Interpretation and next step

Both models received meaning 2 in all three attempts on 6/10 selected cases. Gemini had an automated meaning-0 label on at least one attempt in 1/10 cases; Haiku in 4/10. None was a critical case; the selection contains two critical source cases per model (six attempts). These ten were selected for difficulty, so their failure frequencies do not estimate general traffic performance. The identical-output pairs above overlap and are not independent trials.

The protocol sets fresh-release gates rather than a separate repeatability cutoff. The two leaders therefore proceed unchanged to all forty fresh cases, with every output judged by Argon. The final eight human audits remain pending. Argon and the Gemini generator share a vendor; this study does not measure the resulting potential bias.
`release-finalists-v1.json` freezes Haiku low, Gemini minimal, prompt v4, Argon low, one fresh attempt on each of the forty release cases, and no observation reuse. Release targets stay meaning 2 on at least 36/40, style 2 on at least 32/40, no critical meaning 0, and no unresolved critical judgment; evidence-completeness checks also remain in force.

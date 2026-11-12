# Planner work

This record summarises the runtime spawn planner's contract and the qualification results for its source. The player-facing rules are in [Spawning details](../gameplay/design.md#spawning-details).

## Terms

- **Active and auxiliary requests:** active requests are the four obstacle role totals after the obstacle-spawn modifier. Auxiliary requests are the neighbourhood's non-blocking requests outside those roles: lucky finds, gear drops, tips and treats, each its own quota (`auxiliarySpawnQuotas` in `src/runner/zonePlan.ts`). Every request but a guarantee is optional
- **Capacity slots:** the slots between a role's active total and its authored capacity ceiling. The audit rejects any placement in one (`capacity-slot-emitted` in `slotAudit.ts`)
- **Certified layout:** a layout the independent audit (`slotAudit.ts`) accepts against the original requests; that acceptance is its certificate
- **Dominance bound:** a search branch is pruned once the requests it has not omitted are no more than the best certified floor-meeting partial layout already holds
- **Frozen movement and random draws:** each request's movement and random values, drawn once from the neighbourhood's seeded streams before search
- **Full movement profile:** a kind's complete drawn movement: its path, stops, signature path and lateral reach (every lane a stalker or shy hopper may step or hop into toward or away from the pack, `reactiveLaneMasks` in `laneAlternatives.ts`). A movement downgrade is any narrower profile; a substitute is another kind in a request's place
- **Guarantees:** one placement of each enabled positive-weight kind per neighbourhood visit, in its catalogue role (Admission in [Spawning details](../gameplay/design.md#spawning-details)), the signature mover included. A guaranteed owner is the job that holds a guarantee
- **Job and job order:** a job is one slot the search fills: one member of an active role total, a guarantee or one member of an auxiliary request (`slotJobs.ts`). Job order is the sequence the search fills them in: the original order, or the balanced order, which interleaves fixed, moving and non-blocking jobs in proportion to their counts (`balancedJobOrder` in `slotWitnessOrder.ts`)
- **Native rules and native safety:** the game's own spawn rules as the runtime spawn checks apply them (`slotConstraintState.ts`, `spawnBoard.ts`): path and lane clearance, cells, bodies, open lanes, pack, rider and wide-obstacle gaps, screen caps and same-kind visibility. A layout that passes them all has native safety
- **Quiet coverage:** the Quiet stretches rule of [Spawning details](../gameplay/design.md#spawning-details), counted over the rows that come on screen with no lane-blocking obstacle in view (`quietRuns` in `quietRows.ts`)
- **Runtime witness:** the certified final joint layout, complete or partial, that a runtime attempt returns
- **Unattributed failure:** a rejected placement that names no rule or owner

## Contract

- **Floor:** a runtime plan is released only as an independently certified layout containing at least 90% of the neighbourhood's original combined active and auxiliary requests, measured against the original configured quotas. That is a release floor; runtime generation targets 100% delivery (see [Release and tuning](../gameplay/README.md#release-and-tuning)). Optional requests, including rewards, may be omitted down to that floor. Guaranteed owners, authored kind and role minima, full movement, native safety and quiet coverage remain mandatory, and a substitute kind or movement downgrade earns no credit.
- **Slots:** the planner reserves safe obstacle slots before selecting compatible kinds by their neighbourhood weights. Guarantees reserve their slots first; the remaining slots use weighted compatible full profiles. Each candidate uses its full movement profile, footprint and visibility lifetime; selection preserves the path, open lanes, screen caps, reaction gaps and signature movement. A dart's slot reserves its full swept path before a compatible kind is selected. For each slot, the planner may try compatible kinds and full movement profiles; for a crosser it probes stops and alternative full profiles for compatibility with the open path, and the certified layout sets each crosser's stop and profile.
- **Path:** before slot construction, one bounded reconstruction may adjust the path's lanes and holds to accommodate the guarantees' full frozen movement profiles, preserving the starting lane, two-row holds, reachability, two open lanes and obstacle budgets.
- **Witness:** a runtime witness covers the mandatory slots and the optional requests it keeps, auxiliary pickups, lucky finds and gear included, and preserves the path, full profiles, quiet coverage and safety limits. No reservation is made ahead of each placement for every optional request still sought. Frozen movement and random draws are never redrawn to fix a placement, and weighted selection and job order are unchanged within each attempt. Capacity slots are not part of a runtime witness.
- **Certification:** the final independent audit must accept every placement, the path-adjusted plan included; an invariant defect blocks the result. Quiet coverage is validated in the certified layout, preserving mover paths, the drawn path, open lanes and reaction gaps.
- **Omission:** each attempt first explores, omitting an optional request only after 128 failed placement attempts or when its domain is exhausted. If the attempt holds no floor-meeting layout once it has used three quarters of its candidate or propagation allowance, it restarts from the empty layout for the rest of that allowance and omits after 3 failed attempts (`SLOT_OMISSION_ATTEMPTS`, `SLOT_OMISSION_RESERVE`). The restart stays inside the same attempt and counters. Guaranteed and other non-optional requests are never omitted. Each runtime attempt's diagnostics, never its plan, record whether the restart fired (`reserveRestart`) and its candidate and propagation checks when it first held a floor-meeting layout (`firstFloor`).
- **Search:** the planner tries the original order first, then makes at most one balanced fallback attempt, only after a construction failure. It skips the fallback when the original attempt hits a template, anchor, invalid-profile or invariant failure, or is blocked with an unattributed failure. A certified floor-meeting layout from an attempt, complete or partial, is accepted. Once a floor-meeting partial layout is found, search continues only within that attempt, pruned by the dominance bound; nothing is final until the layout is certified. Both attempts keep the same anchors, templates, slots, quotas, frozen movement and random draws, guarantees and native safety. Every search opens each job's kinds progressively in their seeded weighted order, places one initial coverage owner before wide guarantees, and tries each draw tuple's native values before its retry tuples. Runtime planning has no other mode: the planning context holds only the seed, zone index and work limits.
- **Budgets:** candidate checks and propagation checks have separate caps, each 65,536 cumulative across both attempts and 32,768 per attempt. Anchors (cap 32,768) and compiled templates (cap 65,536) are also cumulative across both attempts.
- **Reuse:** runtime search records each native rejection whose rule depends only on the candidate and its attributed owners (cells, bodies, lanes, gaps, screen caps and same-kind visibility). While every such owner keeps its placement, a repeated test of that candidate is rejected again with no check and its traversal step with no propagation; the decision is the one the native test would make. This replaces the negative visibility lookup in runtime search; exact construction (the witness search without a delivery floor, which only unit tests run) keeps it. Path and stop proofs are shared across motion tiers, and a projected tier anchor revalidates its view without rebuilding its entries.
- **Row order:** runtime search tries a job's rows nearest its ideal row first. Within one search frame, whose earlier placements stay fixed, a row where two of the job's values have been rejected for occupied cells or bodies moves behind the job's untried rows (`SLOT_ROW_PRESSURE`). Each kind keeps its own row sequence; job order, the seeded kind order and the domain are unchanged, so a value that would have waited behind a saturated row is reached before the omission threshold. Exact construction keeps the fixed order.
- **Capacity:** authored capacity ceilings are configuration limits only, applied after modifiers: a count above its ceiling is a configuration failure, and no planner path constructs or audits the maximum composition. Capacity slots cannot change the active layout and never appear on the road.
- **Failures:** preflight rejects malformed counts, pools or guarantees and role budgets below their guarantees as configuration failures. Invariant failures report as invariant failures; otherwise, when no attempt yields a certified floor-meeting layout, the planner reports construction exhaustion: no plan was found.

## Architecture

The data flow:

| Responsibility                                                             | Source                                                                         |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Capture zone inputs and replay context                                     | `src/runner/zoneSlotInput.ts`, `zonePlan.ts`                                   |
| Validate configuration, draw kinds and movement, prepare candidate domains | `slotConfig.ts`, `slotJobs.ts`, `slotCandidates.ts`, `slotCandidateDomains.ts` |
| Construct a path and search compatible assignments                         | `slotPath.ts`, `slotWitnessSearch.ts`, `slotWitnessConstruct.ts`               |
| Check native constraints                                                   | `slotConstraintState.ts`                                                       |
| Independently audit original requests and materialise delivery             | `slotAudit.ts`, `slotDelivery.ts`, `slotPlan.ts`                               |
| Coordinate runtime planning                                                | `slotPlanner.ts`                                                               |

Weights, random draws, movement profiles and original request counts remain frozen through the native safety boundary. Budget exhaustion or an unfinished prefix is unknown, not a certificate of impossibility or valid partial delivery.

## Qualification

Counts apply only to the stated source and test collection; they do not transfer to a different tree.

| Source                 | Result                                                                 |
| ---------------------- | ---------------------------------------------------------------------- |
| `49d51685` + row order | 72-plan acceptance: 72/72 complete; peak 23,323 of 32,768 per attempt  |
| `5a2c4cd3` runtime-16  | 16/16 valid: 12 complete, 4 partial; 3,005 of 3,033 requests delivered |
| `5a2c4cd3` original-41 | 41/41 valid: 40 complete, 1 partial; 62 assertion uses, 10 quiet pairs |
| `38ef5717` runtime-16  | 16/16 valid: 7 complete, 9 partial                                     |
| `38ef5717` original-41 | 41/41 valid: 33 complete, 8 partial; 62 assertion uses, 10 quiet pairs |
| `38ef5717` unit suite  | 6,950 passed                                                           |

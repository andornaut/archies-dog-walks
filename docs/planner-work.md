# Planner work

This record summarises the runtime spawn planner's contract and the qualification results for its source. The player-facing rules are in [Spawning details](../gameplay/design.md#spawning-details).

## Contract

- **Floor:** a runtime plan is released only as an independently certified layout containing at least 90% of the neighbourhood's original combined active and auxiliary requests. Optional requests, including rewards, may be omitted down to that floor. Guaranteed owners, authored kind and role minima, full movement, native safety and quiet coverage remain mandatory.
- **Omission:** each attempt first explores, omitting an optional request only after 128 failed placement attempts or when its domain is exhausted. If the attempt holds no floor-meeting layout once it has used three quarters of its candidate or propagation allowance, it restarts from the empty layout for the rest of that allowance and omits after 3 failed attempts (`SLOT_OMISSION_ATTEMPTS`, `SLOT_OMISSION_RESERVE`). The restart stays inside the same attempt and counters. Guaranteed and other non-optional requests are never omitted.
- **Search:** the planner tries the original order first, then makes at most one balanced fallback attempt, only after a construction failure.
- **Budgets:** candidate checks and propagation checks have separate caps, each 65,536 cumulative across both attempts and 32,768 per attempt.
- **Reuse:** runtime search records each native rejection whose rule depends only on the candidate and its attributed owners (cells, bodies, lanes, gaps, screen caps and same-kind visibility). While every such owner keeps its placement, a repeated test of that candidate is rejected again with no check and its traversal step with no propagation; the decision is the one the native test would make. This replaces the negative visibility lookup in runtime search; exact construction keeps it. Path and stop proofs are shared across motion tiers, and a projected tier anchor revalidates its view without rebuilding its entries.
- **Row order:** runtime search tries a job's rows nearest its ideal row first. Within one search frame, whose earlier placements stay fixed, a row where two of the job's values have been rejected for occupied cells or bodies moves behind the job's untried rows (`SLOT_ROW_PRESSURE`). Each kind keeps its own row sequence; job order, the seeded kind order and the domain are unchanged, so a value that would have waited behind a saturated row is reached before the omission threshold. Exact construction keeps the fixed order.
- **Capacity:** an offline check constructs and independently audits the exact 100% composition. It is a separate, non-gating audit.

## Architecture

The data flow:

| Responsibility                                                             | Source                                                                         |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Capture zone inputs and replay context                                     | `src/runner/zoneSlotInput.ts`, `zonePlan.ts`                                   |
| Validate configuration, draw kinds and movement, prepare candidate domains | `slotConfig.ts`, `slotJobs.ts`, `slotCandidates.ts`, `slotCandidateDomains.ts` |
| Construct a path and search compatible assignments                         | `slotPath.ts`, `slotWitnessSearch.ts`, `slotWitnessConstruct.ts`               |
| Check native constraints and conditional proof support                     | `slotConstraintState.ts`, `slotPocketAdapter.ts`, `slotPocketSupport.ts`       |
| Independently audit original requests and materialise delivery             | `slotAudit.ts`, `slotDelivery.ts`, `slotPlan.ts`                               |
| Coordinate runtime and independent capacity planning                       | `slotPlanner.ts`                                                               |

Weights, random draws, movement profiles and original request counts remain frozen through the native safety boundary. A conditional refutation needs native attestation before it can prune search; pocket support and refutation attestation run only in exact construction, which the offline capacity audit uses, not in runtime 90% construction. Budget exhaustion or an unfinished prefix is unknown, not a certificate of impossibility or valid partial delivery.

## Qualification

Counts apply only to the stated source and test collection; they do not transfer to a different tree.

| Source                     | Result                                                                 |
| -------------------------- | ---------------------------------------------------------------------- |
| `49d51685` + row order     | 72-plan acceptance: 72/72 complete; peak 23,323 of 32,768 per attempt  |
| `5a2c4cd3` runtime-16      | 16/16 valid: 12 complete, 4 partial; 3,005 of 3,033 requests delivered |
| `5a2c4cd3` original-41     | 41/41 valid: 40 complete, 1 partial; 62 assertion uses, 10 quiet pairs |
| `38ef5717` runtime-16      | 16/16 valid: 7 complete, 9 partial                                     |
| `38ef5717` original-41     | 41/41 valid: 33 complete, 8 partial; 62 assertion uses, 10 quiet pairs |
| `38ef5717` unit suite      | 6,950 passed                                                           |
| `f88074c7` strict capacity | 3/6 complete, kept as a separate offline result                        |

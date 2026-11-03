# Planner work

<!-- CLEANUP (added 2026-11-03): Replace this work-in-progress status after the planner lands and all validation is green. -->

This record separates the published planner from an unlanded whole-planner candidate. The candidate revisions below are available locally; they are not published source links or release certificates.

## Scope and architecture

Published main `583dc787` uses the 80% admission rule in [the current design](../gameplay/design.md#spawning-details). The unlanded whole planner targets an independently certified runtime layout containing at least 90% of the original combined active and auxiliary requests. Optional requests, including rewards, may be omitted. Guaranteed owners, authored kind and role minima, full movement, native safety and quiet coverage remain mandatory. Offline capacity constructs and audits the exact 100% composition independently. Search continues toward 100% within the same shared work allowance.

At the unlanded `9b4c6334` revision, the data flow is:

| Responsibility                                                             | Candidate source                                                                |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Capture zone inputs and replay context                                     | `src/runner/zoneSlotInput.ts`, `zonePlan.ts`                                    |
| Validate configuration, draw kinds and movement, prepare candidate domains | `slotConfig.ts`, `slotJobs.ts`, `slotCandidates.ts`, `slotCandidateDomains.ts`  |
| Construct a path and search compatible assignments                         | `slotPath.ts`, `slotWitnessSearch.ts`, `slotWitnessConstruct.ts`                |
| Check native constraints and conditional proof support                     | `slotConstraintState.ts`, `slotPocketSupport.ts`, `slotConflictCertificates.ts` |
| Independently audit original requests and materialise delivery             | `slotAudit.ts`, `slotDelivery.ts`, `slotPlan.ts`                                |
| Coordinate runtime and independent capacity planning                       | `slotPlanner.ts`                                                                |

Weights, random draws, movement profiles and original request counts remain frozen through the native safety boundary. A conditional refutation needs native attestation before it can prune search. Budget exhaustion or an unfinished prefix is unknown, not a certificate of impossibility or valid partial delivery.

## Qualification snapshot

Counts apply only to the stated source and test collection. They do not transfer to a different tree. The following status is the recorded handoff as of 2026-11-03; the result artifacts must be checked before release decisions.

| Source and scope                    | Recorded result                                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Whole `9b4c6334`, runtime 16        | 12 valid: 6 complete, 6 partial. Four Yonge cases unknown.                                                                                        |
| Whole `9b4c6334`, original 41       | 39 valid: 29 complete, 10 partial. Cabbagetown quiet case 126 and Tall Yonge passable case 169 unknown.                                           |
| Whole `9b4c6334`, strict capacity 6 | Cabbagetown 169, High Park 144 and Kensington 187 complete. Distillery 215, Beaches 198 and Yonge 230 unknown.                                    |
| Whole `9b4c6334`, full suite        | 8,552 passed, 4 failed. The later prize-fixture fix is not included in that result.                                                               |
| Whole-on-main `ac1cb8d8`            | TypeScript, changed-file static checks and 90 focused units passed. Native qualification and a fresh full suite remain incomplete.                |
| Paged `00dfb1c9`                    | Held experiment: runtime 9/16, original 34/41 and capacity 1/6 valid. Full suite: 8,591 passed, 43 failed, 2 hook-pending; all seven bots failed. |

The `ac1cb8d8` candidate includes the whole planner and prize-fixture fix on published main, preserving the Pet shop and approved test reductions. Its source differs from `9b4c6334`, so the earlier counts are not its qualification results. The paged experiment is not a release baseline. A same-source whole-mode comparison at `00dfb1c9` restored 12/16 runtime results.

## Resuming work

1. Identify the exact candidate commit, tree, inputs and applicable check artifacts. Preserve other worktrees and unlanded changes.
2. Review a proposed change against the native safety, frozen input, independent audit and shared-budget contracts above. Synthetic fixtures establish a mechanism; they do not establish original-zone success.
3. Run the explicitly approved bounded original cases on the reviewed exact tree. A valid result requires its independent audit; unknown and exhausted outcomes are not passes. Compare matching inputs and counters without increasing limits or crediting a prefix.
4. Qualify runtime, original cases and exact capacity on the final source, then complete the integrated full gate and exact-commit CI and deployment checks. Do not adopt an experiment or ship a candidate with unresolved required cases.

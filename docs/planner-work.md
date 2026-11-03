# Planner work

<!-- CLEANUP (added 2026-11-03): Replace this work-in-progress status after the planner lands and all validation is green. -->

This record separates the published planner from an unlanded whole-planner candidate. The candidate revisions below are available locally; they are not published source links or release certificates.

## Scope and architecture

Published main `21674733` uses the 80% admission rule in [the current design](../gameplay/design.md#spawning-details). The unlanded whole planner targets an independently certified runtime layout containing at least 90% of the original combined active and auxiliary requests. Optional requests, including rewards, may be omitted. Guaranteed owners, authored kind and role minima, full movement, native safety and quiet coverage remain mandatory. Offline capacity constructs and audits the exact 100% composition independently. Search continues toward 100% within the same shared work allowance.

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

| Source and scope                    | Recorded result                                                                                                            |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Whole `ffdb0f36`, original 41       | 41 valid: 33 complete, 8 partial. All 62 assertion uses and 10 quiet pairs passed.                                         |
| Whole `ffdb0f36`, runtime 16        | 14 valid: 7 complete, 7 partial. Yonge `left-2` and `straight-2` are unknown at the unchanged budget.                      |
| Whole `ffdb0f36`, strict capacity 6 | Cabbagetown 169, High Park 144 and Kensington 187 complete. Distillery 215, Beaches 198 and Yonge 230 unknown.             |
| Whole `ffdb0f36`, full suite        | 6,910 passed, 2 failed, 11 skipped. Missing art environment caused one failure; a walk test and simulator setup timed out. |
| Paged `00dfb1c9`                    | Held experiment: runtime 9/16, original 34/41 and capacity 1/6 valid. It is not a release baseline.                        |

The candidate includes the whole planner, prize-fixture correction, Pet shop and approved test reductions. Published main has since added only this work record and its README pointer. The original 41 result is sealed for `ffdb0f36`; do not transfer it to another source without verifying the tree and relevant inputs.

Both unresolved runtime cases use seed 550993563, zone index 3, 237 requests and a 214-request floor. The `left-2` diagnostic retained 115 requests and all 26 protected owners, with zero quiet excess; it has no delivery certificate. Resume from `ffdb0f36`. The unlanded fill leaf `d57885c7` regressed to 12/16 valid in its fresh runtime batch, with four Yonge cases unknown. Preserve it as a negative experiment and do not promote it or the paged experiment.

## Experiments

Additional strategy experiments are on hold while the runtime 90% candidate and its required regression checks are completed. Necessary-bounds checks found individual full-profile fits for protected owners and no overload in the checked standing-domain subsets or screen-exposure bounds; they prove neither joint feasibility nor impossibility.

## Resuming work

1. Identify the exact candidate commit, tree, inputs and applicable check artifacts. Preserve other worktrees and unlanded changes.
2. Review a proposed change against the native safety, frozen input, independent audit and shared-budget contracts above. Synthetic fixtures establish a mechanism; they do not establish original-zone success.
3. Run the explicitly approved bounded original cases on the reviewed exact tree. A valid result requires its independent audit; unknown and exhausted outcomes are not passes. Compare matching inputs and counters without increasing limits or crediting a prefix.
4. Qualify required runtime and original regression checks on the final source, report offline 100% capacity separately, then complete the integrated full gate and exact-commit CI and deployment checks. Capacity unknown alone does not invalidate an independently audited runtime layout meeting the 90% floor. Unresolved required runtime, native safety, guarantee or regression failures block release.

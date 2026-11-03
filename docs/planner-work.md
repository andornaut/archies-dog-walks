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

The original 41 unknowns are `quiet-03` (Cabbagetown, 126 requests, seed 1, zone index 1) and `passable-13` (Tall Yonge, 169 requests, seed 1, zone index 3). They are distinct from these four runtime Yonge cases, all at zone index 3:

| Case         | Seed      | Requests | 90% floor |
| ------------ | --------- | -------- | --------- |
| `left-1`     | 567771182 | 236      | 213       |
| `left-2`     | 550993563 | 237      | 214       |
| `left-5`     | 634881658 | 237      | 214       |
| `straight-2` | 550993563 | 237      | 214       |

## Experiments

These prototypes use the whole `9b4c6334` source and remain scratch work:

- **Local repair v3:** the first 236-request Yonge case returned unknown at the 32,768 propagation limit. All 26 mandatory owners remained, while the highest count was 46 against a 213 floor. Seven quiet gaps had 49 rows of excess; 148 repairs were dominated by kind-row and lane swaps.
- **Dynamic MRV:** five native fixtures and TypeScript passed. One original Yonge 236-request query on scratch `20bff58e` returned unknown at 32,768 propagation checks, peaking at 154 against the required 213, with no audited delivery.
- **Min-conflicts:** three tests and TypeScript passed for a standing-only mechanism. Moving bodies, quiet coverage and optional omissions remain unqualified.
- **Whole-source index:** an optimisation is in progress for 2,663 measured secondary charges while retaining 16,992 mandatory membership charges.
- **Necessary bounds:** all protected owners had individual full-profile fits on the retained paths for four runtime Yonge and three strict capacity cases. Protected standing-domain subsets and screen-exposure lower bounds showed no overload. These checks prove neither joint feasibility nor impossibility; weighted owner, body, quiet and visibility compatibility remains unresolved.

## Resuming work

1. Identify the exact candidate commit, tree, inputs and applicable check artifacts. Preserve other worktrees and unlanded changes.
2. Review a proposed change against the native safety, frozen input, independent audit and shared-budget contracts above. Synthetic fixtures establish a mechanism; they do not establish original-zone success.
3. Run the explicitly approved bounded original cases on the reviewed exact tree. A valid result requires its independent audit; unknown and exhausted outcomes are not passes. Compare matching inputs and counters without increasing limits or crediting a prefix.
4. Qualify required runtime and original regression checks on the final source, report offline 100% capacity separately, then complete the integrated full gate and exact-commit CI and deployment checks. Capacity unknown alone does not invalidate an independently audited runtime layout meeting the 90% floor. Unresolved required runtime, native safety, guarantee or regression failures block release.

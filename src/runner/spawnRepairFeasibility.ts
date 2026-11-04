import {
  type PlacementRejection as RepairRejection,
  type PlacementResult as RepairInsertResult,
  SpawnBoard,
  type SpawnPlacement as RepairEntry,
} from "./spawnBoard";
import type { PlannedSpawns, SpawnPlan } from "./spawning";

export type {
  SpawnPlacement as RepairEntry,
  PlacementResult as RepairInsertResult,
  PlacementRejection as RepairRejection,
} from "./spawnBoard";
export interface RepairCheckpoint<Kind extends string> {
  readonly entries: readonly RepairEntry<Kind>[];
}

// The validated plan/path/ledger and all compiled entry objects remain immutable.
// Partial mode defers only stretch reachability until mandatory actors are restored.
// Neither mode replaces the independent audit required for final acceptance.
export function createRepairFeasibility<Kind extends string>(
  mode: "complete" | "partial",
  plan: SpawnPlan<Kind>,
  path: PlannedSpawns<Kind>["path"],
  validatedLedger: readonly RepairEntry<Kind>[],
) {
  return {
    without(requestIds: readonly string[]) {
      const excluded = new Set(requestIds);
      let entries = validatedLedger.filter((entry) => !excluded.has(identity(entry)));
      let board = new SpawnBoard(mode, plan, path, undefined, entries);
      const owner = new WeakSet<object>();
      return {
        checkpoint(): RepairCheckpoint<Kind> {
          const checkpoint = { entries };
          owner.add(checkpoint);
          return checkpoint;
        },
        // Reports feasibility without retaining the candidate.
        probeDetailed(entry: RepairEntry<Kind>): RepairInsertResult {
          let failure: RepairRejection | undefined;
          if (
            !board.probe(entry, (value) => {
              failure ??= value;
            })
          ) {
            return {
              accepted: false,
              failure: failure ?? {
                classification: "unattributed",
                conflicts: [],
                rule: "unattributed",
              },
            };
          }
          return { accepted: true };
        },
        restore(checkpoint: RepairCheckpoint<Kind>): void {
          if (!owner.has(checkpoint)) {
            throw new Error("Checkpoint belongs to another repair transaction");
          }
          // Rehydration restores every reservation, including mover/rest/cap state.
          entries = [...checkpoint.entries];
          board = new SpawnBoard(mode, plan, path, undefined, entries);
        },
        tryInsert(entry: RepairEntry<Kind>): boolean {
          if (!board.fits(entry)) {
            return false;
          }
          board.keep(entry);
          entries = [...entries, entry];
          return true;
        },
        tryInsertDetailed(entry: RepairEntry<Kind>): RepairInsertResult {
          let failure: RepairRejection | undefined;
          if (
            !board.probe(entry, (value) => {
              failure ??= value;
            })
          ) {
            return {
              accepted: false,
              failure: failure ?? {
                classification: "unattributed",
                conflicts: [],
                rule: "unattributed",
              },
            };
          }
          board.keep(entry);
          entries = [...entries, entry];
          return { accepted: true };
        },
      };
    },
  };
}
const identity = (entry: RepairEntry<string>) =>
  `${entry.trace.quotaIndex}:${entry.trace.memberIndex}`;

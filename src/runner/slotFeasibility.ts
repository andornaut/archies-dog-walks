import {
  type PlacementRejection,
  type PlacementResult,
  SpawnBoard,
  type SpawnPlacement,
} from "./spawnBoard";
import type { PlannedSpawns, SpawnPlan, SpawnQuota } from "./spawning";

export interface SlotPlacement<Kind extends string> extends SpawnPlacement<Kind> {
  // A slot is bound to a kind only after its complete geometry has been checked.
  readonly request: SpawnQuota<Kind>;
}

// Every accepted prefix is complete: active slots precede capacity-only extras.
export function createSlotFeasibility<Kind extends string>(
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  path: PlannedSpawns<Kind>["path"],
  entries: readonly SlotPlacement<Kind>[] = [],
) {
  const board = new SpawnBoard<Kind>(
    "complete",
    { ...geometry, quotas: [] },
    path,
    (entry) => {
      const request = (entry as SlotPlacement<Kind>).request;
      return request?.count === 1 && entry.trace.memberIndex === 0 ? request : undefined;
    },
    entries,
  );
  const probe = (entry: SlotPlacement<Kind>): PlacementResult => {
    let failure: PlacementRejection | undefined;
    const accepted = board.probe(entry, (reason) => {
      failure ??= reason;
    });
    return accepted
      ? { accepted: true }
      : {
          accepted: false,
          failure: failure ?? {
            classification: "unattributed",
            conflicts: [],
            rule: "unattributed",
          },
        };
  };
  return {
    commit(entry: SlotPlacement<Kind>): PlacementResult {
      const result = probe(entry);
      if (result.accepted) {
        board.keep(entry);
      }
      return result;
    },
    probe,
  };
}

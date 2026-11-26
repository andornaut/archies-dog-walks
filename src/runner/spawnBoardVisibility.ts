import type { SpawnPlacement } from "./spawnBoard.ts";
import type { FeasibilityWitness } from "./spawnFeasibilityDiagnostics.ts";
import { type Cell, quotaFootprint, type SpawnPlan, type SpawnQuota } from "./spawning.ts";
import { type SpawnVisibilityTrace, visibilityRejection } from "./spawnVisibility.ts";

export function createSpawnBoardVisibility<Kind extends string>(
  plan: SpawnPlan<Kind>,
  rows: readonly number[],
  spacing: number,
  entries: readonly SpawnPlacement<Kind>[],
) {
  // A hazard's refusal for sharing the screen with others of its kind (visibilityRejection).
  function visibilityRefusal(trace: SpawnVisibilityTrace): FeasibilityWitness | undefined {
    if (!trace.hazard) {
      return undefined;
    }
    let refusal: FeasibilityWitness | undefined;
    visibilityRejection(
      plan.scrollSpeed * plan.stepSeconds,
      (witness) => {
        refusal = witness;
      },
      entries.filter((entry) => entry.trace.hazard).map((entry) => entry.trace),
      trace,
    );
    return refusal;
  }
  function standingTrace(quota: SpawnQuota<string>, cell: Cell): SpawnVisibilityTrace {
    const entry = rows[cell.row]!,
      until =
        entry + plan.roadLength + (quota.hitLength ?? quotaFootprint(quota).rows * plan.cellLength);
    return {
      entry,
      hazard: quota.hazard ?? quota.blocksLane,
      index: 0,
      kind: quota.kind,
      lane: cell.lane,
      nativeUntil: until,
      row: Math.floor(entry / spacing),
      source: "events",
      until,
    };
  }
  return { standingTrace, visibilityRefusal };
}

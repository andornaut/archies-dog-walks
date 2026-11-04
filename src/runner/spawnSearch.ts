import type { SpawnPlan } from "./spawning";

export interface SpawnSearchContext {
  readonly seed: number;
  readonly zoneIndex: number;
}

// JSON canonicalizes signed zero; null maxEmptyRows represents an unbounded empty-row limit.
export interface SpawnPlanSnapshot<Kind extends string = string> {
  readonly context: SpawnSearchContext;
  readonly draws: { readonly movers: readonly number[]; readonly spawns: readonly number[] };
  readonly plan: Omit<SpawnPlan<Kind>, "maxEmptyRows"> & { readonly maxEmptyRows: number | null };
}

export class SpawnPlanningError extends Error {
  readonly snapshot: SpawnPlanSnapshot;
  constructor(message: string, snapshot: SpawnPlanSnapshot) {
    super(message);
    this.snapshot = snapshot;
    this.name = "SpawnPlanningError";
  }
}

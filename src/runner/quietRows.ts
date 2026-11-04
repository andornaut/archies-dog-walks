import type { SpawnPlan } from "./spawning";

export interface QuietRun {
  first: number;
  last: number;
}

// The most quiet rows a run from first to last of rowCount rows may have: maxEmptyRows; half that,
// rounded down, for a run from the zone's first row or to its last, so a run across the road where
// two zones meet keeps near the cap; and none from the first row of a zone whose rows start on the
// road in view, so something meets the pack soon after it starts.
export function quietAllowed(
  plan: Pick<SpawnPlan<string>, "firstContactSeconds" | "maxEmptyRows">,
  rowCount: number,
  first: number,
  last: number,
): number {
  if (first === 0 && plan.firstContactSeconds !== undefined) {
    return 0;
  }
  return first === 0 || last === rowCount - 1
    ? Math.floor(plan.maxEmptyRows / 2)
    : plan.maxEmptyRows;
}

// The runs of more quiet rows than they may have, rows that come on screen with nothing
// lane-blocking in view (0 in filled), and how many rows they run over it in all.
export function quietRuns(
  plan: Pick<SpawnPlan<string>, "firstContactSeconds" | "maxEmptyRows">,
  filled: Uint8Array,
): { over: number; runs: QuietRun[] } {
  const runs: QuietRun[] = [];
  let over = 0;
  let first = 0;
  for (let row = 0; row <= filled.length; row++) {
    if (row < filled.length && filled[row] === 0) {
      continue;
    }
    const allowed = quietAllowed(plan, filled.length, first, row - 1);
    if (row - first > allowed) {
      runs.push({ first, last: row - 1 });
      over += row - first - allowed;
    }
    first = row + 1;
  }
  return { over, runs };
}

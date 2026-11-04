import { visibleMoverRows } from "./moverCoverage";
import { quietRuns } from "./quietRows";
import type { SlotPlacement } from "./slotFeasibility";
import type { SlotAssignment } from "./slotPlan";
import { blockingSpan, quotaFootprint, rowSpacing, type SpawnPlan, zoneRows } from "./spawning";

// A coverage reservation may use any leading row that preserves the quiet-run bound.
export function coverageLeadingRows<Kind extends string>(
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  coverage: ReturnType<typeof quietRuns>,
): number[] | undefined {
  const run = coverage.runs[0];
  if (run === undefined) {
    return undefined;
  }
  const allowed =
    run.first === 0
      ? geometry.firstContactSeconds === undefined
        ? Math.floor(geometry.maxEmptyRows / 2)
        : 0
      : geometry.maxEmptyRows;
  const last = Math.min(run.last, run.first + allowed);
  return Array.from({ length: last - run.first + 1 }, (_, offset) => last - offset);
}

export function createQuietCoverage<Kind extends string>(
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
) {
  return createQuietCoverageState(geometry).coverage;
}

export function createQuietCoverageState<Kind extends string>(
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
) {
  const cached = new WeakMap<SlotPlacement<Kind>, readonly number[]>();
  const plan = { ...geometry, quotas: [] };
  const spacing = rowSpacing(plan);
  const rows = zoneRows(plan, spacing);
  const coverage = (assignments: readonly Pick<SlotAssignment<Kind>, "entry">[]) => {
    const filled = new Uint8Array(rows.length);
    for (const { entry } of assignments) {
      if (entry.herring || !entry.request.blocksLane) {
        continue;
      }
      if (entry.event.mover !== undefined) {
        let visible = cached.get(entry);
        if (visible === undefined) {
          visible = visibleMoverRows(geometry, rows, entry);
          cached.set(entry, visible);
        }
        for (const row of visible) {
          filled[row] = 1;
        }
        continue;
      }
      // zoneRows may start before zero in the first neighbourhood.
      const first = rows.indexOf(entry.event.distance);
      if (first < 0) {
        continue;
      }
      const last = blockingSpan(plan, spacing, first, quotaFootprint(entry.request).rows).lastRow;
      filled.fill(1, first, last + 1);
    }
    return quietRuns(plan, filled);
  };
  return { coverage, rows, spacing };
}

// Certificates use fresh coverage state rather than allocation's memoised results.
export function quietCoverage<Kind extends string>(
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
  assignments: readonly Pick<SlotAssignment<Kind>, "entry">[],
) {
  return createQuietCoverage(geometry)(assignments);
}

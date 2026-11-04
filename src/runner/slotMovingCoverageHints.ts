import { visibleMoverRows } from "./moverCoverage";
import type { PreparedSlotKind } from "./slotCandidates";
import type { SlotPlacement } from "./slotFeasibility";
import { rowSpacing, type SpawnPlan } from "./spawning";

interface HintWork {
  propagate(): boolean;
  stopped?(): boolean;
}

// A sampled native template supplies ordering hints, never admission or domain evidence.
export function createMovingCoverageHints<Kind extends string>(
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
) {
  const spacing = rowSpacing({ ...geometry, quotas: [] });
  const cached = new WeakMap<PreparedSlotKind<Kind>, readonly number[]>();
  return (
    work: HintWork,
    leading: readonly number[],
    rows: readonly number[],
    source: PreparedSlotKind<Kind>,
  ): readonly number[] | undefined => {
    const inspect = () => !work.stopped?.() && work.propagate() && !work.stopped?.();
    if (source.herring || !source.request.blocksLane || source.request.mover === undefined) {
      return rows;
    }
    let offsets = cached.get(source);
    if (offsets === undefined) {
      if (!inspect()) {
        return undefined;
      }
      const placement = source.placements[0];
      if (placement === undefined) {
        return rows;
      }
      const first = Math.ceil(placement.appears / spacing);
      const last = Math.ceil(placement.screen[1] / spacing) - 1;
      if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last)) {
        return rows;
      }
      const entry: SlotPlacement<Kind> = {
        event: {
          distance: placement.appears,
          kind: source.request.kind,
          lane: placement.lane,
          mover: placement.path,
        },
        herring: source.herring,
        request: source.request,
        trace: {
          entry: placement.appears,
          hazard: source.request.hazard ?? source.request.blocksLane,
          index: 0,
          kind: source.request.kind,
          lane: placement.lane,
          memberIndex: 0,
          nativeUntil: placement.screen[1],
          quotaIndex: 0,
          row: 0,
          source: "events",
          until: placement.screen[1],
        },
      };
      const visible: number[] = [];
      for (let offset = first; offset <= last; offset++) {
        if (!inspect()) {
          return undefined;
        }
        if (visibleMoverRows(geometry, [offset * spacing], entry).length > 0) {
          visible.push(offset);
        }
      }
      offsets = visible;
      cached.set(source, offsets);
    }
    const preferred = new Set<number>();
    for (const row of leading) {
      for (const offset of offsets) {
        if (!inspect()) {
          return undefined;
        }
        preferred.add(row - offset);
      }
    }
    const first: number[] = [];
    const later: number[] = [];
    for (const row of rows) {
      if (!inspect()) {
        return undefined;
      }
      (preferred.has(row) ? first : later).push(row);
    }
    return [...first, ...later];
  };
}

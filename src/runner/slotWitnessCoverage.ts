import { visibleMoverRows } from "./moverCoverage.ts";
import type { SlotCandidate } from "./slotCandidateDomains.ts";
import { coverageLeadingRows, createQuietCoverageState } from "./slotCoverage.ts";
import { createMovingCoverageHints } from "./slotMovingCoverageHints.ts";
import type { SlotWitnessBudget, SlotWitnessConstructPorts } from "./slotWitnessConstructTypes.ts";
import { blockingSpan, quotaFootprint, type SpawnPlan } from "./spawning.ts";

// Quiet-row hints and their caches belong to a single construction attempt.
export function createWitnessCoverage<Kind extends string>(
  ports: Pick<SlotWitnessConstructPorts<Kind, unknown>, "entries">,
  budget: Pick<SlotWitnessBudget, "charge" | "stopped">,
  geometry: Omit<SpawnPlan<Kind>, "quotas">,
) {
  const { charge, stopped } = budget;
  const {
    coverage,
    rows: coverageRows,
    spacing: coverageSpacing,
  } = createQuietCoverageState(geometry);
  const movingCoverageRows = createMovingCoverageHints(geometry);
  const coveragePlan = { ...geometry, quotas: [] };
  let distanceRows: Map<number, number> | undefined;
  const fixedAnchors = new Map<number, ReadonlyMap<number, readonly number[]>>();
  const rowsByDistance = () => {
    if (distanceRows !== undefined) {
      return distanceRows;
    }
    const result = new Map<number, number>();
    for (const [row, distance] of coverageRows.entries()) {
      if (!charge()) {
        return undefined;
      }
      result.set(distance, row);
    }
    distanceRows = result;
    return result;
  };
  const anchorsFor = (footprintRows: number) => {
    const cached = fixedAnchors.get(footprintRows);
    if (cached !== undefined) {
      return cached;
    }
    const result = new Map<number, number[]>();
    for (let first = 0; first < coverageRows.length; first++) {
      if (!charge()) {
        return undefined;
      }
      const last = blockingSpan(coveragePlan, coverageSpacing, first, footprintRows).lastRow;
      for (let row = first; row <= last && row < coverageRows.length; row++) {
        if (!charge()) {
          return undefined;
        }
        const anchors = result.get(row) ?? [];
        anchors.push(first);
        result.set(row, anchors);
      }
    }
    fixedAnchors.set(footprintRows, result);
    return result;
  };
  const coversLeading = (candidate: SlotCandidate<Kind>, leading: readonly number[]) => {
    const entry = candidate.entry;
    if (entry.herring || !entry.request.blocksLane) {
      return false;
    }
    if (entry.event.mover !== undefined) {
      for (const row of leading) {
        if (!charge()) {
          return false;
        }
        if (visibleMoverRows(geometry, [coverageRows[row]!], entry).length > 0) {
          return true;
        }
      }
      return false;
    }
    const first = rowsByDistance()?.get(entry.event.distance);
    if (first === undefined) {
      return false;
    }
    const last = blockingSpan(
      coveragePlan,
      coverageSpacing,
      first,
      quotaFootprint(entry.request).rows,
    ).lastRow;
    for (const row of leading) {
      if (!charge()) {
        return false;
      }
      if (first <= row && row <= last) {
        return true;
      }
    }
    return false;
  };
  const leadingRows = () =>
    stopped() ? undefined : coverageLeadingRows(geometry, coverage(ports.entries()));
  return { anchorsFor, coversLeading, leadingRows, movingCoverageRows };
}

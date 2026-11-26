import { moverReservationsMayShare, type MoverVisibilityProof } from "./moverSpots.ts";
import { ridersMeet } from "./riderSpans.ts";
import {
  type BlockingPlace,
  hitLength,
  lastHitRow,
  moverRestSpans,
  packFitsOnPath,
  type PathChange,
  quotaFootprint,
  type SpawnEvent,
  type SpawnPlan,
  type SpawnQuota,
  WIDE_LANES,
} from "./spawning.ts";
import type { SpawnFinding } from "./spawnValidation.ts";
import type { SpawnVisibility } from "./spawnVisibility.ts";

export interface AuditedCell {
  finding: SpawnFinding;
  first: number;
  last: number;
  lane: number;
  lanes: number;
  quota: SpawnQuota<string>;
}

export interface AuditedMover {
  finding: SpawnFinding;
  proof: MoverVisibilityProof;
  quota: SpawnQuota<string>;
  event: SpawnEvent<string>;
}

export interface AuditedPlace {
  finding: SpawnFinding;
  place: BlockingPlace;
}

export interface AuditedVisibility {
  finding: SpawnFinding;
  shown: SpawnVisibility;
}

export function auditMoverPairs(
  plan: SpawnPlan<string>,
  rows: readonly number[],
  cells: readonly AuditedCell[],
  moving: readonly AuditedMover[],
): void {
  for (const move of moving) {
    for (const standing of cells) {
      const body = move.proof.body;
      const standingEntry = rows[standing.first]!;
      const standingExit = standingEntry + hitLength(plan, quotaFootprint(standing.quota).rows);
      if (
        standing.quota.blocksLane &&
        body !== undefined &&
        body.from < standingExit &&
        standingEntry < body.to &&
        body.lanes.first < standing.lane + standing.lanes &&
        standing.lane < body.lanes.first + body.lanes.count
      ) {
        move.finding.reasons.push("moving body intersects standing footprint");
        standing.finding.reasons.push("standing footprint intersects moving body");
      }
    }
  }
  const occupiedBy = (move: AuditedMover, standing: AuditedCell) =>
    move.proof.cells.some(
      (cell) =>
        cell.row >= standing.first &&
        cell.row <= standing.last &&
        cell.lane >= standing.lane &&
        cell.lane < standing.lane + standing.lanes,
    );
  for (const move of moving) {
    for (const standing of cells) {
      if (
        !standing.quota.blocksLane &&
        occupiedBy(move, standing) &&
        (standing.quota.moversPassOver !== true || !move.quota.blocksLane)
      ) {
        move.finding.reasons.push("moving reservation intersects standing pickup");
        standing.finding.reasons.push("standing pickup intersects moving reservation");
      }
      if (
        !standing.quota.blocksLane &&
        standing.quota.moversRestOn !== true &&
        move.event.mover !== undefined &&
        moverRestSpans(plan, move.quota.mover!, move.event).some(
          (rest) =>
            rest.lane < standing.lane + standing.lanes &&
            standing.lane < rest.lane + rest.lanes &&
            rest.distance < rows[standing.last]! + hitLength(plan, 1) &&
            rows[standing.first]! < rest.distance + rest.length,
        )
      ) {
        move.finding.reasons.push("moving rest intersects pickup");
        standing.finding.reasons.push("pickup intersects moving rest");
      }
    }
  }
  for (const [index, a] of moving.entries()) {
    for (const b of moving.slice(index + 1)) {
      const am = a.event.mover!,
        bm = b.event.mover!;
      const shared = a.proof.cells.some((cell) =>
        b.proof.cells.some((other) => cell.row === other.row && cell.lane === other.lane),
      );
      const allowed = moverReservationsMayShare(
        am.motion,
        bm.motion,
        a.quota.blocksLane,
        b.quota.blocksLane,
      );
      if (shared && !allowed) {
        a.finding.reasons.push("moving reservations overlap");
        b.finding.reasons.push("moving reservations overlap");
      }
      if (
        am.motion === "ride" &&
        bm.motion === "ride" &&
        a.quota.blocksLane &&
        b.quota.blocksLane
      ) {
        const rider = (move: typeof a) => {
          const path = move.event.mover!;
          if (path.motion !== "ride") {
            throw new Error("Expected rider");
          }
          const footprint = quotaFootprint(move.quota);
          const length = Math.max(
            footprint.rows * plan.cellLength - 2 * plan.cellInset,
            move.quota.mover?.hitLength ?? 0,
          );
          return {
            from: move.event.distance + path.warning,
            lanes: ((1 << move.proof.block.lanes.count) - 1) << move.proof.block.lanes.first,
            length,
            speed: path.speedMultiplier,
            to:
              move.event.distance +
              path.warning +
              (plan.roadLength + length) / path.speedMultiplier,
          };
        };
        if (ridersMeet(plan.riderFollowGap, rider(a), rider(b))) {
          a.finding.reasons.push("rider following clearance");
          b.finding.reasons.push("rider following clearance");
        }
      }
    }
  }
}

export function auditStandingPairs(
  plan: SpawnPlan<string>,
  spacing: number,
  cells: readonly AuditedCell[],
): void {
  for (const [index, a] of cells.entries()) {
    for (const b of cells.slice(index + 1)) {
      if (
        a.quota.blocksLane &&
        b.quota.blocksLane &&
        a.lanes >= WIDE_LANES &&
        b.lanes >= WIDE_LANES
      ) {
        const aLast = lastHitRow(
          plan,
          spacing,
          { lane: a.lane, row: a.first },
          quotaFootprint(a.quota),
        );
        const bLast = lastHitRow(
          plan,
          spacing,
          { lane: b.lane, row: b.first },
          quotaFootprint(b.quota),
        );
        if (a.first <= bLast + 1 && b.first <= aLast + 1) {
          a.finding.reasons.push("wide footprints need a separating row");
          b.finding.reasons.push("wide footprints need a separating row");
        }
      }
      if (
        a.first <= b.last &&
        b.first <= a.last &&
        a.lane < b.lane + b.lanes &&
        b.lane < a.lane + a.lanes
      ) {
        a.finding.reasons.push("standing footprints overlap");
        b.finding.reasons.push("standing footprints overlap");
      }
    }
  }
}

export function auditReactionGaps(
  plan: SpawnPlan<string>,
  changes: readonly PathChange[],
  places: readonly AuditedPlace[],
): void {
  for (const [index, a] of places.entries()) {
    for (const b of places.slice(index + 1)) {
      if (!packFitsOnPath(plan, changes, a.place, b.place)) {
        a.finding.reasons.push("insufficient pack-fit reaction gap");
        b.finding.reasons.push("insufficient pack-fit reaction gap");
      }
    }
  }
}

export function auditVisibilityPairs(
  plan: SpawnPlan<string>,
  intervals: readonly AuditedVisibility[],
): void {
  // Independent interval sweep: half-open intervals, exits before entries at ties.
  const tick = plan.scrollSpeed * plan.stepSeconds;
  for (const [index, incoming] of intervals.entries()) {
    const same = intervals.filter((other) => other.shown.kind === incoming.shown.kind);
    if (
      same.filter(
        (other) =>
          other.shown.entry <= incoming.shown.entry && incoming.shown.entry < other.shown.until,
      ).length > 2
    ) {
      for (const other of same) {
        if (other.shown.entry <= incoming.shown.entry && incoming.shown.entry < other.shown.until) {
          other.finding.reasons.push("more than two logical groups of one kind visible");
        }
      }
    }
    for (const other of intervals.slice(index + 1)) {
      const a = incoming.shown;
      const b = other.shown;
      if (a.kind !== b.kind || a.entry >= b.until || b.entry >= a.until) {
        continue;
      }
      const conflicts = [
        ...(a.row === b.row ? ["overlapping same-kind spawn row"] : []),
        ...(a.lane === b.lane ? ["overlapping same-kind leftmost lane"] : []),
        ...(Math.abs(Math.max(0, a.entry) - Math.max(0, b.entry)) < tick
          ? ["overlapping same-kind entry tick"]
          : []),
      ];
      incoming.finding.reasons.push(...conflicts);
      other.finding.reasons.push(...conflicts);
    }
  }
}

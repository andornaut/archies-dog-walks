import { laneMask } from "../layout/index.ts";
import type { MoverBody, MoverGeometry } from "./moverModel.ts";
import { type OnScreen, onScreenOf } from "./moverScreen.ts";
import { ridersMeet, type RiderSpan, riderSpanOf } from "./riderSpans.ts";
import type { PlacementRejection, SpawnPlacement } from "./spawnBoard.ts";
import { placementIdentity, spotForPlacement } from "./spawnBoardSpots.ts";
import type { FeasibilityWitness } from "./spawnFeasibilityDiagnostics.ts";
import { holdMoverRests, sharesRoad } from "./spawnFeasibilityRules.ts";
import {
  blockingPlace,
  blockingSpan,
  type Cell,
  type Footprint,
  hitLength,
  lastHitRow,
  lastRowTaken,
  moverRestSpans,
  pickupAllowsMover,
  quotaFootprint,
  type SpawnPlan,
  type SpawnQuota,
  WIDE_LANES,
} from "./spawning.ts";
import type { SpawnVisibilityTrace } from "./spawnVisibility.ts";

interface ConflictContext<Kind extends string> {
  readonly bodies: readonly MoverBody[];
  readonly entries: readonly SpawnPlacement<Kind>[];
  readonly geometry: MoverGeometry;
  readonly plan: SpawnPlan<Kind>;
  readonly quotaFor: (entry: SpawnPlacement<Kind>) => SpawnQuota<Kind> | undefined;
  readonly riders: readonly RiderSpan[];
  readonly rows: readonly number[];
  readonly spacing: number;
  readonly visibilityRefusal: (trace: SpawnVisibilityTrace) => FeasibilityWitness | undefined;
}

// Read the board's current ledgers through the same arrays that its marks restore.
export function createSpawnBoardConflicts<Kind extends string>(context: ConflictContext<Kind>) {
  const { bodies, entries, geometry, plan, quotaFor, riders, rows, spacing, visibilityRefusal } =
    context;

  // A standing spawn's refusal for sharing road with a planned mover's body.
  function moverBodyRefusal(cell: Cell, footprint: Footprint): FeasibilityWitness | undefined {
    const from = rows[cell.row]!,
      to = from + hitLength(plan, footprint.rows);
    const meets = (body: MoverBody) =>
      sharesRoad(
        { ...body, lanes: laneMask(body.lanes.first, body.lanes.count) },
        { from, lanes: laneMask(cell.lane, footprint.lanes), to },
      );
    if (!bodies.some(meets)) {
      return undefined;
    }
    return {
      requests: entries
        .filter((other) => {
          const body = other.trace.placement?.body;
          return body !== undefined && meets(body);
        })
        .map(placementIdentity),
      rule: "body",
    };
  }
  // A mover's refusal for showing alongside others of its kind, or for crossing or resting on a
  // standing pickup that does not allow it (pickupAllowsMover).
  function moverShowRefusal(
    quota: SpawnQuota<Kind>,
    entry: SpawnPlacement<Kind>,
    cells: Parameters<typeof pickupAllowsMover>[1]["cells"],
  ): FeasibilityWitness | undefined {
    const hidden = visibilityRefusal(entry.trace);
    if (hidden !== undefined) {
      return hidden;
    }
    const refused = entries.find((other) => {
      const q = quotaFor(other);
      if (other.herring || other.event.mover !== undefined || q === undefined || q.blocksLane) {
        return false;
      }
      const footprint = quotaFootprint(q),
        row = rows.indexOf(other.event.distance),
        last = lastRowTaken(plan, spacing, { lane: other.event.lane, row }, footprint, false);
      return !pickupAllowsMover(
        {
          firstRow: row,
          from: other.event.distance,
          lane: other.event.lane,
          lanes: footprint.lanes,
          lastRow: last,
          moversPassOver: q.moversPassOver === true,
          moversRestOn: q.moversRestOn === true,
          to: rows[last]! + hitLength(plan, 1),
        },
        {
          blocksLane: quota.blocksLane,
          cells,
          rests: moverRestSpans(plan, quota.mover!, entry.event),
        },
      );
    });
    return refused === undefined
      ? undefined
      : { requests: [placementIdentity(refused)], rule: "pickup" };
  }
  // A mover body's refusal for sharing road with a lane-blocking standing spawn.
  function standingBodyRefusal(body: MoverBody): FeasibilityWitness | undefined {
    const refused = entries.find((other) => {
      const q = quotaFor(other);
      if (other.herring || other.event.mover !== undefined || !q?.blocksLane) {
        return false;
      }
      const footprint = quotaFootprint(q),
        from = other.event.distance,
        to = from + hitLength(plan, footprint.rows);
      return sharesRoad(
        { ...body, lanes: laneMask(body.lanes.first, body.lanes.count) },
        { from, lanes: laneMask(other.event.lane, footprint.lanes), to },
      );
    });
    return refused === undefined
      ? undefined
      : { requests: [placementIdentity(refused)], rule: "body" };
  }
  // A lane-blocking rider's refusal for following another too closely (ridersMeet).
  function riderRefusal(ride: RiderSpan): FeasibilityWitness | undefined {
    if (riders.every((other) => !ridersMeet(plan.riderFollowGap, ride, other))) {
      return undefined;
    }
    const other = riders.find((placed) => ridersMeet(plan.riderFollowGap, ride, placed))!;
    return {
      requests: entries
        .filter((entry) => {
          const quota = quotaFor(entry),
            spot = spotForPlacement(rows, entry, true);
          if (!quota?.blocksLane || quota.mover === undefined || spot === undefined) {
            return false;
          }
          const span = riderSpanOf(geometry, quota.mover, entry.event.distance, spot.placement);
          return (
            span !== undefined &&
            Object.entries(span).every(([key, value]) => Reflect.get(other, key) === value)
          );
        })
        .map(placementIdentity),
      rule: "rider-gap",
    };
  }
  function rejection(
    candidate: SpawnPlacement<Kind> | undefined,
    witness: FeasibilityWitness,
  ): PlacementRejection {
    const conflicts = conflictOwners(candidate, witness);
    const candidateOnlyLanes =
      witness.rule === "open-lanes" &&
      witness.requests === undefined &&
      witness.contributors === undefined &&
      candidate !== undefined &&
      blocksOpenRow(candidate, witness) === true &&
      entries.every((entry) => blocksOpenRow(entry, witness) === false);
    return {
      classification:
        witness.intrinsic === true || candidateOnlyLanes
          ? "intrinsic"
          : conflicts.length > 0
            ? "conflict"
            : "unattributed",
      conflicts,
      rule: witness.rule,
      witness: {
        ...(witness.row === undefined ? {} : { row: witness.row }),
        ...(witness.moment === undefined ? {} : { moment: witness.moment }),
      },
    };
  }

  // Lane-count failures are unary only when the failed row has no committed block.
  // Use the same native span for owner attribution and the absence proof.
  function blocksOpenRow(
    entry: SpawnPlacement<Kind>,
    witness: FeasibilityWitness,
  ): boolean | undefined {
    const quota = quotaFor(entry);
    if (quota === undefined || witness.row === undefined) {
      return undefined;
    }
    if (!quota.blocksLane || entry.herring) {
      return false;
    }
    const footprint = quotaFootprint(quota);
    const row = entry.trace.placement?.block.row ?? rows.indexOf(entry.event.distance);
    const footprintRows = entry.trace.placement?.block.rows ?? footprint.rows;
    if (
      !Number.isSafeInteger(row) ||
      row < 0 ||
      !Number.isSafeInteger(footprintRows) ||
      footprintRows <= 0
    ) {
      return undefined;
    }
    const span = blockingSpan(plan, spacing, row, footprintRows);
    return (
      witness.row >= row && witness.row <= (witness.gap === true ? span.lastGap : span.lastRow)
    );
  }

  function conflictOwners(
    candidate: SpawnPlacement<Kind> | undefined,
    witness: FeasibilityWitness,
  ): string[] {
    if (witness.intrinsic === true) {
      return [];
    }
    // An elsewhere wall can repair a dart stretch by moving into it. Its dependency
    // therefore includes the whole prefix, not only current failed-row contributors.
    if (witness.rule === "open-stretches") {
      return [...new Set(entries.map(placementIdentity))];
    }
    if (witness.requests !== undefined) {
      return [...new Set(witness.requests)];
    }
    const matches = entries.filter((entry) => {
      const quota = quotaFor(entry);
      if (quota === undefined) {
        return false;
      }
      if (witness.contributors !== undefined) {
        if (witness.contributors.includes(entry.trace)) {
          return true;
        }
        if (
          witness.rule === "screen-cap" &&
          candidate !== undefined &&
          !entry.herring &&
          entry.event.mover !== undefined &&
          quota.blocksLane === quotaFor(candidate)?.blocksLane
        ) {
          const screen = onScreenOf(
            entry.event.mover,
            entry.trace.placement?.screen ?? [entry.trace.entry, entry.trace.nativeUntil],
          );
          return witness.contributors.some((raw) => {
            const other = raw as OnScreen;
            return (
              other.dart === screen.dart &&
              other.slowVehicle === screen.slowVehicle &&
              other.interval[0] === screen.interval[0] &&
              other.interval[1] === screen.interval[1]
            );
          });
        }
        if (witness.rule === "pack-gap" && quota.blocksLane && !entry.herring) {
          const places =
            entry.event.mover === undefined
              ? [
                  blockingPlace(
                    plan,
                    rows,
                    quota,
                    { lane: entry.event.lane, row: rows.indexOf(entry.event.distance) },
                    quotaFootprint(quota),
                  ),
                ]
              : (entry.trace.placement?.stands ?? []);
          return places.some((place) =>
            witness.contributors!.some((raw) =>
              Object.entries(place).every(([key, value]) => Reflect.get(raw, key) === value),
            ),
          );
        }
        return false;
      }
      if (witness.rule === "rider-gap") {
        return quota.blocksLane && entry.event.mover?.motion === "ride";
      }
      if (witness.rule === "reservation") {
        return !entry.herring;
      }
      if (witness.row === undefined || entry.herring) {
        return false;
      }
      const footprint = quotaFootprint(quota);
      const row = entry.trace.placement?.block.row ?? rows.indexOf(entry.event.distance);
      if (witness.rule === "open-lanes") {
        return blocksOpenRow(entry, witness) === true;
      }
      if (witness.rule === "wide-gap") {
        return (
          quota.blocksLane &&
          entry.event.mover === undefined &&
          footprint.lanes >= WIDE_LANES &&
          row <= (witness.lastRow ?? witness.row) + 1 &&
          lastHitRow(plan, spacing, { lane: entry.event.lane, row }, footprint) >= witness.row - 1
        );
      }
      if (witness.rule !== "cells" || witness.mask === undefined) {
        return false;
      }
      if (entry.event.mover === undefined) {
        return (
          witness.row >= row &&
          witness.row <=
            lastRowTaken(
              plan,
              spacing,
              { lane: entry.event.lane, row },
              footprint,
              quota.blocksLane,
            ) &&
          (laneMask(entry.event.lane, footprint.lanes) & witness.mask) !== 0
        );
      }
      if (
        entry.trace.placement?.cells.some(
          (cell) => cell.row === witness.row && (laneMask(cell.lane, 1) & witness.mask!) !== 0,
        )
      ) {
        return true;
      }
      const distance = rows[witness.row];
      if (distance === undefined) {
        return false;
      }
      let held = false;
      holdMoverRests(
        plan,
        [distance],
        {
          holdRest: (_row, mask) => {
            held ||= (mask & witness.mask!) !== 0;
          },
        },
        quota.mover!,
        entry.event,
      );
      return held;
    });
    return [...new Set(matches.map(placementIdentity))];
  }

  return { moverBodyRefusal, moverShowRefusal, rejection, riderRefusal, standingBodyRefusal };
}

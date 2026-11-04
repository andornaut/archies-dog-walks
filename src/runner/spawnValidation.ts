import type { MovementKind } from "../data/types.ts";
import { isHerring } from "./dartOutcomes.ts";
import {
  alternativeLanesOpen,
  deterministicOccupancyMasks,
  reactiveLaneMasks,
} from "./laneAlternatives.ts";
import { DART_LIFTS, moverRetries } from "./moverDraws.ts";
import { type MoverDraws } from "./moverModel.ts";
import { onScreenOf } from "./moverScreen.ts";
import { moverReservationsMayShare, type MoverVisibilityProof } from "./moverSpots.ts";
import { ridersMeet } from "./riderSpans.ts";
import {
  signatureFinishClearance,
  signaturePlace,
  type SignatureSweep,
  signatureSweeps,
  signatureTravelSweeps,
} from "./signaturePaths.ts";
import {
  blockingLength,
  type BlockingPlace,
  blockingSpan,
  hitLength,
  lastHitRow,
  lastRowTaken,
  moverRestSpans,
  packFitsOnPath,
  pathChanges,
  pathHeldLanes,
  pathReach,
  type PlannedSpawns,
  quotaFootprint,
  rowSpacing,
  type SpawnEvent,
  type SpawnPlan,
  type SpawnQuota,
  WIDE_LANES,
  zoneRows,
} from "./spawning.ts";
import { auditHerringGeometry, auditMoverGeometry } from "./spawnMoverValidation.ts";
import type { SpawnVisibility, SpawnVisibilityTrace } from "./spawnVisibility.ts";
import { rowsWithin, WHOLE_ZONE } from "./stretches.ts";

export interface SpawnFinding {
  readonly source: "events" | "herrings";
  readonly index: number;
  readonly reasons: string[];
  readonly coverage: string[];
}

export interface SpawnAuditCount {
  readonly kind: string;
  readonly movement: MovementKind | null;
  requested: number;
  emitted: number;
  validPlaced: number;
}

export interface SpawnAudit {
  readonly counts: readonly SpawnAuditCount[];
  readonly findings: readonly SpawnFinding[];
  readonly minimumPlaced: number;
  readonly missingCoverage: readonly string[];
  readonly placed: number;
  readonly requested: number;
  readonly validPlaced: number;
  readonly meetsPlacementFloor: boolean;
  readonly meetsValidPlacementFloor: boolean;
  readonly status: "invalid" | "unverified" | "valid";
  readonly violations: readonly string[];
}

type LocalAudit = { readonly reasons: readonly string[]; readonly coverage: readonly string[] };

function preparePath<Kind extends string>(
  plan: SpawnPlan<Kind>,
  path: PlannedSpawns<Kind>["path"],
) {
  const spacing = rowSpacing(plan);
  const rows = zoneRows(plan, spacing);
  const matches =
    path.length === rows.length &&
    path.every(
      (row, index) =>
        row.distance === rows[index] &&
        Number.isInteger(row.lane) &&
        row.lane >= 0 &&
        row.lane < plan.laneCount,
    );
  return {
    changes: matches
      ? pathChanges(
          rows,
          path.map((row) => row.lane),
        )
      : [],
    held: pathHeldLanes(path.map((row) => row.lane)),
    matches,
    rows,
    spacing,
  };
}

// Audits emitted groups, never admission claims. An interval trace is evidence for
// overlap checks, not proof that a moving body's actual route stays inside it.
export function auditSpawnPlan<Kind extends string>(
  plan: SpawnPlan<Kind>,
  planned: PlannedSpawns<Kind>,
  visibility: readonly SpawnVisibilityTrace[] = planned.visibility,
): SpawnAudit {
  return auditPlan(plan, planned, visibility, preparePath(plan, planned.path));
}

function auditPlan<Kind extends string>(
  plan: SpawnPlan<Kind>,
  planned: PlannedSpawns<Kind>,
  visibility: readonly SpawnVisibilityTrace[],
  prepared: ReturnType<typeof preparePath<Kind>>,
): SpawnAudit {
  const counts: SpawnAuditCount[] = [];
  for (const quota of plan.quotas) {
    const movement = quota.mover?.movement ?? null;
    let count = counts.find((item) => item.kind === quota.kind && item.movement === movement);
    if (count === undefined) {
      count = { emitted: 0, kind: quota.kind, movement, requested: 0, validPlaced: 0 };
      counts.push(count);
    }
    count.requested += quota.count;
  }
  const { changes, held, matches: pathMatches, rows, spacing } = prepared;
  const violations: string[] = [];
  if (!pathMatches || (planned.path[0]?.lane ?? plan.pathStart) !== plan.pathStart) {
    violations.push("invalid guaranteed-path rows or start lane");
  }
  if (
    planned.path.some(
      (row, index) =>
        index > 0 && Math.abs(row.lane - planned.path[index - 1]!.lane) > pathReach(plan),
    )
  ) {
    violations.push("guaranteed path exceeds steering/reaction reach");
  }
  const entries = (["events", "herrings"] as const).flatMap((source) =>
    planned[source].map((event, index) => ({
      event,
      finding: { coverage: [], index, reasons: [], source } satisfies SpawnFinding as SpawnFinding,
    })),
  );
  const usedRequests = new Map<string, SpawnFinding>();
  if (visibility.length > 0) {
    for (const shown of visibility) {
      const trace = shown as Partial<SpawnAuditTrace>;
      if (
        trace.source === undefined ||
        trace.index === undefined ||
        planned[trace.source]?.[trace.index] === undefined
      ) {
        violations.push("extra or unbound visibility trace");
      }
    }
  }
  const places: { finding: SpawnFinding; place: BlockingPlace }[] = [];
  const cells: {
    finding: SpawnFinding;
    first: number;
    last: number;
    lane: number;
    lanes: number;
    quota: SpawnQuota<string>;
  }[] = [];
  const intervals: { finding: SpawnFinding; shown: SpawnVisibility }[] = [];
  const moving: {
    finding: SpawnFinding;
    proof: PlacementProof;
    quota: SpawnQuota<string>;
    event: SpawnEvent<string>;
  }[] = [];
  for (const { event, finding } of entries) {
    const movement = event.mover?.movement ?? null;
    const count = counts.find((item) => item.kind === event.kind && item.movement === movement);
    let quotas = plan.quotas.filter(
      (quota) => quota.kind === event.kind && (quota.mover?.movement ?? null) === movement,
    );
    if (count === undefined) {
      finding.reasons.push("unrequested kind or movement (including substitutions/downgrades)");
      continue;
    }
    count.emitted += 1;
    const bound = visibility.find((item) => {
      const trace = item as Partial<SpawnAuditTrace>;
      return trace.source === finding.source && trace.index === finding.index;
    }) as SpawnAuditTrace | undefined;
    if (visibility.length > 0) {
      const matches = visibility.filter((item) => {
        const trace = item as Partial<SpawnAuditTrace>;
        return trace.source === finding.source && trace.index === finding.index;
      });
      if (matches.length !== 1 || bound === undefined) {
        finding.coverage.push("missing or ambiguous emitted trace");
        continue;
      }
      if (
        bound.kind !== event.kind ||
        bound.entry !== event.distance ||
        bound.lane !== event.lane
      ) {
        finding.reasons.push("trace event binding mismatch");
        continue;
      }
      if (bound.quotaIndex === undefined || bound.memberIndex === undefined) {
        finding.coverage.push("missing frozen request identity");
        continue;
      }
      const original = plan.quotas[bound.quotaIndex];
      if (
        !Number.isInteger(bound.quotaIndex) ||
        !Number.isInteger(bound.memberIndex) ||
        original === undefined ||
        bound.memberIndex < 0 ||
        bound.memberIndex >= original.count
      ) {
        finding.reasons.push("invalid frozen request identity");
        continue;
      }
      const key = `${bound.quotaIndex}:${bound.memberIndex}`;
      const previous = usedRequests.get(key);
      if (previous !== undefined) {
        previous.reasons.push("duplicate frozen request identity");
        finding.reasons.push("duplicate frozen request identity");
      } else {
        usedRequests.set(key, finding);
      }
    }
    if (bound?.quotaIndex !== undefined) {
      const original = plan.quotas[bound.quotaIndex];
      if (original === undefined || !quotas.includes(original)) {
        finding.reasons.push("trace request identity differs from emitted kind/movement");
        continue;
      }
      quotas = [original];
    } else if (quotas.length > 1) {
      const row = bound?.placement?.block.row ?? rows.indexOf(event.distance);
      quotas = quotas.filter((quota) => {
        const [first, end] = rowsWithin(rows.length, quota.within ?? WHOLE_ZONE);
        return row >= first && row < end;
      });
      const shape = (quota: SpawnQuota<string>) => JSON.stringify({ ...quota, count: 0 });
      if (quotas.length > 1 && quotas.every((quota) => shape(quota) === shape(quotas[0]!))) {
        quotas = quotas.slice(0, 1);
      }
    }
    if (quotas.length !== 1) {
      finding.coverage.push("ambiguous duplicate quota geometry");
      continue;
    }
    const quota = quotas[0]!;
    const footprint = quotaFootprint(quota);
    if (!Number.isFinite(event.distance) || !Number.isFinite(event.lane)) {
      finding.reasons.push("nonfinite emitted coordinates");
      continue;
    }
    if (event.mover !== undefined) {
      const traces = visibility.filter((item) => {
        const trace = item as Partial<SpawnAuditTrace>;
        return trace.source === finding.source && trace.index === finding.index;
      }) as SpawnAuditTrace[];
      const trace = traces[0];
      if (traces.length !== 1 || trace === undefined) {
        finding.coverage.push("missing or ambiguous bound moving visibility trace");
        continue;
      }
      if (
        trace.kind !== event.kind ||
        trace.entry !== event.distance ||
        trace.lane !== event.lane ||
        trace.row !== Math.floor(event.distance / spacing) ||
        !Number.isFinite(trace.nativeUntil) ||
        !Number.isFinite(trace.until) ||
        trace.nativeUntil <= event.distance ||
        trace.until < trace.nativeUntil
      ) {
        finding.reasons.push("moving visibility trace does not bind emitted geometry");
        continue;
      }
      if (quota.hazard ?? quota.blocksLane) {
        intervals.push({ finding, shown: trace });
      }
      const requestedDraws = trace.requestedDraws;
      if (requestedDraws === undefined) {
        finding.coverage.push("missing frozen mover draws");
      } else if (
        quota.mover !== undefined &&
        isHerring(quota.mover, requestedDraws) !== (finding.source === "herrings")
      ) {
        finding.reasons.push("emitted herring outcome differs from frozen request");
      }
      const expectedUntil =
        trace.nativeUntil +
        Math.max(0, plan.roadLength - plan.sightLength) +
        plan.packLength +
        (quota.mover?.hitLength ?? plan.cellLength);
      if (Math.abs(trace.until - expectedUntil) > 1e-6) {
        finding.reasons.push("moving stopped-scenery reservation mismatch");
      }
      if (finding.source === "herrings") {
        const audit = auditHerringGeometry(plan, quota, event, trace.nativeUntil);
        finding.reasons.push(...audit.reasons);
        finding.coverage.push(...audit.coverage);
        const spec = quota.mover;
        if (
          requestedDraws !== undefined &&
          spec?.motion.kind === "cross" &&
          event.mover.motion === "cross"
        ) {
          const speed =
            (spec.motion.lanesPerSecond *
              (1 + spec.variation.speedShare * (2 * requestedDraws.speed - 1))) /
            plan.scrollSpeed;
          if (
            Math.abs(event.mover.lanesPerPixel - speed) > 1e-6 ||
            event.mover.direction !== (requestedDraws.side < 0.5 ? 1 : -1)
          ) {
            finding.reasons.push("herring path differs from frozen mover draws");
          }
        }
        continue;
      }
      const proof = trace.placement;
      if (proof !== undefined) {
        const [first, end] = rowsWithin(rows.length, quota.within ?? WHOLE_ZONE);
        if (proof.block.row < first || proof.block.row >= end) {
          finding.reasons.push("moving spawn outside requested quota span");
        }
      }
      if (proof === undefined) {
        finding.coverage.push(
          "moving route/body/path geometry",
          "moving visibility interval geometry",
        );
        continue;
      }
      if (proof.selection === undefined) {
        finding.coverage.push("missing selected mover draws/lift");
      } else if (requestedDraws !== undefined && quota.mover !== undefined) {
        const permitted = [requestedDraws, ...moverRetries(quota.mover, requestedDraws)];
        if (!permitted.some((draws) => sameDraws(draws, proof.selection!.draws))) {
          finding.reasons.push("selected mover draws are not an allowed frozen-request retry");
        }
        if (
          proof.selection.lift !== 0 &&
          (quota.mover.motion.kind !== "cross" ||
            !DART_LIFTS.some((lift) => lift === proof.selection!.lift))
        ) {
          finding.reasons.push("selected mover lift is not an allowed retry");
        }
      }
      const audit: LocalAudit =
        event.mover!.motion === "signature"
          ? { coverage: [], reasons: signatureProof(plan, quota, event, proof) }
          : auditMoverGeometry(plan, quota, event, proof);
      finding.reasons.push(...audit.reasons);
      finding.coverage.push(...audit.coverage);
      if (
        proof.screen[0] !== trace.entry ||
        proof.screen[1] !== trace.nativeUntil ||
        trace.entry < 0 ||
        trace.nativeUntil > plan.zoneLength
      ) {
        finding.reasons.push("moving screen outside zone or trace interval");
      }
      moving.push({ event, finding, proof, quota });
      if (quota.blocksLane) {
        for (const stand of proof.stands) {
          places.push({ finding, place: stand });
        }
        const block = proof.block;
        const mask = ((1 << block.lanes.count) - 1) << block.lanes.first;
        const { lastGap, lastRow } = blockingSpan(plan, spacing, block.row, block.rows);
        if (
          !Number.isInteger(block.row) ||
          block.row < 0 ||
          block.row >= rows.length ||
          lastRow >= rows.length ||
          lastGap >= rows.length - 1 ||
          block.lanes.first < 0 ||
          block.lanes.first + block.lanes.count > plan.laneCount
        ) {
          finding.reasons.push("moving contact block outside rows or lanes");
        }
        for (
          let row = Math.max(0, block.row);
          row <= Math.min(rows.length - 1, Math.max(lastRow, lastGap));
          row++
        ) {
          if (((held[row] ?? 0) & mask) !== 0) {
            finding.reasons.push("moving contact block obstructs guaranteed path");
          }
        }
      }
      continue;
    }
    if (finding.source === "herrings") {
      finding.reasons.push("herring without a mover path");
    }
    const row = rows.indexOf(event.distance);
    if (
      bound !== undefined &&
      (bound.row !== Math.floor(event.distance / spacing) ||
        Math.abs(
          bound.nativeUntil -
            (event.distance +
              plan.roadLength +
              (quota.hitLength ?? footprint.rows * plan.cellLength)),
        ) > 1e-6 ||
        bound.until !== bound.nativeUntil)
    ) {
      finding.reasons.push("standing visibility interval mismatch");
    }
    const [firstAllowed, endAllowed] = rowsWithin(rows.length, quota.within ?? WHOLE_ZONE);
    if (row < firstAllowed || row >= endAllowed) {
      finding.reasons.push("standing spawn outside requested quota span");
    }
    if (
      row < 0 ||
      !Number.isInteger(event.lane) ||
      event.lane < 0 ||
      event.lane + footprint.lanes > plan.laneCount ||
      lastRowTaken(plan, spacing, { lane: event.lane, row }, footprint, quota.blocksLane) >=
        rows.length
    ) {
      finding.reasons.push("standing footprint outside legal rows or lanes");
    }
    if (row >= 0) {
      cells.push({
        finding,
        first: row,
        lane: event.lane,
        lanes: footprint.lanes,
        last: lastRowTaken(plan, spacing, { lane: event.lane, row }, footprint, quota.blocksLane),
        quota,
      });
    }
    if (quota.blocksLane && row >= 0) {
      places.push({
        finding,
        place: {
          distance: event.distance,
          lane: event.lane,
          lanes: footprint.lanes,
          length: quota.hitLength ?? hitLength(plan, footprint.rows),
        },
      });
      if (!pathMatches) {
        finding.reasons.push("invalid guaranteed path");
      } else {
        const { lastGap, lastRow } = blockingSpan(plan, spacing, row, footprint.rows);
        const lanes = ((1 << footprint.lanes) - 1) << event.lane;
        if (
          lastRow >= rows.length ||
          lastGap >= rows.length - 1 ||
          Array.from(
            { length: Math.max(lastRow, lastGap) - row + 1 },
            (_, offset) => row + offset,
          ).some((index) => ((held[index] ?? 0) & lanes) !== 0)
        ) {
          finding.reasons.push("standing reservation intersects guaranteed path or zone boundary");
        }
      }
    }
    if (quota.hazard ?? quota.blocksLane) {
      intervals.push({
        finding,
        shown: {
          entry: event.distance,
          kind: event.kind,
          lane: event.lane,
          row: Math.floor(event.distance / spacing),
          until:
            event.distance +
            plan.roadLength +
            (quota.hitLength ?? footprint.rows * plan.cellLength),
        },
      });
    }
  }
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
  const occupiedBy = (move: (typeof moving)[number], standing: (typeof cells)[number]) =>
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
  const blocks = [
    ...cells
      .filter((cell) => cell.quota.blocksLane)
      .map((cell) => ({
        alternatives: undefined as readonly number[] | undefined,
        covered: ((1 << cell.lanes) - 1) << cell.lane,
        dart: false,
        finding: cell.finding,
        occupancy: undefined as readonly number[] | undefined,
        row: cell.first,
        rows: quotaFootprint(cell.quota).rows,
      })),
    ...moving
      .filter((move) => move.quota.blocksLane)
      .map((move) => ({
        alternatives: reactiveLaneMasks(move.quota.mover!.footprint.lanes, move.event.mover!),
        covered: ((1 << move.proof.block.lanes.count) - 1) << move.proof.block.lanes.first,
        dart: move.proof.block.dart,
        finding: move.finding,
        occupancy: deterministicOccupancyMasks(
          plan.laneCount,
          move.quota.mover!.footprint.lanes,
          ((1 << move.proof.block.lanes.count) - 1) << move.proof.block.lanes.first,
          move.event.mover!,
        ),
        row: move.proof.block.row,
        rows: move.proof.block.rows,
      })),
  ];
  for (let row = 0; row < rows.length; row++) {
    const window = blocks.filter((block) => {
      const span = blockingSpan(plan, spacing, block.row, block.rows);
      return row >= block.row && row <= span.lastRow;
    });
    const gap = blocks.filter((block) => {
      const span = blockingSpan(plan, spacing, block.row, block.rows);
      return row >= block.row && row <= span.lastGap;
    });
    if (
      !alternativeLanesOpen(plan.laneCount, plan.minOpenLanes, true, window) ||
      !alternativeLanesOpen(plan.laneCount, plan.minOpenLanes, false, gap)
    ) {
      for (const block of new Set([...window, ...gap])) {
        block.finding.reasons.push("insufficient open lanes");
      }
    }
  }
  const screens = moving.map((move) => ({
    move,
    screen: onScreenOf(move.event.mover!, move.proof.screen),
  }));
  for (const { screen } of screens) {
    const active = screens.filter(
      (other) =>
        other.screen.interval[0] <= screen.interval[0] &&
        screen.interval[0] < other.screen.interval[1],
    );
    if (
      active.length > plan.moverCaps.total ||
      active.filter((other) => other.screen.dart).length > plan.moverCaps.darts ||
      active.filter((other) => other.screen.slowVehicle).length > plan.moverCaps.slowVehicles
    ) {
      for (const item of active) {
        item.move.finding.reasons.push("moving screen cap exceeded");
      }
    }
  }
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
  for (const [index, a] of places.entries()) {
    for (const b of places.slice(index + 1)) {
      if (!packFitsOnPath(plan, changes, a.place, b.place)) {
        a.finding.reasons.push("insufficient pack-fit reaction gap");
        b.finding.reasons.push("insufficient pack-fit reaction gap");
      }
    }
  }
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
  if (violations.length > 0) {
    for (const { finding } of entries) {
      finding.reasons.push("invalid guaranteed-path geometry");
    }
  }
  for (const count of counts) {
    if (count.emitted > count.requested) {
      violations.push(`overcount ${count.kind}/${count.movement ?? "standing"}`);
      for (const { event, finding } of entries) {
        if (event.kind === count.kind && (event.mover?.movement ?? null) === count.movement) {
          finding.reasons.push("quota overcount");
        }
      }
    }
    count.validPlaced = entries.filter(
      ({ event, finding }) =>
        event.kind === count.kind &&
        (event.mover?.movement ?? null) === count.movement &&
        finding.reasons.length === 0 &&
        finding.coverage.length === 0,
    ).length;
  }
  const findings = entries.map(({ finding }) => finding);
  const requested = counts.reduce((sum, count) => sum + count.requested, 0);
  const placed = counts.reduce((sum, count) => sum + Math.min(count.requested, count.emitted), 0);
  const validPlaced = counts.reduce((sum, count) => sum + count.validPlaced, 0);
  const missingCoverage = [...new Set(findings.flatMap((finding) => finding.coverage))];
  const invalid = violations.length > 0 || findings.some((finding) => finding.reasons.length > 0);
  return {
    counts,
    findings,
    meetsPlacementFloor: placed * 5 >= requested * 4,
    meetsValidPlacementFloor:
      validPlaced * 5 >= requested * 4 && !invalid && missingCoverage.length === 0,
    minimumPlaced: Math.ceil((requested * 4) / 5),
    missingCoverage,
    placed,
    requested,
    status: invalid ? "invalid" : missingCoverage.length > 0 ? "unverified" : "valid",
    validPlaced,
    violations,
  };
}

type PlacementProof = MoverVisibilityProof;
export type SpawnAuditTrace = SpawnVisibilityTrace;

function signatureProof(
  plan: SpawnPlan<string>,
  quota: SpawnQuota<string>,
  event: SpawnEvent<string>,
  proof: PlacementProof,
): string[] {
  const path = event.mover;
  const spec = quota.mover;
  if (path?.motion !== "signature" || spec?.motion.kind !== "signature") {
    return ["signature movement mismatch"];
  }
  const route = path.route;
  const span = spec.footprint.lanes;
  const window = blockingLength(plan, 1);
  const height = Math.max(
    spec.footprint.rows * plan.cellLength,
    spec.hitLength ?? window - plan.packLength + (spec.footprint.rows - 1) * plan.cellLength,
  );
  const spacing = rowSpacing(plan);
  const rows = zoneRows(plan, spacing);
  const inset = plan.laneInset / plan.cellLength;
  const reasons: string[] = [];
  const near = (a: number, b: number) =>
    Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-6;
  if (JSON.stringify(route.profile) !== JSON.stringify(spec.motion.profile)) {
    reasons.push("signature profile differs from frozen quota");
  }
  if (
    !near(route.scrollSpeed, plan.scrollSpeed) ||
    !Number.isFinite(route.complete) ||
    route.complete < route.entryEnd ||
    !Number.isFinite(route.entryEnd) ||
    route.legs.length === 0 ||
    route.componentDelays.some((delay) => !Number.isFinite(delay) || delay < 0) ||
    route.componentDelays.length === 0
  ) {
    return [...reasons, "invalid signature clock/components"];
  }
  if (
    event.lane !== path.lane ||
    !near(signaturePlace(route, 0).x, path.lane) ||
    !near(path.warning, route.profile.warningSeconds * plan.scrollSpeed) ||
    route.entryEnd < path.warning
  ) {
    reasons.push("signature origin lane or warning mismatch");
  }
  const finish = signatureFinishClearance(
    plan.scrollSpeed,
    route.profile.finishAheadSeconds,
    route.tail.y,
  );
  const mustStay = route.profile.kind !== "turnExit" && route.profile.kind !== "reflectingDiagonal";
  for (const sweep of signatureSweeps(route, route.entryEnd, route.complete)) {
    for (const point of [sweep.from, sweep.to]) {
      if (
        !Number.isFinite(point.x) ||
        !Number.isFinite(point.y) ||
        point.y > plan.sightLength - finish + 1e-6 ||
        (mustStay && (point.x < 0 || point.x + span > plan.laneCount))
      ) {
        reasons.push("signature choreography violates finish clearance or road bounds");
      }
    }
  }
  if (reasons.length > 0) {
    return [...new Set(reasons)];
  }
  const clipped = (sweeps: readonly SignatureSweep[], cut: number) =>
    sweeps.flatMap((sweep) => {
      const low = -span + cut,
        high = plan.laneCount - cut;
      const dx = sweep.to.x - sweep.from.x;
      if (dx === 0) {
        return sweep.from.x > low && sweep.from.x < high ? [sweep] : [];
      }
      // Exit legs crossing a road edge are linear in X. Ordinary interior arcs
      // are monotone and remain on the road throughout each defining sweep.
      if (Math.min(sweep.from.x, sweep.to.x) > low && Math.max(sweep.from.x, sweep.to.x) < high) {
        return [sweep];
      }
      const fractions = [(low - sweep.from.x) / dx, (high - sweep.from.x) / dx].sort(
        (a, b) => a - b,
      );
      const first = Math.max(0, fractions[0]!),
        last = Math.min(1, fractions[1]!);
      if (first >= last) {
        return [];
      }
      const start = sweep.start + (sweep.end - sweep.start) * first,
        end = sweep.start + (sweep.end - sweep.start) * last;
      return [
        {
          ...sweep,
          end,
          from: signaturePlace(route, start, sweep.component),
          start,
          to: signaturePlace(route, end, sweep.component),
        },
      ];
    });
  const lanes = (sweeps: readonly SignatureSweep[], cut = 0) => {
    if (sweeps.length === 0) {
      return { count: 0, first: 0 };
    }
    const points = sweeps.flatMap((sweep) => [sweep.from.x, sweep.to.x]);
    const first = Math.max(0, Math.floor(Math.min(...points) - 1 + cut + 1e-9) + 1);
    const last = Math.min(
      plan.laneCount - 1,
      Math.ceil(Math.max(...points) + span - cut - 1e-9) - 1,
    );
    return last < first ? { count: 0, first: 0 } : { count: last - first + 1, first };
  };
  const whole = clipped(signatureTravelSweeps(route, 0, plan.roadLength + height), 0);
  const contact = clipped(
    signatureTravelSweeps(route, plan.sightLength, plan.sightLength + window),
    0,
  );
  const touched = clipped(
    signatureTravelSweeps(
      route,
      plan.sightLength,
      plan.sightLength +
        (spec.hitLength ?? window - plan.packLength + (spec.footprint.rows - 1) * plan.cellLength) +
        plan.packHitLength,
    ),
    inset,
  );
  if (whole.length === 0) {
    return [...reasons, "signature has no visible body"];
  }
  if (
    !near(proof.screen[0], event.distance) ||
    !near(proof.screen[1], event.distance + Math.max(...whole.map((s) => s.end)))
  ) {
    reasons.push("signature native screen interval mismatch");
  }
  const levels = whole.flatMap((s) => [
    event.distance + s.start - s.from.y,
    event.distance + s.end - s.to.y,
  ]);
  const bodyLanes = lanes(whole, inset);
  if (
    proof.body === undefined ||
    !near(proof.body.from, Math.min(...levels)) ||
    !near(proof.body.to, Math.max(...levels) + height) ||
    proof.body.lanes.first !== bodyLanes.first ||
    proof.body.lanes.count !== bodyLanes.count
  ) {
    reasons.push("signature body reservation mismatch");
  }
  const expectedContact = lanes(contact);
  if (
    proof.block.lanes.first !== expectedContact.first ||
    proof.block.lanes.count !== expectedContact.count ||
    proof.block.dart
  ) {
    reasons.push("signature contact lanes mismatch");
  }
  const first = contact.length
    ? Math.min(...contact.map((s) => s.start))
    : route.complete + Math.max(0, plan.sightLength - signaturePlace(route, route.complete).y);
  const contactLength = contact.length ? Math.max(...contact.map((s) => s.end)) - first : 0;
  const expectedRows = Math.max(
    1,
    1 + Math.ceil((contactLength - window) / plan.cellLength - 1e-9),
  );
  if (
    proof.block.rows !== expectedRows ||
    !near(event.distance, rows[proof.block.row]! + plan.sightLength - first)
  ) {
    reasons.push("signature contact row mismatch");
  }
  const required = touched.map((s) => {
    const hit = lanes([s], inset);
    return {
      distance: event.distance + s.start - plan.sightLength,
      lane: hit.first,
      lanes: hit.count,
      length: s.end - s.start - plan.packHitLength,
    };
  });
  if (
    required.length !== proof.stands.length ||
    required.some((stand, index) => {
      const actual = proof.stands[index]!;
      return (
        !near(stand.distance, actual.distance) ||
        stand.lane !== actual.lane ||
        stand.lanes !== actual.lanes ||
        !near(stand.length, actual.length)
      );
    })
  ) {
    reasons.push("signature pack-contact stands mismatch");
  }
  for (const sweep of whole) {
    const swept = lanes([sweep]);
    const positions = [
      event.distance + sweep.start - sweep.from.y,
      event.distance + sweep.end - sweep.to.y,
    ];
    const firstRow = Math.floor((Math.min(...positions) - rows[0]!) / spacing);
    const lastRow = Math.ceil((Math.max(...positions) + height - rows[0]!) / spacing);
    for (let row = firstRow; row <= lastRow; row++) {
      for (let lane = swept.first; lane < swept.first + swept.count; lane++) {
        if (!proof.cells.some((cell) => cell.row === row && cell.lane === lane)) {
          reasons.push("signature swept cell missing");
        }
      }
    }
  }
  return [...new Set(reasons)];
}

function sameDraws(a: MoverDraws, b: MoverDraws): boolean {
  const keys = [
    "count",
    "share",
    "shy",
    "side",
    "speed",
    "start",
    "tilt",
    "turn",
    "turnAt",
  ] as const;
  return (
    keys.every((key) => a[key] === b[key]) &&
    a.delays.length === b.delays.length &&
    a.delays.every((value, index) => value === b.delays[index]) &&
    a.lengths.length === b.lengths.length &&
    a.lengths.every((value, index) => value === b.lengths[index])
  );
}

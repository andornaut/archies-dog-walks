import type { MovementKind } from "../data/index.ts";
import { isHerring } from "./dartOutcomes.ts";
import {
  alternativeLanesOpen,
  deterministicOccupancyMasks,
  reactiveLaneMasks,
} from "./laneAlternatives.ts";
import { DART_LIFTS, moverRetries } from "./moverDraws.ts";
import type { MoverDraws } from "./moverModel.ts";
import { onScreenOf } from "./moverScreen.ts";
import {
  type AuditedCell,
  type AuditedMover,
  type AuditedPlace,
  type AuditedVisibility,
  auditMoverPairs,
  auditReactionGaps,
  auditStandingPairs,
  auditVisibilityPairs,
} from "./spawnAuditPairs.ts";
import {
  blockingSpan,
  hitLength,
  lastRowTaken,
  pathChanges,
  pathHeldLanes,
  pathReach,
  type PlannedSpawns,
  quotaFootprint,
  rowSpacing,
  type SpawnPlan,
  type SpawnQuota,
  zoneRows,
} from "./spawning.ts";
import { auditHerringGeometry, auditMoverGeometry } from "./spawnMoverValidation.ts";
import { signatureProof } from "./spawnSignatureAudit.ts";
import type { SpawnVisibilityTrace } from "./spawnVisibility.ts";
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
  const places: AuditedPlace[] = [];
  const cells: AuditedCell[] = [];
  const intervals: AuditedVisibility[] = [];
  const moving: AuditedMover[] = [];
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
  auditMoverPairs(plan, rows, cells, moving);
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
  auditStandingPairs(plan, spacing, cells);
  auditReactionGaps(plan, changes, places);
  auditVisibilityPairs(plan, intervals);
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

export type SpawnAuditTrace = SpawnVisibilityTrace;

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

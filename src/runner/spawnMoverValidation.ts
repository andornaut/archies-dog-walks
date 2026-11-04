import {
  type MoverBody,
  type MoverDraws,
  type MoverGeometry,
  moverPlacements,
  type MoverStand,
} from "./moverPlanning.ts";
import { crossLength } from "./movers.ts";
import {
  blockingLength,
  rowSpacing,
  type SpawnEvent,
  type SpawnPlan,
  type SpawnQuota,
  zoneRows,
} from "./spawning.ts";

export interface MoverProof {
  readonly block: {
    readonly dart: boolean;
    readonly lanes: { readonly first: number; readonly count: number };
    readonly row: number;
    readonly rows: number;
  };
  readonly body?: MoverBody;
  readonly cells: readonly { readonly lane: number; readonly row: number }[];
  readonly screen: readonly [number, number];
  readonly stands: readonly MoverStand[];
  readonly selection?: { readonly draws: MoverDraws; readonly lift: number };
}
type Audit = { reasons: string[]; coverage: string[] };
const EPS = 1e-6;
function same(a: unknown, b: unknown): boolean {
  if (typeof a === "number" && typeof b === "number") {
    return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= EPS;
  }
  if (a === b) {
    return true;
  }
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") {
    return false;
  }
  const left = Object.keys(a)
    .filter((key) => Reflect.get(a, key) !== undefined)
    .sort();
  const right = Object.keys(b)
    .filter((key) => Reflect.get(b, key) !== undefined)
    .sort();
  return (
    left.length === right.length &&
    left.every((key, i) => key === right[i] && same(Reflect.get(a, key), Reflect.get(b, key)))
  );
}
function geometry(plan: SpawnPlan<string>): MoverGeometry {
  return {
    cellLength: plan.cellLength,
    laneCount: plan.laneCount,
    laneInset: plan.laneInset,
    packHitLength: plan.packHitLength,
    packLength: plan.packLength,
    roadLength: plan.roadLength,
    rowSpacing: rowSpacing(plan),
    scrollSpeed: plan.scrollSpeed,
    sightLength: plan.sightLength,
    window: blockingLength(plan, 1),
  };
}

// Reconstruct legal candidates from the frozen request and selected draws. This verifies
// evidence identity; the caller must independently check its coexistence with the whole plan.
export function auditMoverGeometry(
  plan: SpawnPlan<string>,
  quota: SpawnQuota<string>,
  event: SpawnEvent<string>,
  proof: MoverProof,
): Audit {
  if (event.mover === undefined || quota.mover === undefined) {
    return { coverage: [], reasons: ["missing moving event or quota geometry"] };
  }
  if (proof.selection === undefined) {
    return { coverage: ["moving proof lacks selected draws and lift"], reasons: [] };
  }
  const { draws, lift } = proof.selection;
  const values = [
    draws.count,
    ...draws.delays,
    ...draws.lengths,
    draws.share,
    draws.shy,
    draws.side,
    draws.speed,
    draws.start,
    draws.tilt,
    draws.turn,
    draws.turnAt,
    lift,
  ];
  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
    return { coverage: [], reasons: ["invalid selected mover draws or lift"] };
  }
  const origin = zoneRows(plan, rowSpacing(plan))[proof.block.row];
  if (origin === undefined) {
    return { coverage: [], reasons: ["moving proof has no legal candidate row"] };
  }
  const candidates = moverPlacements(geometry(plan), quota.mover, draws, lift);
  const matching = candidates.filter(
    (candidate) =>
      same(candidate.path, event.mover) &&
      same(candidate.lane, event.lane) &&
      same(origin + candidate.appears, event.distance),
  );
  if (matching.length === 0) {
    return { coverage: [], reasons: ["moving event is not a legal selected request candidate"] };
  }
  const exact = matching.some((candidate) => {
    const expected = {
      block: {
        dart: candidate.path.motion === "cross",
        lanes: candidate.lanes,
        row: proof.block.row,
        rows: candidate.rows,
      },
      body:
        candidate.body === undefined
          ? undefined
          : {
              ...candidate.body,
              from: origin + candidate.body.from,
              to: origin + candidate.body.to,
            },
      cells: candidate.cells.map(({ lane, row }) => ({ lane, row: proof.block.row + row })),
      screen: candidate.screen.map((distance) => origin + distance),
      stands: candidate.stands.map((stand) => ({ ...stand, distance: origin + stand.distance })),
    };
    return same(expected, {
      block: proof.block,
      body: proof.body,
      cells: proof.cells,
      screen: proof.screen,
      stands: proof.stands,
    });
  });
  return {
    coverage: [],
    reasons: exact ? [] : ["moving proof differs from reconstructed selected geometry"],
  };
}

// Herrings have no reservations. Prove directly that their uninterrupted crossing exits
// before reaching the pack, and that the native visibility interval includes that exit.
export function auditHerringGeometry(
  plan: SpawnPlan<string>,
  quota: SpawnQuota<string>,
  event: SpawnEvent<string>,
  nativeUntil: number,
): Audit {
  const path = event.mover;
  const spec = quota.mover;
  const reasons: string[] = [];
  if (
    path?.motion !== "cross" ||
    spec?.motion.kind !== "cross" ||
    spec.motion.herring === undefined
  ) {
    return { coverage: [], reasons: ["invalid herring cross request"] };
  }
  const span = spec.footprint.lanes;
  const speed = spec.motion.lanesPerSecond / plan.scrollSpeed;
  const lowSpeed = speed * (1 - spec.variation.speedShare);
  const highSpeed = speed * (1 + spec.variation.speedShare);
  if (
    !Number.isFinite(path.lanesPerPixel) ||
    path.lanesPerPixel <= 0 ||
    path.lanesPerPixel < lowSpeed - EPS ||
    path.lanesPerPixel > highSpeed + EPS ||
    (path.direction !== 1 && path.direction !== -1)
  ) {
    reasons.push("invalid herring direction or speed");
  }
  if (
    path.warning !== 0 ||
    path.idle !== 0 ||
    path.enterTravel !== 0 ||
    path.turnAfter !== null ||
    path.stopAfter !== null ||
    path.pause !== undefined ||
    path.slide !== undefined ||
    (path.span ?? 1) !== span ||
    path.movement !== spec.movement
  ) {
    reasons.push("herring is not an uninterrupted entry crossing");
  }
  if (event.lane !== (path.direction === 1 ? 0 : plan.laneCount - span)) {
    reasons.push("herring entry lane differs from its direction");
  }
  const duration = crossLength(plan.laneCount, span) / path.lanesPerPixel;
  const gone = plan.sightLength * (1 - spec.motion.herring.endRoadShare);
  const expectedTilt = Math.min(0, gone / duration - 1);
  if (
    !Number.isFinite(path.tilt) ||
    path.tilt <= -1 ||
    !same(path.tilt, expectedTilt) ||
    duration * (1 + path.tilt) >= plan.sightLength - EPS
  ) {
    reasons.push("herring can reach pack contact");
  }
  if (
    !zoneRows(plan, rowSpacing(plan)).some((row) => same(row, event.distance)) ||
    event.distance + duration > plan.zoneLength + EPS
  ) {
    reasons.push("herring has no legal complete entry row");
  }
  if (!same(nativeUntil, event.distance + duration)) {
    reasons.push("herring screen trace differs from actual exit");
  }
  return { coverage: [], reasons };
}

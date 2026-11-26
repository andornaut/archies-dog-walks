import type { MoverVisibilityProof } from "./moverSpots.ts";
import {
  signatureFinishClearance,
  signaturePlace,
  type SignatureSweep,
  signatureSweeps,
  signatureTravelSweeps,
} from "./signaturePaths.ts";
import {
  blockingLength,
  rowSpacing,
  type SpawnEvent,
  type SpawnPlan,
  type SpawnQuota,
  zoneRows,
} from "./spawning.ts";

export function signatureProof(
  plan: SpawnPlan<string>,
  quota: SpawnQuota<string>,
  event: SpawnEvent<string>,
  proof: MoverVisibilityProof,
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

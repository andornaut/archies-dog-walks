import { expect, it, vi } from "vitest";

import {
  createSlotCandidateDomains,
  type SlotCandidate,
  type SlotOwnerDomainToken,
} from "./slotCandidateDomains.ts";
import {
  isNativeSlotPreparation,
  nativeSlotPreparationOrderingHint,
  nativeSlotPreparationWallRows,
  prepareSlotKind,
} from "./slotCandidates.ts";
import { createSlotConstructionState } from "./slotConstraintState.ts";
import { rowSpacing, type SpawnPlan, zoneRows } from "./spawning.ts";

const geometry: Omit<SpawnPlan<string>, "quotas"> = {
  cellInset: 5,
  cellLength: 30,
  fixedKinds: [],
  laneCount: 5,
  laneInset: 5,
  laneMoveSeconds: 0.1,
  maxEmptyRows: Infinity,
  minOpenLanes: 1,
  minSpacing: 100,
  moverCaps: { darts: 3, slowVehicles: 3, total: 6 },
  packHitLength: 30,
  packLength: 30,
  pathLaneMoveSeconds: 0.1,
  pathStart: 4,
  reactionSeconds: 0,
  riderFollowGap: 30,
  roadLength: 100,
  scrollSpeed: 100,
  sightLength: 80,
  stepSeconds: 0.05,
  zoneLength: 2000,
};
function fixture() {
  const prepared = prepareSlotKind({ movers: () => 0.5, spawns: () => 0.5 }, geometry, {
    compile: () => ({
      blocksLane: true,
      mover: {
        footprint: { lanes: 2, rows: 1 },
        motion: {
          firstDelaySeconds: [0, 0],
          kind: "approach",
          secondRoadShare: [0.5, 0.5],
          stepSeconds: 0.1,
          steps: { max: 2, min: 2 },
        },
        movement: "approach",
        variation: { delaySeconds: 0, lengthShare: 0, speedShare: 0 },
        warningSeconds: 0,
      },
    }),
    footprint: { lanes: 2, rows: 1 },
    kind: "following",
    role: "minorMoving",
    weight: 1,
  });
  const path = zoneRows(geometry, rowSpacing({ ...geometry, quotas: [] })).map((distance) => ({
    distance,
    lane: geometry.pathStart,
  }));
  return { path, prepared };
}

it("rejects a placement change and keeps the ordering hint, wall rows and domain proof", () => {
  const { path, prepared } = fixture();
  const domains = createSlotCandidateDomains(geometry, path);
  const owner = { key: "owner", phase: "active" as const, preparations: () => [prepared] };
  const scope = domains.pocketScope([owner]);
  const work = {
    anchor: () => true,
    check: () => true,
    propagate: () => true,
    stopped: () => false,
  };
  const values: SlotCandidate<string>[] = [];
  let token: SlotOwnerDomainToken | undefined;
  for (const step of domains.completeOwnerDomain(work, scope, owner)) {
    if (step.status === "candidate") {
      values.push(step.value);
    } else if (step.status === "complete") {
      token = step.token;
    } else {
      throw Error(`Unexpected native domain status ${step.status}`);
    }
  }
  expect(values.length).toBeGreaterThan(0);
  expect(token).toBeDefined();
  expect(domains.attestsCompleteOwnerDomain(work, scope, owner, values, token!)).toBe(true);
  const candidate = values[0]!;
  expect(createSlotConstructionState(geometry, path).commit(owner, candidate.entry).accepted).toBe(
    true,
  );
  const original = nativeSlotPreparationOrderingHint(work, prepared);
  expect(original).toEqual({ hint: { envelopeWidth: 4 }, status: "hint" });
  if (original.status !== "hint") {
    throw Error("Missing native-origin hint");
  }
  expect(Object.isFrozen(original.hint)).toBe(true);
  const span = candidate.entry.placement!.lanes;
  const count = span.count;
  const rows = nativeSlotPreparationWallRows(prepared);
  expect(rows).toBeDefined();
  expect(Reflect.set(span, "count", geometry.laneCount)).toBe(false);
  expect(span.count).toBe(count);
  expect(nativeSlotPreparationOrderingHint(work, prepared)).toEqual(original);
  expect(isNativeSlotPreparation(prepared)).toBe(true);
  expect(nativeSlotPreparationWallRows(prepared)).toBe(rows);
  expect(domains.attestsCompleteOwnerDomain(work, scope, owner, values, token!)).toBe(true);
  expect(createSlotConstructionState(geometry, path).commit(owner, candidate.entry).accepted).toBe(
    true,
  );
});

it("charges every lookup and leaves foreign objects unknown without reading their catalogue", () => {
  const { prepared } = fixture();
  const propagate = vi.fn(() => true);
  const first = nativeSlotPreparationOrderingHint({ propagate }, prepared);
  const second = nativeSlotPreparationOrderingHint({ propagate }, prepared);
  expect(first.status).toBe("hint");
  expect(second).toEqual(first);
  if (first.status !== "hint" || second.status !== "hint") {
    throw Error("Missing native-origin hint");
  }
  expect(second.hint).toBe(first.hint);
  const foreign = new Proxy(prepared, {
    get() {
      throw Error("Foreign shape must not be inspected");
    },
  });
  expect(nativeSlotPreparationOrderingHint({ propagate }, foreign)).toEqual({ status: "unknown" });
  expect(propagate).toHaveBeenCalledTimes(3);
  expect(nativeSlotPreparationOrderingHint({ propagate: () => false }, foreign)).toEqual({
    kind: "propagation",
    status: "budget",
  });
});

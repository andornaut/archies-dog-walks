import * as random from "@andornaut/game-kit/random";
import { describe, expect, it, vi } from "vitest";

import type { SlotKind } from "./slotConfig";
import { planSlotSpawns, SLOT_LIMITS } from "./slotPlanner";
import * as witnessSearch from "./slotWitnessSearch";
import type { SpawnPlan } from "./spawning";

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
  moverCaps: { darts: 1, slowVehicles: 1, total: 3 },
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
  zoneLength: 800,
};

describe("slot producer preparation failure", () => {
  it.each([0, 1])(
    "preserves the source failure and stops work after %i preparation yields",
    (yielded) => {
      let failed = false;
      let afterFailure = 0;
      const compiled: string[] = [];
      const source = (role: SlotKind<string>["role"], kind: string): SlotKind<string> => ({
        compile: () => {
          compiled.push(kind);
          if (kind === "broken") {
            failed = true;
            throw new Error("Invalid source profile");
          }
          return { blocksLane: true, footprint: { lanes: 1, rows: 1 } };
        },
        footprint: { lanes: 1, rows: 1 },
        kind,
        role,
        weight: 1,
      });
      const catalogue = [
        source("encounterFixed", "pinned"),
        ...(yielded === 0 ? [] : [source("minorFixed", "valid")]),
        source("minorFixed", "broken"),
      ];
      const track = (step: () => boolean) => () => {
        if (failed) {
          afterFailure++;
        }
        return step();
      };
      const createSearch = witnessSearch.createSlotWitnessSearch;
      const search = vi
        .spyOn(witnessSearch, "createSlotWitnessSearch")
        .mockImplementation((road, path, domains, jobs, work) =>
          createSearch(road, path, domains, jobs, {
            ...work,
            anchor: track(work.anchor),
            check: track(work.check),
            ...(work.propagate === undefined ? {} : { propagate: track(work.propagate) }),
          }),
        );
      const active = {
        encounterFixed: 1,
        encounterMoving: 0,
        minorFixed: yielded + 1,
        minorMoving: 0,
      };
      const stream = random.randomStream;
      const sourceOrder = vi
        .spyOn(random, "randomStream")
        .mockImplementation((seed, name) =>
          yielded === 1 && name === "slots-0-active:minorFixed:0-source-order"
            ? () => 0
            : stream(seed, name),
        );
      try {
        const result = planSlotSpawns(
          { limits: SLOT_LIMITS, seed: 7, zoneIndex: 0 },
          geometry,
          catalogue,
          [],
          {
            active,
            capacity: active,
            guarantees: [
              { count: 1, kind: "pinned", role: "encounterFixed" },
              ...(yielded === 0 ? [] : [{ count: 1, kind: "valid", role: "minorFixed" as const }]),
              { count: 1, kind: "broken", role: "minorFixed" },
            ],
          },
        );
        expect(result).toMatchObject({
          delivered: 0,
          failures: [{ code: "invalid-profile", kind: "broken", role: "minorFixed" }],
          stage: "configuration",
          status: "unsupported",
        });
        expect(result).not.toHaveProperty("planned");
        expect(compiled).toEqual(["pinned", ...(yielded === 0 ? [] : ["valid"]), "broken"]);
        expect(afterFailure).toBe(0);
      } finally {
        sourceOrder.mockRestore();
        search.mockRestore();
      }
    },
  );
});

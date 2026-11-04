import { describe, expect, it } from "vitest";

import { DEBUFFS } from "../data/debuffs.ts";
import { DOGS } from "../data/dogs.ts";
import { ENCOUNTERS } from "../data/encounters.ts";
import { SHOP_GEAR } from "../data/shop.ts";
import { WORLD } from "../data/world.ts";
import { newRun, type RunState } from "../state/runState.ts";
import { defined } from "../testing/defined.ts";
import { quietCounters } from "../testing/saves.ts";
import { TEST_TUNING } from "../testing/tuning.ts";
import { TEST_WALKER_DATA } from "../testing/walkers.ts";
import { cents, clampHearts } from "../units.ts";
import { checkpointOf, runResultOf } from "./runSlices.ts";

const data = {
  debuffs: DEBUFFS,
  dogs: DOGS,
  encounters: ENCOUNTERS,
  shopGear: SHOP_GEAR,
  ...TEST_WALKER_DATA,
  tuning: TEST_TUNING,
  world: WORLD,
};
const start = newRun(data, 3, { dogs: ["kilo", "ginger"], gear: null, walker: "casey" });
// In zone 3 with 2 zones paid and $12.50 earned since; ginger fired you in zone 2.
const midRun: RunState = {
  ...start,
  money: cents(4_250),
  pack: [defined(start.pack[0]), { dog: "ginger", status: "fired", zoneIndex: 1 }],
  route: ["distilleryDistrict", "theBeaches", "highPark"],
  zoneEndMoney: cents(3_000),
  zoneIndex: 2,
};

const walking = defined(start.pack[0]);
if (walking.status !== "walking") {
  throw new Error("The run starts with kilo walking");
}

describe("checkpointOf", () => {
  it("records the zones paid, the money heading home keeps and the zone each owner fired you in", () => {
    expect(checkpointOf(data, midRun)).toEqual({
      counters: { ...quietCounters(), startCents: start.startMoney },
      dogs: [
        { firedInZone: null, id: "kilo" },
        { firedInZone: 2, id: "ginger" },
      ],
      earnedCents: midRun.zoneEndMoney,
      route: ["distilleryDistrict", "theBeaches", "highPark"],
      zonesFinished: 2,
    });
  });

  it("copies the run's achievement counters", () => {
    const counted: RunState = {
      ...midRun,
      bumpsByKind: { raccoon: 2 },
      bumpsByZone: [0, 2],
      debuffsGot: { stinky: 1 },
      optionPicks: { cheeseCrates: { sniff: 2 } },
      startMoney: cents(500),
      tallies: { squirrelPulls: 3 },
    };
    expect(checkpointOf(data, counted).counters).toEqual({
      bumpsByKind: { raccoon: 2 },
      bumpsByZone: [0, 2],
      debuffsGot: { stinky: 1 },
      firstZone: 0,
      optionPicks: { cheeseCrates: { sniff: 2 } },
      startCents: 500,
      tallies: { squirrelPulls: 3 },
    });
  });

  it("counts every zone once the last one is paid", () => {
    const finished = { ...midRun, phase: { kind: "ended", reason: "finished" } as const };
    expect(checkpointOf(data, finished).zonesFinished).toBe(4);
  });
});

describe("runResultOf", () => {
  it("ends a finished run in its last zone, every walking dog paid for all of them", () => {
    const finished = { ...midRun, phase: { kind: "ended", reason: "finished" } as const };
    expect(runResultOf(data, finished)).toEqual({
      counters: { ...quietCounters(), startCents: start.startMoney },
      dogs: [
        { firedInZone: null, id: "kilo" },
        { firedInZone: 2, id: "ginger" },
      ],
      earnedCents: 4_250,
      lastHeartOwners: 0,
      lostCents: 0,
      outcome: "finished",
      route: ["distilleryDistrict", "theBeaches", "highPark"],
      walker: start.walker,
      zone: 4,
    });
  });

  it("counts the walking owners on their last heart", () => {
    const run: RunState = { ...midRun, pack: [{ ...walking, hearts: clampHearts(5, 1) }] };
    expect([runResultOf(data, midRun), runResultOf(data, run)]).toMatchObject([
      { lastHeartOwners: 0 },
      { lastHeartOwners: 1 },
    ]);
  });

  // Heading home or fired out, each in the zone it was in, losing the rest.
  it.each<[string, RunState, string]>([
    [
      "a run that headed home",
      { ...midRun, phase: { kind: "ended", reason: "wentHome" } },
      "wentHome",
    ],
    ["a run that has not ended", midRun, "wentHome"],
    [
      "a run every owner fired you out of",
      {
        ...midRun,
        pack: [
          { dog: "kilo", status: "fired", zoneIndex: 2 },
          { dog: "ginger", status: "fired", zoneIndex: 1 },
        ],
        phase: { kind: "ended", reason: "noDogs" },
      },
      "noDogs",
    ],
  ])("ends %s, banking the last zone's end money", (_, run, outcome) => {
    expect(runResultOf(data, run)).toMatchObject({
      earnedCents: midRun.zoneEndMoney,
      lostCents: midRun.money - midRun.zoneEndMoney,
      outcome,
      zone: 3,
    });
  });
});

it("keeps negative walk cash out of persisted checkpoints and abort results", () => {
  const spent = { ...midRun, money: cents(-500) };
  expect(checkpointOf(data, spent).earnedCents).toBe(0);
  expect(runResultOf(data, spent)).toMatchObject({
    earnedCents: 0,
    lostCents: 0,
    outcome: "wentHome",
  });
});

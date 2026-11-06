import { fillNames } from "@andornaut/game-kit/lines";
import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import type { DogId } from "../data/types.ts";
import { dollarText } from "../home/home.ts";
import { currentZone, defaultRoute, walkLength } from "../rules/route.ts";
import { read } from "../rules/units.ts";
import type { RunState } from "../state/runState.ts";
import { testState } from "../testing/runState.ts";
import { cents } from "../units.ts";
import { homeQuestionNote, pauseNote } from "./homeQuestion.ts";

type Slots = Readonly<Partial<Record<DogId, number | "fired">>>;

const zones = walkLength(gameData);
const route = defaultRoute(gameData, zones);
const pay = read(gameData.tuning, "money", "payPerDog");
const tip = read(gameData.tuning, "money", "tip");
// The money at the last zone's end: a zone's pay for a pack of three.
const zoneEnd = cents(3 * pay);
// A run holding money, more than its last zone's end money once tips are earned, less once card
// costs spent below it.
const holding = (money: number): Partial<RunState> => ({
  money: cents(money),
  zoneEndMoney: zoneEnd,
});

describe("homeQuestionNote", () => {
  const words = gameData.runText.homeQuestion;

  it.each([
    ["three dogs walking, nothing earned yet", { buddy: 3, ginger: 5, kilo: 2 }, 1, zoneEnd],
    ["three dogs walking, with tips earned", { buddy: 3, ginger: 5, kilo: 2 }, 1, zoneEnd + tip],
    ["one dog walking of two, with tips earned", { ginger: 5, kilo: "fired" }, 1, zoneEnd + tip],
    ["card costs spent below the last zone's end money", { buddy: 3 }, 1, zoneEnd - tip],
    ["a lone dog in the last zone, with tips earned", { buddy: 4 }, zones - 1, zoneEnd + tip],
  ] satisfies [string, Slots, number, number][])(
    "states what going home keeps, then what the zone has earned and the zones left that it gives up: %s",
    (_name, slots, zoneIndex, money) => {
      const run = testState(slots, { ...holding(money), route, zoneIndex });
      const walking = Object.values(slots).filter((hearts) => hearts !== "fired").length;
      const earned = Math.max(0, money - zoneEnd);
      const left = zones - zoneIndex - 1;
      const named = {
        lost: dollarText(cents(earned + pay * walking)),
        zone: currentZone(gameData, run).name,
      };
      expect(homeQuestionNote(gameData, run)).toEqual([
        { kind: "keep", text: pauseNote(gameData, run) },
        { kind: "lose", text: fillNames(words.lose, named) },
        ...(left > 0
          ? [{ kind: "zonesLeft", text: fillNames(words.zonesLeft, { count: String(left) }) }]
          : []),
      ]);
    },
  );

  it.each([
    ["a full pack", { ginger: 5 }],
    ["an owner who fired you", { ginger: 5, kilo: "fired" }],
  ] satisfies [string, Slots][])(
    "states what going home keeps and gives up nothing at a fork, with %s",
    (_name, slots) => {
      const fork = { ...holding(zoneEnd), route: route.slice(0, 1), zoneIndex: 1 };
      const run = testState(slots, fork);
      const lines = homeQuestionNote(gameData, run);
      expect(lines[0]).toEqual({ kind: "keep", text: pauseNote(gameData, run) });
      expect(lines.filter(({ kind }) => kind === "lose")).toEqual([]);
    },
  );
});

describe("pauseNote", () => {
  const words = gameData.menuText.pause;

  const all = (money: number) => fillNames(words.noteAll, { cash: dollarText(cents(money)) });
  it.each([
    ["all the cash with nothing earned since the last zone's end", zoneEnd, all(zoneEnd)],
    [
      "all the cash after card costs spent below the last zone's end money",
      zoneEnd - tip,
      all(zoneEnd - tip),
    ],
    [
      "the last zone's end money once the zone has earned some",
      zoneEnd + tip,
      fillNames(words.note, { cash: dollarText(cents(zoneEnd + tip)), kept: dollarText(zoneEnd) }),
    ],
  ])("says End walk keeps %s", (_name, money, note) => {
    expect(pauseNote(gameData, testState({ ginger: 5 }, holding(money)))).toBe(note);
  });
});

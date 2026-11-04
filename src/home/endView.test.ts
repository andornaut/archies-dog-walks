import { describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { QUIPS } from "../data/quips.ts";
import type { Cause, Change, MoneyChange } from "../rules/causes.ts";
import { cents, type Hearts } from "../units.ts";
import {
  closingLines,
  earningsBreakdown,
  type EndTarget,
  endTargetAt,
  zonePips,
} from "./endView.ts";

const money = (amount: number, base: Cause): MoneyChange => ({
  amount: cents(amount),
  causes: [base],
  dog: null,
  kind: "money",
});
const pay = (amount: number) => money(amount, { amount, kind: "pay" });
const tip = (amount: number) => money(amount, { amount, kind: "tip" });
const treat = (amount: number) => money(amount, { amount, kind: "treat" });
const card = (amount: number) =>
  money(amount, {
    amount,
    kind: "effect",
    source: { encounter: "thief", kind: "encounter", option: 0 },
  });
const hearts: Change = {
  after: 3 as Hearts,
  before: 4 as Hearts,
  causes: [],
  dog: "kilo",
  kind: "hearts",
};

describe("earningsBreakdown", () => {
  const labels = gameData.menuText.end.earnings;

  // Each line as [kind, amount], labelled from the data.
  it.each<[string, Change[], number, number, [keyof typeof labels, number][]]>([
    [
      "totals pay, tips and card costs, and ignores heart changes",
      [pay(1_000), tip(150), tip(100), card(-400), hearts, pay(1_000)],
      1_850,
      0,
      [
        ["fees", 2_000],
        ["tips", 250],
        ["cardCosts", -400],
      ],
    ],
    [
      "counts a treat's cash in the Tips row",
      [pay(1_000), tip(100), treat(500)],
      1_600,
      0,
      [
        ["fees", 1_000],
        ["tips", 600],
        ["cardCosts", 0],
      ],
    ],
    [
      "adds lucky finds and starting money only when the run had some",
      [pay(1_000), card(500)],
      2_500,
      0,
      [
        ["fees", 1_000],
        ["tips", 0],
        ["luckyFinds", 500],
        ["cardCosts", 0],
        ["start", 1_000],
      ],
    ],
    [
      "shows the cash lost when every owner fired you as a cost, left out of the earnings",
      [pay(1_000), tip(300), card(-100)],
      1_000,
      200,
      [
        ["fees", 1_000],
        ["tips", 300],
        ["cardCosts", -100],
        ["cashLost", -200],
      ],
    ],
  ])("%s", (_, changes, earned, lost, lines) => {
    expect(
      earningsBreakdown(gameData, changes, { earned: cents(earned), lost: cents(lost) }),
    ).toEqual(lines.map(([kind, amount]) => ({ amount, kind, label: labels[kind] })));
  });

  it.each([
    ["with no cash lost", 0],
    ["with cash lost", 400],
  ])("always adds up to the earnings %s", (_name, lost) => {
    const lines = earningsBreakdown(gameData, [pay(700), tip(55), card(-300)], {
      earned: cents(9_999),
      lost: cents(lost),
    });
    expect(lines.reduce((total, line) => total + line.amount, 0)).toBe(9_999);
  });
});

describe("zonePips", () => {
  it("marks finished zones done and the zone an early end stopped in current", () => {
    const cases: readonly [string, Parameters<typeof zonePips>[1], ReturnType<typeof zonePips>][] =
      [
        [
          "marks every zone done for a finished walk",
          { outcome: "finished", zonesFinished: 4 },
          ["done", "done", "done", "done"],
        ],
        [
          "marks the zone an early end stopped in as current",
          { outcome: "wentHome", zonesFinished: 2 },
          ["done", "done", "current", "todo"],
        ],
        [
          "marks the first zone current when every owner fired you in it",
          { outcome: "noDogs", zonesFinished: 0 },
          ["current", "todo", "todo", "todo"],
        ],
      ];
    for (const [, walk, expected] of cases) {
      expect(zonePips(4, walk)).toEqual(expected);
    }
  });
});

describe("closingLines", () => {
  it("has each owner say a happier line, or their fired line if they fired you", () => {
    const walk = {
      dogs: ["kilo", "lady"] as const,
      firings: ["lady" as const],
    };
    expect(closingLines({ quips: QUIPS }, () => 0, { ...walk, dogs: [...walk.dogs] })).toEqual([
      { dog: "kilo", fired: false, text: QUIPS.kilo.happier[0] },
      { dog: "lady", fired: true, text: QUIPS.lady.fired[0] },
    ]);
  });
});

describe("endTargetAt", () => {
  const badgeHits = [
    { height: 60, width: 100, x: 10, y: 400 },
    { height: 60, width: 100, x: 110, y: 400 },
  ];
  const button = { height: 44, width: 200, x: 50, y: 500 };
  it.each<[string, boolean, number, number, EndTarget | undefined]>([
    ["the first badge", false, 20, 420, { badge: 0 }],
    ["the second badge", false, 150, 459, { badge: 1 }],
    ["Back to title", false, 60, 510, "home"],
    ["the panel's title, above the badges", false, 60, 399, undefined],
    ["a badge, with a card open", true, 20, 420, "dismiss"],
    ["Back to title, with a card open", true, 60, 510, "dismiss"],
    ["bare screen, with a card open", true, 5, 5, "dismiss"],
  ])("a press on %s (card open: %s) lands on its target", (_, cardOpen, x, y, target) => {
    expect(endTargetAt({ badgeHits, button, cardOpen }, x, y)).toEqual(target);
  });
});

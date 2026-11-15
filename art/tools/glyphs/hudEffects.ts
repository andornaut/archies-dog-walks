// Native 24px HUD effect glyphs. Existing 16px and 20px roles retain separate painters.
import { bitmap, Grid } from "../pixel.ts";

const SIZE = 24;

function heart(x: number, y: number, g: Grid): void {
  bitmap(
    g,
    x,
    y,
    [
      ".rrr...rrr.",
      "rrrrr.rrrrr",
      "rrrrrrrrrrr",
      "rrrrrrrrrrr",
      ".rrrrrrrrh.",
      "..rrrrrrh..",
      "...rrrrh...",
      "....rrh....",
      ".....h.....",
    ],
    { h: "hot", r: "red" },
  );
  g.rect(x + 1, y + 1, 2, 1, "white");
}

function bubble(
  { fill, right = false, shade }: { fill: string; shade: string; right?: boolean },
  g: Grid,
): void {
  g.rect(3, 2, 18, 14, fill);
  g.rect(2, 3, 20, 12, fill);
  g.rect(3, 15, 18, 1, shade);
  g.rect(21, 4, 1, 11, shade);
  if (right) {
    g.tri([13, 15], [19, 22], [19, 15], fill);
    g.rect(18, 16, 1, 3, shade);
  } else {
    g.tri([5, 15], [5, 22], [11, 15], fill);
    g.rect(5, 16, 1, 3, shade);
  }
}

function keenEye(): Grid {
  const g = new Grid(SIZE, SIZE);
  for (let i = 0; i < 7; i++) {
    g.rect(14 + i, 14 + i, 3, 3, "brown");
  }
  g.ell(9, 9, 8, 8, "lgrey", "grey");
  g.ell(9, 9, 6, 6, "cyan", null, "white");
  bitmap(g, 3, 7, ["...rr.rr...", "wwrrrrrrrww", ".wwwrrrwww.", "ww...r...ww"], {
    r: "red",
    w: "white",
  });
  return g;
}

function longReach(): Grid {
  const g = new Grid(SIZE, SIZE);
  g.rect(7, 5, 10, 8, "skin1");
  for (const [x, y] of [
    [7, 3],
    [10, 1],
    [13, 2],
    [16, 4],
  ] as const) {
    g.rect(x, y, 2, 8 - y, "skin1");
  }
  g.rect(3, 7, 3, 4, "skin1");
  g.rect(5, 10, 5, 4, "skin1");
  g.rect(9, 13, 6, 2, "skin1");
  g.rect(15, 9, 2, 4, "skin2");
  g.tri([2, 19], [6, 15], [6, 22], "green");
  g.tri([22, 19], [18, 15], [18, 22], "green");
  g.rect(6, 17, 12, 4, "green");
  g.rect(6, 20, 12, 1, "dgreen");
  return g;
}

function quickRecovery(): Grid {
  const g = new Grid(SIZE, SIZE);
  for (const y of [2, 20]) {
    g.rect(5, y, 14, 1, "brown");
    g.rect(5, y + 1, 14, 1, "dbrown");
  }
  g.tri([6, 4], [18, 4], [12, 12], "foam");
  g.tri([6, 20], [18, 20], [12, 12], "foam");
  g.rect(11, 10, 2, 4, "foam");
  g.rect(8, 4, 1, 3, "white");
  g.tri([10, 9], [14, 9], [12, 12], "amber");
  g.rect(12, 11, 1, 5, "amber");
  g.tri([7, 20], [17, 20], [12, 15], "amber");
  g.rect(8, 19, 8, 1, "orange");
  for (const y of [7, 16]) {
    g.rect(1, y, 3, 1, "white");
    g.rect(20, y, 3, 1, "white");
  }
  return g;
}

function secondChance(): Grid {
  const g = new Grid(SIZE, SIZE);
  bubble({ fill: "pink", right: true, shade: "mauve" }, g);
  heart(6, 4, g);
  return g;
}

function bellyRubs(): Grid {
  const g = new Grid(SIZE, SIZE);
  heart(8, 1, g);
  bitmap(
    g,
    2,
    13,
    [
      ".......sssss.......",
      "sssssssssssssssss..",
      "ssssssssdddddddd...",
      "ssssssssssssssssss.",
      "sssssssdddddddd....",
      "sssssssssssssssss..",
      "ssssssddddddd......",
      "ssssssssssssss.....",
      "sssssssssss........",
    ],
    { d: "skin2", s: "skin1" },
  );
  return g;
}

function bigTipper(): Grid {
  const g = new Grid(SIZE, SIZE);
  for (let i = 0; i < 5; i++) {
    const x = 2 + (i % 2),
      y = 19 - i * 3;
    g.rect(x, y, 11, 2, "amber");
    g.rect(x, y + 1, 11, 1, "orange");
    g.rect(x + 1, y, 2, 1, "yellow");
  }
  g.ell(8, 5, 5, 2.5, "yellow", "amber");
  g.rect(5, 5, 6, 1, "amber");
  g.tri([19, 1], [15, 6], [22, 6], "green");
  g.rect(18, 6, 3, 15, "green");
  g.rect(20, 7, 1, 14, "dgreen");
  return g;
}

function charmer(): Grid {
  const g = new Grid(SIZE, SIZE);
  bubble({ fill: "white", shade: "lgrey" }, g);
  bitmap(
    g,
    4,
    4,
    ["..s..", ".ssss", "s.s..", "s.s..", ".sss.", "..s.s", "..s.s", "ssss.", "..s.."],
    { s: "forest" },
  );
  g.rect(15, 4, 3, 7, "dred");
  g.tri([12, 10], [21, 10], [16.5, 15], "dred");
  return g;
}

function goodLeash(): Grid {
  const g = new Grid(SIZE, SIZE);
  bitmap(
    g,
    1,
    2,
    [
      "...oooooo...........",
      "..ooooooee..........",
      "..oookooee..........",
      "..ooooooee..........",
      ".kmmmmoooe..........",
      "..mmmmmooe..........",
      "....ccccc...........",
      "....mooooo..........",
      "....moooooo.........",
      "....mooooooo........",
      "....moooooooo....h..",
      "....mooooooooo...h..",
      "....moooooooooo..h..",
      "....moooooooooo.hhh.",
      "....moooohhoooohhhh.",
      "....moooohhoooohh...",
      "....moooohhoooo.....",
      "....moooohhoooo.....",
      "...hhhhhh.hhhhhh....",
    ],
    { c: "red", e: "dbrown", h: "dbrown", k: "ink", m: "tan", o: "brown" },
  );
  g.rect(19, 2, 1, 5, "yellow");
  g.rect(17, 4, 5, 1, "yellow");
  return g;
}

function raincoats(): Grid {
  const g = new Grid(SIZE, SIZE);
  bitmap(
    g,
    8,
    1,
    [
      "..yyyyyy..",
      ".yyyyyyyy.",
      "yydddddday",
      "yydddddday",
      "yydddddday",
      "yydddddday",
      ".yyyyyyyy.",
    ],
    { a: "amber", d: "dbrown", y: "yellow" },
  );
  g.rect(7, 8, 12, 13, "yellow");
  g.tri([7, 7], [2, 13], [5, 16], "yellow");
  g.tri([18, 7], [22, 13], [20, 16], "amber");
  g.rect(18, 9, 1, 12, "amber");
  g.rect(12, 9, 1, 11, "orange");
  for (const y of [12, 17]) {
    g.rect(13, y, 1, 2, "ochre");
  }
  g.rect(7, 21, 12, 1, "amber");
  g.tri([3, 1], [1, 5], [5, 5], "cyan");
  g.ell(3, 5, 2, 2, "cyan", "sky");
  return g;
}

function rushHour(): Grid {
  const g = new Grid(SIZE, SIZE);
  g.ell(5, 4.5, 3.5, 3, "amber", "orange", "yellow");
  g.ell(19, 4.5, 3.5, 3, "amber", "orange", "yellow");
  g.rect(5, 18, 2, 4, "lgrey");
  g.rect(17, 18, 2, 4, "lgrey");
  g.ell(12, 12, 9, 9, "red", null, "pink");
  g.ell(12, 12, 6.5, 6.5, "white", "lgrey");
  g.rect(11, 3, 2, 2, "lgrey");
  g.rect(12, 7, 1, 6, "ink");
  g.rect(13, 12, 4, 1, "ink");
  return g;
}

function fannyPack(): Grid {
  const g = new Grid(SIZE, SIZE);
  g.rect(1, 6, 22, 3, "dslate");
  g.blob(12, 14, 10, 7, "dgreen", "forest", "green", 4);
  g.rect(4, 6, 16, 6, "dgreen");
  g.rect(4, 6, 16, 1, "green");
  g.rect(4, 9, 16, 1, "ink");
  g.rect(18, 9, 1, 3, "lgrey");
  g.rect(1, 5, 3, 6, "slate");
  g.rect(2, 6, 1, 4, "lgrey");
  g.rect(7, 15, 5, 2, "cream");
  return g;
}

function hallPass(): Grid {
  const g = new Grid(SIZE, SIZE);
  for (let i = 0; i < 7; i++) {
    g.p(4 + i, i + 1, "sky");
    g.p(19 - i, i + 1, "sky");
  }
  g.rect(2, 9, 20, 13, "cream");
  g.rect(2, 9, 20, 4, "red");
  g.rect(2, 9, 20, 1, "pink");
  g.rect(21, 9, 1, 13, "tan");
  g.rect(2, 21, 20, 1, "tan");
  g.rect(21, 10, 1, 3, "dred");
  g.rect(9, 6, 6, 2, "lgrey");
  g.rect(11, 8, 2, 3, "lgrey");
  for (const [x, y] of [
    [4, 16],
    [6, 15],
    [8, 15],
    [10, 16],
  ] as const) {
    g.p(x, y, "dred");
  }
  g.rect(5, 17, 5, 3, "dred");
  g.rect(13, 15, 6, 1, "brown");
  g.rect(13, 18, 6, 1, "brown");
  return g;
}

function luckyCollar(): Grid {
  const g = new Grid(SIZE, SIZE);
  g.ell(12, 8, 10, 6.5, "red", null, "pink");
  g.ell(12, 8, 7, 3.5, null);
  g.ell(12, 17, 4.5, 4.5, "amber", "orange", "yellow");
  for (const [x, y] of [
    [12, 14],
    [10, 16],
    [14, 16],
    [12, 18],
    [13, 20],
  ] as const) {
    g.rect(x, y, 2, 2, "green");
  }
  return g;
}

function runningShoes(): Grid {
  const g = new Grid(SIZE, SIZE);
  bitmap(
    g,
    1,
    5,
    [
      "...............oo.....",
      "...........cccccoo....",
      "..........cwwnnnnso...",
      ".........cssbnnnnsss..",
      ".......ccwwssssssssss.",
      ".....csssssssoooosssb.",
      "....csssssoooossssssb.",
      "..cssssoooosssssssssb.",
      ".csssooosssssssssssbb.",
      "cssssssssssssssssbbb.",
      "sbbbbbbbbbbbbbbbbbbbb",
      "wwwwwwwwwwwwwwwwwwwww",
      ".wwwwwwwwwwwwwwwwwwww",
      "..lglglglglglglglglg.",
    ],
    { b: "blue", c: "cyan", g: "grey", l: "lgrey", n: "navy", o: "orange", s: "sky", w: "white" },
  );
  return g;
}

function whistle(): Grid {
  const g = new Grid(SIZE, SIZE);
  g.ell(9, 16, 8, 6, "lgrey", "grey", "white");
  g.rect(9, 10, 13, 6, "lgrey");
  g.rect(9, 10, 13, 1, "white");
  g.rect(9, 15, 13, 1, "grey");
  g.rect(21, 10, 1, 6, "grey");
  g.rect(10, 10, 4, 1, null);
  g.rect(10, 11, 4, 1, "dslate");
  for (const [x, y] of [
    [5, 14],
    [8, 14],
    [4, 16],
    [9, 16],
  ] as const) {
    g.p(x, y, "dred");
  }
  g.rect(5, 17, 4, 3, "dred");
  for (const [x, y] of [
    [12, 2],
    [12, 3],
    [12, 4],
    [12, 5],
    [5, 4],
    [6, 5],
    [7, 6],
    [18, 5],
    [19, 4],
    [20, 3],
  ] as const) {
    g.p(x, y, "cyan");
  }
  return g;
}

export const HUD_EFFECT_IMAGES: ReadonlyMap<string, () => Grid> = new Map([
  ["icon-hud-effect-perk-keen-eye", keenEye],
  ["icon-hud-effect-perk-long-reach", longReach],
  ["icon-hud-effect-perk-quick-recovery", quickRecovery],
  ["icon-hud-effect-perk-second-chance", secondChance],
  ["icon-hud-effect-upgrade-belly-rubs", bellyRubs],
  ["icon-hud-effect-upgrade-big-tipper", bigTipper],
  ["icon-hud-effect-upgrade-charmer", charmer],
  ["icon-hud-effect-upgrade-good-leash", goodLeash],
  ["icon-hud-effect-upgrade-raincoats", raincoats],
  ["icon-hud-effect-upgrade-rush-hour", rushHour],
  ["icon-hud-effect-gear-fanny-pack", fannyPack],
  ["icon-hud-effect-gear-hall-pass", hallPass],
  ["icon-hud-effect-gear-lucky-collar", luckyCollar],
  ["icon-hud-effect-gear-running-shoes", runningShoes],
  ["icon-hud-effect-gear-whistle", whistle],
]);

import { fillNames } from "@andornaut/game-kit/lines";
import { keysOf } from "@andornaut/game-kit/records";

import { gameData } from "../data/index.ts";
import { SIZE_STRIP_LINES } from "../hud/buffMarks.ts";
import { effectLine } from "../hud/effectIcons.ts";
import { type FaceText, fillFaceText, ownerFaceText } from "../hud/faceText.ts";
import type { MessageLine } from "../hud/messageStrip.ts";
import { STRIP_LINE_FIELDS } from "../hud/runText.ts";
import { debuffLines } from "../hud/stripLines.ts";
import { minorObstacleNames } from "../runner/obstacleLooks.ts";
import { inkWidth } from "./fontInk.ts";

// Strip lines with two-digit counts and the largest amounts. Representative mode samples
// dog, owner and obstacle widths while keeping every line template.
export function everyStripLine(
  mode: "all" | "representative" = "all",
): (FaceText & Pick<MessageLine, "names">)[] {
  const { strip } = gameData.runText;
  const line = (key: keyof typeof STRIP_LINE_FIELDS, fields: Record<string, FaceText | string>) =>
    fillFaceText(strip[key], fields);
  const dogs = keysOf(gameData.dogs).map((id) => ({
    dog: gameData.dogs[id].name,
    owner: ownerFaceText(gameData, "neutral", id),
  }));
  const obstacles = [
    ...new Set(
      keysOf(gameData.minorObstacles)
        .flatMap((id) => minorObstacleNames(gameData, id))
        .map((name) => name.toLowerCase()),
    ),
  ];
  const width = (text: string) => inkWidth("font-body", { scale: 2 }, text);
  const pick = <T>(values: readonly T[], measure: (value: T) => number, count: number): T[] => {
    const sorted = [...values].sort((a, b) => measure(a) - measure(b));
    return Array.from(
      { length: count },
      (_, i) => sorted[Math.round((i * (sorted.length - 1)) / (count - 1))],
    ).filter((value): value is T => value !== undefined);
  };
  const sampledDogs =
    mode === "representative"
      ? pick(dogs, ({ dog, owner }) => width(dog) + width(owner.text), 4)
      : dogs;
  const sampledObstacles = mode === "representative" ? pick(obstacles, width, 3) : obstacles;
  const amount = "$9,999";
  return [
    ...Object.values(gameData.hints).map(({ text }) => ({ text })),
    ...gameData.achievements.map(({ name }) => line("achievement", { name })),
    // Each debuff's start line at the largest amounts, its lead in its pill as debuffLines marks it.
    ...keysOf(gameData.debuffs).map((debuff) => {
      const started = [{ debuff, secondsLeft: 99, untilZone: 0 }];
      const [said] = debuffLines(gameData, { ended: [], started });
      const fields = { cash: amount, seconds: "99" };
      return { names: said?.names ?? [], text: fillNames(strip.debuffStart[debuff], fields) };
    }),
    ...keysOf(gameData.shopGear).map((gear) =>
      line("effectStart", {
        effect: effectLine(gameData, { gear, kind: "gear" }),
        name: gameData.shopGear[gear].name,
      }),
    ),
    ...Object.values(strip.debuffEnd).map((text) => ({ text })),
    line("luckyNeighbour", { hearts: "10" }),
    line("fullPackHome", { amount }),
    line("luckyWallet", {}),
    line("spareTreatSaved", {}),
    // Each large or small dog's walk-start line, at a two-digit percent.
    ...keysOf(gameData.dogs).flatMap((id) => {
      const { name, size } = gameData.dogs[id];
      return size === "medium" ? [] : [line(SIZE_STRIP_LINES[size], { dog: name, speed: "99%" })];
    }),
    ...sampledDogs.flatMap(({ dog, owner }) => [
      line("fired", { dog, owner }),
      line("secondChance", { owner }),
      line("spareTreatUsed", { owner }),
      line("pull", { dog }),
      line("treat", { dog, hearts: "10", owner }),
      ...sampledObstacles.flatMap((obstacle) => [
        line("dodge", { dog, obstacle }),
        line("plainHit", { dog, hearts: "10", obstacle, owner }),
      ]),
    ]),
  ];
}

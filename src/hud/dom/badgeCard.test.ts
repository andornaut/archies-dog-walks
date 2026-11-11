import { readFileSync } from "node:fs";

import { fontMetrics } from "@andornaut/game-kit/text/bitmapFont";
import { describe, expect, it } from "vitest";

import { gameData } from "../../data/index.ts";
import { badgeCardView } from "../../home/badgeCardView.ts";
import { badgeWall } from "../../home/badgesView.ts";
import { FakeDocument, fakeLayer } from "../../testing/fakeDom.ts";
import { gameFont } from "../../testing/fontInk.ts";
import { domScale } from "../../ui/domScale.ts";
import { showBadgeCard } from "./badgeCard.ts";

const fonts = { body: gameFont("font-body"), title: gameFont("font-title") };
const MEASURE = {
  art: () => ({ height: 32, width: 32 }),
  body: fontMetrics(fonts.body),
  hasTag: () => true,
  inkWidth: () => 40,
  title: fontMetrics(fonts.title),
  wrapBody: (_width: number, text: string) => [text],
};
const CONFETTI_JSON = JSON.parse(
  readFileSync(new URL("../../../public/art/sprites/fx-confetti.json", import.meta.url), "utf8"),
) as { frames: Record<string, { duration: number; frame: { x: number } }> };
const FRAMES = Object.values(CONFETTI_JSON.frames);
const [EARNED] = badgeWall(gameData, [gameData.achievements[0]?.id ?? "roundTrip"]);

// An earned badge's card, its confetti playing on a clock at now, or held still.
async function card(still: boolean) {
  if (EARNED === undefined) {
    throw new Error("No badge");
  }
  const doc = new FakeDocument();
  const { element, layer } = fakeLayer(doc, domScale(1, { height: 560, width: 360, x: 0, y: 0 }));
  const clock = { now: 1000, steps: [] as (() => void)[] };
  showBadgeCard(layer, {
    artUrl: (path) => path,
    closeLabel: gameData.menuText.common.close,
    everyFrame: (step) => {
      clock.steps.push(step);
      return () => undefined;
    },
    fonts,
    loadSheet: () => Promise.resolve(CONFETTI_JSON),
    now: () => clock.now,
    pillColours: () => undefined,
    toGame: (point) => point,
    view: badgeCardView(
      gameData,
      MEASURE,
      { height: 520, width: 360, x: 0, y: 40 },
      {
        badge: EARNED,
        burst: true,
        reduced: still,
      },
    ),
  });
  await Promise.resolve();
  await Promise.resolve();
  const [dialog] = element.children;
  const confetti = dialog?.children.find((node) =>
    node.style.backgroundImage?.includes("fx-confetti"),
  );
  // The frame shown at ms after the card opens, by its place in the sheet, or hidden.
  const at = (ms: number) => {
    clock.now = 1000 + ms;
    clock.steps.forEach((step) => step());
    return confetti?.style.visibility === "hidden" ? undefined : confetti?.style.backgroundPosition;
  };
  return { at, dialog };
}

// At 1x the confetti at 2x takes two device pixels an art pixel.
const position = (index: number) => `${-(FRAMES[index]?.frame.x ?? 0) * 2}px 0px`;

describe("the HTML badge card", () => {
  it("dims what is under it with the shade first, and takes no presses", async () => {
    const { dialog } = await card(true);
    expect(dialog?.className).toContain("adw-passive");
    expect(dialog?.children[0]?.className).toBe("adw-shade");
  });

  it("plays the confetti's frames for their JSON durations by the scene's clock, then hides it", async () => {
    const { at } = await card(false);
    const first = FRAMES[0]?.duration ?? 0;
    const total = FRAMES.reduce((sum, { duration }) => sum + duration, 0);
    expect(at(0)).toBe(position(0));
    expect(at(first)).toBe(position(1));
    expect(at(total)).toBeUndefined();
  });

  it("holds the canvas's still frame under reduced motion", async () => {
    const { at } = await card(true);
    expect(at(0)).toBe(position(4));
    expect(at(60_000)).toBe(position(4));
  });
});

import { pixels } from "@andornaut/game-kit/units";
import { expect, it, vi } from "vitest";

import { gameData } from "../../data/index.ts";
import { SCREEN_LAYOUT } from "../../data/screen.ts";
import { FakeDocument } from "../../testing/fakeDom.ts";
import { gameFont } from "../../testing/fontInk.ts";
import { testState } from "../../testing/runState.ts";
import { PALETTE } from "../../ui/palette.ts";
import { zoneProgressLayout, zoneShare } from "../walkHud.ts";
import { createHudChrome } from "./hudChrome.ts";
import type { HudMoment, HudMomentPainter } from "./hudMoments.ts";
it("retains unchanged native chrome and repaints only changed debuff and progress groups", () => {
  const doc = new FakeDocument();
  const views: HudMoment[] = [];
  const painter = {
    fonts: { body: gameFont("font-body") },
    group: vi.fn(() => {
      const view = {
        art: vi.fn(),
        dispose: vi.fn(),
        element: doc.createElement("div"),
        panel: vi.fn(),
        text: vi.fn(),
      } as unknown as HudMoment;
      views.push(view);
      return view;
    }),
    hasArt: () => true,
  } as unknown as HudMomentPainter;
  const colours = {
    muddy: { face: PALETTE.brown, fill: PALETTE.tan, name: PALETTE.ink },
    spotlight: { face: PALETTE.blue, fill: PALETTE.yellow, name: PALETTE.white },
    stinky: { face: PALETTE.mauve, fill: PALETTE.pink, name: PALETTE.white },
    zoomies: { face: PALETTE.green, fill: PALETTE.yellow, name: PALETTE.ink },
  };
  const chrome = createHudChrome(painter, painter, colours);
  const run = testState({ archie: 3 });
  chrome.update(run);
  const count = views.length;
  chrome.update(run);
  expect(views).toHaveLength(count);
  const debuffed = {
    ...run,
    debuffs: [{ debuff: "muddy" as const, secondsLeft: 1, untilZone: run.zoneIndex }],
    zoneDistance: pixels(100),
  };
  chrome.update(debuffed);
  expect(chrome.bars()).toEqual([{ debuff: "muddy", rect: expect.objectContaining({ x: 0 }) }]);
  expect(views.flatMap((view) => vi.mocked(view.art).mock.calls).map(([art]) => art.key)).toContain(
    "icon-muddy",
  );
  const progress = zoneProgressLayout(SCREEN_LAYOUT.zoneProgress, zoneShare(gameData, debuffed));
  expect(
    views
      .flatMap((view) => vi.mocked(view.panel).mock.calls)
      .some(([rect]) => rect.width === progress.fills[0]?.width && rect.y === progress.fills[0]?.y),
  ).toBe(true);
  chrome.dispose();
  expect(views.filter((view) => !vi.mocked(view.dispose).mock.calls.length)).toEqual([]);
});

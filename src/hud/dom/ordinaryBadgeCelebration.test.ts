import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { keysOf } from "@andornaut/game-kit/runtime/records";
import { expect, it, vi } from "vitest";

import { ownerFaceKey } from "../../assets/spriteKeys.ts";
import { gameData } from "../../data/index.ts";
import { earnedBadges } from "../../home/badgesView.ts";
import { SCREEN_LAYOUT } from "../../layout/screen.ts";
import { FakeDocument, fakeLayer } from "../../testing/fakeDom.ts";
import { fontFileMetrics, gameFont } from "../../testing/fontInk.ts";
import { domScale } from "../../ui/domScale.ts";
import { modalTitleInk } from "../../ui/modal/titleRole.ts";
import { panelButton, panelTitle } from "../../ui/modal/view.ts";
import { showOrdinaryBadgeCelebration } from "./ordinaryBadgeCelebration.ts";

it("renders the complete award as one native modal with badge and cheering-owner art", async () => {
  const doc = new FakeDocument();
  const { element, layer } = fakeLayer(doc, domScale(1, SCREEN_LAYOUT.screen));
  const panel = { height: 244, width: 280, x: 40, y: 160 };
  const measure = {
    body: fontFileMetrics("font-body"),
    inkWidth: (_font: "body" | "title", text: string) => text.length * 10,
    title: fontFileMetrics("font-title"),
    titleInk: (line: string) => modalTitleInk(gameFont("font-title"), line),
    wrapNote: (_room: number, text: string) => [text],
  };
  const close = vi.fn();
  const stop = vi.fn();
  const dog = keysOf(gameData.dogs)[0]!;
  const badges = earnedBadges(gameData, [gameData.achievements[0]!.id]);
  const shown = showOrdinaryBadgeCelebration(layer, {
    artUrl: (path) => path,
    badges,
    close,
    closeLabel: gameData.menuText.common.close,
    everyFrame: () => stop,
    faces: [{ dog, rect: { height: 32, width: 32, x: 80, y: 290 } }],
    fonts: { body: gameFont("font-body"), title: gameFont("font-title") },
    loadSheet: (path) =>
      Promise.resolve(
        JSON.parse(
          readFileSync(resolve(import.meta.dirname, "../../../public/art", path), "utf8"),
        ) as unknown,
      ),
    now: () => 0,
    pillColours: () => undefined,
    reduced: true,
    rows: 1,
    toGame: (point) => point,
    view: {
      button: panelButton(
        measure,
        { height: 48, width: 160, x: 100, y: 340 },
        true,
        gameData.menuText.common.close,
      ),
      names: [],
      panel,
      title: panelTitle(measure, panel, 190, gameData.menuText.common.close),
      titleY: 190,
    },
  });
  await Promise.all([...shown.badges.parts, ...shown.faces].map((part) => part.ready));
  await vi.waitFor(() => expect(shown.panel.accepts()).toBe(true));
  expect(element.all().filter((node) => node.getAttribute("role") === "dialog")).toHaveLength(1);
  expect(element.all().some((node) => node.className === "adw-plate-frame")).toBe(true);
  expect(element.all().some((node) => node.style.backgroundImage?.includes(badges[0]!.art))).toBe(
    true,
  );
  expect(
    element.all().some((node) => node.style.backgroundImage?.includes(ownerFaceKey(gameData, dog))),
  ).toBe(true);
  const buttons = element.all().filter((node) => node.tagName === "button");
  expect(buttons.map((node) => node.getAttribute("aria-label"))).toEqual([
    gameData.menuText.common.close,
    gameData.menuText.common.close,
  ]);
  buttons[0]?.fire("click");
  expect(close).toHaveBeenCalledOnce();
  shown.panel.destroy();
  expect(stop).toHaveBeenCalledTimes(2);
  expect(layer.input.accepts()).toBe(true);
});

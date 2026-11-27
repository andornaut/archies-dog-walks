import type { Scene } from "phaser";
import { expect, it, vi } from "vitest";

import { gameData } from "../data/index.ts";
import { questionView } from "./questionPanel.ts";

vi.mock("phaser", () => ({ Core: { Events: {} }, Scenes: { Events: {} } }));
vi.mock("./modalMeasure.ts", () => ({ canvasPanelMeasure: () => ({}) }));
vi.mock("../hud/index.ts", async (original) => ({
  ...(await original<typeof import("../hud/index.ts")>()),
  questionPanelView: () => ({ buttons: [{ actionIndex: 1 }, { actionIndex: 0 }] }),
}));

it("keeps disabled source actions attached to their sorted native question buttons", () => {
  const view = questionView(
    {} as Scene,
    { height: 600, width: 360, x: 0, y: 0 },
    {
      close: vi.fn(),
      entries: [
        { label: gameData.homeText.backExit.cancel, press: vi.fn() },
        { available: false, label: gameData.homeText.backExit.exit, press: vi.fn() },
      ],
      note: [],
      sentenceLines: false,
      title: gameData.homeText.quit.title,
    },
  );
  expect(view.buttons.map(({ actionIndex, available }) => ({ actionIndex, available }))).toEqual([
    { actionIndex: 1, available: false },
    { actionIndex: 0, available: undefined },
  ]);
});

import { expect, it } from "vitest";

import { gameData } from "../../data/index.ts";
import { fontFileMetrics, gameFont, inkWidth } from "../../testing/fontInk.ts";
import {
  ACTION_LABEL_SCALE,
  domScale,
  gridRect,
  lineInk,
  menuItemLabel,
  menuItems,
  modalActionWidth,
  modalTitleInk,
  navigationMenuWidth,
  panelButton,
  PAUSE_MENU_ITEMS,
  pauseMenuItemLabel,
} from "../index.ts";
import { loadingFailurePresentation } from "./loadingFailureStyle.ts";
import { capRows, textPlace } from "./pixelLine.ts";

const font = gameFont("font-title");
const measure = {
  inkWidth: (_font: "body" | "title", text: string) => inkWidth("font-title", { scale: 2 }, text),
  title: fontFileMetrics("font-title"),
  titleInk: (text: string) => modalTitleInk(font, text),
};
const labels = [
  ...menuItems("page").map((item) => menuItemLabel(gameData, item)),
  ...PAUSE_MENU_ITEMS.map((item) => pauseMenuItemLabel(gameData, item)),
  gameData.menuText.cheats.reset.title,
];

it("sizes fixed 2.25x action ink through the existing measured-width contract", () => {
  for (const label of labels) {
    const width = modalActionWidth(measure.inkWidth("title", label));
    const button = panelButton(measure, { height: 48, width, x: 0, y: 40 }, false, label);
    const ink = lineInk(font, label.toUpperCase(), ACTION_LABEL_SCALE);
    expect(button.text.scale).toBe(2.25);
    expect(button.text.projection).toBe("layout");
    expect(width - (ink.right - ink.left)).toBeGreaterThanOrEqual(32);
    expect(button.text.capTop + (ink.top + ink.bottom) / 2).toBe(64);
  }
  const width = navigationMenuWidth(gameData, measure, 328);
  const longest = Math.max(
    ...labels.map((label) => modalActionWidth(measure.inkWidth("title", label))),
  );
  expect(width - 32 - longest).toBeGreaterThanOrEqual(40);
});

it.each([
  [360, 1],
  [390, 2],
  [393, 3],
  [575, 1],
  [575, 2.625],
])("keeps full ink centred on a painted face at width %s DPR %s", (width, dpr) => {
  const scale = domScale(dpr, { height: 640, width, x: 0, y: 0 });
  for (const label of labels) {
    const face = {
      height: 48,
      width: modalActionWidth(measure.inkWidth("title", label)),
      x: 0,
      y: 40,
    };
    const button = panelButton(measure, face, false, label);
    const place = textPlace(font, scale, { x: 0, y: 0 }, button.text);
    const pixel = place.lineHeight / font.lineHeight;
    expect(pixel).toBeCloseTo(ACTION_LABEL_SCALE * scale.unit * dpr, 9);
    const ink = lineInk(font, label.toUpperCase(), 1);
    const centre = place.top + (capRows(font, "title") + (ink.top + ink.bottom) / 2) * pixel;
    const box = gridRect(scale, face);
    expect(Math.abs(centre - (box.top + box.height / 2)), label).toBeLessThanOrEqual(1);
  }
});

it("enlarges only the recovery action role and removes its flat-fill padding bias", () => {
  const style = loadingFailurePresentation(1);
  expect(style.text.action.sizePx).toBe(20.25);
  expect(style.text.body.sizePx).toBe(18);
  expect(style.text.title.sizePx).toBe(24);
  expect(style.action.heightPx).toBe(48);
  expect(style.action.paddingBottomPx).toBe(0);
});

import { expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { ownerNameWrap } from "../presentation/ownerName.ts";
import { fontFileMetrics, fontInk, fontInkRows, gameFont, inkWidth } from "../testing/fontInk.ts";
import { MODAL } from "../ui/modal/layout.ts";
import { modalTitleInk } from "../ui/modal/titleRole.ts";
import { ACTION_LABEL_SCALE, TEXT_SCALE } from "../ui/textFit.ts";
import { END_LAYOUT } from "./endLayout.ts";
import { type EndMeasure, endScreenView } from "./endScreenView.ts";

const measure: EndMeasure = {
  art: () => undefined,
  body: fontFileMetrics("font-body"),
  bodyWidth: (lines) =>
    Math.max(0, ...lines.map((text) => inkWidth("font-body", { scale: TEXT_SCALE }, text))),
  fitQuip: (_style, text) => ({ lines: [text], scale: TEXT_SCALE }),
  hasTag: () => false,
  inkWidth: (font, text) =>
    inkWidth(`font-${font}`, { scale: TEXT_SCALE }, font === "title" ? text.toUpperCase() : text),
  ownerName: (room, name) => ownerNameWrap(gameFont("font-body"), room, name),
  span: (font, scale, text) => {
    const ink = fontInk(`font-${font}`, { scale }, text);
    return { ...ink, width: ink.right - ink.left };
  },
  title: fontFileMetrics("font-title"),
  titleInk: (text) => modalTitleInk(gameFont("font-title"), text),
  wrapBody: (_room, text) => [text],
  wrapNote: (_room, text) => [text],
};

it("sizes End's ordinary action from its ink and uses the same narrow pointer target", () => {
  const view = endScreenView(gameData, measure, {
    closing: [],
    earned: [],
    lines: [],
    stripNames: () => [],
    walk: {
      dogs: ["archie"],
      earnedCents: 0,
      firings: [],
      outcome: "wentHome",
      route: [],
      zonesFinished: 0,
    } as never,
  });
  const { backToTitle: button } = view;
  const anchor = END_LAYOUT.backToTitle;
  const ink = inkWidth("font-title", { scale: ACTION_LABEL_SCALE }, button.label.toUpperCase());
  expect(button.rect.width).toBe(Math.ceil(ink + 2 * MODAL.pad));
  expect(button.rect.width).toBeLessThan(anchor.width);
  expect(button.rect).toMatchObject({ height: anchor.height, y: anchor.y });
  expect(button.rect.x + button.rect.width / 2).toBe(anchor.x + anchor.width / 2);
  expect(button.hit).toEqual(button.rect);
  expect(button.text.scale).toBe(ACTION_LABEL_SCALE);
  const rows = fontInkRows("font-title", { scale: ACTION_LABEL_SCALE }, button.label.toUpperCase());
  const inkCentre = button.text.capTop + (rows.top + rows.bottom) / 2;
  expect(inkCentre).toBe(anchor.y + anchor.height / 2);
  expect(button.text.centreX).toBe(button.rect.x + button.rect.width / 2);
});

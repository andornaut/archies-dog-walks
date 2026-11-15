import { advanceWidth, fontMetrics } from "@andornaut/game-kit/text/bitmapFont";
import { expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { dollarText } from "../presentation/currency.ts";
import { createDefaultSave } from "../save/schema.ts";
import { gameFont } from "../testing/fontInk.ts";
import { testContext } from "../testing/saves.ts";
import { PALETTE } from "../ui/palette.ts";
import { plainMarks } from "../ui/pixelFont.ts";
import { PLATE_LOOKS } from "../ui/selection.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import { pricePlateView } from "./pricePlateView.ts";
import { gearRows } from "./shop.ts";

const body = gameFont("font-body");
const measure = {
  capHeight: fontMetrics(body).capHeight,
  padding: 3,
  scale: TEXT_SCALE,
  width: (text: string) => advanceWidth(body, TEXT_SCALE, plainMarks(text)),
};
const price = gearRows(gameData, createDefaultSave(testContext.defaults).owned).find(
  (row) => row.price !== null,
)!.price!;

it("keeps a shop price right-aligned with its authored cap-top padding and buy palette", () => {
  const at = { capTop: 34, originX: 1, x: 312 };
  const view = pricePlateView(measure, at, "buy", dollarText(price));
  expect(view.rect.x + view.rect.width).toBe(at.x);
  expect(view.rect.y + measure.padding).toBe(at.capTop);
  expect(view.fills[0]?.colour).toBe(PALETTE[PLATE_LOOKS.buy.edge]);
  expect(view.fills.map(({ colour }) => colour)).toContain(PALETTE[PLATE_LOOKS.buy.face]);
  expect(view.label).toMatchObject({
    centre: "ink",
    font: "body",
    scale: TEXT_SCALE,
    text: dollarText(price),
  });
});

it("centres a home cost on its backing while short prices retain the disabled palette", () => {
  const at = { capTop: 50, originX: 0.5, x: 180 };
  const view = pricePlateView(measure, at, "short", dollarText(price));
  expect(Math.abs(view.rect.x + view.rect.width / 2 - at.x)).toBeLessThanOrEqual(0.5);
  expect(view.label.centreX).toBe(view.rect.x + view.rect.width / 2);
  expect(view.label.colour).toBe(PALETTE[PLATE_LOOKS.short.text]);
  expect(view.fills).toHaveLength(3);
});

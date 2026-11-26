import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";
import {
  advanceWidth,
  type BitmapFont,
  inkWidth,
} from "@andornaut/game-kit/runtime/text/bitmapFont";

import {
  type DomScale,
  fontPixel,
  PALETTE,
  TOP_BAR_WELL,
  topSectionCurrency,
  topSectionCurrencyText,
} from "../index.ts";
import { type DomArtSource, imageThreeSlice } from "./artElements.ts";
import { backedTextPlaces, createTextLine, placeText } from "./pixelLine.ts";

export function createTopSectionMoney(
  doc: Document,
  source: DomArtSource,
  title: BitmapFont,
  origin: Point,
  readScale: () => DomScale,
  currency: Rect | undefined,
) {
  const layout = { currency };
  const money = doc.createElement("div");
  money.className = "adw-lines";
  // art: the cash well's ends, a column each, and its middle column, which stretches.
  const cashArt =
    currency === undefined
      ? undefined
      : imageThreeSlice(
          doc,
          source,
          {
            left: "ui-home-cash-well-left",
            middle: "ui-home-cash-well-mid",
            right: "ui-home-cash-well-right",
          },
          { left: 1, right: 1 },
        );
  if (cashArt !== undefined) {
    money.append(cashArt.element);
  }
  const moneyLine = {
    capTop: 0,
    centre: "left",
    centreX: 0,
    colour: PALETTE.amber,
    font: "title",
    scale: 1,
    text: "$",
  } as const;
  const dollarElement = createTextLine(doc, moneyLine);
  const amountElement = createTextLine(doc, { ...moneyLine, colour: PALETTE.cream, text: "" });
  money.append(dollarElement, amountElement);
  let amount = "";
  let short = "";
  const place = (scale: DomScale) => {
    money.hidden = currency === undefined || amount === "";
    if (money.hidden) {
      return;
    }
    const measure = (at: number, line: string) => inkWidth(title, at, line);
    const text = topSectionCurrencyText(measure, layout, { full: amount, short });
    const { scale: moneyScale } = topSectionCurrency(layout, 0);
    const placement = topSectionCurrency(layout, measure(moneyScale, `$${text}`));
    const rect = placement.well;
    cashArt?.place(scale, origin, rect);
    const dollar = {
      ...moneyLine,
      capTop: placement.top,
      centreX: placement.left,
      scale: placement.scale,
    };
    const digits = {
      ...dollar,
      centreX:
        placement.left +
        advanceWidth(title, placement.scale, `$${text}`) -
        advanceWidth(title, placement.scale, text),
      colour: PALETTE.cream,
      text,
    };
    amountElement.textContent = text;
    placeText(title, scale, origin, dollarElement, dollar);
    placeText(title, scale, origin, amountElement, digits);
    const whole = { ...dollar, text: `$${text}` };
    const centred = backedTextPlaces(
      title,
      scale,
      origin,
      // The well's flat face, less its lip's row and column.
      { ...rect, height: rect.height - TOP_BAR_WELL.lip, width: rect.width - TOP_BAR_WELL.lip },
      [whole],
      "layout",
    )[0]!;
    dollarElement.style.left = `${centred.left}px`;
    const pen = advanceWidth(title, 1, whole.text) - advanceWidth(title, 1, text);
    amountElement.style.left = `${centred.left + pen * fontPixel(scale, placement.scale)}px`;
    for (const element of [dollarElement, amountElement]) {
      element.style.top = `${centred.top}px`;
    }
  };
  return {
    element: money,
    place,
    ready: cashArt?.ready,
    setAmount(full: string, abbreviated: string) {
      if (amount === full && short === abbreviated) {
        return;
      }
      amount = full;
      short = abbreviated;
      place(readScale());
    },
  };
}

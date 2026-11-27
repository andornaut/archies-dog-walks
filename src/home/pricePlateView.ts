import type { Rect } from "@andornaut/game-kit/runtime/rect";

import { PALETTE, type PanelText, PLATE_LOOKS, type PlateKind } from "../ui/index.ts";

export interface PricePlateMeasure {
  readonly capHeight: number;
  readonly padding: number;
  readonly scale: number;
  // The rendered advance of a body-font line at scale, in game pixels.
  readonly width: (text: string) => number;
}

export interface PricePlateView {
  readonly fills: readonly { readonly colour: number; readonly rect: Rect }[];
  readonly label: PanelText;
  readonly rect: Rect;
}

// Home and shop prices share one backing geometry and palette contract.
export function pricePlateView(
  measure: PricePlateMeasure,
  at: { readonly capTop: number; readonly originX: number; readonly x: number },
  kind: PlateKind,
  text: string,
): PricePlateView {
  const colours = PLATE_LOOKS[kind];
  const width = Math.ceil(measure.width(text)) + 2 * measure.padding;
  const height = measure.capHeight * measure.scale + 2 * measure.padding;
  const rect = {
    height,
    width,
    x: Math.round(at.x - at.originX * width),
    y: at.capTop - measure.padding,
  };
  const face = { height: height - 2, width: width - 2, x: rect.x + 1, y: rect.y + 1 };
  const fills: { colour: number; rect: Rect }[] = [
    { colour: PALETTE[colours.edge], rect: { ...rect, width: width - 2, x: rect.x + 1 } },
    { colour: PALETTE[colours.edge], rect: { ...rect, height: height - 2, y: rect.y + 1 } },
    { colour: PALETTE[colours.face], rect: face },
  ];
  if (colours.lit !== null) {
    fills.push({ colour: PALETTE[colours.lit], rect: { ...face, height: 1 } });
  }
  if (colours.shade !== null) {
    fills.push({
      colour: PALETTE[colours.shade],
      rect: { ...face, height: 1, y: face.y + face.height - 1 },
    });
  }
  return {
    fills,
    label: {
      capTop: at.capTop,
      centre: "ink",
      centreX: rect.x + width / 2,
      colour: PALETTE[colours.text],
      font: "body",
      line: 0,
      scale: measure.scale,
      text,
    },
    rect,
  };
}

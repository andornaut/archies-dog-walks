import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";

import type { DomPart } from "../../ui/dom/parts.ts";
import { type PillColours, textBlock } from "../../ui/dom/textBlock.ts";
import type { DomScale } from "../../ui/domScale.ts";
import { TEXT_SCALE } from "../../ui/textFit.ts";
import type { DetailText } from "../detailCardView.ts";

// What a detail text draws with: each font it may be set in, and the colours of a name's pill of
// a kind and of its name, or undefined for none.
export interface DetailTextInput {
  readonly fonts: Readonly<Record<NonNullable<DetailText["font"]>, BitmapFont>>;
  readonly pillColours: PillColours;
}

// A detail text as a paragraph text block (textBlock), anchored by its alignment.
export function textPart(
  doc: Document,
  input: DetailTextInput,
  text: DetailText,
  // Device pixels to move it right by at a scale, as a run of a centred row (rowPart).
  shift: (scale: DomScale) => number = () => 0,
): DomPart {
  const { align, ...rest } = text;
  const font = text.font ?? "body";
  const block = textBlock(
    doc,
    { fonts: input.fonts, pillColours: input.pillColours, spoken: true, tag: "p" },
    {
      ...rest,
      // A left-aligned label starts its pen at x in the body font and its ink in the title font,
      // as addPixelText places it.
      anchor:
        align === "centre" || align === "inkCentre" || align === "inkRight" || align === "right"
          ? align
          : font === "title"
            ? "ink"
            : "pen",
      font,
      scale: text.scale ?? TEXT_SCALE,
    },
  );
  return {
    element: block.element,
    place: (scale) => block.place(scale, undefined, shift(scale)),
  };
}

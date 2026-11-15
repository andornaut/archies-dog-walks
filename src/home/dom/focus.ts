import { insetRect, type Rect, ringRects } from "@andornaut/game-kit/rect";

import { fillPart } from "../../hud/dom/shopPage.ts";
import type { DomScale } from "../../ui/domScale.ts";
import { PALETTE } from "../../ui/palette.ts";
export function createHomeFocus(
  doc: Document,
  input:
    | {
        readonly rect: Rect;
        readonly outset: number;
      }
    | undefined,
): {
  readonly element: HTMLElement;
  place(scale: DomScale): void;
} {
  const element = doc.createElement("span");
  element.className = "adw-framed";
  const parts =
    input === undefined
      ? []
      : ringRects(2, insetRect(-input.outset, input.rect)).map((rect) =>
          fillPart(doc, { colour: PALETTE.cyan, rect }),
        );
  element.append(...parts.map(({ element }) => element));
  return {
    element,
    place: (scale) => {
      parts.forEach((part) => part.place(scale));
    },
  };
}

import { insetRect, type Rect, ringRects } from "@andornaut/game-kit/runtime/rect";
import { type BitmapFont, fontMetrics } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { SLICES } from "../../data/layout.ts";
import { framedPart } from "../../hud/dom/detailCard.ts";
import { fillPart } from "../../hud/dom/shopPage.ts";
import { type DomArtSource, sheetArt, sheetNineSlice } from "../../ui/dom/artElements.ts";
import { createGameButton } from "../../ui/dom/gameButton.ts";
import { createTextLine, placeBackedText, placeBox, setBox } from "../../ui/dom/pixelLine.ts";
import type { SheetFrame } from "../../ui/dom/sheetFrames.ts";
import { artPixel, type DomScale, gridRect, gridX, gridY } from "../../ui/domScale.ts";
import { PALETTE } from "../../ui/palette.ts";
import { AFFORD_OUTSET, GREYED } from "../../ui/selection.ts";
import { FEEDBACK } from "../feedback.ts";
import { HOME_LAYOUT, slotSignText } from "../homeLayout.ts";
import type { slotSign } from "../slotSign.ts";
export function createSlotSign(
  doc: Document,
  source: DomArtSource & {
    readonly hasArt: (key: string) => boolean;
  },
  body: BitmapFont,
  activate: () => void,
  { crop, focused }: { readonly crop: Rect; readonly focused?: boolean },
  sign: NonNullable<ReturnType<typeof slotSign>>,
): {
  readonly element: HTMLButtonElement;
  readonly ready: Promise<readonly string[]>;
  dispose(): void;
  place(
    scale: DomScale,
    motion: {
      readonly pressed: boolean;
      readonly x: number;
      readonly y: number;
    },
  ): void;
  setAffordFrame(frame: SheetFrame): void;
} {
  const layout = HOME_LAYOUT.slotSign;
  const paint = doc.createElement("span");
  paint.className = "adw-framed";
  const button = createGameButton(doc, {
    appearance: { className: "adw-slot-sign" },
    content: { icon: paint, kind: "icon", name: sign.lines.join(" ") },
    getAction: () => ({ activate }),
    skin: "authored",
  });
  const { element, face } = button;
  element.style.position = "absolute";
  element.style.pointerEvents = "auto";
  element.style.overflow = "visible";
  element.toggleAttribute("data-picker-focused", focused === true);
  Object.assign(face.style, { inset: "0", pointerEvents: "none", position: "absolute" });
  const art = source.hasArt(layout.key) ? sheetArt(doc, source, layout.key) : undefined;
  const fallback =
    art === undefined
      ? framedPart(doc, { border: PALETTE.ink, fill: PALETTE.cream, rect: layout.board })
      : undefined;
  if (art !== undefined) {
    paint.append(art.element);
  }
  if (fallback !== undefined) {
    paint.append(fallback.element);
  }
  const origin = layout.hit;
  const at = slotSignText(fontMetrics(body));
  const focusFace = doc.createElement("span");
  focusFace.className = "adw-framed adw-slot-sign-focus";
  paint.append(focusFace);
  const lines = sign.lines.map(
    (text, i) =>
      ({
        capTop: i === 0 ? at.headCapY : at.priceCapY,
        centre: "ink",
        centreX: at.x,
        colour:
          PALETTE[
            i === 0 ? layout.headColour : sign.affordable ? layout.priceColour : GREYED.shortPrice
          ],
        font: "body",
        projection: "layout",
        scale: layout.scale,
        text,
      }) as const,
  );
  const labels = lines.map((line) => createTextLine(doc, line));
  paint.append(...labels);
  const afford =
    sign.affordable && source.hasArt("ui-afford")
      ? sheetNineSlice(doc, source, "ui-afford", SLICES["ui-afford"])
      : undefined;
  if (afford !== undefined) {
    paint.append(afford.element);
  }
  const outer = insetRect(-AFFORD_OUTSET, layout.board);
  const affordFallback =
    sign.affordable && afford === undefined
      ? [
          ...ringRects(1, outer).map((rect) => fillPart(doc, { colour: PALETTE.plum, rect })),
          ...ringRects(1, insetRect(1, outer)).map((rect) =>
            fillPart(doc, { colour: PALETTE.amber, rect }),
          ),
        ]
      : [];
  paint.append(...affordFallback.map(({ element }) => element));
  let affordFrame: SheetFrame | undefined;
  let key = "";
  return {
    dispose: button.dispose,
    element,
    place: (scale, motion) => {
      const next = [
        scale.unit,
        scale.dpr,
        scale.origin.x,
        scale.origin.y,
        motion.pressed,
        motion.x,
        motion.y,
        affordFrame?.x,
        affordFrame?.y,
      ].join(":");
      if (next === key) {
        return;
      }
      key = next;
      const box = gridRect(scale, origin);
      setBox(element, box);
      const mask = gridRect(scale, crop);
      const left = mask.left - box.left,
        top = mask.top - box.top;
      const points = [
        [left, top],
        [left + mask.width, top],
        [left + mask.width, top + mask.height],
        [left, top + mask.height],
      ];
      element.style.clipPath = `polygon(${points.map(([x, y]) => `${x}px ${y}px`).join(",")})`;
      const pixel = artPixel(scale);
      const drop = art === undefined && motion.pressed ? FEEDBACK.pressDipPx : 0;
      const x = Math.round(motion.x) * pixel;
      const y = Math.round(motion.y + drop) * pixel;
      paint.style.transform = `translate(${x}px,${y}px)`;
      if (fallback !== undefined) {
        fallback.place(scale);
        fallback.element.style.transform = `translate(${-gridX(scale, origin.x)}px,${-gridY(scale, origin.y)}px)`;
      }
      for (const part of affordFallback) {
        part.place(scale);
        part.element.style.transform = `translate(${-gridX(scale, origin.x)}px,${-gridY(scale, origin.y)}px)`;
      }
      art?.place(scale, origin, {
        ...layout.art,
        projection: "layout",
        tag: motion.pressed ? "pressed" : "normal",
      });
      const pressDrop = art !== undefined && motion.pressed ? layout.pressDrop : 0;
      const cream = { ...at.cream, y: at.cream.y + pressDrop };
      placeBox(scale, origin, focusFace, cream);
      placeBackedText(
        body,
        scale,
        origin,
        cream,
        lines.map((line, i) => ({
          element: labels[i]!,
          line: { ...line, capTop: line.capTop + pressDrop },
        })),
        "layout",
      );
      afford?.place(scale, origin, {
        ...insetRect(-AFFORD_OUTSET, layout.board),
        tag: "glint",
        ...(affordFrame === undefined ? {} : { frame: affordFrame }),
      });
    },
    ready: Promise.all([
      ...(art === undefined ? [] : [art.ready]),
      ...(afford === undefined ? [] : [afford.ready]),
    ]).then((urls) => urls.flat()),
    setAffordFrame: (frame) => {
      affordFrame = frame;
    },
  };
}

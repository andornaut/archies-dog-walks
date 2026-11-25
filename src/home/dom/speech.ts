import { type Rect, ringRects } from "@andornaut/game-kit/runtime/rect";
import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { SLICES } from "../../data/layout.ts";
import { textPart } from "../../hud/dom/detailCard.ts";
import { type DomArtSource, imageArt, imageNineSlice, sheetArt } from "../../ui/dom/artElements.ts";
import { type DomPart, fillPart, framedPart } from "../../ui/dom/parts.ts";
import { createTextLine, placeText } from "../../ui/dom/pixelLine.ts";
import type { SheetFrame } from "../../ui/dom/sheetFrames.ts";
import type { DomScale } from "../../ui/domScale.ts";
import { PALETTE } from "../../ui/palette.ts";
import type { HomeSpeechView } from "../speechView.ts";

// art: each tail's cream inside, row by row from the tail's top-left, which the bubble's focus
// fill covers with its inside. ui-quip-tail-down narrows a column a row from columns 2 to 5.
export const SPEECH_TAIL_INSIDES: Readonly<Record<string, readonly Rect[]>> = {
  "ui-quip-tail-down": [
    { height: 1, width: 4, x: 2, y: 0 },
    { height: 1, width: 3, x: 3, y: 1 },
    { height: 1, width: 2, x: 4, y: 2 },
    { height: 1, width: 1, x: 5, y: 3 },
  ],
};

export function createHomeSpeech(
  doc: Document,
  source: DomArtSource & {
    readonly hasArt: (key: string) => boolean;
    readonly imageSize: (key: string) => {
      readonly width: number;
      readonly height: number;
    };
  },
  fonts: {
    readonly body: BitmapFont;
    readonly title: BitmapFont;
  },
  pillColours: (index: number) =>
    | {
        readonly name: number;
        readonly pill: number;
      }
    | undefined,
  view: HomeSpeechView,
): {
  readonly element: HTMLElement;
  readonly ready: Promise<readonly string[]>;
  place(scale: DomScale): void;
  setOwnerFrame(frame: SheetFrame): void;
} {
  const element = doc.createElement("div");
  element.className = "adw-framed";
  const parts: DomPart[] = [];
  const ready: Promise<readonly string[]>[] = [];
  const origin = { x: 0, y: 0 };
  if (source.hasArt("ui-quip")) {
    const frame = imageNineSlice(
      doc,
      source,
      "ui-quip",
      source.imageSize("ui-quip"),
      SLICES["ui-quip"],
    );
    ready.push(frame.ready);
    parts.push({ element: frame.element, place: (scale) => frame.place(scale, origin, view.rect) });
  } else {
    parts.push(framedPart(doc, { border: PALETTE.plum, fill: PALETTE.cream, rect: view.rect }));
  }
  // The keyboard focus's fill over the bubble's cream inside, which uiStyle shows while the
  // bubble is focused. art: ui-quip's inside, 2 rows in from its top and left and 3 from its
  // right and bottom, clear of the frame's plum line and tan shade.
  const focus = fillPart(doc, {
    colour: PALETTE.cyan,
    rect: {
      height: view.rect.height - 5,
      width: view.rect.width - 5,
      x: view.rect.x + 2,
      y: view.rect.y + 2,
    },
  });
  focus.element.classList.add("adw-speech-focus");
  parts.push(focus);
  const words = textPart(
    doc,
    { fonts, pillColours },
    {
      align: "centre",
      capTop: view.capTop,
      colour: PALETTE.plum,
      lines: view.lines,
      x: view.textX,
    },
  );
  parts.push(words);
  let ownerFrame: SheetFrame | undefined;
  if (view.owner !== undefined) {
    const owner = view.owner;
    parts.push(fillPart(doc, { colour: PALETTE.tan, rect: owner.face }));
    if (source.hasArt(owner.key)) {
      const face = sheetArt(doc, source, owner.key);
      ready.push(face.ready);
      parts.push({
        element: face.element,
        place: (scale) =>
          face.place(scale, origin, {
            projection: "layout",
            tag: "happy",
            x: owner.face.x,
            y: owner.face.y,
            ...(ownerFrame === undefined ? {} : { frame: ownerFrame }),
          }),
      });
    }
    parts.push(
      ...ringRects(1, owner.face).map((rect) => fillPart(doc, { colour: PALETTE.ink, rect })),
    );
    const line = {
      capTop: owner.name.capTop,
      centre: "ink",
      centreX: owner.name.x,
      colour: PALETTE.rust,
      font: "body",
      scale: 1,
      text: owner.name.text,
    } as const;
    const name = createTextLine(doc, line);
    name.classList.add("adw-speech-name");
    parts.push({
      element: name,
      place: (scale) => placeText(fonts.body, scale, origin, name, line),
    });
  }
  if (view.tail !== undefined) {
    const tail = view.tail;
    const art = imageArt(doc, source, tail.key);
    ready.push(art.ready);
    parts.push({
      element: art.element,
      place: (scale) =>
        art.place(scale, origin, { ...source.imageSize(tail.key), x: tail.x, y: tail.y }),
    });
    for (const row of SPEECH_TAIL_INSIDES[tail.key] ?? []) {
      const inside = fillPart(doc, {
        colour: PALETTE.cyan,
        rect: { ...row, x: tail.x + row.x, y: tail.y + row.y },
      });
      inside.element.classList.add("adw-speech-tail-focus");
      parts.push(inside);
    }
  }
  element.append(...parts.map(({ element }) => element));
  let placement = "";
  return {
    element,
    place: (scale) => {
      const key = [
        scale.unit,
        scale.dpr,
        scale.origin.x,
        scale.origin.y,
        ownerFrame?.x,
        ownerFrame?.y,
      ].join(":");
      if (key === placement) {
        return;
      }
      placement = key;
      for (const part of parts) {
        part.place(scale);
      }
    },
    ready: Promise.all(ready).then((urls) => urls.flat()),
    setOwnerFrame: (frame) => {
      ownerFrame = frame;
    },
  };
}

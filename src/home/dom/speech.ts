import { type Rect, ringRects } from "@andornaut/game-kit/runtime/rect";
import {
  type BitmapFont,
  fontMetrics,
  laidGlyphs,
} from "@andornaut/game-kit/runtime/text/bitmapFont";

import { SLICES } from "../../data/index.ts";
import {
  createTextLine,
  type DomArtSource,
  type DomPart,
  fillPart,
  framedPart,
  imageArt,
  imageNineSlice,
  namePillBoxes,
  placeText,
  setBox,
  sheetArt,
  type SheetFrame,
} from "../../ui/dom/index.ts";
import {
  type DomScale,
  frameRect,
  inkWithPills,
  lineInk,
  PALETTE,
  plainMarks,
  TEXT_SCALE,
} from "../../ui/index.ts";
import { HOME_LAYOUT, type HomeSpeechView } from "../index.ts";
import { textPart } from "./detailText.ts";

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

// The rows lines of 2x body text ink, from the first line's capitals: each line's glyphs and each
// name's pill as it is painted, the lines a line of the font apart.
function speechInk(body: BitmapFont, lines: readonly string[]): { bottom: number; top: number } {
  const { capTop, lineHeight } = fontMetrics(body);
  const rows = lines.flatMap((line, i) => {
    const text = plainMarks(line);
    const caps = i * lineHeight * TEXT_SCALE;
    const ink = lineInk(body, text, TEXT_SCALE);
    const pills = namePillBoxes(body, TEXT_SCALE, { x: 0, y: caps - capTop * TEXT_SCALE }, text);
    return [
      ...(ink.bottom > ink.top ? [{ bottom: caps + ink.bottom, top: caps + ink.top }] : []),
      ...pills.map(({ box }) => ({ bottom: box.top + box.height, top: box.top })),
    ];
  });
  return rows.length === 0
    ? { bottom: 0, top: 0 }
    : {
        bottom: Math.max(...rows.map(({ bottom }) => bottom)),
        top: Math.min(...rows.map(({ top }) => top)),
      };
}

// The row of the first line's capitals in a bubble at rect: the lines' ink (speechInk) centred
// down the cream between the quip art's rims, any odd row left under it.
function speechCapTop(body: BitmapFont, lines: readonly string[], rect: Rect): number {
  const { rim } = HOME_LAYOUT.speech;
  const ink = speechInk(body, lines);
  const cream = rect.height - rim.top - rim.bottom;
  return rect.y + rim.top + Math.floor((cream - (ink.bottom - ink.top)) / 2) - ink.top;
}

// The column a line's visible ink centres on as the text block's inkCentre places it: centre
// moved by as far as the line's glyphs' middle is from the middle of its glyphs and pills, so
// its glyphs and pills together centre on centre.
function lineInkX(body: BitmapFont, line: string, centre: number): number {
  const chars = laidGlyphs(body, 1, plainMarks(line)).map((glyph) => ({ ...glyph, line: 0 }));
  const glyphs = chars.flatMap(({ ink }) => (ink === null ? [] : [ink]));
  const visible = inkWithPills(1, chars);
  if (glyphs.length === 0 || visible === null) {
    return centre;
  }
  const glyphMiddle =
    (Math.min(...glyphs.map(({ left }) => left)) + Math.max(...glyphs.map(({ right }) => right))) /
    2;
  return centre + (glyphMiddle - (visible.left + visible.right) / 2) * TEXT_SCALE;
}

// A part of the bubble's focus fill over rect, its corner on the art-pixel grid and its size whole
// art pixels; uiStyle shows it and gives its colour.
function focusPart(doc: Document, className: string, rect: Rect): DomPart {
  const element = doc.createElement("div");
  element.className = `adw-framed ${className}`;
  return { element, place: (scale) => setBox(element, frameRect(scale, rect)) };
}

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
  // The keyboard focus's fill over the bubble's cream inside, which uiStyle shows and colours
  // while the bubble is focused, clear of the frame's rim and sides.
  const { rim } = HOME_LAYOUT.speech;
  parts.push(
    focusPart(doc, "adw-speech-focus", {
      height: view.rect.height - rim.top - rim.bottom,
      width: view.rect.width - rim.left - rim.right,
      x: view.rect.x + rim.left,
      y: view.rect.y + rim.top,
    }),
  );
  // Each line's visible ink, its pills' included, centred across the cream between the frame's
  // sides, or across the text's column beside an owner, the block's ink centred down the cream.
  const centre =
    view.owner === undefined
      ? view.rect.x + rim.left + (view.rect.width - rim.left - rim.right) / 2
      : view.textX;
  const capTop = speechCapTop(fonts.body, view.lines, view.rect);
  const { lineHeight } = fontMetrics(fonts.body);
  parts.push(
    ...view.lines.map((line, i) =>
      textPart(
        doc,
        { fonts, pillColours },
        {
          align: "inkCentre",
          capTop: capTop + i * lineHeight * TEXT_SCALE,
          colour: PALETTE.plum,
          lines: [line],
          x: lineInkX(fonts.body, line, centre),
        },
      ),
    ),
  );
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
      scale: TEXT_SCALE,
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
      parts.push(
        focusPart(doc, "adw-speech-tail-focus", {
          ...row,
          x: tail.x + row.x,
          y: tail.y + row.y,
        }),
      );
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

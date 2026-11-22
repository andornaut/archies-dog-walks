import type { Rect } from "@andornaut/game-kit/runtime/rect";
import {
  advanceWidth,
  type BitmapFont,
  fontMetrics,
} from "@andornaut/game-kit/runtime/text/bitmapFont";

import { type DomArtSource, imageArt, sheetArt } from "../../ui/dom/artElements.ts";
import { createGameButton } from "../../ui/dom/gameButton.ts";
import { createTextLine, placeBackedText, placeText, setBox } from "../../ui/dom/pixelLine.ts";
import type { SheetFrame } from "../../ui/dom/sheetFrames.ts";
import { type DomScale, frameRect, gridX, gridY } from "../../ui/domScale.ts";
import { itemTileLook } from "../../ui/interaction.ts";
import { PALETTE } from "../../ui/palette.ts";
import { plainMarks } from "../../ui/pixelFont.ts";
import { TEXT_SCALE } from "../../ui/textFit.ts";
import { HOME_LAYOUT } from "../homeLayout.ts";
import { plateStripView, pricePlateView } from "../pricePlateView.ts";
import { homeSelectionColour, type HomeSelectionView } from "../selectionView.ts";
import { createSelectionTile, type NativeTileFill } from "./selectionTile.ts";
interface SelectionArtSource extends DomArtSource {
  readonly hasArt: (key: string) => boolean;
  readonly imageSize: (key: string) => {
    readonly width: number;
    readonly height: number;
  };
  readonly isSheet: (key: string) => boolean;
  readonly disabledKey: (key: string) => string;
}
export interface SelectionMotion {
  readonly x: number;
  readonly y: number;
  readonly faceY: number;
  readonly refusing: boolean;
  readonly markY: number;
}
export interface NativeHomeSelection {
  readonly element: HTMLButtonElement;
  readonly ready: Promise<readonly string[]>;
  dispose(): void;
  place(scale: DomScale, motion: SelectionMotion): void;
  setFrame(index: number, frame: string | number | SheetFrame): void;
  setOrbit(fills: readonly NativeTileFill[]): void;
}
const hex = (colour: number) => `#${colour.toString(16).padStart(6, "0")}`;
// Home-specific art and copy compose the shared native tile.
export function createHomeSelection(
  doc: Document,
  source: SelectionArtSource,
  fonts: {
    readonly body: BitmapFont;
    readonly title: BitmapFont;
  },
  context: {
    readonly activate: () => void;
    readonly hold: () => void;
    readonly platePadding: number;
  },
  view: HomeSelectionView,
): NativeHomeSelection {
  const { body } = fonts;
  const { activate, hold, platePadding } = context;
  const control = createGameButton(doc, {
    content: { kind: "icon", name: view.label },
    getAction: () => ({ activate, hold }),
    getState: () => ({ toggled: view.tile.kind === "picked" }),
    skin: "authored",
  });
  const tile = createSelectionTile(doc, source, fonts.title, {
    control,
    frame: source.hasArt("ui-tile") ? "art" : "fallback",
    hit: view.hit,
    mark: view.tile.kind === "picked" ? (source.hasArt("ui-check") ? "art" : "fallback") : "none",
    outset: HOME_LAYOUT.tileSelectOutset,
    rect: view.rect,
    state: itemTileLook(view.tile).state,
  });
  const paint = tile.content,
    origin = view.hit;
  const parts: ((scale: DomScale, motion: SelectionMotion) => void)[] = [];
  const promises: Promise<readonly string[]>[] = [tile.ready];
  const frames = new Map<number, string | number | SheetFrame>();
  let lastPlacement = "";
  const local = (scale: DomScale, rect: Rect) => {
    const box = frameRect(scale, rect);
    return {
      ...box,
      left: box.left - gridX(scale, origin.x),
      top: box.top - gridY(scale, origin.y),
    };
  };
  const fill = (rect: Rect, colour: number) => {
    const box = doc.createElement("span");
    box.className = "adw-framed";
    box.style.backgroundColor = hex(colour);
    paint.append(box);
    parts.push((scale) => setBox(box, local(scale, rect)));
  };
  fill(view.fill.rect, view.fill.colour);
  view.pictures.forEach((picture, index) => {
    const key = view.art === "grey" ? source.disabledKey(picture.key) : picture.key;
    if (!source.hasArt(picture.key) && picture.fallback !== undefined) {
      const line = picture.fallback;
      const label = createTextLine(doc, line);
      paint.append(label);
      parts.push((scale, motion) =>
        placeText(fonts[line.font], scale, origin, label, {
          ...line,
          colour: motion.refusing ? PALETTE.red : line.colour,
        }),
      );
    } else if (source.isSheet(picture.key)) {
      const art = sheetArt(doc, source, picture.key, key);
      paint.append(art.element);
      promises.push(art.ready);
      parts.push((scale, motion) => {
        const frame = frames.get(index);
        art.place(scale, origin, {
          projection: "layout",
          x: picture.x,
          y: picture.y + (index === 0 ? motion.faceY : 0),
          ...(picture.tag === undefined ? {} : { tag: picture.tag }),
          scale: picture.scale,
          ...(frame === undefined ? {} : { frame }),
        });
      });
    } else {
      const art = imageArt(doc, source, picture.key, key);
      const size = source.imageSize(picture.key);
      paint.append(art.element);
      promises.push(art.ready);
      parts.push((scale, motion) =>
        art.place(scale, origin, {
          height: size.height * picture.scale,
          projection: "layout",
          width: size.width * picture.scale,
          x: picture.x,
          y: picture.y + (index === 0 ? motion.faceY : 0),
        }),
      );
    }
  });
  if (view.name !== undefined) {
    const name = view.name;
    const line = {
      capTop: name.capTop,
      centre: "left",
      centreX: name.x,
      colour: homeSelectionColour(view),
      font: "body",
      scale: TEXT_SCALE,
      text: name.text,
    } as const;
    const label = createTextLine(doc, line);
    paint.append(label);
    parts.push((scale, motion) => {
      const shown = { ...line, colour: motion.refusing ? PALETTE.red : line.colour };
      if (name.centreIn === undefined) {
        placeText(body, scale, origin, label, shown);
      } else {
        placeBackedText(body, scale, origin, name.centreIn, [{ element: label, line: shown }]);
      }
    });
  }
  if (view.plate !== undefined) {
    const measure = {
      capHeight: fontMetrics(body).capHeight,
      padding: platePadding,
      scale: TEXT_SCALE,
      width: (text: string) => advanceWidth(body, TEXT_SCALE, plainMarks(text)),
    };
    const plate =
      view.plate.strip === undefined
        ? pricePlateView(measure, view.plate, view.plate.kind, view.plate.text)
        : plateStripView(
            measure,
            view.plate.strip,
            view.tile.kind === "picked" ? "picked" : view.plate.kind,
            view.plate.text,
          );
    for (const part of plate.fills) {
      fill(part.rect, part.colour);
    }
    const label = createTextLine(doc, plate.label);
    paint.append(label);
    parts.push((scale, motion) =>
      placeBackedText(body, scale, origin, plate.rect, [
        {
          element: label,
          line: { ...plate.label, colour: motion.refusing ? PALETTE.red : plate.label.colour },
        },
      ]),
    );
  }
  if (view.badge !== undefined) {
    const badge = view.badge;
    const art = imageArt(doc, source, `icon-${badge.kind}`);
    paint.append(art.element);
    promises.push(art.ready);
    parts.push((scale) =>
      art.place(scale, origin, {
        ...source.imageSize(`icon-${badge.kind}`),
        x: badge.x,
        y: badge.y,
      }),
    );
  }
  return {
    dispose: control.dispose,
    element: tile.element,
    place: (scale, motion) => {
      tile.place(scale, motion);
      const key = [
        scale.unit,
        scale.dpr,
        scale.origin.x,
        scale.origin.y,
        motion.faceY,
        motion.refusing,
      ].join(":");
      if (key === lastPlacement) {
        return;
      }
      lastPlacement = key;
      for (const part of parts) {
        part(scale, motion);
      }
    },
    ready: Promise.all(promises).then((groups) => groups.flat()),
    setFrame: (index, frame) => {
      if (frames.get(index) !== frame) {
        frames.set(index, frame);
        lastPlacement = "";
      }
    },
    setOrbit: (fills) => tile.setOrbit(fills),
  };
}

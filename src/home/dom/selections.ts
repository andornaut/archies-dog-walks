import type { Rect } from "@andornaut/game-kit/runtime/rect";
import {
  advanceWidth,
  type BitmapFont,
  fontMetrics,
} from "@andornaut/game-kit/runtime/text/bitmapFont";

import {
  createGameButton,
  createTextLine,
  type DomArtSource,
  imageArt,
  placeBackedText,
  placeText,
  setBox,
  sheetArt,
  type SheetFrame,
} from "../../ui/dom/index.ts";
import {
  cssHex,
  type DomScale,
  frameRect,
  gridX,
  gridY,
  itemTileLook,
  plainMarks,
  TEXT_SCALE,
} from "../../ui/index.ts";
import {
  homeSelectionColour,
  type HomeSelectionView,
  plateStripView,
  type PricePlateView,
  pricePlateView,
} from "../index.ts";
import { createSelectionTile } from "./selectionTile.ts";
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
  readonly faceY: number;
  readonly pressed?: boolean;
  readonly refusing: boolean;
  readonly markY: number;
}
export interface NativeHomeSelection {
  readonly element: HTMLButtonElement;
  readonly ready: Promise<readonly string[]>;
  dispose(): void;
  place(scale: DomScale, motion: SelectionMotion): void;
  setFrame(index: number, frame: string | number | SheetFrame): void;
}
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
    readonly focused?: boolean;
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
  control.element.toggleAttribute("data-picker-focused", context.focused === true);
  const tile = createSelectionTile(doc, source, fonts.title, {
    control,
    focus: "content",
    hit: view.hit,
    mark: view.tile.kind === "picked" ? (source.hasArt("ui-check") ? "art" : "fallback") : "none",
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
  const fill = (rect: Rect, colour?: number) => {
    const box = doc.createElement("span");
    box.className = "adw-framed";
    if (colour !== undefined) {
      box.style.backgroundColor = cssHex(colour);
    }
    paint.append(box);
    parts.push((scale) => setBox(box, local(scale, rect)));
    return box;
  };
  const nameStrip = view.strip !== undefined && view.strip.text === view.label;
  const pictureWell = fill(view.fill.rect, view.fill.colour);
  if (view.name === undefined && !nameStrip) {
    pictureWell.classList.add("adw-selection-focus-fill");
  }
  view.pictures.forEach((picture, index) => {
    const key = view.art === "grey" ? source.disabledKey(picture.key) : picture.key;
    if (!source.hasArt(picture.key) && picture.fallback !== undefined) {
      const { line, picture: backing } = picture.fallback;
      const label = createTextLine(doc, line);
      paint.append(label);
      parts.push((scale) =>
        placeBackedText(fonts[line.font], scale, origin, backing, [{ element: label, line }]),
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
    // A centred name's line starts at its area's corner; its ink is placed on the area.
    const at = "centreIn" in name ? { capTop: name.centreIn.y, x: name.centreIn.x } : name;
    const line = {
      capTop: at.capTop,
      centre: "left",
      centreX: at.x,
      colour: homeSelectionColour(view),
      font: "body",
      scale: TEXT_SCALE,
      text: name.text,
    } as const;
    const label = createTextLine(doc, line);
    label.classList.add("adw-selection-focus-ink");
    const nameArea =
      "centreIn" in name
        ? name.centreIn
        : {
            height: fontMetrics(body).capHeight * TEXT_SCALE + 2,
            width: view.rect.x + view.rect.width - 2 - name.x,
            x: name.x,
            y: name.capTop - 1,
          };
    fill(nameArea).classList.add("adw-selection-focus-fill", "adw-selection-name-cue");
    paint.append(label);
    parts.push((scale) => {
      if ("centreIn" in name) {
        placeBackedText(body, scale, origin, name.centreIn, [{ element: label, line }]);
      } else {
        placeText(body, scale, origin, label, line);
      }
    });
  }
  let plate: PricePlateView | undefined;
  if (view.strip !== undefined) {
    plate = plateStripView(view.tile.kind === "picked", view.strip);
  } else if (view.plate !== undefined) {
    const measure = {
      capHeight: fontMetrics(body).capHeight,
      padding: platePadding,
      scale: TEXT_SCALE,
      width: (text: string) => advanceWidth(body, TEXT_SCALE, plainMarks(text)),
    };
    plate = pricePlateView(measure, view.plate, view.plate.kind, view.plate.text);
  }
  if (plate !== undefined) {
    for (const part of plate.fills) {
      const backing = fill(part.rect, part.colour);
      if (nameStrip && part.rect === plate.rect) {
        backing.classList.add("adw-selection-focus-fill");
      }
    }
    const label = createTextLine(doc, plate.label);
    if (nameStrip) {
      label.classList.add("adw-selection-focus-ink");
    }
    paint.append(label);
    parts.push((scale) =>
      placeBackedText(body, scale, origin, plate.rect, [{ element: label, line: plate.label }]),
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
      control.element.toggleAttribute("data-picker-refusing", motion.refusing);
      control.setPressed(motion.pressed === true);
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
  };
}

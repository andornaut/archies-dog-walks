import "./startSelection.css";

import type { Rect } from "@andornaut/game-kit/runtime/rect";
import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";

import {
  createGameButton,
  createTextLine,
  type DomArtSource,
  type DomTextLine,
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
  GREYED,
  gridRect,
  gridX,
  gridY,
  itemTileLook,
  lineInk,
  PALETTE,
  plainMarks,
  PLATE_LOOKS,
  TEXT_SCALE,
} from "../../ui/index.ts";
import { homeSelectionColour, type HomeSelectionView, START_PICKER_MARK } from "../index.ts";
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
  readonly pressed?: boolean;
  readonly refusing: boolean;
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
  },
  view: HomeSelectionView,
): NativeHomeSelection {
  const { body } = fonts;
  const { activate, hold } = context;
  const control = createGameButton(doc, {
    content: { kind: "icon", name: view.label },
    getAction: () => ({ activate, hold }),
    getState: () => ({ toggled: view.tile.kind === "picked" }),
    skin: "authored",
  });
  control.element.toggleAttribute("data-picker-focused", context.focused === true);
  const tile = createSelectionTile(doc, source, fonts.title, {
    control,
    focus: "face",
    hit: view.hit,
    mark: view.tile.kind === "picked" ? (source.hasArt("ui-check") ? "art" : "fallback") : "none",
    markOffset: START_PICKER_MARK,
    rect: view.rect,
    state: itemTileLook(view.tile).state,
    variant: "start",
  });
  const paint = tile.content,
    origin = view.hit;
  const parts: ((scale: DomScale) => void)[] = [];
  const promises: Promise<readonly string[]>[] = [tile.ready];
  const frames = new Map<number, string | number | SheetFrame>();
  let lastPlacement = "";
  const local = (scale: DomScale, rect: Rect) => {
    const box = gridRect(scale, rect);
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
      parts.push((scale) => {
        const frame = frames.get(index);
        art.place(scale, origin, {
          projection: "layout",
          x: picture.x,
          y: picture.y,
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
      parts.push((scale) =>
        art.place(scale, origin, {
          height: size.height * picture.scale,
          projection: "layout",
          width: size.width * picture.scale,
          x: picture.x,
          y: picture.y,
        }),
      );
    }
  });
  const addLabel = (rect: Rect, text: string, colour: number, left = false) => {
    const ink = lineInk(body, plainMarks(text));
    const line: DomTextLine = {
      capTop: rect.y - ink.top,
      centre: "left",
      centreX: rect.x - ink.left,
      colour,
      font: "body",
      projection: "layout",
      scale: TEXT_SCALE,
      text,
    };
    const element = createTextLine(doc, line);
    element.classList.add("adw-selection-focus-ink");
    paint.append(element);
    parts.push((scale) =>
      left
        ? placeText(body, scale, origin, element, line)
        : placeBackedText(body, scale, origin, rect, [{ element, line }], "layout"),
    );
    return element;
  };
  if (view.name !== undefined) {
    const { align, rect, text } = view.name;
    const picked = view.tile.kind === "picked";
    const locked = view.art === "grey";
    const colour = homeSelectionColour(view);
    if (align === "strip") {
      fill({ ...rect, height: 1 }, PALETTE[locked ? GREYED.edge : "plum"]);
      const body = { ...rect, height: rect.height - 1, y: rect.y + 1 };
      if (picked || locked) {
        fill(body, PALETTE[picked ? "amber" : GREYED.plateFace]).classList.add(
          "adw-start-name-strip",
        );
      }
      addLabel({ ...body, width: body.width - 4, x: body.x + 2 }, text, colour);
    } else {
      addLabel(rect, text, colour, align === "left");
    }
  }
  if (view.plate !== undefined) {
    const { framed, kind, rect, text } = view.plate;
    const colours = PLATE_LOOKS[kind];
    if (framed) {
      fill(rect, PALETTE[colours.edge]).classList.add("adw-selection-plate");
    }
    const inside = framed
      ? { height: rect.height - 2, width: rect.width - 2, x: rect.x + 1, y: rect.y + 1 }
      : rect;
    fill(inside, PALETTE[colours.face]).classList.add("adw-selection-plate");
    const label = addLabel(rect, text, PALETTE[colours.text]);
    label.classList.remove("adw-selection-focus-ink");
    label.classList.add("adw-selection-plate-ink");
  }
  if (view.badge !== undefined) {
    const badge = view.badge;
    const art = imageArt(doc, source, `icon-${badge.kind}`);
    paint.append(art.element);
    promises.push(art.ready);
    parts.push((scale) =>
      art.place(scale, origin, {
        ...source.imageSize(`icon-${badge.kind}`),
        projection: "layout",
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
      tile.place(scale, { markY: 0, x: motion.x });
      const key = [scale.unit, scale.dpr, scale.origin.x, scale.origin.y].join(":");
      if (key === lastPlacement) {
        return;
      }
      lastPlacement = key;
      for (const part of parts) {
        part(scale);
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

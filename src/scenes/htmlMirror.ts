import type { Point, Rect } from "@andornaut/game-kit/rect";
import { Core, type Data, type GameObjects, type Scene, Scenes } from "phaser";

import { artUrl } from "../assets/artFiles.ts";
import { DOM_ART_KEYS, DOM_DISABLED_ART_KEYS, domArtPath } from "../assets/domArt.ts";
import { MANIFEST_CACHE_KEY } from "../assets/phaser/manifestArt.ts";
import { SCREEN_CONFIG } from "../data/screen.ts";
import { addTapBurst } from "../hud/dom/questionPanel.ts";
import { pillKind } from "../hud/effectNames.ts";
import { disabledArtKey, disabledArtPath } from "../ui/disabledArt.ts";
import { drawLabel, LABEL_ALIGN_DATA } from "../ui/dom/labelBlock.ts";
import {
  graphicsFills,
  motionShift,
  scaledArtBox,
  scrollShift,
  sliceParts,
  tileBackground,
} from "../ui/dom/mirrorPlace.ts";
import { setBox } from "../ui/dom/pixelLine.ts";
import { loadedSheet, loadSheet, type SheetFrame, sheetFrameNamed } from "../ui/dom/sheetFrames.ts";
import {
  deviceX,
  deviceY,
  type DomScale,
  gridRect,
  gridTransform,
  gridX,
  gridY,
  scrollbarBoxes,
} from "../ui/domScale.ts";
import { PALETTE } from "../ui/palette.ts";
import { displayBitmapFont } from "../ui/phaser/displayText.ts";
import {
  GREY_PILL,
  type LabelNamePills,
  NAME_PILLS_DATA,
  pillColours,
} from "./effectNameColours.ts";
import { domLabel, LABEL_FONTS } from "./htmlLabels.ts";
import { htmlPanelPlace } from "./questionPanel.ts";
import { MIRROR_SCROLLBAR_DATA, type MirrorScrollbar } from "./scrollView.ts";

// What a scene draws in its marked containers, drawn in HTML over the canvas where the canvas
// draws it: every bitmap label with its name pills, every image, sprite and tiled sprite of art
// the HTML interface has files for (DOM_ART_KEYS, and the disabled tiles' grey copies,
// DOM_DISABLED_ART_KEYS), every nine-slice, filled rectangle and graphics of filled rects, in
// display order, each at its alpha through its containers, as the canvas blends it. The scene
// keeps its objects, which it places, shows, hides, moves and redraws as ever; before each frame
// the HTML follows, and the scene's camera draws them no more. An object or container marked
// MIRROR_CANVAS_DATA stays on the canvas, under all of the HTML. A sprite playing a tag shows the
// frame it is on, so the HTML steps with the scene's clock through the tag's frames and
// durations. A scaled image keeps whole art pixels where it is scaled evenly and spans its game
// length on the grid along an axis stretched alone (scaledArtBox). Placement is the
// art-pixel grid's (src/ui/dom/mirrorPlace.ts): a container places its parts from where it was
// first drawn, each part's corner on the grid, and moves them alike by how far it has moved since
// (a dip, a shake, a lift, a flight) in the whole art pixels nearest that move at the fit, but a
// container marked as a scrolled list
// (MIRROR_SCROLL_DATA) moves its content by its scroll, and one marked with a clip rect
// (MIRROR_CLIP_DATA) clips it there, as the canvas's mask does. It takes no presses: every press
// goes through to the canvas. While the scene is paused or asleep under another page, the canvas
// draws the containers again.

// The data key of a container whose y is a list's scroll: whether the scroll has settled.
export const MIRROR_SCROLL_DATA = "htmlScroll";
export interface MirrorScroll {
  readonly settled: () => boolean;
}

// The data key of a container clipped to a game rect, as a mask clips it on the canvas.
export const MIRROR_CLIP_DATA = "htmlClip";

// The data key of an image the canvas scales across its game rect at the fit (a bar as wide as
// the screen), drawn across that rect on the grid, as the canvas stretches it: true.
export const MIRROR_SPAN_DATA = "htmlSpan";

// The data key of an object or container the canvas draws, under all of the HTML: true.
export const MIRROR_CANVAS_DATA = "htmlCanvas";

export interface HtmlMirror {
  // A tap burst at a game point, over the HTML.
  burst(at: Point): void;
  destroy(): void;
}

// Where a part is drawn from in the HTML: its alpha through its containers, its motion and
// scroll in device pixels, and the clip it is drawn in.
interface Context {
  readonly alpha: number;
  readonly clip: HTMLElement;
  // The game point its containers put their parts at: each container where it was first drawn.
  readonly origin: { x: number; y: number };
  // How far its containers have moved since they were first drawn (a dip, a shake, a lift, a
  // flight), in game pixels.
  readonly motion: { x: number; y: number };
  readonly scroll: { offset: number; settled: boolean } | undefined;
  readonly shown: boolean;
}

interface Entry {
  readonly element: HTMLElement;
  key: string;
  // The fields the part was last drawn from (fillTuple), while they hold.
  tuple?: unknown[] | undefined;
}

const hex = (colour: number) => `#${colour.toString(16).padStart(6, "0")}`;

// An object's data at key, without making a data store for an object that has none.
function dataOf(object: GameObjects.GameObject, key: string): unknown {
  return (object.data as Data.DataManager | null)?.get(key);
}

// A game coordinate as the canvas draws it: a half pixel to the whole pixel below it.
const halfDown = (value: number) => Math.ceil(value - 0.5);

// An opacity as CSS sets it: none at full alpha, else in whole 255ths rounded down, as WebGL
// takes a vertex's alpha, so a fade blends as the canvas blends it.
const opacity = (alpha: number) => (alpha < 1 ? String(Math.floor(alpha * 255) / 255) : "");

// The art the HTML has a file for at a texture key: its PNG's path, and its sheet's JSON path
// for a sprite sheet, a grey copy's its key's.
function artFile(
  sprites: ReadonlySet<string>,
  key: string,
): { json: string | undefined; png: string } | undefined {
  const base = DOM_DISABLED_ART_KEYS.has(key.replace(/-disabled$/, ""))
    ? key.replace(/-disabled$/, "")
    : undefined;
  if (base !== undefined && key === disabledArtKey(base)) {
    const kind = sprites.has(base) ? "sheet" : "image";
    return {
      json: kind === "sheet" ? domArtPath("sheet", base, "json") : undefined,
      png: disabledArtPath(kind, base),
    };
  }
  if (!DOM_ART_KEYS.has(key)) {
    return undefined;
  }
  const kind = sprites.has(key) ? "sheet" : "image";
  return {
    json: kind === "sheet" ? domArtPath("sheet", key, "json") : undefined,
    png: domArtPath(kind, key, "png"),
  };
}

// A frame of art in its sheet, or the whole image, once its sheet's JSON has loaded.
type FrameOf = (
  file: { json: string | undefined; png: string },
  name: number | string,
  size: { height: number; width: number },
) => SheetFrame | undefined;

// element shows from's part of frame's art over its box, from's art pixels scaled to the box.
function showArt(
  element: HTMLElement,
  url: string,
  frame: SheetFrame,
  from: { height: number; width: number; x: number; y: number },
  box: { height: number; width: number },
): void {
  const across = box.width / from.width;
  const down = box.height / from.height;
  Object.assign(element.style, {
    backgroundImage: `url("${url}")`,
    backgroundPosition: `${-(frame.x + from.x) * across}px ${-(frame.y + from.y) * down}px`,
    backgroundSize: `${frame.sheet.width * across}px ${frame.sheet.height * down}px`,
  });
}

// The fields of object its HTML is drawn from, written into out: a frame in which none of them
// and none of its placing changed skips the part's key and its DOM. False for a part drawn from
// data a tuple cannot hold (a scrollbar's), which is keyed every frame.
function fillTuple(out: unknown[], object: GameObjects.GameObject): boolean {
  out.length = 0;
  switch (object.type) {
    case "BitmapText": {
      const label = object as GameObjects.BitmapText;
      const pills = dataOf(label, NAME_PILLS_DATA) as LabelNamePills | undefined;
      out.push(
        label.text,
        label.font,
        label.fontSize,
        label.maxWidth,
        label.letterSpacing,
        label.lineSpacing,
        label.align,
        label.originX,
        label.tintTopLeft,
        label.x,
        label.y,
        label.scaleX,
        label.scaleY,
        label.displayOriginX,
        label.displayOriginY,
        pills,
        pills?.grey,
        dataOf(label, LABEL_ALIGN_DATA),
      );
      return true;
    }
    case "Image":
    case "Sprite": {
      const image = object as GameObjects.Image;
      out.push(image.texture.key, image.frame, image.x, image.y, image.scaleX, image.scaleY);
      out.push(image.displayOriginX, image.displayOriginY, dataOf(image, MIRROR_SPAN_DATA));
      return true;
    }
    case "NineSlice": {
      const slice = object as GameObjects.NineSlice;
      if (dataOf(slice, MIRROR_SCROLLBAR_DATA) !== undefined) {
        return false;
      }
      out.push(slice.texture.key, slice.frame, slice.x, slice.y, slice.width, slice.height);
      out.push(slice.displayOriginX, slice.displayOriginY, slice.leftWidth, slice.rightWidth);
      out.push(slice.topHeight, slice.bottomHeight);
      return true;
    }
    case "TileSprite": {
      const tiled = object as GameObjects.TileSprite;
      out.push(tiled.texture.key, tiled.frame, tiled.x, tiled.y, tiled.width, tiled.height);
      out.push(tiled.scaleX, tiled.scaleY, tiled.displayOriginX, tiled.displayOriginY);
      out.push(tiled.tilePositionX, tiled.tilePositionY, tiled.tileScaleX, tiled.tileScaleY);
      return true;
    }
    case "Rectangle": {
      const shape = object as GameObjects.Rectangle;
      out.push(shape.isFilled, shape.fillColor, shape.fillAlpha, shape.x, shape.y);
      out.push(shape.width, shape.height, shape.displayOriginX, shape.displayOriginY);
      return true;
    }
    case "Graphics": {
      const graphics = object as GameObjects.Graphics;
      out.push(graphics.x, graphics.y, ...(graphics.commandBuffer as readonly number[]));
      return true;
    }
    default:
      return false;
  }
}

const sameTuple = (a: readonly unknown[], b: readonly unknown[]) =>
  a.length === b.length && a.every((value, i) => value === b[i]);

// Moves each element into its parent after the element placed before it there, in order, so
// only elements out of place move.
function placeInOrder(placed: readonly (readonly [HTMLElement, HTMLElement])[]): void {
  const last = new Map<HTMLElement, Element>();
  for (const [element, parent] of placed) {
    const before = last.get(parent);
    const next = before === undefined ? parent.firstElementChild : before.nextElementSibling;
    if (next !== element) {
      parent.insertBefore(element, next);
    }
    last.set(parent, element);
  }
}

// scene's marked objects (roots, its containers or its whole display list in display order) in
// HTML until the scene shuts down: shown while the scene runs and shows, and while standDown
// says no page over it needs the canvas to draw them. Returns undefined where the canvas must
// draw them: the page's switch is off, or its fonts are not ready.
export function addHtmlMirror(
  scene: Scene,
  roots: () => readonly GameObjects.GameObject[],
  standDown: () => boolean = () => false,
): HtmlMirror | undefined {
  const place = htmlPanelPlace(scene);
  if (place === undefined) {
    return undefined;
  }
  const display = displayBitmapFont(scene);
  const fonts = { ...place.fonts, ...(display === undefined ? {} : { display }) };
  const { layer } = place;
  const doc = layer.element.ownerDocument;
  const dialog = doc.createElement("div");
  dialog.className = "adw-dialog adw-passive adw-mirror";
  dialog.setAttribute("aria-hidden", "true");
  dialog.hidden = true;
  layer.element.append(dialog);
  const manifest = scene.cache.json.get(MANIFEST_CACHE_KEY) as
    { sprites?: readonly { key?: unknown }[] } | undefined;
  const sprites = new Set(
    (manifest?.sprites ?? []).flatMap(({ key }) => (typeof key === "string" ? [key] : [])),
  );
  const camera = scene.cameras.main;
  const entries = new Map<GameObjects.GameObject, Entry>();
  const clips = new Map<GameObjects.Container, Entry>();
  // Where each container was first drawn, the game point its parts are placed from.
  const homes = new WeakMap<GameObjects.Container, { x: number; y: number }>();
  // Each mirrored label's name pills, which the label's HTML draws, so the camera draws them no
  // more.
  const pills = new Map<GameObjects.BitmapText, GameObjects.Graphics>();
  // A part waiting for its sheet's JSON is drawn again once it has loaded. Every sheet the HTML
  // has files for starts loading as the mirror starts, so a part rarely waits.
  const waiting = new Set<string>();
  const frameOf: FrameOf = (file, name, size) => {
    if (file.json === undefined) {
      return { ...size, sheet: size, x: 0, y: 0 };
    }
    const url = artUrl(file.json);
    const json = loadedSheet(url);
    if (json === undefined) {
      if (!waiting.has(url)) {
        waiting.add(url);
        loadSheet(url).then(
          () => {
            waiting.delete(url);
            invalidate();
          },
          (error: unknown) => console.error(`The ${file.json} sheet did not load.`, error),
        );
      }
      return undefined;
    }
    return sheetFrameNamed(json, name);
  };
  for (const key of DOM_ART_KEYS) {
    if (sprites.has(key)) {
      loadSheet(artUrl(domArtPath("sheet", key, "json"))).catch(() => undefined);
    }
  }
  // What each graphics' box and each of its fills' styles were last set to, so a redrawn graphics
  // writes only what changed.
  const fillKeys = new WeakMap<HTMLElement, string>();
  const fillStyles = new WeakMap<HTMLElement, Readonly<Record<string, string>>>();
  // The fields of the part being drawn (fillTuple), reused for every part.
  const tuple: unknown[] = [];
  const invalidate = () => {
    for (const entry of [...entries.values(), ...clips.values()]) {
      entry.key = "";
      entry.tuple = undefined;
    }
  };
  const forget = () => {
    for (const object of [...entries.keys(), ...pills.values()]) {
      object.cameraFilter &= ~camera.id;
    }
    entries.clear();
    pills.clear();
    clips.clear();
    dialog.replaceChildren();
  };

  // The entry for object, made the first time, the camera drawing it no more.
  const entryOf = (object: GameObjects.GameObject, tag: string): Entry => {
    let entry = entries.get(object);
    if (entry === undefined) {
      camera.ignore(object);
      const element = doc.createElement(tag);
      element.className = tag === "p" ? "adw-lines" : "adw-framed";
      entry = { element, key: "" };
      entries.set(object, entry);
    }
    return entry;
  };

  // Draws or places object's entry as scale and context say, if anything changed.
  const sync = (
    scale: DomScale,
    object: GameObjects.GameObject,
    context: Context,
    visit: (element: HTMLElement) => void,
  ): void => {
    const moved = motionShift(scale, context.motion);
    const scrolled =
      context.scroll === undefined
        ? 0
        : scrollShift(scale, context.scroll.offset, context.scroll.settled);
    const shift = { x: moved.x, y: moved.y + scrolled };
    const { origin } = context;
    const tupled = fillTuple(tuple, object);
    tuple.push(context.shown, shift.x, shift.y, origin.x, origin.y, context.alpha);
    const known = entries.get(object);
    if (tupled && known?.tuple !== undefined && sameTuple(known.tuple, tuple)) {
      visit(known.element);
      return;
    }
    // What places every part, for its key.
    const placing = [context.shown, shift, context.alpha];
    const transform = (element: HTMLElement, alpha = context.alpha) => {
      element.hidden = !context.shown;
      element.style.transform =
        shift.x === 0 && shift.y === 0 ? "" : `translate(${shift.x}px, ${shift.y}px)`;
      element.style.opacity = opacity(alpha);
    };
    switch (object.type) {
      case "BitmapText": {
        const label = object as GameObjects.BitmapText;
        const face = LABEL_FONTS[label.font];
        const bitmap = face === undefined ? undefined : fonts[face.font];
        if (face === undefined || bitmap === undefined) {
          return;
        }
        const entry = entryOf(object, "p");
        const labelPills = label.getData(NAME_PILLS_DATA) as LabelNamePills | undefined;
        if (labelPills !== undefined && pills.get(label) !== labelPills.graphics) {
          camera.ignore(labelPills.graphics);
          pills.set(label, labelPills.graphics);
        }
        // A label centred about a half pixel (an odd width at origin 0.5) starts on the canvas at
        // the whole game pixel below it.
        const at = {
          x: halfDown(origin.x + label.x - label.displayOriginX * label.scaleX),
          y: halfDown(origin.y + label.y - label.displayOriginY * label.scaleY),
        };
        const view = domLabel(label, face, at);
        const key = JSON.stringify([view, ...placing]);
        if (key !== entry.key) {
          if (JSON.stringify(view) !== entry.element.dataset.view) {
            entry.element.dataset.view = JSON.stringify(view);
            drawLabel(
              doc,
              {
                bitmap,
                grey: PALETTE[GREY_PILL],
                pillColours: (index) => {
                  const kind = pillKind(index);
                  return kind === undefined ? undefined : pillColours(kind);
                },
                scale,
              },
              entry.element,
              view,
            );
          }
          transform(entry.element);
          entry.key = key;
        }
        visit(entry.element);
        break;
      }
      case "Image":
      case "Sprite": {
        const image = object as GameObjects.Image;
        const file = artFile(sprites, image.texture.key);
        if (file === undefined) {
          return;
        }
        const entry = entryOf(object, "span");
        const size = { height: image.frame.realHeight, width: image.frame.realWidth };
        const at = {
          x: origin.x + image.x - image.displayOriginX * image.scaleX,
          y: origin.y + image.y - image.displayOriginY * image.scaleY,
        };
        const by = { x: image.scaleX, y: image.scaleY };
        const spans = dataOf(image, MIRROR_SPAN_DATA) === true;
        const key = JSON.stringify([file, image.frame.name, size, at, by, spans, ...placing]);
        if (key !== entry.key) {
          const frame = frameOf(file, image.frame.name, size);
          entry.element.className = "adw-art";
          const box = spans
            ? gridRect(scale, { ...at, height: size.height * by.y, width: size.width * by.x })
            : scaledArtBox(scale, at, size, by);
          setBox(entry.element, box);
          entry.element.style.visibility = frame === undefined ? "hidden" : "";
          if (frame !== undefined) {
            showArt(entry.element, artUrl(file.png), frame, { ...frame, x: 0, y: 0 }, box);
          }
          transform(entry.element);
          entry.key = frame === undefined ? "" : key;
        }
        visit(entry.element);
        break;
      }
      case "NineSlice": {
        const slice = object as GameObjects.NineSlice;
        const file = artFile(sprites, slice.texture.key);
        if (file === undefined) {
          return;
        }
        const entry = entryOf(object, "div");
        const size = { height: slice.frame.realHeight, width: slice.frame.realWidth };
        const rect = {
          height: slice.height,
          width: slice.width,
          x: origin.x + slice.x - slice.displayOriginX,
          y: origin.y + slice.y - slice.displayOriginY,
        };
        const slices = {
          bottom: slice.bottomHeight,
          left: slice.leftWidth,
          right: slice.rightWidth,
          top: slice.topHeight,
        };
        // A scrollbar's track and thumb are placed in art pixels from the track's corner.
        const bar = slice.getData(MIRROR_SCROLLBAR_DATA) as MirrorScrollbar | undefined;
        const key = JSON.stringify([file, slice.frame.name, rect, slices, bar, ...placing]);
        if (key !== entry.key) {
          const frame = frameOf(file, slice.frame.name, size);
          const box =
            bar === undefined
              ? gridRect(scale, rect)
              : scrollbarBoxes(
                  scale,
                  { left: gridX(scale, bar.bar.track.x), top: gridY(scale, bar.bar.track.y) },
                  bar.bar,
                )[bar.part];
          setBox(entry.element, box);
          // Its pieces lie in its box, so they are cut again only as its art or size changes, not
          // as it moves.
          const url = artUrl(file.png);
          const pieces = JSON.stringify([url, frame, box.width, box.height, slices]);
          if (entry.element.dataset.pieces !== pieces) {
            entry.element.dataset.pieces = pieces;
            entry.element.replaceChildren(
              ...(frame === undefined
                ? []
                : sliceParts(scale, box, frame, slices).map((part) => {
                    const span = doc.createElement("span");
                    span.className = "adw-art";
                    setBox(span, part.box);
                    showArt(span, url, frame, part.from, part.box);
                    return span;
                  })),
            );
          }
          transform(entry.element);
          entry.key = frame === undefined ? "" : key;
        }
        visit(entry.element);
        break;
      }
      case "TileSprite": {
        // A texture tiled at its own size; a sheet's frame, which CSS cannot repeat alone, stays
        // on the canvas.
        const tiled = object as GameObjects.TileSprite;
        const file = artFile(sprites, tiled.texture.key);
        if (
          file === undefined ||
          file.json !== undefined ||
          tiled.tileScaleX !== 1 ||
          tiled.tileScaleY !== 1
        ) {
          return;
        }
        const entry = entryOf(object, "span");
        const size = { height: tiled.frame.realHeight, width: tiled.frame.realWidth };
        const rect = {
          height: tiled.height * tiled.scaleY,
          width: tiled.width * tiled.scaleX,
          x: origin.x + tiled.x - tiled.displayOriginX * tiled.scaleX,
          y: origin.y + tiled.y - tiled.displayOriginY * tiled.scaleY,
        };
        const tilePosition = { x: tiled.tilePositionX, y: tiled.tilePositionY };
        const key = JSON.stringify([file, size, rect, tilePosition, ...placing]);
        if (key !== entry.key) {
          entry.element.className = "adw-art";
          setBox(entry.element, gridRect(scale, rect));
          const background = tileBackground(scale, size, tilePosition);
          Object.assign(entry.element.style, {
            backgroundImage: `url("${artUrl(file.png)}")`,
            backgroundPosition: background.position,
            backgroundRepeat: "repeat",
            backgroundSize: background.size,
          });
          transform(entry.element);
          entry.key = key;
        }
        visit(entry.element);
        break;
      }
      case "Rectangle": {
        const shape = object as GameObjects.Rectangle;
        if (!shape.isFilled || shape.fillAlpha === 0) {
          return;
        }
        const entry = entryOf(object, "div");
        const rect = {
          height: shape.height,
          width: shape.width,
          x: origin.x + shape.x - shape.displayOriginX,
          y: origin.y + shape.y - shape.displayOriginY,
        };
        const key = JSON.stringify([shape.fillColor, shape.fillAlpha, rect, ...placing]);
        if (key !== entry.key) {
          setBox(entry.element, gridRect(scale, rect));
          entry.element.style.backgroundColor = hex(shape.fillColor);
          transform(entry.element, context.alpha * shape.fillAlpha);
          entry.key = key;
        }
        visit(entry.element);
        break;
      }
      case "Graphics": {
        const graphics = object as GameObjects.Graphics;
        const fills = graphicsFills(graphics.commandBuffer as readonly number[], {
          x: origin.x + graphics.x,
          y: origin.y + graphics.y,
        });
        if (fills === undefined) {
          return;
        }
        const entry = entryOf(object, "div");
        const key = JSON.stringify([fills, ...placing]);
        if (key !== entry.key) {
          // The graphics' own box is the layer's; each fill is placed on the grid.
          const screen = {
            height: deviceY(scale, SCREEN_CONFIG.height),
            left: 0,
            top: 0,
            width: deviceX(scale, SCREEN_CONFIG.width),
          };
          const screenKey = [screen.width, screen.height].join();
          if (fillKeys.get(entry.element) !== screenKey) {
            fillKeys.set(entry.element, screenKey);
            setBox(entry.element, screen);
          }
          // Each fill is a child drawn again only where it changed.
          const { children } = entry.element;
          fills.forEach(({ alpha, colour, rect }, i) => {
            let fill = children[i] as HTMLElement | undefined;
            if (fill === undefined) {
              fill = doc.createElement("div");
              fill.className = "adw-framed";
              entry.element.append(fill);
            }
            // Each fill blends on its own, as the canvas blends it.
            const box = gridRect(scale, rect);
            const style = {
              backgroundColor: hex(colour),
              height: `${box.height}px`,
              left: `${box.left}px`,
              opacity: opacity(context.alpha * alpha),
              top: `${box.top}px`,
              width: `${box.width}px`,
            };
            const was = fillStyles.get(fill);
            for (const [name, value] of Object.entries(style) as [keyof typeof style, string][]) {
              if (was?.[name] !== value) {
                fill.style[name] = value;
              }
            }
            fillStyles.set(fill, style);
          });
          while (children.length > fills.length) {
            children[children.length - 1]?.remove();
          }
          transform(entry.element, 1);
          entry.key = key;
        }
        visit(entry.element);
        break;
      }
      default:
        break;
    }
    const drawn = entries.get(object);
    if (drawn !== undefined) {
      drawn.tuple = tupled && drawn.key !== "" ? [...tuple] : undefined;
    }
  };

  const frameScale = { key: "" };
  const update = () => {
    const scale = layer.scale();
    // Paused or asleep under another page, the scene's canvas draws it again, so a page's dim,
    // which reads the canvas back, dims it as before: the shop under help or the settings, and
    // the start screen under the shop, the Logbook, help, the settings, Quit? and a celebration.
    // CLEANUP (added 2026-11-11): remove in phase 5, when overlay dims move to HTML.
    // The walk's HUD stands down the same way while a page over the walk dims or covers it.
    const hidden = !scene.sys.isActive() || !scene.sys.isVisible() || standDown();
    dialog.hidden = hidden;
    if (hidden) {
      if (entries.size > 0) {
        forget();
      }
      return;
    }
    const frame = [scale.dpr, scale.unit, scale.origin.x, scale.origin.y].join();
    if (frame !== frameScale.key) {
      frameScale.key = frame;
      dialog.style.width = `${deviceX(scale, SCREEN_CONFIG.width)}px`;
      dialog.style.height = `${deviceY(scale, SCREEN_CONFIG.height)}px`;
      dialog.style.transform = gridTransform(scale);
      invalidate();
    }
    const seen = new Set<GameObjects.GameObject>();
    const placed: [HTMLElement, HTMLElement][] = [];
    const walk = (list: readonly GameObjects.GameObject[], context: Context) => {
      // The labels' name pills, which their labels' HTML draws.
      const labelPills = new Set(
        list.flatMap((object) => {
          const graphics = (dataOf(object, NAME_PILLS_DATA) as LabelNamePills | undefined)
            ?.graphics;
          return graphics === undefined ? [] : [graphics];
        }),
      );
      for (const object of list) {
        if (
          !object.active ||
          labelPills.has(object as GameObjects.Graphics) ||
          dataOf(object, MIRROR_CANVAS_DATA) === true
        ) {
          continue;
        }
        const alpha = context.alpha * ((object as unknown as { alpha?: number }).alpha ?? 1);
        const shown =
          context.shown &&
          (object as unknown as { visible: boolean }).visible !== false &&
          alpha > 0;
        if (object.type === "Container") {
          const container = object as GameObjects.Container;
          const scroll = container.getData(MIRROR_SCROLL_DATA) as MirrorScroll | undefined;
          const clipRect = container.getData(MIRROR_CLIP_DATA) as Rect | undefined;
          let { clip } = context;
          if (clipRect !== undefined) {
            let entry = clips.get(container);
            if (entry === undefined) {
              const element = doc.createElement("div");
              element.className = "adw-clip";
              entry = { element, key: "" };
              clips.set(container, entry);
            }
            const box = gridRect(scale, clipRect);
            const key = JSON.stringify(box);
            if (key !== entry.key) {
              const right = deviceX(scale, SCREEN_CONFIG.width) - box.left - box.width;
              const bottom = deviceY(scale, SCREEN_CONFIG.height) - box.top - box.height;
              entry.element.style.clipPath = `inset(${box.top}px ${right}px ${bottom}px ${box.left}px)`;
              entry.key = key;
            }
            placed.push([entry.element, context.clip]);
            clip = entry.element;
          }
          let home = homes.get(container);
          if (home === undefined) {
            home = { x: container.x, y: scroll === undefined ? container.y : 0 };
            homes.set(container, home);
          }
          walk(container.list, {
            alpha,
            clip,
            motion: {
              x: context.motion.x + container.x - home.x,
              y: context.motion.y + (scroll === undefined ? container.y - home.y : 0),
            },
            origin: { x: context.origin.x + home.x, y: context.origin.y + home.y },
            scroll:
              scroll === undefined
                ? context.scroll
                : {
                    offset: (context.scroll?.offset ?? 0) + container.y,
                    settled: scroll.settled(),
                  },
            shown,
          });
          continue;
        }
        sync(scale, object, { ...context, alpha, shown }, (element) => {
          seen.add(object);
          placed.push([element, context.clip]);
        });
      }
    };
    for (const root of roots()) {
      if (root.active) {
        walk([root], {
          alpha: 1,
          clip: dialog,
          motion: { x: 0, y: 0 },
          origin: { x: 0, y: 0 },
          scroll: undefined,
          shown: true,
        });
      }
    }
    for (const [object, { element }] of entries) {
      if (!seen.has(object)) {
        object.cameraFilter &= ~camera.id;
        element.remove();
        entries.delete(object);
      }
    }
    for (const [label, graphics] of pills) {
      if (!entries.has(label)) {
        graphics.cameraFilter &= ~camera.id;
        pills.delete(label);
      }
    }
    for (const [container, { element }] of clips) {
      if (!container.active) {
        element.remove();
        clips.delete(container);
      }
    }
    // The parts in display order, each in its clip, only those out of place moving.
    placeInOrder(placed);
  };
  update();
  scene.game.events.on(Core.Events.PRE_RENDER, update);
  const destroy = () => {
    scene.game.events.off(Core.Events.PRE_RENDER, update);
    scene.events.off(Scenes.Events.SHUTDOWN, destroy);
    dialog.remove();
  };
  scene.events.once(Scenes.Events.SHUTDOWN, destroy);
  return {
    burst: (at) => addTapBurst(layer, at),
    destroy,
  };
}

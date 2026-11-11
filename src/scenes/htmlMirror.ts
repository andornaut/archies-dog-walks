import type { Point, Rect } from "@andornaut/game-kit/rect";
import { Core, type GameObjects, type Scene, Scenes } from "phaser";

import { artUrl } from "../assets/artFiles.ts";
import { DOM_ART_KEYS, DOM_DISABLED_ART_KEYS, domArtPath } from "../assets/domArt.ts";
import { MANIFEST_CACHE_KEY } from "../assets/phaser/manifestArt.ts";
import { SCREEN_CONFIG } from "../data/screen.ts";
import { addTapBurst } from "../hud/dom/questionPanel.ts";
import { pillKind } from "../hud/effectNames.ts";
import { disabledArtKey, disabledArtPath } from "../ui/disabledArt.ts";
import { drawLabel } from "../ui/dom/labelBlock.ts";
import { artBox, gridRect, motionShift, scrollShift, sliceParts } from "../ui/dom/mirrorPlace.ts";
import { setBox } from "../ui/dom/pixelLine.ts";
import { loadSheet, type SheetFrame, sheetFrameNamed } from "../ui/dom/sheetFrames.ts";
import { deviceX, deviceY, type DomScale, gridTransform } from "../ui/domScale.ts";
import { PALETTE } from "../ui/palette.ts";
import { displayBitmapFont } from "../ui/phaser/displayText.ts";
import { GREY_PILL, pillColours } from "./effectNameColours.ts";
import { domLabel, LABEL_FONTS } from "./htmlLabels.ts";
import { htmlPanelPlace } from "./questionPanel.ts";

// What a scene draws in its marked containers, drawn in HTML over the canvas where the canvas
// draws it: every bitmap label, every image and sprite of art the HTML interface has files for
// (DOM_ART_KEYS, and the disabled tiles' grey copies, DOM_DISABLED_ART_KEYS), every nine-slice,
// filled rectangle and graphics of filled rects, in display order. The scene keeps its objects,
// which it places, shows, hides, moves and redraws as ever; before each frame the HTML follows,
// and the scene's camera draws them no more. A sprite playing a tag shows the frame it is on, so
// the HTML steps with the scene's clock through the tag's frames and durations. Placement is the
// art-pixel grid's (src/ui/dom/mirrorPlace.ts): each container's position is motion (a dip, a
// shake, a lift) in whole game pixels, but a container marked as a scrolled list
// (MIRROR_SCROLL_DATA) moves its content by its scroll, and one marked with a clip rect
// (MIRROR_CLIP_DATA) clips it there, as the canvas's mask does. It takes no presses: every press
// goes through to the canvas.

// The data key of a container whose y is a list's scroll: whether the scroll has settled.
export const MIRROR_SCROLL_DATA = "htmlScroll";
export interface MirrorScroll {
  readonly settled: () => boolean;
}

// The data key of a container clipped to a game rect, as a mask clips it on the canvas.
export const MIRROR_CLIP_DATA = "htmlClip";

export interface HtmlMirror {
  // A tap burst at a game point, over the HTML.
  burst(at: Point): void;
  destroy(): void;
  // While suspended the canvas draws the containers again and the HTML shows nothing.
  setSuspended(suspended: boolean): void;
}

// Where a part is drawn from in the HTML: its motion and scroll in device pixels, and the clip
// it is drawn in.
interface Context {
  readonly clip: HTMLElement;
  readonly motion: { x: number; y: number };
  readonly scroll: { offset: number; settled: boolean } | undefined;
  readonly shown: boolean;
}

interface Entry {
  readonly element: HTMLElement;
  key: string;
}

const hex = (colour: number) => `#${colour.toString(16).padStart(6, "0")}`;

// Phaser's Graphics commands a fill of rects uses: a line style (every graphics starts with its
// default, which no fill draws with), a fill style, then rects in it.
const LINE_STYLE = 6;
const FILL_STYLE = 7;
const FILL_RECT = 3;

// A graphics' fills, or undefined where it draws anything but rects filled at full alpha or
// none.
function graphicsFills(
  graphics: GameObjects.Graphics,
): { colour: number; rect: Rect }[] | undefined {
  const commands = graphics.commandBuffer as readonly number[];
  const fills: { colour: number; rect: Rect }[] = [];
  // The fill style's colour, or undefined while it draws nothing (alpha 0); null for a partial
  // alpha, which the HTML does not draw.
  let colour: number | null | undefined;
  for (let i = 0; i < commands.length;) {
    const command = commands[i];
    if (command === LINE_STYLE) {
      i += 4;
    } else if (command === FILL_STYLE) {
      const alpha = commands[i + 2] ?? 1;
      colour = alpha === 0 ? undefined : alpha < 1 ? null : commands[i + 1];
      i += 3;
    } else if (command === FILL_RECT && colour !== null) {
      const [x = 0, y = 0, width = 0, height = 0] = commands.slice(i + 1, i + 5);
      if (colour !== undefined) {
        fills.push({ colour, rect: { height, width, x: x + graphics.x, y: y + graphics.y } });
      }
      i += 5;
    } else {
      return undefined;
    }
  }
  return fills;
}

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

// Each element's id, so the mirror knows when its parts' order has changed.
const ids = new WeakMap<HTMLElement, number>();
let nextId = 0;
function idOf(element: HTMLElement): number {
  let id = ids.get(element);
  if (id === undefined) {
    nextId += 1;
    id = nextId;
    ids.set(element, id);
  }
  return id;
}

// scene's marked containers (roots) in HTML until the scene shuts down: shown while the scene
// runs and shows. Returns undefined where the canvas must draw them: the page's switch is off,
// or its fonts are not ready.
export function addHtmlMirror(
  scene: Scene,
  roots: () => readonly GameObjects.Container[],
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
  dialog.className = "adw-dialog adw-passive";
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
  // Each sheet's JSON once it has loaded; a part waiting for one is drawn again when it has.
  const sheets = new Map<string, unknown>();
  const frameOf: FrameOf = (file, name, size) => {
    if (file.json === undefined) {
      return { ...size, sheet: size, x: 0, y: 0 };
    }
    const json = sheets.get(file.json);
    if (json === undefined) {
      if (!sheets.has(file.json)) {
        sheets.set(file.json, undefined);
        loadSheet(artUrl(file.json)).then(
          (loaded) => {
            sheets.set(file.json ?? "", loaded);
            invalidate();
          },
          (error: unknown) => console.error(`The ${file.json} sheet did not load.`, error),
        );
      }
      return undefined;
    }
    return sheetFrameNamed(json, name);
  };
  let suspended = false;
  let order = "";
  const invalidate = () => {
    for (const entry of [...entries.values(), ...clips.values()]) {
      entry.key = "";
    }
  };
  const forget = () => {
    for (const object of entries.keys()) {
      object.cameraFilter &= ~camera.id;
    }
    entries.clear();
    clips.clear();
    dialog.replaceChildren();
    order = "";
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
    const transform = (element: HTMLElement) => {
      element.hidden = !context.shown;
      element.style.transform =
        shift.x === 0 && shift.y === 0 ? "" : `translate(${shift.x}px, ${shift.y}px)`;
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
        const at = {
          x: label.x - label.displayOriginX * label.scaleX,
          y: label.y - label.displayOriginY * label.scaleY,
        };
        const view = domLabel(label, face, at);
        const key = JSON.stringify([view, context.shown, shift]);
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
        return;
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
          x: image.x - image.displayOriginX * image.scaleX,
          y: image.y - image.displayOriginY * image.scaleY,
        };
        const key = JSON.stringify([
          file,
          image.frame.name,
          size,
          at,
          image.scaleX,
          context.shown,
          shift,
        ]);
        if (key !== entry.key) {
          const frame = frameOf(file, image.frame.name, size);
          entry.element.className = "adw-art";
          const box = artBox(scale, at, {
            height: size.height * image.scaleY,
            width: size.width * image.scaleX,
          });
          setBox(entry.element, box);
          entry.element.style.visibility = frame === undefined ? "hidden" : "";
          if (frame !== undefined) {
            showArt(entry.element, artUrl(file.png), frame, { ...frame, x: 0, y: 0 }, box);
          }
          transform(entry.element);
          entry.key = frame === undefined ? "" : key;
        }
        visit(entry.element);
        return;
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
          x: slice.x - slice.displayOriginX,
          y: slice.y - slice.displayOriginY,
        };
        const slices = {
          bottom: slice.bottomHeight,
          left: slice.leftWidth,
          right: slice.rightWidth,
          top: slice.topHeight,
        };
        const key = JSON.stringify([file, slice.frame.name, rect, slices, context.shown, shift]);
        if (key !== entry.key) {
          const frame = frameOf(file, slice.frame.name, size);
          const box = gridRect(scale, rect);
          setBox(entry.element, box);
          const url = artUrl(file.png);
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
          transform(entry.element);
          entry.key = frame === undefined ? "" : key;
        }
        visit(entry.element);
        return;
      }
      case "Rectangle": {
        const shape = object as GameObjects.Rectangle;
        if (!shape.isFilled || shape.fillAlpha < 1) {
          return;
        }
        const entry = entryOf(object, "div");
        const rect = {
          height: shape.height,
          width: shape.width,
          x: shape.x - shape.displayOriginX,
          y: shape.y - shape.displayOriginY,
        };
        const key = JSON.stringify([shape.fillColor, rect, context.shown, shift]);
        if (key !== entry.key) {
          setBox(entry.element, gridRect(scale, rect));
          entry.element.style.backgroundColor = hex(shape.fillColor);
          transform(entry.element);
          entry.key = key;
        }
        visit(entry.element);
        return;
      }
      case "Graphics": {
        const fills = graphicsFills(object as GameObjects.Graphics);
        if (fills === undefined) {
          return;
        }
        const entry = entryOf(object, "div");
        const key = JSON.stringify([fills, context.shown, shift]);
        if (key !== entry.key) {
          // The graphics' own box is the layer's; each fill is placed on the grid.
          setBox(entry.element, {
            height: deviceY(scale, SCREEN_CONFIG.height),
            left: 0,
            top: 0,
            width: deviceX(scale, SCREEN_CONFIG.width),
          });
          entry.element.replaceChildren(
            ...fills.map(({ colour, rect }) => {
              const fill = doc.createElement("div");
              fill.className = "adw-framed";
              fill.style.backgroundColor = hex(colour);
              setBox(fill, gridRect(scale, rect));
              return fill;
            }),
          );
          transform(entry.element);
          entry.key = key;
        }
        visit(entry.element);
        break;
      }
      default:
        break;
    }
  };

  const frameScale = { key: "" };
  const update = () => {
    const scale = layer.scale();
    const hidden = suspended || !scene.sys.isActive() || !scene.sys.isVisible();
    dialog.hidden = hidden;
    if (hidden) {
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
      for (const object of list) {
        if (!object.active) {
          continue;
        }
        const shown =
          context.shown &&
          (object as unknown as { visible: boolean }).visible !== false &&
          (object as unknown as { alpha?: number }).alpha !== 0;
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
          walk(container.list, {
            clip,
            motion:
              scroll === undefined
                ? { x: context.motion.x + container.x, y: context.motion.y + container.y }
                : { x: context.motion.x + container.x, y: context.motion.y },
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
        sync(scale, object, { ...context, shown }, (element) => {
          seen.add(object);
          placed.push([element, context.clip]);
        });
      }
    };
    for (const root of roots()) {
      if (root.active) {
        walk([root], { clip: dialog, motion: { x: 0, y: 0 }, scroll: undefined, shown: true });
      }
    }
    for (const [object, { element }] of entries) {
      if (!seen.has(object)) {
        element.remove();
        entries.delete(object);
      }
    }
    for (const [container, { element }] of clips) {
      if (!container.active) {
        element.remove();
        clips.delete(container);
      }
    }
    // The parts in display order, each in its clip; laid out again only when the order changes.
    const signature = placed.map(([element, parent]) => `${idOf(element)}:${idOf(parent)}`).join();
    if (signature !== order) {
      order = signature;
      for (const [element, parent] of placed) {
        parent.append(element);
      }
    }
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
    setSuspended(next) {
      if (next !== suspended) {
        suspended = next;
        if (suspended) {
          forget();
        }
        dialog.hidden = suspended;
      }
    },
  };
}

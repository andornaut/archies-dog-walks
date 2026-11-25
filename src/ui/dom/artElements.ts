import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";

import { domArtPath } from "../../assets/domArt.ts";
import { artPixel, type DomScale, frameRect, gridRect, gridX, gridY } from "../domScale.ts";
import { setBox } from "./pixelLine.ts";
import {
  playingFrame,
  type SheetFrame,
  sheetFrame,
  sheetFrameNamed,
  sheetTagFrames,
} from "./sheetFrames.ts";
import { sliceParts } from "./sliceParts.ts";

// Art the HTML interface draws as backgrounds of its key's DOM sheet: an image's one frame, or
// one frame of a sprite sheet by its tag. Art projection keeps whole authored pixels; layout
// projection follows logical rect edges. Art stays hidden until its frames load.

export interface DomArtSource {
  // A DOM art file's URL by its logical path (domArtPath): its sheet's image, or its frames.
  readonly artUrl: (path: string) => string;
  // A key's frames by their URL, once they have loaded.
  readonly loadSheet: (url: string) => Promise<unknown>;
}

// One frame of a sheet by its tag, from its top-left at a game point.
export interface SheetArtPlace {
  // The part of the frame drawn, from the frame's corner; the whole frame where undefined.
  readonly crop?: Rect;
  readonly frame?: number | string | SheetFrame;
  // The share of the drawn width left of x: 0 puts its left edge at x, 0.5 its centre.
  readonly originX?: number;
  // The tag's frame playing playMs into its loop, where the sheet has the tag; else its first.
  readonly playMs?: number;
  // Layout art follows logical rect edges; default art retains whole authored-pixel scaling.
  readonly projection?: "art" | "layout";
  readonly scale?: number;
  readonly tag?: string;
  readonly x: number;
  readonly y: number;
}

// The frame art names on its sheet's JSON.
function placedFrame(json: unknown, art: SheetArtPlace): SheetFrame {
  if (typeof art.frame === "object") {
    return art.frame;
  }
  if (art.frame !== undefined) {
    return sheetFrameNamed(json, art.frame);
  }
  if (art.playMs !== undefined && art.tag !== undefined) {
    const frames = sheetTagFrames(json, art.tag);
    const total = frames.reduce((sum, { durationMs }) => sum + durationMs, 0);
    const playing = frames[total > 0 ? (playingFrame(frames, art.playMs % total) ?? 0) : 0];
    if (playing !== undefined) {
      return playing;
    }
  }
  return sheetFrame(json, art.tag);
}

function artUrls(
  source: DomArtSource,
  kind: "image" | "sheet",
  key: string,
  imageKey = key,
): string[] {
  return [source.artUrl(domArtPath(kind, imageKey, "png"))];
}

// The key's frames once loaded, calling shown with them then and on each later call.
function sheetOf(
  source: DomArtSource,
  key: string,
  element: HTMLElement,
  imageKey = key,
  kind: "image" | "sheet" = "sheet",
) {
  let json: unknown;
  let waiting: (() => void) | undefined;
  element.style.visibility = "hidden";
  const request = source.loadSheet(source.artUrl(domArtPath(kind, key, "json")));
  request.then(
    (loaded) => {
      json = loaded;
      element.style.visibility = "";
      waiting?.();
    },
    (error: unknown) => console.error(`The ${key} sheet did not load.`, error),
  );
  return Object.assign(
    (shown: (json: unknown) => void) => {
      if (json === undefined) {
        waiting = () => shown(json);
      } else {
        shown(json);
      }
    },
    {
      ready: request.then(
        () => artUrls(source, kind, key, imageKey),
        () => [],
      ),
    },
  );
}

const backgroundOf = (source: DomArtSource, key: string) =>
  `url("${source.artUrl(domArtPath("sheet", key, "png"))}")`;

// A sheet's frame in an element of its own, placed in its container whose corner is at origin,
// or at, device pixels from that corner, where given.
export function sheetArt(
  doc: Document,
  source: DomArtSource,
  key: string,
  imageKey = key,
): {
  readonly element: HTMLElement;
  readonly ready: Promise<readonly string[]>;
  readonly place: (
    scale: DomScale,
    origin: Point,
    art: SheetArtPlace,
    at?: { readonly left: number; readonly top: number },
  ) => void;
} {
  const element = doc.createElement("span");
  return { element, ...paintSheetArt(source, key, element, imageKey) };
}

// A sheet's frame drawn on element, which another part (a Game Kit control) made: as sheetArt
// places its own. With art.alternate, the property holds a second frame's background position,
// for a state CSS shows in its place. The frame's image, size and position are also held in
// --adw-art-image, --adw-art-size and --adw-art-position, for CSS that masks a silhouette of it.
export function paintSheetArt(
  source: DomArtSource,
  key: string,
  element: HTMLElement,
  imageKey = key,
): {
  readonly ready: Promise<readonly string[]>;
  readonly place: (
    scale: DomScale,
    origin: Point,
    art: SheetArtPlace & {
      readonly alternate?: { readonly property: string; readonly tag: string };
    },
    at?: { readonly left: number; readonly top: number },
  ) => void;
} {
  element.classList.add("adw-art");
  const image = backgroundOf(source, imageKey);
  element.style.backgroundImage = image;
  element.style.setProperty("--adw-art-image", image);

  const loaded = sheetOf(source, key, element, imageKey);
  return {
    place: (scale, origin, art, at) =>
      loaded((json) => {
        const frame = placedFrame(json, art);
        const factor = art.scale ?? 1;
        const crop = art.crop ?? { height: frame.height, width: frame.width, x: 0, y: 0 };
        const x = art.x - (art.originX ?? 0) * crop.width * factor;
        const pixel = artPixel(scale) * factor;
        const box =
          art.projection === "layout"
            ? gridRect(scale, {
                height: crop.height * factor,
                width: crop.width * factor,
                x,
                y: art.y,
              })
            : {
                height: crop.height * pixel,
                left: gridX(scale, x),
                top: gridY(scale, art.y),
                width: crop.width * pixel,
              };
        setBox(element, {
          height: box.height,
          left: at?.left ?? box.left - gridX(scale, origin.x),
          top: at?.top ?? box.top - gridY(scale, origin.y),
          width: box.width,
        });
        const across = art.projection === "layout" ? box.width / crop.width : pixel;
        const down = art.projection === "layout" ? box.height / crop.height : pixel;
        const size = `${frame.sheet.width * across}px ${frame.sheet.height * down}px`;
        const position = `${-(frame.x + crop.x) * across}px ${-(frame.y + crop.y) * down}px`;
        element.style.backgroundSize = size;
        element.style.backgroundPosition = position;
        element.style.setProperty("--adw-art-size", size);
        element.style.setProperty("--adw-art-position", position);
        if (art.alternate !== undefined) {
          const other = sheetFrame(json, art.alternate.tag);
          element.style.setProperty(
            art.alternate.property,
            `${-other.x * across}px ${-other.y * down}px`,
          );
        }
      }),
    ready: loaded.ready,
  };
}

// A sheet's frame stretched across, as a nine-slice cut only at its sides draws it: its left
// and right columns whole, the columns between them stretched, which holds for art whose
// middle columns are alike, since the stretch then samples none but them. width, where given,
// is its width in device pixels. It draws in element where another part made it.
export function sheetThreeSlice(
  doc: Document,
  source: DomArtSource,
  key: string,
  slices: { readonly left: number; readonly right: number },
  element: HTMLElement = doc.createElement("span"),
): {
  readonly element: HTMLElement;
  readonly ready: Promise<readonly string[]>;
  readonly place: (
    scale: DomScale,
    origin: Point,
    art: SheetArtPlace & { readonly width: number },
    width?: number,
  ) => void;
} {
  element.classList.add("adw-art");
  element.style.backgroundImage = "none";
  const parts = ["left", "middle", "right"].map(() => {
    const part = doc.createElement("span");
    part.className = "adw-art";
    part.style.backgroundImage = backgroundOf(source, key);

    return part;
  });
  element.append(...parts);
  const loaded = sheetOf(source, key, element);
  return {
    element,
    place: (scale, origin, art, across) =>
      loaded((json) => {
        const frame = sheetFrame(json, art.tag);
        const pixel = artPixel(scale);
        const left = gridX(scale, art.x);
        const width = across ?? gridX(scale, art.x + art.width) - left;
        const layout = art.projection === "layout";
        const height = layout
          ? gridY(scale, art.y + frame.height * (art.scale ?? 1)) - gridY(scale, art.y)
          : frame.height * pixel;
        const down = height / frame.height;
        setBox(element, {
          height,
          left: left - gridX(scale, origin.x),
          top: gridY(scale, art.y) - gridY(scale, origin.y),
          width,
        });
        const [start, middle, end] = parts;
        const sheetSize = (across: number) =>
          `${frame.sheet.width * across}px ${frame.sheet.height * down}px`;
        const sides = layout
          ? {
              left: gridX(scale, art.x + slices.left) - left,
              right:
                gridX(scale, art.x + art.width) - gridX(scale, art.x + art.width - slices.right),
            }
          : { left: slices.left * pixel, right: slices.right * pixel };
        if (start !== undefined && end !== undefined && middle !== undefined) {
          setBox(start, { height, left: 0, top: 0, width: sides.left });
          const near = slices.left === 0 ? pixel : sides.left / slices.left;
          start.style.backgroundSize = sheetSize(near);
          start.style.backgroundPosition = `${-frame.x * near}px ${-frame.y * down}px`;
          setBox(end, { height, left: width - sides.right, top: 0, width: sides.right });
          const far = slices.right === 0 ? pixel : sides.right / slices.right;
          end.style.backgroundSize = sheetSize(far);
          end.style.backgroundPosition = `${-(frame.x + frame.width - slices.right) * far}px ${-frame.y * down}px`;
          // The middle columns at the stretch that spans them across the room the sides leave.
          const room = width - sides.left - sides.right;
          const across = room / (frame.width - slices.left - slices.right);
          setBox(middle, { height, left: sides.left, top: 0, width: room });
          middle.style.backgroundSize = sheetSize(across);
          middle.style.backgroundPosition = `${-(frame.x + slices.left) * across}px ${-frame.y * down}px`;
        }
      }),
    ready: loaded.ready,
  };
}

// An image whole, at its size in art pixels, from its top-left at a game point. Frame
// projection, as a frame's rect (frameRect) is, puts its corner on the grid and its sides the
// nearest whole art pixels to the rect's.
export function imageArt(
  doc: Document,
  source: DomArtSource,
  key: string,
  imageKey = key,
): {
  readonly element: HTMLElement;
  readonly ready: Promise<readonly string[]>;
  readonly place: (
    scale: DomScale,
    origin: Point,
    art: Rect & { readonly projection?: "art" | "frame" | "layout" },
  ) => void;
} {
  const element = doc.createElement("span");
  element.className = "adw-art";
  element.style.backgroundImage = `url("${source.artUrl(domArtPath("image", imageKey, "png"))}")`;
  const loaded = sheetOf(source, key, element, imageKey, "image");
  return {
    element,
    place: (scale, origin, art) => {
      const pixel = artPixel(scale);
      const box =
        art.projection === "layout"
          ? gridRect(scale, art)
          : art.projection === "frame"
            ? frameRect(scale, art)
            : {
                height: art.height * pixel,
                left: gridX(scale, art.x),
                top: gridY(scale, art.y),
                width: art.width * pixel,
              };
      setBox(element, {
        ...box,
        left: box.left - gridX(scale, origin.x),
        top: box.top - gridY(scale, origin.y),
      });
      loaded((json) => {
        const frame = sheetFrame(json, undefined);
        const across = box.width / frame.width;
        const down = box.height / frame.height;
        element.style.backgroundSize = `${frame.sheet.width * across}px ${frame.sheet.height * down}px`;
        element.style.backgroundPosition = `${-frame.x * across}px ${-frame.y * down}px`;
      });
    },
    ready: loaded.ready,
  };
}

// Three images as one three-slice across a rect: the left and right images whole, slices.left and
// slices.right columns wide, and the middle image stretched across the columns between them, each
// following the rect's logical edges.
export function imageThreeSlice(
  doc: Document,
  source: DomArtSource,
  keys: { readonly left: string; readonly middle: string; readonly right: string },
  slices: { readonly left: number; readonly right: number },
): {
  readonly element: HTMLElement;
  readonly ready: Promise<readonly string[]>;
  readonly place: (scale: DomScale, origin: Point, art: Rect) => void;
} {
  const element = doc.createElement("span");
  element.className = "adw-art";
  const parts = [keys.left, keys.middle, keys.right].map((key) => imageArt(doc, source, key));
  element.append(...parts.map((part) => part.element));
  const [start, middle, end] = parts as [(typeof parts)[0], (typeof parts)[0], (typeof parts)[0]];
  return {
    element,
    place: (scale, origin, art) => {
      const box = gridRect(scale, art);
      setBox(element, {
        ...box,
        left: box.left - gridX(scale, origin.x),
        top: box.top - gridY(scale, origin.y),
      });
      const right = art.x + art.width - slices.right;
      start.place(scale, art, { ...art, projection: "layout", width: slices.left });
      middle.place(scale, art, {
        ...art,
        projection: "layout",
        width: right - art.x - slices.left,
        x: art.x + slices.left,
      });
      end.place(scale, art, { ...art, projection: "layout", width: slices.right, x: right });
    },
    ready: Promise.all(parts.map((part) => part.ready)).then((urls) => urls.flat()),
  };
}

interface SliceInsets {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
}

// Both image and sheet panels use one corner/stretch projection.
function slicePainter(
  doc: Document,
  source: DomArtSource,
  kind: "image" | "sheet",
  key: string,
  slices: SliceInsets,
  element: HTMLElement,
) {
  const url = source.artUrl(domArtPath(kind, key, "png"));
  let previous = "";
  return (
    scale: DomScale,
    origin: Point,
    art: Rect & Pick<SheetArtPlace, "projection">,
    frame: SheetFrame,
  ) => {
    const box = gridRect(scale, art);
    setBox(element, {
      ...box,
      left: box.left - gridX(scale, origin.x),
      top: box.top - gridY(scale, origin.y),
    });
    const current = JSON.stringify([
      frame,
      box.width,
      box.height,
      slices,
      artPixel(scale),
      art.projection === "layout" ? [scale, art] : null,
    ]);
    if (current === previous) {
      return;
    }
    previous = current;
    element.replaceChildren(
      ...sliceParts(scale, box, frame, slices, art.projection === "layout" ? art : undefined).map(
        ({ box: part, from }) => {
          const span = doc.createElement("span");
          span.className = "adw-art";
          setBox(span, part);
          const across = part.width / from.width;
          const down = part.height / from.height;
          Object.assign(span.style, {
            backgroundImage: `url("${url}")`,
            backgroundPosition: `${-(frame.x + from.x) * across}px ${-(frame.y + from.y) * down}px`,
            backgroundSize: `${frame.sheet.width * across}px ${frame.sheet.height * down}px`,
          });

          return span;
        },
      ),
    );
  };
}

// Sheet tag selection remains client-owned; decoded image readiness is shared with image panels.
export function sheetNineSlice(
  doc: Document,
  source: DomArtSource,
  key: string,
  slices: SliceInsets,
): {
  readonly element: HTMLElement;
  readonly ready: Promise<readonly string[]>;
  readonly place: (
    scale: DomScale,
    origin: Point,
    art: SheetArtPlace & { readonly height: number; readonly width: number },
  ) => void;
} {
  const element = doc.createElement("span");
  element.className = "adw-art";
  const loaded = sheetOf(source, key, element);
  const paint = slicePainter(doc, source, "sheet", key, slices, element);
  return {
    element,
    place: (scale, origin, art) =>
      loaded((json) => paint(scale, origin, art, placedFrame(json, art))),
    ready: loaded.ready,
  };
}

// Native image dimensions come from the authored asset contract; its rect on its sheet from its
// frames, until which it stays hidden.
export function imageNineSlice(
  doc: Document,
  source: DomArtSource,
  key: string,
  native: Readonly<Pick<Rect, "height" | "width">>,
  slices: SliceInsets,
): {
  readonly element: HTMLElement;
  readonly ready: Promise<readonly string[]>;
  readonly place: (scale: DomScale, origin: Point, art: Rect) => void;
} {
  const element = doc.createElement("span");
  element.className = "adw-art";
  const loaded = sheetOf(source, key, element, key, "image");
  const paint = slicePainter(doc, source, "image", key, slices, element);
  return {
    element,
    place: (scale, origin, art) =>
      loaded((json) => {
        const { sheet, x, y } = sheetFrame(json, undefined);
        paint(scale, origin, art, { ...native, sheet, x, y });
      }),
    ready: loaded.ready,
  };
}

import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";

import { DOM_DIM_ART_KEYS, domArtPath } from "../../assets/domArt.ts";
import { dimArtPath } from "../dimArt.ts";
import { artPixel, type DomScale, gridRect, gridX, gridY } from "../domScale.ts";
import { setBox } from "./pixelLine.ts";
import { DIM_ART_ATTRIBUTE } from "./rampDim.ts";
import { type SheetFrame, sheetFrame, sheetFrameNamed } from "./sheetFrames.ts";
import { sliceParts } from "./sliceParts.ts";

// Art the HTML interface draws as backgrounds of each key's own file: an image whole, or one
// frame of a sheet by its tag. Art projection keeps whole authored pixels; layout projection
// follows logical rect edges. A sheet stays hidden until its JSON loads.

export interface DomArtSource {
  // An art file's URL by its path under /art/.
  readonly artUrl: (path: string) => string;
  // A sheet's JSON by its URL, once it has loaded.
  readonly loadSheet: (url: string) => Promise<unknown>;
}

// One frame of a sheet by its tag, from its top-left at a game point.
export interface SheetArtPlace {
  readonly frame?: number | string | SheetFrame;
  // Layout art follows logical rect edges; default art retains whole authored-pixel scaling.
  readonly projection?: "art" | "layout";
  readonly scale?: number;
  readonly tag?: string;
  readonly x: number;
  readonly y: number;
}

function artUrls(source: DomArtSource, kind: "image" | "sheet", key: string): string[] {
  return [
    source.artUrl(domArtPath(kind, key, "png")),
    ...(DOM_DIM_ART_KEYS.has(key) ? [source.artUrl(dimArtPath(kind, key))] : []),
  ];
}

function markDimArt(
  source: DomArtSource,
  kind: "image" | "sheet",
  key: string,
  element: HTMLElement,
): void {
  if (DOM_DIM_ART_KEYS.has(key)) {
    element.setAttribute(DIM_ART_ATTRIBUTE, source.artUrl(dimArtPath(kind, key)));
  }
}

// The sheet's JSON once loaded, calling shown with it then and on each later call.
function sheetOf(source: DomArtSource, key: string, element: HTMLElement, imageKey = key) {
  let json: unknown;
  let waiting: (() => void) | undefined;
  element.style.visibility = "hidden";
  const request = source.loadSheet(source.artUrl(domArtPath("sheet", key, "json")));
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
        () => artUrls(source, "sheet", imageKey),
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
  element.className = "adw-art";
  element.style.backgroundImage = backgroundOf(source, imageKey);
  markDimArt(source, "sheet", imageKey, element);
  const loaded = sheetOf(source, key, element, imageKey);
  return {
    element,
    place: (scale, origin, art, at) =>
      loaded((json) => {
        const frame =
          typeof art.frame === "object"
            ? art.frame
            : art.frame === undefined
              ? sheetFrame(json, art.tag)
              : sheetFrameNamed(json, art.frame);
        const pixel = artPixel(scale) * (art.scale ?? 1);
        const box =
          art.projection === "layout"
            ? gridRect(scale, {
                height: frame.height * (art.scale ?? 1),
                width: frame.width * (art.scale ?? 1),
                x: art.x,
                y: art.y,
              })
            : {
                height: frame.height * pixel,
                left: gridX(scale, art.x),
                top: gridY(scale, art.y),
                width: frame.width * pixel,
              };
        setBox(element, {
          height: box.height,
          left: at?.left ?? box.left - gridX(scale, origin.x),
          top: at?.top ?? box.top - gridY(scale, origin.y),
          width: box.width,
        });
        const across = art.projection === "layout" ? box.width / frame.width : pixel;
        const down = art.projection === "layout" ? box.height / frame.height : pixel;
        element.style.backgroundSize = `${frame.sheet.width * across}px ${frame.sheet.height * down}px`;
        element.style.backgroundPosition = `${-frame.x * across}px ${-frame.y * down}px`;
      }),
    ready: loaded.ready,
  };
}

// A sheet's frame stretched across, as a nine-slice cut only at its sides draws it: its left
// and right columns whole, the columns between them stretched, which holds for art whose
// middle columns are alike, since the stretch then samples none but them. width, where given,
// is its width in device pixels.
export function sheetThreeSlice(
  doc: Document,
  source: DomArtSource,
  key: string,
  slices: { readonly left: number; readonly right: number },
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
  const element = doc.createElement("span");
  element.className = "adw-art";
  element.style.backgroundImage = "none";
  const parts = ["left", "middle", "right"].map(() => {
    const part = doc.createElement("span");
    part.className = "adw-art";
    part.style.backgroundImage = backgroundOf(source, key);
    markDimArt(source, "sheet", key, part);
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

// An image whole, at its size in art pixels, from its top-left at a game point.
export function imageArt(
  doc: Document,
  source: DomArtSource,
  key: string,
): {
  readonly element: HTMLElement;
  readonly ready: Promise<readonly string[]>;
  readonly place: (
    scale: DomScale,
    origin: Point,
    art: Rect & Pick<SheetArtPlace, "projection">,
  ) => void;
} {
  const element = doc.createElement("span");
  element.className = "adw-art";
  element.style.backgroundImage = `url("${source.artUrl(domArtPath("image", key, "png"))}")`;
  markDimArt(source, "image", key, element);
  return {
    element,
    place: (scale, origin, art) => {
      const pixel = artPixel(scale);
      const box =
        art.projection === "layout"
          ? gridRect(scale, art)
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
    },
    ready: Promise.resolve(artUrls(source, "image", key)),
  };
}

interface SliceInsets {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
}

// Both image and sheet panels use one corner/stretch projection and dim-image policy.
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
          markDimArt(source, kind, key, span);
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
      loaded((json) => {
        const frame =
          typeof art.frame === "object"
            ? art.frame
            : art.frame === undefined
              ? sheetFrame(json, art.tag)
              : sheetFrameNamed(json, art.frame);
        paint(scale, origin, art, frame);
      }),
    ready: loaded.ready,
  };
}

// Native image dimensions come from the authored asset contract, without another size loader.
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
  const frame: SheetFrame = { ...native, sheet: native, x: 0, y: 0 };
  const paint = slicePainter(doc, source, "image", key, slices, element);
  return {
    element,
    place: (scale, origin, art) => paint(scale, origin, art, frame),
    ready: Promise.resolve(artUrls(source, "image", key)),
  };
}

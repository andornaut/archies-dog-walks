import type { Point } from "@andornaut/game-kit/rect";

import { domArtPath } from "../../assets/domArt.ts";
import { artPixel, type DomScale, gridX, gridY } from "../domScale.ts";
import { setBox } from "./pixelLine.ts";
import { type SheetFrame, sheetFrame } from "./sheetFrames.ts";

// Art the HTML interface draws as backgrounds of each key's own file: an image whole, or one
// frame of a sheet by its tag, every art pixel artPixel device pixels. A sheet's frame is read
// from its JSON, and its element stays hidden until that loads.

export interface DomArtSource {
  // An art file's URL by its path under /art/.
  readonly artUrl: (path: string) => string;
  // A sheet's JSON by its URL, once it has loaded.
  readonly loadSheet: (url: string) => Promise<unknown>;
}

// One frame of a sheet by its tag, from its top-left at a game point.
export interface SheetArtPlace {
  readonly tag: string;
  readonly x: number;
  readonly y: number;
}

// The sheet's JSON once loaded, calling shown with it then and on each later call.
function sheetOf(source: DomArtSource, key: string, element: HTMLElement) {
  let json: unknown;
  let waiting: (() => void) | undefined;
  element.style.visibility = "hidden";
  source.loadSheet(source.artUrl(domArtPath("sheet", key, "json"))).then(
    (loaded) => {
      json = loaded;
      element.style.visibility = "";
      waiting?.();
    },
    (error: unknown) => console.error(`The ${key} sheet did not load.`, error),
  );
  return (shown: (json: unknown) => void) => {
    if (json === undefined) {
      waiting = () => shown(json);
    } else {
      shown(json);
    }
  };
}

const backgroundOf = (source: DomArtSource, key: string) =>
  `url("${source.artUrl(domArtPath("sheet", key, "png"))}")`;

// A frame's art pixel at (column, row) as a background position, each art pixel pixel wide.
function framePosition(frame: SheetFrame, pixel: number, column: number) {
  return `${-(frame.x + column) * pixel}px ${-frame.y * pixel}px`;
}

// A sheet's frame in an element of its own, placed in its container whose corner is at origin,
// or at, device pixels from that corner, where given.
export function sheetArt(
  doc: Document,
  source: DomArtSource,
  key: string,
): {
  readonly element: HTMLElement;
  readonly place: (
    scale: DomScale,
    origin: Point,
    art: SheetArtPlace,
    at?: { readonly left: number; readonly top: number },
  ) => void;
} {
  const element = doc.createElement("span");
  element.className = "adw-art";
  element.style.backgroundImage = backgroundOf(source, key);
  const loaded = sheetOf(source, key, element);
  return {
    element,
    place: (scale, origin, art, at) =>
      loaded((json) => {
        const frame = sheetFrame(json, art.tag);
        const pixel = artPixel(scale);
        setBox(element, {
          height: frame.height * pixel,
          left: at?.left ?? gridX(scale, art.x) - gridX(scale, origin.x),
          top: at?.top ?? gridY(scale, art.y) - gridY(scale, origin.y),
          width: frame.width * pixel,
        });
        element.style.backgroundSize = `${frame.sheet.width * pixel}px ${frame.sheet.height * pixel}px`;
        element.style.backgroundPosition = framePosition(frame, pixel, 0);
      }),
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
        const height = frame.height * pixel;
        setBox(element, {
          height,
          left: left - gridX(scale, origin.x),
          top: gridY(scale, art.y) - gridY(scale, origin.y),
          width,
        });
        const [start, middle, end] = parts;
        const sheetSize = (across: number) =>
          `${frame.sheet.width * across}px ${frame.sheet.height * pixel}px`;
        const sides = { left: slices.left * pixel, right: slices.right * pixel };
        if (start !== undefined && end !== undefined && middle !== undefined) {
          setBox(start, { height, left: 0, top: 0, width: sides.left });
          start.style.backgroundSize = sheetSize(pixel);
          start.style.backgroundPosition = framePosition(frame, pixel, 0);
          setBox(end, { height, left: width - sides.right, top: 0, width: sides.right });
          end.style.backgroundSize = sheetSize(pixel);
          end.style.backgroundPosition = framePosition(frame, pixel, frame.width - slices.right);
          // The middle columns at the stretch that spans them across the room the sides leave.
          const room = width - sides.left - sides.right;
          const across = room / (frame.width - slices.left - slices.right);
          setBox(middle, { height, left: sides.left, top: 0, width: room });
          middle.style.backgroundSize = sheetSize(across);
          middle.style.backgroundPosition = `${-(frame.x + slices.left) * across}px ${-frame.y * pixel}px`;
        }
      }),
  };
}

// An image whole, at its size in art pixels, from its top-left at a game point.
export function imageArt(
  doc: Document,
  source: DomArtSource,
  key: string,
): {
  readonly element: HTMLElement;
  readonly place: (
    scale: DomScale,
    origin: Point,
    art: Point & { readonly height: number; readonly width: number },
  ) => void;
} {
  const element = doc.createElement("span");
  element.className = "adw-art";
  element.style.backgroundImage = `url("${source.artUrl(domArtPath("image", key, "png"))}")`;
  return {
    element,
    place: (scale, origin, art) => {
      const pixel = artPixel(scale);
      setBox(element, {
        height: art.height * pixel,
        left: gridX(scale, art.x) - gridX(scale, origin.x),
        top: gridY(scale, art.y) - gridY(scale, origin.y),
        width: art.width * pixel,
      });
    },
  };
}

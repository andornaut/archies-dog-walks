import type { ZoneId } from "../data/ids.ts";
import { SCREEN_CONFIG } from "../data/index.ts";

export interface PixelImage {
  readonly height: number;
  readonly pixels: Uint32Array;
  readonly width: number;
}

// A road strip and its copies shrunk 2x and 4x along the road, for rows that cover more road
// than the strip has rows to show.
type StripLevels = readonly [PixelImage, PixelImage, PixelImage];

// A zone's look: its strip and the zone whose verge goes beside it, the strip's lines along the
// road, which every row that covers them keeps (stripLines), and its seams across the road,
// which every pass of the road through the view shows (stripSeams).
export interface RoadLook {
  readonly lines?: StripLines;
  readonly seams?: StripSeams;
  readonly strip: StripLevels;
  readonly zone: ZoneId;
}

// A strip's look, with its lines and seams.
export function roadLook(zone: ZoneId, strip: PixelImage): RoadLook {
  const seams = stripSeams(strip);
  return { lines: stripLines(strip), seams, strip: stripLevels(strip, seams), zone };
}

// The pixels of a strip that lie on its lines along the road, such as lane marks: runs at
// least LINE_RUN rows long, down one column, of a colour other than the strip's commonest.
// columns marks each column holding any.
export interface StripLines {
  readonly columns: Uint8Array;
  readonly mask: Uint8Array;
}

export const STRIP = { height: 64, width: SCREEN_CONFIG.roadWidth } as const;
// A start strip's far rows are its zone's road; the rest, a cross street, then the previous
// zone's road below it.
export const START_STRIP_ZONE_ROWS = 20;

// A run down a strip column at least this long is a line along the road.
export const LINE_RUN = 8;

// A palette colour as a pixel word: opaque, in ImageData byte order on any platform.
export function pixelWord(rgb: number): number {
  const bytes = new Uint8Array([(rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff, 0xff]);
  return new Uint32Array(bytes.buffer)[0] ?? 0;
}

function mostCommon(pixels: Uint32Array): number {
  const counts = new Map<number, number>();
  let best = pixels[0] ?? 0;
  let bestCount = 0;
  for (const pixel of pixels) {
    const count = (counts.get(pixel) ?? 0) + 1;
    counts.set(pixel, count);
    if (count > bestCount) {
      best = pixel;
      bestCount = count;
    }
  }
  return best;
}

// The image shrunk factor times along its height. Each pixel takes the colour most of the
// rows it stands for have; a tie goes to the image's commonest colour if it is one of the
// tied, else to the nearest of them to the top. Colours are never mixed, so it stays on the
// palette, and a far row shows the road's base rather than a speckle that blinks. The pixels
// set in skip, such as seams, which drawRoad draws itself, have no say; a pixel with none
// takes the base.
export function shrinkRows(factor: number, image: PixelImage, skip?: Uint8Array): PixelImage {
  const { width } = image;
  const height = Math.floor(image.height / factor);
  const base = mostCommon(image.pixels);
  const pixels = new Uint32Array(width * height);
  const seen: number[] = [];
  const counts: number[] = [];
  for (let row = 0; row < height; row++) {
    for (let x = 0; x < width; x++) {
      seen.length = 0;
      counts.length = 0;
      for (let k = 0; k < factor; k++) {
        const index = (row * factor + k) * width + x;
        if (skip?.[index] === 1) {
          continue;
        }
        const pixel = image.pixels[index] ?? 0;
        const at = seen.indexOf(pixel);
        if (at < 0) {
          seen.push(pixel);
          counts.push(1);
        } else {
          counts[at] = (counts[at] ?? 0) + 1;
        }
      }
      const most = Math.max(...counts);
      const tied = seen.filter((_, i) => counts[i] === most);
      pixels[row * width + x] = tied.includes(base) ? base : (tied[0] ?? base);
    }
  }
  return { height, pixels, width };
}

// The strip and its shrunk copies, which leave out seams, so a seam shows only on the rows
// drawRoad draws it on.
export function stripLevels(strip: PixelImage, seams?: StripSeams): StripLevels {
  return [strip, shrinkRows(2, strip, seams?.mask), shrinkRows(4, strip, seams?.mask)];
}

// The strip's lines along the road, wrapping from its last row to its first as it tiles.
export function stripLines(strip: PixelImage): StripLines {
  const { height, pixels, width } = strip;
  const base = mostCommon(pixels);
  const mask = new Uint8Array(width * height);
  const columns = new Uint8Array(width);
  const at = (x: number, y: number) => pixels[(((y % height) + height) % height) * width + x];
  for (let x = 0; x < width; x++) {
    // A column of one colour has no run start: it is one line all the way down.
    const uniform = Array.from({ length: height }, (_, y) => at(x, y)).every(
      (pixel) => pixel === at(x, 0),
    );
    if (uniform && at(x, 0) !== base && height >= LINE_RUN) {
      for (let y = 0; y < height; y++) {
        mask[y * width + x] = 1;
      }
      columns[x] = 1;
      continue;
    }
    for (let y = 0; y < height; y++) {
      const pixel = at(x, y);
      if (pixel === base || at(x, y - 1) === pixel) {
        continue;
      }
      let run = 1;
      while (run < height && at(x, y + run) === pixel) {
        run += 1;
      }
      if (run >= LINE_RUN) {
        for (let k = 0; k < run; k++) {
          mask[((y + k) % height) * width + x] = 1;
        }
        columns[x] = 1;
      }
    }
  }
  return { columns, mask };
}

// The pixels of a strip that lie on its seams across the road, such as paving joints: runs at
// least LINE_RUN columns long, along one row, of a colour other than the strip's commonest, and
// fewer than LINE_RUN rows of that colour down each column, wrapping as the strip tiles. Each
// column's run of seam rows is one seam: starts holds its row count at its nearest pixel (its
// last row in the strip, the first along the road), and 0 elsewhere. rows flags the strip rows
// holding a seam pixel (SEAM_PIXEL) and a seam's nearest pixel (SEAM_START).
interface StripSeams {
  readonly mask: Uint8Array;
  readonly rows: Uint8Array;
  readonly starts: Uint8Array;
}

export const SEAM_PIXEL = 1;
export const SEAM_START = 2;

export function stripSeams(strip: PixelImage): StripSeams {
  const { height, pixels, width } = strip;
  const base = mostCommon(pixels);
  const across = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    let x = 0;
    while (x < width) {
      const pixel = pixels[y * width + x];
      let run = 1;
      while (x + run < width && pixels[y * width + x + run] === pixel) {
        run += 1;
      }
      if (pixel !== base && run >= LINE_RUN) {
        across.fill(1, y * width + x, y * width + x + run);
      }
      x += run;
    }
  }
  const mask = new Uint8Array(width * height);
  const starts = new Uint8Array(width * height);
  const rows = new Uint8Array(height);
  const at = (x: number, y: number) => (((y % height) + height) % height) * width + x;
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const pixel = pixels[at(x, y)];
      // A seam starts on a row whose pixel above is not the same seam; a column all one seam
      // colour has no start, and is a line along the road.
      if (
        across[at(x, y)] !== 1 ||
        (across[at(x, y - 1)] === 1 && pixels[at(x, y - 1)] === pixel)
      ) {
        continue;
      }
      let run = 1;
      while (run < height && across[at(x, y + run)] === 1 && pixels[at(x, y + run)] === pixel) {
        run += 1;
      }
      if (run >= LINE_RUN) {
        continue;
      }
      for (let k = 0; k < run; k++) {
        mask[at(x, y + k)] = 1;
        rows[(y + k) % height] = (rows[(y + k) % height] ?? 0) | SEAM_PIXEL;
      }
      const nearest = (y + run - 1) % height;
      starts[nearest * width + x] = run;
      rows[nearest] = (rows[nearest] ?? 0) | SEAM_START;
    }
  }
  return { mask, rows, starts };
}

// A strip of one colour, for a zone whose art is missing.
export function solidStrip(rgb: number): PixelImage {
  const pixels = new Uint32Array(STRIP.width * STRIP.height).fill(pixelWord(rgb));
  return { ...STRIP, pixels };
}

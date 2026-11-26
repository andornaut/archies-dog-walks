import type { RasterRow, RoadRaster } from "./roadRaster.ts";
import {
  type PixelImage,
  type RoadLook,
  SEAM_PIXEL,
  SEAM_START,
  START_STRIP_ZONE_ROWS,
  STRIP,
  type StripLines,
} from "./roadStrip.ts";
import { drawVergeDetails, keepBackdropVerge, vergeAt, vergeOf } from "./vergeDraw.ts";

// approach, when set, is the backdrop's pixels on the approach rows across the view.
// zoneStart is the scroll at which the current zone began. While its start strip rolls in, it
// lies just past the far edge of the road in view at zoneStart, with the previous zone's road
// on the near side of it.
export interface RoadFrame {
  readonly approach?: Uint32Array | null;
  readonly current: RoadLook;
  readonly scroll: number;
  readonly transition: { readonly previous: RoadLook; readonly start: RoadLook } | null;
  readonly zoneStart: number;
}

// Draws one frame of the road into out, view.width by view.height, row by row: the strip's
// columns copied from the row's strip row with its lines kept, the verge copied from the
// zone's, then the seams, rough patches and 2-row marks that scroll with the road. On the
// approach rows the verge shows only where the backdrop's own pixel is the verge's.
export function drawRoad(raster: RoadRaster, frame: RoadFrame, out: Uint32Array): void {
  const { centreX, rows, view } = raster;
  const stripLeft = centreX - STRIP.width / 2;
  const { width } = view;
  const scratch = raster.scratch;
  let carried = scratch.carried[0];
  let next = scratch.carried[1];
  carried.count = 0;
  // Strip rows count down the road from the start strip's far end.
  const lineStart = frame.scroll - frame.zoneStart - raster.visibleDistance;
  for (let y = 0; y < rows.length; y++) {
    const row = rows[y];
    if (row === undefined) {
      continue;
    }
    const z = frame.scroll + row.distance;
    const along = Math.floor(z - frame.zoneStart - raster.visibleDistance);
    const look = lookAt(frame, along);
    const stripRow = stripRowAt(along);
    // Below its own zone's rows, the start strip is a cross street that follows the previous
    // zone: the verge beside it is the previous zone's.
    const vergeZone =
      look === frame.transition?.start && stripRow >= START_STRIP_ZONE_ROWS
        ? frame.transition.previous.zone
        : look.zone;
    const verge = vergeAt(vergeZone);
    const offset = y * width;
    const vergePixels = vergeOf(raster, vergeZone)[y]!;
    const { roadEnd, roadStart, roadX } = row;
    // The typed copy lays down the verge's cached base; the strip replaces its centre.
    out.set(vergePixels, offset);

    const image = look.strip[row.level];
    const pixels = image.pixels;
    // Whole, so the strip is indexed with integers.
    const rowStart = ((stripRow >> row.level) * image.width - stripLeft) | 0;
    for (let i = roadStart; i < roadEnd; i++) {
      out[offset + i] = pixels[rowStart + (roadX[i] ?? 0)] ?? 0;
    }
    // The shrunk strips leave seams out, so draw those on the row's strip row.
    if (row.level > 0 && look.seams !== undefined) {
      drawSeams(out, offset, row, look, stripLeft, stripRow, look.seams.mask, SEAM_PIXEL);
    }
    // The seams wholly between this row's strip row and the row below's, which no row samples.
    const below = Math.floor(frame.scroll + row.below - frame.zoneStart - raster.visibleDistance);
    for (let k = Math.max(below + 1, along - STRIP.height); k < along; k++) {
      const skipped = lookAt(frame, k);
      if (skipped.seams !== undefined) {
        drawSeams(
          out,
          offset,
          row,
          skipped,
          stripLeft,
          stripRowAt(k),
          skipped.seams.starts,
          SEAM_START,
          along - k + 1,
        );
      }
    }
    if (look.lines !== undefined) {
      const first = Math.floor(lineStart + row.near);
      const last = Math.max(first, Math.ceil(lineStart + row.far) - 1);
      drawLines(
        out,
        offset,
        row,
        look.strip[0],
        look.lines,
        stripLeft,
        first,
        last,
        scratch.lineRows,
      );
    }

    const plan = drawVergeDetails(raster, row, verge, carried, next, out, z, offset);
    const swap = carried;
    carried = next;
    next = swap;
    if (y < raster.junctionRows) {
      out.fill(0, offset, offset + roadStart);
      out.fill(0, offset + roadEnd, offset + width);
    } else if (y < raster.approachRows) {
      keepBackdropVerge(frame.approach ?? null, row, vergePixels, plan, offset, out);
    }
  }
}

// The look a strip row along the road shows: while a start strip rolls in, the previous zone's
// road lies on its near side.
function lookAt(frame: RoadFrame, along: number): RoadLook {
  if (frame.transition === null || along >= STRIP.height) {
    return frame.current;
  }
  return along >= 0 ? frame.transition.start : frame.transition.previous;
}

// The strip row a row along the road shows: strip rows count down the road from the strip's far
// end.
function stripRowAt(along: number): number {
  return (((STRIP.height - 1 - along) % STRIP.height) + STRIP.height) % STRIP.height;
}

// Draws a strip row's seam pixels on a screen row, from the full-size strip: the columns whose
// road x has a mark under fits. For a strip row no row samples, marks are its seam starts and
// fits the strip rows up to the row's own, so only the seams that end before it draw; the row's
// own strip row shows the rest.
function drawSeams(
  out: Uint32Array,
  offset: number,
  row: RasterRow,
  look: RoadLook,
  stripLeft: number,
  stripRow: number,
  marks: Uint8Array,
  flag: number,
  fits = 256,
): void {
  if (((look.seams?.rows[stripRow] ?? 0) & flag) === 0) {
    return;
  }
  const { pixels, width } = look.strip[0];
  const rowStart = (stripRow * width - stripLeft) | 0;
  const { roadEnd, roadX } = row;
  for (let i = row.roadStart; i < roadEnd; i++) {
    const at = rowStart + (roadX[i] ?? 0);
    const mark = marks[at] ?? 0;
    if (mark > 0 && mark < fits) {
      out[offset + i] = pixels[at] ?? 0;
    }
  }
}

// Keeps the strip's lines on a row: a column whose share of the road holds a line pixel on any
// strip row from first to last (counted down the road, as along) draws it, so a line thinner
// than a column or shorter than the row's span still shows, and moves with the road.
function drawLines(
  out: Uint32Array,
  offset: number,
  row: RasterRow,
  strip: PixelImage,
  lines: StripLines,
  stripLeft: number,
  first: number,
  last: number,
  lineRows: Int32Array,
): void {
  const { height, pixels, width } = strip;
  const { mask } = lines;
  // Each strip row's start in the strip, nearest first; a block longer than the strip covers
  // all of it.
  const count = Math.min(last - first + 1, height, lineRows.length);
  for (let n = 0; n < count; n++) {
    const along = first + n;
    lineRows[n] = ((((height - 1 - along) % height) + height) % height) * width;
  }
  const columns = lineColumnsOf(row, lines, width, stripLeft);
  for (let c = 0; c < columns.length; c += 3) {
    const from = columns[c + 1] ?? 0;
    const to = columns[c + 2] ?? 0;
    let at = -1;
    for (let n = 0; n < count && at < 0; n++) {
      const start = lineRows[n] ?? 0;
      for (let x = from; x <= to; x++) {
        if (mask[start + x] === 1) {
          at = start + x;
          break;
        }
      }
    }
    if (at >= 0) {
      out[offset + (columns[c] ?? 0)] = pixels[at] ?? 0;
    }
  }
}

// The row's columns whose share of the strip holds a line column, each as its column and the
// first and last strip columns of its share, flat.
function lineColumnsOf(
  row: RasterRow,
  lines: StripLines,
  width: number,
  stripLeft: number,
): Int16Array {
  let columns = row.lineColumns.get(lines);
  if (columns === undefined) {
    const found: number[] = [];
    for (let i = row.roadStart; i < row.roadEnd; i++) {
      const centre = (row.roadX[i] ?? 0) - stripLeft;
      let from = Math.max(0, (row.roadXFrom[i] ?? 0) - stripLeft);
      let to = Math.min(width - 1, (row.roadXTo[i] ?? 0) - stripLeft);
      if (from > to) {
        from = centre;
        to = centre;
      }
      for (let x = from; x <= to; x++) {
        if (lines.columns[x] === 1) {
          found.push(i, from, to);
          break;
        }
      }
    }
    columns = Int16Array.from(found);
    row.lineColumns.set(lines, columns);
  }
  return columns;
}

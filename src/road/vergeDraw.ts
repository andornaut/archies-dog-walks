import type { ZoneId } from "../data/ids.ts";
import type { RasterRow, RoadRaster } from "./roadRaster.ts";
import {
  dotColour,
  dottedBands,
  LEAF_PIXELS,
  markFits,
  markFrom,
  marksOnRow,
  noiseByte,
  noiseRow,
  ROUGH_PATCH_BLOCK,
  ROUGH_PATCH_REACH,
  roughPatches,
  seamRow,
  type Verge,
  vergeBase,
  VERGES,
  walkFrom,
} from "./roadside.ts";
import { pixelWord } from "./roadStrip.ts";

const words = new Map<number, number>();
function wordOf(rgb: number): number {
  let word = words.get(rgb);
  if (word === undefined) {
    word = pixelWord(rgb);
    words.set(rgb, word);
  }
  return word;
}

const LEAF_WORDS = LEAF_PIXELS.map((rows) =>
  rows.map((cells) => cells.map(({ colour, dx }) => ({ dx, word: wordOf(colour) }))),
);
const NO_LEAF: readonly { dx: number; word: number }[] = [];

// The colour words the verge draws over its base from across from to to (excluded): seams,
// dots, a rough lawn's patches, tufts and leaves.
interface VergeDetail {
  readonly from: number;
  readonly to: number;
  readonly words: ReadonlySet<number>;
}

// What each zone's verge draws per frame, looked up once a row: where its sidewalk or paving
// starts, its seam word, and its dotted bands, each with the colour word every noise byte
// picks (0 for none).
interface VergePlan {
  readonly details: readonly VergeDetail[];
  readonly dots: readonly {
    readonly from: number;
    readonly to: number;
    readonly words: Uint32Array;
  }[];
  // The least across each kind of mark may lie at (markFrom).
  readonly leafFrom: number;
  // The lawn's patch word, and its tuft word by each lawn word it falls on; none with no lawn.
  readonly patchWord: number;
  readonly seamWord: number;
  readonly tuftFrom: number;
  readonly tuftWords: ReadonlyMap<number, number>;
  readonly walkFrom: number;
}

const NOISE_STEPS = 256;

function vergePlan(verge: Verge): VergePlan {
  const lawn = verge.lawnColours;
  const dots = dottedBands(verge).map(({ dots: bandDots, from, to }) => ({
    from,
    to,
    words: Uint32Array.from({ length: NOISE_STEPS }, (_, n) => {
      const rgb = dotColour(bandDots, (n + 0.5) / NOISE_STEPS);
      return rgb === null ? 0 : wordOf(rgb);
    }),
  }));
  const leafFrom = markFrom(verge, "leaf");
  const patchWord = lawn === null ? 0 : wordOf(lawn[1]);
  const seamWord = wordOf(verge.seamColour);
  const tuftFrom = markFrom(verge, "tuft");
  const tuftWords = new Map(
    lawn === null ? [] : [lawn[0], lawn[1]].map((rgb) => [wordOf(rgb), wordOf(lawn[2])]),
  );
  const from = walkFrom(verge);
  const details: VergeDetail[] = [
    { from, to: verge.walkTo, words: new Set([seamWord]) },
    ...dots.map((band) => ({ ...band, words: new Set([...band.words].filter((w) => w !== 0)) })),
    { from: tuftFrom, to: Infinity, words: new Set([...tuftWords.values()]) },
    { from: leafFrom, to: Infinity, words: new Set(LEAF_WORDS.flat(2).map(({ word }) => word)) },
  ];
  if (verge.lawn === "rough") {
    details.push({ from: verge.walkTo, to: Infinity, words: new Set([patchWord]) });
  }
  return {
    details: details.filter((detail) => detail.to > detail.from && detail.words.size > 0),
    dots,
    leafFrom,
    patchWord,
    seamWord,
    tuftFrom,
    tuftWords,
    walkFrom: from,
  };
}

// Whether the verge draws this word over its base at across.
function isVergeDetail(plan: VergePlan, across: number, word: number): boolean {
  for (const { from, to, words } of plan.details) {
    if (across >= from && across < to && words.has(word)) {
      return true;
    }
  }
  return false;
}

// Each zone's verge, looked up by a Map: a keyed property read by a zone id string that V8
// has not seen there deoptimizes drawRoad.
const VERGE_BY_ZONE: ReadonlyMap<string, Verge> = new Map(Object.entries(VERGES));
export function vergeAt(zone: ZoneId): Verge {
  return VERGE_BY_ZONE.get(zone) ?? VERGES[zone];
}

const plans = new Map<Verge, VergePlan>();
function planOf(verge: Verge): VergePlan {
  let plan = plans.get(verge);
  if (plan === undefined) {
    plan = vergePlan(verge);
    plans.set(verge, plan);
  }
  return plan;
}

// Where the verge reaches threshold across on each side of a row's road: the first column
// nearer than it on the left, and the first as far or farther on the right.
function splitAt(row: RasterRow, threshold: number): readonly [number, number] {
  let split = row.splits.get(threshold);
  if (split === undefined) {
    let left = 0;
    while (left < row.roadStart && (row.across[left] ?? 0) >= threshold) {
      left += 1;
    }
    let right = row.roadEnd;
    while (right < row.across.length && (row.across[right] ?? 0) < threshold) {
      right += 1;
    }
    split = [left, right];
    row.splits.set(threshold, split);
  }
  return split;
}

export function vergeOf(raster: RoadRaster, zone: ZoneId): readonly Uint32Array[] {
  const drawn = raster.verges.get(zone);
  if (drawn !== undefined) {
    return drawn;
  }
  const verge = vergeAt(zone);
  const { width } = raster.view;
  const base = new Uint32Array(width * raster.rows.length);
  const rows = raster.rows.map((row, y) => {
    const pixels = base.subarray(y * width, (y + 1) * width);
    for (let i = 0; i < width; i++) {
      const across = row.across[i] ?? -1;
      pixels[i] = across < 0 ? 0 : wordOf(vergeBase(verge, across, row.scale));
    }
    return pixels;
  });
  raster.verges.set(zone, rows);
  return rows;
}

// The raster's caches grow with the road; past this many entries the oldest goes, so the rows
// in view stay cached rather than all being made again in one frame.
const CACHE_LIMIT = 4096;

function cached<T>(cache: Map<number, T>, key: number, make: (key: number) => T): T {
  let value = cache.get(key);
  if (value === undefined) {
    if (cache.size >= CACHE_LIMIT) {
      const oldest = cache.keys().next();
      if (oldest.done !== true) {
        cache.delete(oldest.value);
      }
    }
    value = make(key);
    cache.set(key, value);
  }
  return value;
}

// The pixels of marks' lower rows, drawn on the row below the one they start on: each one's
// column and the colour word to draw, or TUFT to tuft the lawn.
const TUFT = -1;
const CARRIED_MAX = 1024;

export interface Carried {
  count: number;
  readonly columns: Int16Array;
  readonly words: Float64Array;
}

export function carriedBuffer(): Carried {
  return {
    columns: new Int16Array(CARRIED_MAX),
    count: 0,
    words: new Float64Array(CARRIED_MAX),
  };
}

function carry(carried: Carried, column: number, word: number): void {
  if (carried.count < CARRIED_MAX) {
    carried.columns[carried.count] = column;
    carried.words[carried.count] = word;
    carried.count += 1;
  }
}

// Draws a mark pixel where the verge takes it and no other mark has drawn on this row, so a
// tuft marks the lawn once. word is TUFT, or a leaf's colour word.
function markPixel(
  out: Uint32Array,
  marked: Uint8Array,
  row: RasterRow,
  verge: Verge,
  offset: number,
  column: number,
  word: number,
): void {
  if (column < 0 || column >= row.across.length || marked[column] === 1) {
    return;
  }
  if (!markFits(verge, word === TUFT ? "tuft" : "leaf", row.across[column] ?? -1)) {
    return;
  }
  marked[column] = 1;
  const at = offset + column;
  if (word !== TUFT) {
    out[at] = word;
    return;
  }
  const tuft = planOf(verge).tuftWords.get(out[at] ?? 0);
  if (tuft !== undefined) {
    out[at] = tuft;
  }
}

// Draws a verge row's dots, seams, patches and marks over its base.
export function drawVergeDetails(
  raster: RoadRaster,
  row: RasterRow,
  verge: Verge,
  carried: Carried,
  next: Carried,
  out: Uint32Array,
  z: number,
  offset: number,
): VergePlan {
  const { centreX, view } = raster;
  const { marked } = raster.scratch;
  const { roadX } = row;
  const plan = planOf(verge);
  const { dots } = plan;
  if (dots.length > 0) {
    // Each dot holds a cell of road at least as long as the row's span, so it moves down
    // with the road rather than reshuffle on rows that cover more road than they show.
    const rowNoise = noiseRow(Math.floor(z) >> row.dotLevel);
    for (let d = 0; d < dots.length; d++) {
      const band = dots[d];
      if (band === undefined) {
        continue;
      }
      const from = splitAt(row, band.from);
      const to = splitAt(row, band.to);
      drawDots(out, offset, roadX, rowNoise, band.words, to[0], from[0]);
      drawDots(out, offset, roadX, rowNoise, band.words, from[1], to[1]);
    }
  }

  if (verge.walkTo > plan.walkFrom && seamRow(verge, z, row.span)) {
    const inner = splitAt(row, plan.walkFrom);
    const walk = splitAt(row, verge.walkTo);
    out.fill(plan.seamWord, offset + walk[0], offset + inner[0]);
    out.fill(plan.seamWord, offset + inner[1], offset + walk[1]);
  }

  if (verge.lawn === "rough") {
    drawPatches(raster, row, verge, z, offset, out);
  }

  marked.fill(0);
  for (let j = 0; j < carried.count; j++) {
    const column = carried.columns[j] ?? 0;
    markPixel(out, marked, row, verge, offset, column, carried.words[j] ?? TUFT);
  }
  next.count = 0;
  // A kind the row has no room for draws nothing, so its marks are not looked at.
  const tuftLimit = row.reach >= plan.tuftFrom ? row.tuftLimit : 0;
  const leafLimit = row.reach >= plan.leafFrom ? row.leafLimit : 0;
  const lastK = tuftLimit > 0 || leafLimit > 0 ? Math.floor(z) : Number.NEGATIVE_INFINITY;
  for (let k = Math.floor(z - row.span) + 1; k <= lastK; k++) {
    const marks = cached(raster.marks, k, marksOnRow);
    for (const mark of marks.tuft) {
      if (mark.keep >= tuftLimit) {
        break;
      }
      const column = Math.floor(centreX + mark.x * row.scale) - view.x;
      markPixel(out, marked, row, verge, offset, column, TUFT);
      carry(next, column, TUFT);
    }
    for (const mark of marks.leaf) {
      if (mark.keep >= leafLimit) {
        break;
      }
      const column = Math.floor(centreX + mark.x * row.scale) - view.x;
      const shape = LEAF_WORDS[mark.shape];
      for (const { dx, word } of shape?.[0] ?? NO_LEAF) {
        markPixel(out, marked, row, verge, offset, column + dx, word);
      }
      for (const { dx, word } of shape?.[1] ?? NO_LEAF) {
        carry(next, column + dx, word);
      }
    }
  }
  return plan;
}

// Clears an approach row's verge, for the backdrop under it to show, wherever the backdrop's
// own pixel is not the verge's, its base or a detail it draws there: its corners and fences
// stand still, while its sidewalks and lawns carry the verge's moving detail in place of the
// backdrop's still seams, dots and marks. With no backdrop, the whole verge clears.
export function keepBackdropVerge(
  approach: Uint32Array | null,
  row: RasterRow,
  verge: Uint32Array,
  plan: VergePlan,
  offset: number,
  out: Uint32Array,
): void {
  for (let i = 0; i < row.across.length; i++) {
    const at = offset + i;
    const across = row.across[i] ?? -1;
    if (across < 0) {
      continue;
    }
    const pixel = approach?.[at];
    if (pixel === undefined || (pixel !== verge[i] && !isVergeDetail(plan, across, pixel))) {
      out[at] = 0;
    }
  }
}

// A dotted band's columns from to to (excluded) on a row: each pixel's noise, seeded on its
// road x and the row's noise row, picks its dot word, if any.
function drawDots(
  out: Uint32Array,
  offset: number,
  roadX: Int16Array,
  rowNoise: number,
  words: Uint32Array,
  from: number,
  to: number,
): void {
  for (let i = from; i < to; i++) {
    const word = words[noiseByte(rowNoise, roadX[i] ?? 0)] ?? 0;
    if (word !== 0) {
      out[offset + i] = word;
    }
  }
}

// The rough patches on an unmown lawn: each one's chord across this row, in its mark colour.
function drawPatches(
  raster: RoadRaster,
  row: RasterRow,
  verge: Verge,
  z: number,
  offset: number,
  out: Uint32Array,
): void {
  const { centreX, view } = raster;
  const { patchWord } = planOf(verge);
  // The blocks whose patches reach z.
  const first = Math.floor((z - ROUGH_PATCH_REACH) / ROUGH_PATCH_BLOCK);
  const last = Math.floor((z + ROUGH_PATCH_REACH) / ROUGH_PATCH_BLOCK);
  for (let block = first; block <= last; block++) {
    for (const patch of cached(raster.patches, block, roughPatches)) {
      const along = (z - patch.z) / patch.rz;
      if (Math.abs(along) >= 1) {
        continue;
      }
      const half = patch.rx * Math.sqrt(1 - along * along);
      const from = Math.ceil(centreX + (patch.x - half) * row.scale - 0.5) - view.x;
      const to = Math.ceil(centreX + (patch.x + half) * row.scale - 0.5) - view.x;
      for (let i = Math.max(0, from); i < Math.min(view.width, to); i++) {
        if (markFits(verge, "tuft", row.across[i] ?? -1)) {
          out[offset + i] = patchWord;
        }
      }
    }
  }
}

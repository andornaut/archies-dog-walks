// Write a pixel font as a TrueType font in a WOFF 1.0 file, for HTML text that matches a BMFont's
// pixels.
//
// Each glyph is its bitmap's lit pixels (alpha above 0) merged into closed outlines along pixel
// edges, clockwise round ink and anticlockwise round counters, with no curves and no hinting
// instructions. One design pixel is UNITS (128) font units and the em is the font's size in design
// pixels (8 for every font fonts.ts writes, so 1024 units per em), so CSS font-size N px draws one
// design pixel N / size CSS pixels wide. The baseline is the BMFont's base, rows below the line's
// top: the ascent is base and the descent lineHeight - base, in hhea, OS/2's typo and win metrics
// alike (USE_TYPO_METRICS set, line gap 0), so CSS line-height normal is the BMFont's line. Advances
// and kerning pairs (a version 0 kern table) are the BMFont's, in whole design pixels. Glyph 0 is an
// empty .notdef, which TrueType requires; every other glyph is one of the BMFont's characters.
//
// The WOFF compresses each table with node:zlib's deflate, so it needs no dependency. A build is
// deterministic: the head table's dates are fixed and the deflate level is pinned.
//
// Run from the repository root; fonts.ts imports it.
import { deflateSync } from "node:zlib";

import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";

// Font units per design pixel.
export const UNITS = 128;

// A glyph as fonts.ts lays it out: its pixels (none for a space), the offsets of its top-left from
// the pen and the line's top, and the pen's advance, in design pixels.
export interface PixelGlyph {
  image: RgbaImage | undefined;
  xadvance: number;
  xoffset: number;
  yoffset: number;
}

export interface PixelFont {
  // Rows from the line's top to the baseline.
  base: number;
  // Name ID 0, the copyright notice.
  copyright?: string;
  // Name IDs 1 and 4; the PostScript name (ID 6) is family without spaces.
  family: string;
  kerns?: readonly (readonly [string, string, number])[];
  // Name IDs 13 and 14, the licence's description and URL.
  licence?: readonly [description: string, url: string];
  lineHeight: number;
  // The em in design pixels.
  size: number;
}

// ---------- outlines ----------

type Point = readonly [number, number];

// The lit pixels of image traced into contours in design pixels, y up from the baseline. A contour
// is its corner points in order; the last joins the first.
function contours(base: number, glyph: PixelGlyph): Point[][] {
  const { image, xoffset, yoffset } = glyph;
  if (!image) {
    return [];
  }
  const lit = (x: number, y: number): boolean =>
    x >= 0 &&
    y >= 0 &&
    x < image.width &&
    y < image.height &&
    image.data[(y * image.width + x) * 4 + 3]! > 0;
  // Directed pixel edges, ink on the right: from "x,y" to each end, in design pixels with y up.
  const edges = new Map<string, Point[]>();
  const key = ([x, y]: Point): string => `${x},${y}`;
  const add = (from: Point, to: Point): void => {
    const k = key(from);
    edges.set(k, [...(edges.get(k) ?? []), to]);
  };
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (!lit(x, y)) {
        continue;
      }
      const left = xoffset + x;
      const top = base - yoffset - y;
      const right = left + 1;
      const bottom = top - 1;
      if (!lit(x, y - 1)) {
        add([left, top], [right, top]);
      }
      if (!lit(x + 1, y)) {
        add([right, top], [right, bottom]);
      }
      if (!lit(x, y + 1)) {
        add([right, bottom], [left, bottom]);
      }
      if (!lit(x - 1, y)) {
        add([left, bottom], [left, top]);
      }
    }
  }
  const out: Point[][] = [];
  const starts = [...edges.keys()].sort();
  for (const startKey of starts) {
    while ((edges.get(startKey)?.length ?? 0) > 0) {
      const [sx, sy] = startKey.split(",").map(Number) as [number, number];
      const points: Point[] = [[sx, sy]];
      let at: Point = [sx, sy];
      let heading: Point | undefined;
      for (;;) {
        const ends = edges.get(key(at)) ?? [];
        if (ends.length === 0) {
          break;
        }
        // Where two pixels meet only at a corner, turn right, so each keeps its own contour.
        const pick = heading === undefined ? 0 : rightmost(at, heading, ends);
        const [to] = ends.splice(pick, 1) as [Point];
        heading = [to[0] - at[0], to[1] - at[1]];
        at = to;
        if (key(at) === startKey) {
          break;
        }
        points.push(at);
      }
      out.push(corners(points));
    }
  }
  return out;
}

// The index of the end that turns furthest clockwise from heading.
function rightmost(at: Point, heading: Point, ends: readonly Point[]): number {
  const turn = ([x, y]: Point): number => {
    const dx = x - at[0];
    const dy = y - at[1];
    // right is the heading turned clockwise, y up
    const cross = heading[0] * dy - heading[1] * dx;
    const dot = heading[0] * dx + heading[1] * dy;
    return cross < 0 ? 0 : dot > 0 ? 1 : 2;
  };
  let best = 0;
  ends.forEach((end, i) => {
    if (turn(end) < turn(ends[best]!)) {
      best = i;
    }
  });
  return best;
}

// points without the ones mid-way along a straight run.
function corners(points: readonly Point[]): Point[] {
  const n = points.length;
  return points.filter((p, i) => {
    const prev = points[(i + n - 1) % n]!;
    const next = points[(i + 1) % n]!;
    return (p[0] - prev[0]) * (next[1] - p[1]) !== (p[1] - prev[1]) * (next[0] - p[0]);
  });
}

// ---------- binary ----------

// A big-endian byte buffer that grows.
class Bytes {
  private data = new Uint8Array(256);
  length = 0;

  private room(n: number): void {
    if (this.length + n > this.data.length) {
      const grown = new Uint8Array(Math.max(this.data.length * 2, this.length + n));
      grown.set(this.data);
      this.data = grown;
    }
  }

  u8(v: number): this {
    this.room(1);
    this.data[this.length++] = v & 0xff;
    return this;
  }

  u16(v: number): this {
    return this.u8(v >> 8).u8(v);
  }

  i16(v: number): this {
    if (!Number.isInteger(v) || v < -0x8000 || v > 0x7fff) {
      throw new RangeError(`${v} is not an int16`);
    }
    return this.u16(v & 0xffff);
  }

  u32(v: number): this {
    return this.u16(Math.floor(v / 0x10000) & 0xffff).u16(v & 0xffff);
  }

  bytes(b: Uint8Array): this {
    this.room(b.length);
    this.data.set(b, this.length);
    this.length += b.length;
    return this;
  }

  tag(t: string): this {
    [...t].forEach((c) => this.u8(c.charCodeAt(0)));
    return this;
  }

  pad4(): this {
    while (this.length % 4 !== 0) {
      this.u8(0);
    }
    return this;
  }

  done(): Uint8Array {
    return this.data.slice(0, this.length);
  }
}

function checksum(table: Uint8Array): number {
  let sum = 0;
  for (let i = 0; i < table.length; i += 4) {
    const word =
      ((table[i] ?? 0) << 24) |
      ((table[i + 1] ?? 0) << 16) |
      ((table[i + 2] ?? 0) << 8) |
      (table[i + 3] ?? 0);
    sum = (sum + (word >>> 0)) % 0x100000000;
  }
  return sum;
}

// [searchRange, entrySelector, rangeShift] for n items of size bytes.
function search(n: number, size: number): [number, number, number] {
  const selector = Math.floor(Math.log2(n));
  const range = 2 ** selector * size;
  return [range, selector, n * size - range];
}

// ---------- tables ----------

interface Outline {
  advance: number;
  bounds: [xMin: number, yMin: number, xMax: number, yMax: number] | undefined;
  contours: Point[][];
}

// One simple glyph in glyf, in font units; empty for no contours.
function glyfEntry(outline: Outline): Uint8Array {
  if (!outline.bounds) {
    return new Uint8Array(0);
  }
  const b = new Bytes().i16(outline.contours.length);
  outline.bounds.forEach((v) => b.i16(v * UNITS));
  let end = -1;
  for (const c of outline.contours) {
    end += c.length;
    b.u16(end);
  }
  b.u16(0);
  const points = outline.contours.flat().map(([x, y]) => [x * UNITS, y * UNITS] as const);
  const flags: number[] = [];
  const xs = new Bytes();
  const ys = new Bytes();
  let px = 0;
  let py = 0;
  for (const [x, y] of points) {
    let flag = 0x01;
    for (const [d, shortBit, sameBit, out] of [
      [x - px, 0x02, 0x10, xs],
      [y - py, 0x04, 0x20, ys],
    ] as const) {
      if (d === 0) {
        flag |= sameBit;
      } else if (Math.abs(d) < 256) {
        flag |= shortBit | (d > 0 ? sameBit : 0);
        out.u8(Math.abs(d));
      } else {
        out.i16(d);
      }
    }
    flags.push(flag);
    px = x;
    py = y;
  }
  flags.forEach((f) => b.u8(f));
  return b.bytes(xs.done()).bytes(ys.done()).pad4().done();
}

function nameTable(records: readonly (readonly [number, string])[]): Uint8Array {
  const strings = records.map(([, s]) => {
    const out = new Bytes();
    [...s].forEach((c) => out.u16(c.charCodeAt(0)));
    return out.done();
  });
  const b = new Bytes()
    .u16(0)
    .u16(records.length)
    .u16(6 + records.length * 12);
  let offset = 0;
  records.forEach(([id], i) => {
    b.u16(3).u16(1).u16(0x409).u16(id).u16(strings[i]!.length).u16(offset);
    offset += strings[i]!.length;
  });
  strings.forEach((s) => b.bytes(s));
  return b.done();
}

// cmap with one format 4 subtable, for Unicode (0, 3) and Windows (3, 1), codes in glyph id order.
function cmapTable(codes: readonly number[]): Uint8Array {
  const segments: [start: number, end: number, delta: number][] = [];
  codes.forEach((code, i) => {
    const gid = i + 1;
    const last = segments.at(-1);
    if (last && code === last[1] + 1 && gid - code === last[2]) {
      last[1] = code;
    } else {
      segments.push([code, code, gid - code]);
    }
  });
  segments.push([0xffff, 0xffff, 1]);
  const n = segments.length;
  const [range, selector, shift] = search(n, 2);
  const sub = new Bytes()
    .u16(4)
    .u16(16 + n * 8)
    .u16(0)
    .u16(n * 2)
    .u16(range)
    .u16(selector)
    .u16(shift);
  segments.forEach(([, end]) => sub.u16(end));
  sub.u16(0);
  segments.forEach(([start]) => sub.u16(start));
  segments.forEach(([, , delta]) => sub.u16((delta + 0x10000) % 0x10000));
  segments.forEach(() => sub.u16(0));
  return new Bytes()
    .u16(0)
    .u16(2)
    .u16(0)
    .u16(3)
    .u32(20)
    .u16(3)
    .u16(1)
    .u32(20)
    .bytes(sub.done())
    .done();
}

function kernTable(pairs: readonly (readonly [number, number, number])[]): Uint8Array {
  const sorted = [...pairs].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const [range, selector, shift] = search(sorted.length, 6);
  const b = new Bytes()
    .u16(0)
    .u16(1)
    .u16(0)
    .u16(14 + sorted.length * 6)
    .u16(0x0001)
    .u16(sorted.length)
    .u16(range)
    .u16(selector)
    .u16(shift);
  sorted.forEach(([left, right, value]) =>
    b
      .u16(left)
      .u16(right)
      .i16(value * UNITS),
  );
  return b.done();
}

// The font's tables by tag.
function tables(font: PixelFont, glyphs: ReadonlyMap<string, PixelGlyph>): Map<string, Uint8Array> {
  const { base, family, lineHeight, size } = font;
  const descent = lineHeight - base;
  const chars = [...glyphs.keys()].sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!);
  const codes = chars.map((ch) => ch.codePointAt(0)!);
  if (codes.some((c) => c > 0xffff)) {
    throw new RangeError(`${family}: a format 4 cmap maps the BMP only`);
  }
  const outlines: Outline[] = [
    { advance: 0, bounds: undefined, contours: [] },
    ...chars.map((ch): Outline => {
      const g = glyphs.get(ch)!;
      const cs = contours(base, g);
      const pts = cs.flat();
      const bounds: Outline["bounds"] =
        pts.length === 0
          ? undefined
          : [
              Math.min(...pts.map(([x]) => x)),
              Math.min(...pts.map(([, y]) => y)),
              Math.max(...pts.map(([x]) => x)),
              Math.max(...pts.map(([, y]) => y)),
            ];
      return { advance: g.xadvance, bounds, contours: cs };
    }),
  ];
  const inked = outlines.flatMap((o) => (o.bounds ? [o.bounds] : []));
  const [xMin, yMin, xMax, yMax] = [
    Math.min(...inked.map((b) => b[0])),
    Math.min(...inked.map((b) => b[1])),
    Math.max(...inked.map((b) => b[2])),
    Math.max(...inked.map((b) => b[3])),
  ];
  const ascentUnits = base * UNITS;
  const descentUnits = descent * UNITS;
  const em = size * UNITS;

  const glyf = new Bytes();
  const loca = new Bytes();
  for (const o of outlines) {
    loca.u32(glyf.length);
    glyf.bytes(glyfEntry(o));
  }
  loca.u32(glyf.length);

  const hmtx = new Bytes();
  outlines.forEach((o) => hmtx.u16(o.advance * UNITS).i16((o.bounds?.[0] ?? 0) * UNITS));

  const head = new Bytes()
    .u32(0x00010000)
    .u32(0x00010000)
    .u32(0)
    .u32(0x5f0f3cf5)
    // baseline at y 0, left sidebearing at x 0
    .u16(0x0001 | 0x0002)
    .u16(em)
    // created and modified: 0, the epoch of 1904, so a build is deterministic
    .u32(0)
    .u32(0)
    .u32(0)
    .u32(0);
  [xMin, yMin, xMax, yMax].forEach((v) => head.i16(v * UNITS));
  head.u16(0).u16(size).i16(2).i16(1).i16(0);

  const sides = outlines.filter((o) => o.bounds);
  const hhea = new Bytes()
    .u32(0x00010000)
    .i16(ascentUnits)
    .i16(-descentUnits)
    .i16(0)
    .u16(Math.max(...outlines.map((o) => o.advance)) * UNITS)
    .i16(Math.min(...sides.map((o) => o.bounds![0])) * UNITS)
    .i16(Math.min(...sides.map((o) => o.advance - o.bounds![2])) * UNITS)
    .i16(Math.max(...sides.map((o) => o.bounds![2])) * UNITS)
    .i16(1)
    .i16(0)
    .i16(0)
    .i16(0)
    .i16(0)
    .i16(0)
    .i16(0)
    .i16(0)
    .u16(outlines.length);

  const maxPoints = Math.max(...outlines.map((o) => o.contours.flat().length));
  const maxContours = Math.max(...outlines.map((o) => o.contours.length));
  const maxp = new Bytes().u32(0x00010000).u16(outlines.length).u16(maxPoints).u16(maxContours);
  // composite points and contours, zones (2), then twilight points to component depth: 0
  maxp.u16(0).u16(0).u16(2);
  for (let i = 0; i < 8; i++) {
    maxp.u16(0);
  }

  const advances = outlines.filter((o) => o.advance > 0).map((o) => o.advance * UNITS);
  const capital = glyphs.get("H");
  const lower = glyphs.get("x");
  const heightOf = (g: PixelGlyph | undefined): number =>
    g?.image ? (base - g.yoffset) * UNITS : 0;
  const os2 = new Bytes()
    .u16(4)
    .i16(Math.round(advances.reduce((s, a) => s + a, 0) / advances.length))
    .u16(400)
    .u16(5)
    .u16(0);
  // sub- and superscript sizes and offsets, then strikeout size and position
  const half = Math.round(em / 2);
  [half, half, 0, Math.round(descentUnits / 2), half, half, 0, Math.round(ascentUnits / 2)].forEach(
    (v) => os2.i16(v),
  );
  os2.i16(UNITS).i16(Math.round(heightOf(capital) / 2));
  os2.i16(0);
  for (let i = 0; i < 10; i++) {
    os2.u8(0);
  }
  // Basic Latin, Latin-1 Supplement, and Miscellaneous Symbols for the heart
  const symbols = codes.some((c) => c >= 0x2600 && c <= 0x26ff);
  os2
    .u32(0x00000003)
    .u32(symbols ? 1 << 14 : 0)
    .u32(0)
    .u32(0);
  os2.tag("NONE");
  // regular, use typo metrics
  os2.u16(0x0040 | 0x0080);
  os2.u16(Math.min(...codes)).u16(Math.max(...codes));
  os2.i16(ascentUnits).i16(-descentUnits).i16(0);
  os2.u16(Math.max(ascentUnits, yMax * UNITS)).u16(Math.max(descentUnits, -yMin * UNITS));
  // Latin 1 code page
  os2.u32(1).u32(0);
  os2
    .i16(heightOf(lower))
    .i16(heightOf(capital))
    .u16(0)
    .u16(32)
    .u16(font.kerns?.length ? 2 : 1);

  const post = new Bytes()
    .u32(0x00030000)
    .u32(0)
    .i16(-UNITS)
    .i16(UNITS)
    .u32(0)
    .u32(0)
    .u32(0)
    .u32(0)
    .u32(0);

  const names: [number, string][] = [];
  if (font.copyright) {
    names.push([0, font.copyright]);
  }
  const postscript = `${family.replaceAll(" ", "")}-Regular`;
  names.push(
    [1, family],
    [2, "Regular"],
    [3, postscript],
    [4, family],
    [5, "Version 1.000"],
    [6, postscript],
  );
  if (font.licence) {
    names.push([13, font.licence[0]], [14, font.licence[1]]);
  }

  const out = new Map<string, Uint8Array>([
    ["OS/2", os2.done()],
    ["cmap", cmapTable(codes)],
    ["glyf", glyf.done()],
    ["head", head.done()],
    ["hhea", hhea.done()],
    ["hmtx", hmtx.done()],
    ["loca", loca.done()],
    ["maxp", maxp.done()],
    ["name", nameTable(names)],
    ["post", post.done()],
  ]);
  const gid = new Map(chars.map((ch, i) => [ch, i + 1]));
  const kerns = (font.kerns ?? []).flatMap(([a, b, amount]): [number, number, number][] => {
    const left = gid.get(a);
    const right = gid.get(b);
    return left === undefined || right === undefined ? [] : [[left, right, amount]];
  });
  if (kerns.length > 0) {
    out.set("kern", kernTable(kerns));
  }
  return out;
}

// ---------- files ----------

// The tables as a TrueType file, head's checkSumAdjustment filled in.
function sfnt(tabs: ReadonlyMap<string, Uint8Array>): Uint8Array {
  const tags = [...tabs.keys()].sort();
  const n = tags.length;
  const [range, selector, shift] = search(n, 16);
  const offsets = new Map<string, number>();
  let at = 12 + n * 16;
  for (const tag of tags) {
    offsets.set(tag, at);
    at += Math.ceil(tabs.get(tag)!.length / 4) * 4;
  }
  const file = new Bytes().u32(0x00010000).u16(n).u16(range).u16(selector).u16(shift);
  for (const tag of tags) {
    const data = tabs.get(tag)!;
    file.tag(tag).u32(checksum(data)).u32(offsets.get(tag)!).u32(data.length);
  }
  tags.forEach((tag) => file.bytes(tabs.get(tag)!).pad4());
  const out = file.done();
  const adjust = (0xb1b0afba - checksum(out) + 0x100000000) % 0x100000000;
  new DataView(out.buffer).setUint32(offsets.get("head")! + 8, adjust);
  return out;
}

// The tables as a WOFF 1.0 file: each table deflated where that makes it smaller, in tag order.
function woff(tabs: ReadonlyMap<string, Uint8Array>): Uint8Array {
  const ttf = sfnt(tabs);
  const tags = [...tabs.keys()].sort();
  const view = new DataView(ttf.buffer);
  // each table as the TrueType file holds it, head with its checkSumAdjustment
  const original = tags.map((tag, i) => {
    const offset = view.getUint32(12 + i * 16 + 8);
    return ttf.slice(offset, offset + tabs.get(tag)!.length);
  });
  const packed = original.map((data) => {
    const deflated = deflateSync(data, { level: 9 });
    return deflated.length < data.length ? new Uint8Array(deflated) : data;
  });
  let offset = 44 + tags.length * 20;
  const directory = new Bytes();
  tags.forEach((tag, i) => {
    const data = original[i]!;
    directory.tag(tag).u32(offset).u32(packed[i]!.length).u32(data.length).u32(checksum(data));
    offset += Math.ceil(packed[i]!.length / 4) * 4;
  });
  const file = new Bytes()
    .tag("wOFF")
    .u32(0x00010000)
    .u32(offset)
    .u16(tags.length)
    .u16(0)
    .u32(ttf.length)
    .u16(1)
    .u16(0)
    .u32(0)
    .u32(0)
    .u32(0)
    .u32(0)
    .u32(0)
    .bytes(directory.done());
  packed.forEach((data) => file.bytes(data).pad4());
  return file.done();
}

// The pixel font as a WOFF 1.0 file.
export function pixelWoff(font: PixelFont, glyphs: ReadonlyMap<string, PixelGlyph>): Uint8Array {
  return woff(tables(font, glyphs));
}

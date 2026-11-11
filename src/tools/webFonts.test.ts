import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { readBitmapFont } from "./fontFile.ts";

// The HTML interface lays its web fonts' text out by the bitmap fonts' glyphs
// (src/ui/dom/pixelLine.ts), and the canvas's fit checks hold for its text, so each web font must
// be its bitmap font: the same characters, advances, kerning and line, at 128 font units a pixel.

const UNITS_PER_PIXEL = 128;

// A WOFF 1.0 file's tables, each inflated where it is compressed.
function woffTables(file: Uint8Array): Map<string, DataView> {
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const tag = (at: number) => String.fromCharCode(...file.subarray(at, at + 4));
  expect(tag(0)).toBe("wOFF");
  const tables = new Map<string, DataView>();
  for (let i = 0; i < view.getUint16(12); i++) {
    const at = 44 + i * 20;
    const offset = view.getUint32(at + 4);
    const stored = file.subarray(offset, offset + view.getUint32(at + 8));
    const data = stored.length < view.getUint32(at + 12) ? inflateSync(stored) : stored;
    tables.set(tag(at), new DataView(data.buffer, data.byteOffset, data.byteLength));
  }
  return tables;
}

function table(tables: Map<string, DataView>, name: string): DataView {
  const found = tables.get(name);
  if (found === undefined) {
    throw new Error(`no ${name} table`);
  }
  return found;
}

// The glyph id of each character a format 4 cmap subtable maps.
function cmapGlyphs(cmap: DataView): Map<string, number> {
  const records = cmap.getUint16(2);
  let at = -1;
  for (let i = 0; i < records && at < 0; i++) {
    const offset = cmap.getUint32(4 + i * 8 + 4);
    if (cmap.getUint16(offset) === 4) {
      at = offset;
    }
  }
  expect(at).toBeGreaterThanOrEqual(0);
  const segments = cmap.getUint16(at + 6) / 2;
  const ends = at + 14;
  const starts = ends + segments * 2 + 2;
  const deltas = starts + segments * 2;
  const ranges = deltas + segments * 2;
  const glyphs = new Map<string, number>();
  for (let s = 0; s < segments; s++) {
    const end = cmap.getUint16(ends + s * 2);
    const delta = cmap.getInt16(deltas + s * 2);
    const range = cmap.getUint16(ranges + s * 2);
    for (let code = cmap.getUint16(starts + s * 2); code <= end && code !== 0xffff; code++) {
      const start = cmap.getUint16(starts + s * 2);
      const id =
        range === 0
          ? (code + delta) & 0xffff
          : cmap.getUint16(ranges + s * 2 + range + (code - start) * 2);
      if (id !== 0) {
        glyphs.set(String.fromCodePoint(code), id);
      }
    }
  }
  return glyphs;
}

function advances(hhea: DataView, hmtx: DataView): (id: number) => number {
  const metrics = hhea.getUint16(34);
  return (id) => hmtx.getUint16(Math.min(id, metrics - 1) * 4);
}

// A version 0 kern table's format 0 pairs, keyed by the two glyph ids.
function kernPairs(kern: DataView | undefined): Map<string, number> {
  const pairs = new Map<string, number>();
  if (kern === undefined) {
    return pairs;
  }
  const count = kern.getUint16(10);
  for (let i = 0; i < count; i++) {
    const at = 18 + i * 6;
    pairs.set(`${kern.getUint16(at)}:${kern.getUint16(at + 2)}`, kern.getInt16(at + 4));
  }
  return pairs;
}

describe.each(["font-body", "font-title"])("%s.woff", (key) => {
  const tables = woffTables(
    readFileSync(new URL(`../../public/art/fonts/${key}.woff`, import.meta.url)),
  );
  const bitmap = readBitmapFont(key);
  const glyphs = cmapGlyphs(table(tables, "cmap"));
  const hhea = table(tables, "hhea");

  it("maps exactly the bitmap font's characters, each at its advance", () => {
    expect([...glyphs.keys()].sort()).toEqual([...bitmap.glyphs.keys()].sort());
    const advance = advances(hhea, table(tables, "hmtx"));
    for (const [char, glyph] of bitmap.glyphs) {
      expect(advance(glyphs.get(char) ?? 0), char).toBe(glyph.advance * UNITS_PER_PIXEL);
    }
  });

  it("keeps the bitmap font's line, baseline and pixel grid", () => {
    expect(table(tables, "head").getUint16(18)).toBe(8 * UNITS_PER_PIXEL);
    expect(hhea.getInt16(4)).toBe((bitmap.baseline ?? 0) * UNITS_PER_PIXEL);
    expect(hhea.getInt16(6)).toBe(-(bitmap.lineHeight - (bitmap.baseline ?? 0)) * UNITS_PER_PIXEL);
    expect(hhea.getInt16(8)).toBe(0);
  });

  it("kerns the bitmap font's pairs, and no others", () => {
    const id = (char: string) => glyphs.get(char) ?? 0;
    const expected = new Map(
      [...bitmap.kernings].map(([pair, amount]) => {
        const [first = "", second = ""] = [...pair];
        return [`${id(first)}:${id(second)}`, amount * UNITS_PER_PIXEL];
      }),
    );
    expect(kernPairs(tables.get("kern"))).toEqual(expected);
  });
});

import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

import { decodePng } from "@andornaut/art-kit/png";
import { describe, expect, it } from "vitest";

import palette from "../../shared/palette.json" with { type: "json" };

// Art's conformance rules over every committed export (art/style-guide.md, art/inventory.md).

const ART = "public/art";

function filesUnder(dir: string, ext: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(ext))
    .map((entry) => join(entry.parentPath, entry.name))
    .sort();
}

const stem = (path: string, ext: string) => basename(path, ext);

// The home page's screenshots are captures of the running game, not drawn art, so they are
// exempt from the palette rule.
const CAPTURES = [`${ART}/site/home-road.png`, `${ART}/site/home-start.png`];

describe("the exported PNGs", () => {
  // shared/palette.json holds the house palette and the picker-only UI tones (PICKER_UI).
  const allowed = new Set(Object.values(palette).map(({ hex }) => Number.parseInt(hex, 16)));

  it("use only palette colours, each pixel opaque or fully transparent", () => {
    const pngs = filesUnder(ART, ".png").filter((path) => !CAPTURES.includes(path));
    expect(pngs.length).toBeGreaterThan(0);
    const misfits: string[] = [];
    for (const path of pngs) {
      const { data } = decodePng(readFileSync(path));
      let partial = 0;
      const off = new Set<number>();
      for (let i = 0; i < data.length; i += 4) {
        const alpha = data[i + 3]!;
        if (alpha === 0) {
          continue;
        }
        if (alpha !== 255) {
          partial += 1;
        }
        const rgb = (data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!;
        if (!allowed.has(rgb)) {
          off.add(rgb);
        }
      }
      if (partial > 0 || off.size > 0) {
        const hexes = [...off].slice(0, 4).map((rgb) => rgb.toString(16).padStart(6, "0"));
        misfits.push(`${path}: ${partial} partial-alpha pixels, off-palette ${hexes.join(" ")}`);
      }
    }
    expect(misfits).toEqual([]);
  });

  it.each(CAPTURES)("keep the game capture %s full-screen and opaque", (path) => {
    const { data, height, width } = decodePng(readFileSync(path));
    expect([width, height]).toEqual([360, 560]);
    expect(data.filter((_, i) => i % 4 === 3).every((alpha) => alpha === 255)).toBe(true);
  });
});

describe("the art sources", () => {
  it("are the tools, with no Aseprite files committed", () => {
    expect(filesUnder("art", ".aseprite")).toEqual([]);
  });
});

interface InventoryRow {
  keys: string[];
  line: number;
  sizes: string;
  tags: string;
}

// The inventory's sprite rows: every row of a Key/Size/Tags table whose Type is sprite, or
// that has no Type column (the roadside props).
function spriteRows(markdown: string): InventoryRow[] {
  const rows: InventoryRow[] = [];
  let header: string[] | undefined;
  const cells = (line: string) =>
    line
      .slice(1, -1)
      .split("|")
      .map((cell) => cell.trim());
  markdown.split("\n").forEach((text, index) => {
    if (!text.startsWith("|")) {
      header = undefined;
      return;
    }
    const row = cells(text);
    if (header === undefined) {
      header = row;
      return;
    }
    if (row.every((cell) => /^-+$/.test(cell))) {
      return;
    }
    const at = (name: string) => row[header!.indexOf(name)];
    const key = at("Key");
    const type = header.includes("Type") ? at("Type") : "sprite";
    if (key === undefined || type !== "sprite" || !header.includes("Tags")) {
      return;
    }
    // A key cell lists backticked keys; one starting with "-" shortens the first key's family.
    const listed = [...key.matchAll(/`([^`]+)`/g)].map((match) => match[1]!);
    const family = listed[0]!.split("-")[0]!;
    rows.push({
      keys: listed.map((k) => (k.startsWith("-") ? `${family}${k}` : k)),
      line: index + 1,
      sizes: at("Size")!,
      tags: at("Tags")!,
    });
  });
  return rows;
}

// A key with <placeholders> matches any lower-case kebab name in each.
function keyPattern(key: string): RegExp {
  const literal = key
    .split(/<[^>]+>/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("[a-z0-9]+(?:-[a-z0-9]+)*");
  return new RegExp(`^${literal}$`);
}

const literalLength = (key: string) => key.replace(/<[^>]+>/g, "").length;

// Rows whose Tags cell is prose around its tags, so only their sizes are checked. Other rows'
// tags match the sprite's in any order, a <placeholder> tag matching any name.
const PROSE_TAGS = [
  "ambient-bird",
  "card-frame-large",
  "chase-cat",
  "ui-difficulty",
  "ui-dog-card",
  "ui-warning",
];

// Tags a sprite has beyond its row's, which the inventory gives in prose under the row's table.
const EXTRA_TAGS: Readonly<Record<string, readonly string[]>> = { "walker-mr-b": ["phone"] };

interface SpriteSheet {
  frames: Record<string, { sourceSize: { h: number; w: number } }>;
  meta: { frameTags: { name: string }[] };
}

describe("the inventory's sprite rows", () => {
  const rows = spriteRows(readFileSync("art/inventory.md", "utf8"));
  const sheets = new Map(
    filesUnder(`${ART}/sprites`, ".json")
      .map((path) => [stem(path, ".json"), path] as const)
      .filter(([key]) => !key.includes("@")),
  );
  // Each base sprite belongs to its most specific inventory key: a literal key over a
  // placeholder, more literal characters over fewer.
  const owner = new Map<string, string>();
  for (const key of sheets.keys()) {
    const best = rows
      .flatMap((row) => row.keys)
      .filter((listed) => keyPattern(listed).test(key))
      .sort((a, b) => literalLength(b) - literalLength(a))[0];
    if (best !== undefined) {
      owner.set(key, best);
    }
  }
  const exportsOf = (listed: string) =>
    [...owner].filter(([, best]) => best === listed).map(([key]) => key);

  it("each name at least one exported sprite", () => {
    const missing = rows.flatMap((row) =>
      row.keys.filter((listed) => exportsOf(listed).length === 0).map((k) => `${row.line} ${k}`),
    );
    expect(missing).toEqual([]);
  });

  it("give each sprite's frame size and tags", () => {
    const misfits: string[] = [];
    const prose: string[] = [];
    for (const row of rows) {
      const sizes = [...row.sizes.matchAll(/(\d+)×(\d+)/g)].map(([size]) => size);
      const tagText = row.tags.replace(/`[^`]+`/g, "").replace(/[,\s]/g, "");
      const tags = tagText === "" ? [...row.tags.matchAll(/`([^`]+)`/g)].map((m) => m[1]!) : null;
      if (tags === null) {
        prose.push(row.keys[0]!);
      }
      row.keys.forEach((listed, index) => {
        // A size per key when there are as many; otherwise any listed size.
        const allowed = sizes.length === row.keys.length ? [sizes[index]!] : sizes;
        for (const key of exportsOf(listed)) {
          const sheet = JSON.parse(readFileSync(sheets.get(key)!, "utf8")) as SpriteSheet;
          const frameSizes = new Set(
            Object.values(sheet.frames).map(({ sourceSize: { h, w } }) => `${w}×${h}`),
          );
          if (frameSizes.size !== 1 || !allowed.includes([...frameSizes][0]!)) {
            misfits.push(`${row.line} ${key}: ${[...frameSizes].join(", ")}, not ${row.sizes}`);
          }
          const actual = sheet.meta.frameTags.map(({ name }) => name);
          const listed = [...(tags ?? []), ...(EXTRA_TAGS[key] ?? [])].map(keyPattern);
          const unlisted = actual.filter((tag) => !listed.some((pattern) => pattern.test(tag)));
          const absent = listed.filter((pattern) => !actual.some((tag) => pattern.test(tag)));
          if (tags !== null && (unlisted.length > 0 || absent.length > 0)) {
            misfits.push(`${row.line} ${key}: ${actual.join(", ")}, not ${row.tags}`);
          }
        }
      });
    }
    expect(misfits).toEqual([]);
    expect(prose.sort()).toEqual(PROSE_TAGS);
  });
});

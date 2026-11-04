// Compare two trees of generated art outputs and report every difference.
//
// Usage:
//   node art/tools/parity.ts BASELINE_DIR CANDIDATE_DIR [--paths GLOB...] [--diff OUT_DIR]
//
// PNGs match when they decode to the same size and RGBA; a mismatch reports its differing-pixel count
// and bounding box and, with --diff, writes OUT_DIR/<path>.diff.png (differing pixels magenta over
// the faded baseline). An .aseprite pair matches when its bytes do, or when Aseprite's sheet export of
// each decodes to the same RGBA with equal frames (rects and durations), tags, slices and layers. JSON
// matches when it parses deep-equal (-0 equal to 0), and anything else when its bytes do. Files on only one side are
// differences. --paths limits the comparison to paths relative to the tree roots that match a glob.
// The exit status is 1 on any difference.
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, matchesGlob, relative } from "node:path";
import { isDeepStrictEqual } from "node:util";

import { decodePng, encodeRgbaPng } from "@andornaut/art-kit/png";
import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";

const SKIP = new Set([".git", "__pycache__", "node_modules"]);
const USAGE =
  "node art/tools/parity.ts BASELINE_DIR CANDIDATE_DIR [--paths GLOB...] [--diff OUT_DIR]";

// JSON text's value, with -0 read as 0: Python writes -0.0, and JSON.stringify cannot write -0.
function parseJson(bytes: Buffer): unknown {
  return JSON.parse(bytes.toString("utf8"), (_, v: unknown) => (Object.is(v, -0) ? 0 : v));
}

// Every file under root, as paths relative to it.
function files(root: string): string[] {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(root, join(entry.parentPath, entry.name)))
    .filter((path) => !path.split("/").some((part) => SKIP.has(part)));
}

// The pixels that differ between two same-size images: their count and bounding box.
function pixelDiff(
  a: RgbaImage,
  b: RgbaImage,
): { box: [number, number, number, number]; count: number } {
  let count = 0;
  const box: [number, number, number, number] = [Infinity, Infinity, -1, -1];
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const i = (y * a.width + x) * 4;
      if ([0, 1, 2, 3].some((k) => a.data[i + k] !== b.data[i + k])) {
        count += 1;
        box[0] = Math.min(box[0], x);
        box[1] = Math.min(box[1], y);
        box[2] = Math.max(box[2], x);
        box[3] = Math.max(box[3], y);
      }
    }
  }
  return { box, count };
}

// The baseline faded to a quarter of its opacity, with the pixels that differ in magenta.
function diffImage(a: RgbaImage, b: RgbaImage): RgbaImage {
  const data = new Uint8Array(a.data);
  for (let i = 0; i < data.length; i += 4) {
    const differs = [0, 1, 2, 3].some((k) => a.data[i + k] !== b.data[i + k]);
    data.set(
      differs ? [255, 0, 255, 255] : [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]! >> 2],
      i,
    );
  }
  return { data, height: a.height, width: a.width };
}

// The difference between two decoded images, or null when they match.
function compareImages(
  diffDir: string | undefined,
  path: string,
  a: RgbaImage,
  b: RgbaImage,
): string | null {
  if (a.width !== b.width || a.height !== b.height) {
    return `size ${a.width}x${a.height} != ${b.width}x${b.height}`;
  }
  const { box, count } = pixelDiff(a, b);
  if (!count) {
    return null;
  }
  if (diffDir) {
    const out = join(diffDir, `${path}.diff.png`);
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(
      out,
      encodeRgbaPng({ deflateLevel: 9, deflateStrategy: 3, filterType: -1 }, diffImage(a, b)),
    );
  }
  return `${count} pixels differ in x ${box[0]}..${box[2]}, y ${box[1]}..${box[3]}`;
}

interface SheetData {
  frames: Record<string, unknown>;
  meta: { frameTags?: unknown; layers?: unknown; slices?: unknown };
}

// An .aseprite file's sheet, as Aseprite exports it, and the parts of its data that describe the
// sprite rather than the export.
function asepriteSheet(path: string): { data: unknown; image: RgbaImage } {
  const scratch = mkdtempSync(join(tmpdir(), "parity-"));
  try {
    const sheet = join(scratch, "sheet.png");
    const json = join(scratch, "sheet.json");
    // Aseprite names each frame after the file, so both sides export from the same basename.
    const source = join(scratch, basename(path));
    writeFileSync(source, readFileSync(path));
    execFileSync(
      "aseprite",
      [
        "-b",
        source,
        "--sheet",
        sheet,
        "--data",
        json,
        "--format",
        "json-hash",
        "--list-tags",
        "--list-slices",
        "--list-layers",
      ],
      { stdio: ["ignore", "ignore", "inherit"] },
    );
    const { frames, meta } = JSON.parse(readFileSync(json, "utf8")) as SheetData;
    return {
      data: { frames, layers: meta.layers, slices: meta.slices, tags: meta.frameTags },
      image: decodePng(readFileSync(sheet)),
    };
  } finally {
    rmSync(scratch, { force: true, recursive: true });
  }
}

// The difference between the files at path under the two roots, or null when they match.
function compare(
  diffDir: string | undefined,
  baseline: string,
  candidate: string,
  path: string,
): string | null {
  const a = readFileSync(join(baseline, path));
  const b = readFileSync(join(candidate, path));
  if (path.endsWith(".png")) {
    return compareImages(diffDir, path, decodePng(a), decodePng(b));
  }
  if (path.endsWith(".aseprite")) {
    if (a.equals(b)) {
      return null;
    }
    const sa = asepriteSheet(join(baseline, path));
    const sb = asepriteSheet(join(candidate, path));
    const pixels = compareImages(diffDir, path, sa.image, sb.image);
    if (pixels) {
      return `sheet: ${pixels}`;
    }
    return isDeepStrictEqual(sa.data, sb.data) ? null : "frames, tags, slices or layers differ";
  }
  if (path.endsWith(".json")) {
    return isDeepStrictEqual(parseJson(a), parseJson(b)) ? null : "parsed JSON differs";
  }
  return a.equals(b) ? null : "bytes differ";
}

function parseArgs(argv: readonly string[]): {
  diffDir?: string;
  globs: string[];
  roots: string[];
} {
  const roots: string[] = [];
  const globs: string[] = [];
  let diffDir: string | undefined;
  let mode: "diff" | "paths" | "roots" = "roots";
  for (const arg of argv) {
    if (arg === "--paths" || arg === "--diff") {
      mode = arg === "--paths" ? "paths" : "diff";
    } else if (mode === "diff") {
      diffDir = arg;
      mode = "roots";
    } else {
      (mode === "paths" ? globs : roots).push(arg);
    }
  }
  return diffDir === undefined ? { globs, roots } : { diffDir, globs, roots };
}

const { diffDir, globs, roots } = parseArgs(process.argv.slice(2));
if (roots.length !== 2) {
  console.error(USAGE);
  process.exit(2);
}
const [baseline, candidate] = roots as [string, string];
const wanted = (path: string): boolean =>
  !globs.length || globs.some((glob) => matchesGlob(path, glob));
const left = new Set(files(baseline).filter(wanted));
const right = new Set(files(candidate).filter(wanted));
const paths = [...new Set([...left, ...right])].sort();
// [compared, differing] by kind.
const tally = new Map<string, [number, number]>();
let differences = 0;
for (const path of paths) {
  let problem: string | null;
  if (!left.has(path)) {
    problem = "only in candidate";
  } else if (right.has(path)) {
    problem = compare(diffDir, baseline, candidate, path);
  } else {
    problem = "only in baseline";
  }
  const kind = /\.(aseprite|json|png)$/.exec(path)?.[1] ?? "other";
  const [n, d] = tally.get(kind) ?? [0, 0];
  tally.set(kind, [n + 1, d + (problem ? 1 : 0)]);
  if (problem) {
    differences += 1;
    console.log(`DIFF ${path}: ${problem}`);
  }
}
for (const [kind, [n, d]] of [...tally].sort()) {
  console.log(`${kind}: ${n} compared, ${d} differ`);
}
console.log(
  `${paths.length} files compared, ${paths.length - differences} equal, ${differences} differ`,
);
process.exitCode = differences ? 1 : 0;

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { decodePng } from "@andornaut/art-kit/build/png";
import type { RgbaImage } from "@andornaut/art-kit/build/rgbaImage";
import decoderFactory from "@jsquash/webp/codec/dec/webp_dec.js";
import { initEmscriptenModule } from "@jsquash/webp/utils.js";
import { beforeAll, describe, expect, it, vi } from "vitest";

import {
  DOM_CHOICE_CARD_ART,
  DOM_DISABLED_ART_KEYS,
  DOM_SHEET_KEYS,
  DOM_SHEETS,
  domArtFileUrl,
  domArtPath,
  domSheetImagePath,
  domSheetJsonPath,
} from "../../assets/domArt.ts";
import { parseManifest } from "../../assets/manifest.ts";
import { type DomSheetJson, domSheetSprite } from "../../ui/dom/sheetFrames.ts";
import { ART_MANIFEST } from "../artManifest.ts";
import { ATLAS_MAX_SIZE } from "./atlasLayout.ts";
import { buildDomSheets, packDomSheet } from "./domSheets.ts";
import { artCopies, type DomArtKeys } from "./hashedArt.ts";

const ART_DIR = join(import.meta.dirname, "../../../public/art");
const readOwn = (path: string) => new Uint8Array(readFileSync(join(ART_DIR, path)));
const DOM_KEYS: DomArtKeys = {
  disabled: DOM_DISABLED_ART_KEYS,
  grey: DOM_CHOICE_CARD_ART.grey,
  sheets: DOM_SHEET_KEYS,
};
const manifest = parseManifest(JSON.parse(new TextDecoder().decode(readOwn(ART_MANIFEST))));

interface OwnSheet {
  frames: Record<
    string,
    { duration: number; frame: { h: number; w: number; x: number; y: number } }
  >;
  meta: { frameTags?: unknown[] };
}

// The pixels of rect in image, row by row.
function crop(image: RgbaImage, [x, y, width, height]: readonly number[]): Uint8Array {
  const out = new Uint8Array(width! * height! * 4);
  for (let row = 0; row < height!; row += 1) {
    const start = ((y! + row) * image.width + x!) * 4;
    out.set(image.data.subarray(start, start + width! * 4), row * width! * 4);
  }
  return out;
}

const same = (a: Uint8Array, b: Uint8Array) => Buffer.from(a).equals(Buffer.from(b));

describe("the DOM sheets a build packs from the files on disk", () => {
  let files: Map<string, Uint8Array>;
  // Each built image, decoded by libwebp built to WebAssembly, as the browser decodes it.
  const images = new Map<string, RgbaImage>();
  const sheets = new Map<string, DomSheetJson>();
  beforeAll(async () => {
    files = await buildDomSheets(async (path) => readOwn(path), manifest, {
      copies: artCopies(DOM_KEYS),
      sheets: DOM_SHEET_KEYS,
    });
    const require = createRequire(import.meta.url);
    const wasm = await WebAssembly.compile(
      readFileSync(require.resolve("@jsquash/webp/codec/dec/webp_dec.wasm")),
    );
    const decoder = await initEmscriptenModule(decoderFactory, wasm);
    for (const [path, bytes] of files) {
      if (path.endsWith(".webp")) {
        const image = decoder.decode(bytes)!;
        images.set(path, {
          data: new Uint8Array(image.data.buffer),
          height: image.height,
          width: image.width,
        });
      } else {
        sheets.set(path, JSON.parse(new TextDecoder().decode(bytes)) as DomSheetJson);
      }
    }
  }, 120_000);

  it("pack each sheet onto one page within the texture size mid-range Android guarantees", () => {
    for (const sheet of DOM_SHEETS) {
      const image = images.get(domSheetImagePath(sheet))!;
      const json = sheets.get(domSheetJsonPath(sheet))!;
      expect(Math.max(image.width, image.height), sheet).toBeLessThanOrEqual(ATLAS_MAX_SIZE);
      expect([json.size.w, json.size.h], sheet).toEqual([image.width, image.height]);
    }
  });

  it("hold every key's own PNG byte for byte at its rect, and its own frames moved there", () => {
    for (const [key, sheet] of DOM_SHEET_KEYS) {
      const image = images.get(domSheetImagePath(sheet))!;
      const json = sheets.get(domSheetJsonPath(sheet))!;
      const entry = json.keys[key]!;
      const sprite = manifest.sprites.find((each) => each.key === key);
      const own = decodePng(
        readOwn(sprite?.png ?? manifest.images.find((each) => each.key === key)!.png),
      );
      expect([entry.rect[2], entry.rect[3]], key).toEqual([own.width, own.height]);
      expect(same(crop(image, entry.rect), own.data), key).toBe(true);
      if (sprite !== undefined) {
        const ownJson = JSON.parse(new TextDecoder().decode(readOwn(sprite.json))) as OwnSheet;
        const moved = domSheetSprite(json, key) as OwnSheet;
        const rects = (sheetJson: OwnSheet, x: number, y: number) =>
          Object.entries(sheetJson.frames).map(([name, { duration, frame }]) => [
            name,
            frame.x - x,
            frame.y - y,
            frame.w,
            frame.h,
            duration,
          ]);
        expect(rects(moved, entry.rect[0], entry.rect[1]), key).toEqual(rects(ownJson, 0, 0));
        expect(moved.meta.frameTags, key).toEqual(ownJson.meta.frameTags ?? []);
      }
    }
  });

  it("write each copy with its sheet's rects: each copied key remapped, the rest clear", () => {
    for (const [copy, copied] of artCopies(DOM_KEYS)) {
      for (const sheet of DOM_SHEETS) {
        const image = images.get(domSheetImagePath(sheet))!;
        const json = sheets.get(domSheetJsonPath(sheet))!;
        const keys = Object.keys(json.keys);
        const path = domSheetImagePath(sheet, copy.suffix);
        const copyImage = images.get(path);
        expect(copyImage !== undefined, path).toBe(keys.some((key) => copied.has(key)));
        if (copyImage === undefined) {
          continue;
        }
        expect([copyImage.width, copyImage.height], path).toEqual([image.width, image.height]);
        for (const key of keys) {
          const pixels = new Uint8ClampedArray(crop(image, json.keys[key]!.rect));
          if (copied.has(key)) {
            copy.remap(pixels);
          } else {
            pixels.fill(0);
          }
          const drawn = crop(copyImage, json.keys[key]!.rect);
          expect(same(drawn, new Uint8Array(pixels.buffer)), `${path} ${key}`).toBe(true);
        }
      }
    }
  });
});

it("resolves each key's logical files to its sheet, and a copy's to its sheet's copy", () => {
  const artUrl = (path: string) => `/art/${path}`;
  expect(domArtFileUrl(artUrl, domArtPath("sheet", "ui-dog-card", "json"))).toBe(
    "/art/dom/dom-walk.json#ui-dog-card",
  );
  expect(domArtFileUrl(artUrl, domArtPath("image", "ui-quip", "png"))).toBe(
    "/art/dom/dom-chrome.webp",
  );
  expect(domArtFileUrl(artUrl, domArtPath("sheet", "face-dog-kilo-disabled", "png"))).toBe(
    "/art/dom/dom-home-disabled.webp",
  );
  expect(domArtFileUrl(artUrl, "images/card-skip-grey.png")).toBe("/art/dom/dom-cards-grey.webp");
  expect(domArtFileUrl(artUrl, domArtPath("sheet", "treat@50", "json"))).toBe(
    "/art/dom/dom-walk.json#treat%4050",
  );
  const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
  expect(domArtFileUrl(artUrl, domArtPath("image", "ambient-airliner", "png"))).toBe(
    "/art/images/ambient-airliner.png",
  );
  expect(String(error.mock.calls[0]?.[0])).toContain("no art the HTML interface draws");
  error.mockRestore();
});

it("fails a sheet that needs more than one page", () => {
  const sizes = ["a", "b", "c"].map((key) => ({ height: 1500, key, width: 1500 }));
  expect(() => packDomSheet("dom-test", sizes)).toThrow("does not fit one page of 2048 px");
  expect(packDomSheet("dom-test", sizes.slice(0, 1))).toMatchObject({ height: 1500, width: 1500 });
});

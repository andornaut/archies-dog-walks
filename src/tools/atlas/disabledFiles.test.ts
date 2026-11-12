import { decodePng } from "@andornaut/art-kit/png";
import { blankImage } from "@andornaut/art-kit/rgbaImage";
import { keysOf } from "@andornaut/game-kit/records";
import { describe, expect, it } from "vitest";

import { DOM_DIM_ART_KEYS, DOM_DISABLED_ART_KEYS } from "../../assets/domArt.ts";
import type { AssetManifest } from "../../assets/manifest.ts";
import { gameData } from "../../data/index.ts";
import { dimForModal } from "../../ui/dimArt.ts";
import { greyForDisabledTile, greysOnTile } from "../../ui/disabledArt.ts";
import { PALETTE } from "../../ui/palette.ts";
import { encodePng } from "./atlasBuild.ts";
import { type ArtCopy, artCopyFiles, DIM_COPY, DISABLED_COPY } from "./disabledFiles.ts";
import { hashGameArt } from "./hashedArt.ts";

// A 2x1 picture in two palette colours, and a one-frame sheet of it.
const image = blankImage(2, 1);
const rgba = (colour: number) => [(colour >> 16) & 0xff, (colour >> 8) & 0xff, colour & 0xff, 255];
image.data.set([...rgba(PALETTE.yellow), ...rgba(PALETTE.cream)]);
const png = encodePng(image);
const sheet = (width: number) =>
  new TextEncoder().encode(
    JSON.stringify({
      frames: { "0": { duration: 100, frame: { h: 1, w: width, x: 0, y: 0 } } },
      meta: { frameTags: [] },
    }),
  );

const manifest: Pick<AssetManifest, "images" | "sprites"> = {
  images: [
    { key: "item-whistle", png: "images/item-whistle.png" },
    { key: "icon-lock", png: "images/icon-lock.png" },
    { key: "ui-panel", png: "images/ui-panel.png" },
  ],
  sprites: [
    { json: "sprites/face-dog-kilo.json", key: "face-dog-kilo", png: "sprites/face-dog-kilo.png" },
    { json: "sprites/face-dog-pepe.json", key: "face-dog-pepe", png: "sprites/face-dog-pepe.png" },
    {
      json: "sprites/ui-quip-tail-up.json",
      key: "ui-quip-tail-up",
      png: "sprites/ui-quip-tail-up.png",
    },
  ],
};
const readArt = async (path: string) =>
  path.endsWith(".png") ? png : sheet(path.includes("pepe") ? 3 : 2);
const none = new Set<string>();

describe("the remapped copies of its art the HTML interface draws", () => {
  it("grey every tile picture a disabled tile greys: each dog's and walker's face, perk, gear and the dog slot", () => {
    expect(DOM_DISABLED_ART_KEYS.size).toBe(
      keysOf(gameData.dogs).length +
        keysOf(gameData.walkers).length +
        keysOf(gameData.walkerPerks).length +
        keysOf(gameData.shopGear).length +
        1,
    );
    expect([...DOM_DISABLED_ART_KEYS].filter((key) => !greysOnTile(key))).toEqual([]);
  });

  it("dim the zone celebration's frames, tail, perk icons and button face", () => {
    expect(DOM_DIM_ART_KEYS.size).toBe(keysOf(gameData.walkerPerks).length + 4);
    for (const key of ["ui-button-go", "ui-panel", "ui-quip", "ui-quip-tail-up"]) {
      expect(DOM_DIM_ART_KEYS.has(key), key).toBe(true);
    }
  });

  it.each([
    ["grey", DISABLED_COPY, greyForDisabledTile, ["face-dog-kilo", "item-whistle"]],
    ["dimmed", DIM_COPY, dimForModal, ["ui-quip-tail-up", "ui-panel"]],
  ] as const)(
    "write each key's %s copy from its PNG, beside its key's files",
    async (name, copy, remap, [sheetKey, imageKey]) => {
      const dom = {
        art: none,
        dim: copy === DIM_COPY ? new Set([sheetKey, imageKey]) : none,
        disabled: copy === DISABLED_COPY ? new Set([sheetKey, imageKey]) : none,
      };
      const files = await hashGameArt(
        readArt,
        dom,
        { ...manifest, fonts: [], sounds: [] },
        { files: new Map(), manifest: { pages: [], textures: [] } },
      );
      const pixels = new Uint8ClampedArray(image.data);
      remap(pixels);
      const paths = [copy.path("sheet", sheetKey), copy.path("image", imageKey)];
      for (const path of paths) {
        const file = files.find((entry) => entry.path === path);
        expect(file, `${name} ${path}`).toBeDefined();
        expect(decodePng(file?.source ?? new Uint8Array()).data, path).toEqual(
          new Uint8Array(pixels.buffer),
        );
      }
      // A sheet's copy reads its key's JSON frames, hashed with the rest.
      expect(files.some(({ path }) => path === `sprites/${sheetKey}.json`)).toBe(true);
    },
  );

  it("dim each colour down its ramp, never off the palette", () => {
    const pixels = new Uint8ClampedArray(image.data);
    dimForModal(pixels);
    const palette = new Set<number>(Object.values(PALETTE));
    const colour = (i: number) =>
      ((pixels[i] ?? 0) << 16) | ((pixels[i + 1] ?? 0) << 8) | (pixels[i + 2] ?? 0);
    expect([colour(0), colour(4)].every((each) => palette.has(each))).toBe(true);
    expect(colour(0)).not.toBe(PALETTE.yellow);
  });

  const byName: Readonly<Record<string, ArtCopy>> = {
    [DIM_COPY.name]: DIM_COPY,
    [DISABLED_COPY.name]: DISABLED_COPY,
  };
  it.each([
    [DISABLED_COPY.name, "face-dog-ginger", "no image or sprite"],
    [DISABLED_COPY.name, "icon-lock", "no tile picture"],
    [DISABLED_COPY.name, "face-dog-pepe", "reaches outside"],
    [DIM_COPY.name, "icon-lock", "no art the zone celebration draws dimmed"],
  ])("fail the build for a %s of %s: %s", async (name, key, error) => {
    const copy = byName[name] ?? DISABLED_COPY;
    await expect(artCopyFiles(readArt, manifest, copy, new Set([key]))).rejects.toThrow(error);
  });
});

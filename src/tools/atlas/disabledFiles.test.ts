import { decodePng } from "@andornaut/art-kit/png";
import { blankImage } from "@andornaut/art-kit/rgbaImage";
import { keysOf } from "@andornaut/game-kit/records";
import { describe, expect, it } from "vitest";

import { DOM_DISABLED_ART_KEYS } from "../../assets/domArt.ts";
import type { AssetManifest } from "../../assets/manifest.ts";
import { gameData } from "../../data/index.ts";
import { greyForDisabledTile, greysOnTile } from "../../ui/disabledArt.ts";
import { encodePng } from "./atlasBuild.ts";
import { disabledArtFiles } from "./disabledFiles.ts";
import { hashGameArt } from "./hashedArt.ts";

// A 2x1 picture in two colours, and a one-frame sheet of it.
const image = blankImage(2, 1);
image.data.set([255, 80, 20, 255, 20, 120, 255, 255]);
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
  ],
  sprites: [
    { json: "sprites/face-dog-kilo.json", key: "face-dog-kilo", png: "sprites/face-dog-kilo.png" },
    { json: "sprites/face-dog-pepe.json", key: "face-dog-pepe", png: "sprites/face-dog-pepe.png" },
  ],
};
const readArt = async (path: string) =>
  path.endsWith(".png") ? png : sheet(path.includes("pepe") ? 3 : 2);

describe("the disabled tiles' grey copies the HTML interface draws", () => {
  it("are every tile picture a disabled tile greys: each dog's and walker's face, perk, gear and the dog slot", () => {
    expect(DOM_DISABLED_ART_KEYS.size).toBe(
      keysOf(gameData.dogs).length +
        keysOf(gameData.walkers).length +
        keysOf(gameData.walkerPerks).length +
        keysOf(gameData.shopGear).length +
        1,
    );
    expect([...DOM_DISABLED_ART_KEYS].filter((key) => !greysOnTile(key))).toEqual([]);
  });

  it("write each key's PNG remapped as the atlas packs its copy, beside its key's files", async () => {
    const keys = new Set(["face-dog-kilo", "item-whistle"]);
    const files = await hashGameArt(
      readArt,
      { art: new Set(), disabled: keys },
      { ...manifest, fonts: [], sounds: [] },
      {
        files: new Map(),
        manifest: { pages: [], textures: [] },
      },
    );
    const grey = new Uint8ClampedArray(image.data);
    greyForDisabledTile(grey);
    for (const path of ["images/item-whistle-disabled.png", "sprites/face-dog-kilo-disabled.png"]) {
      const file = files.find((entry) => entry.path === path);
      expect(file, path).toBeDefined();
      expect(decodePng(file?.source ?? new Uint8Array()).data, path).toEqual(
        new Uint8Array(grey.buffer),
      );
    }
    // A sheet's copy reads its key's JSON frames, hashed with the rest.
    expect(files.some(({ path }) => path === "sprites/face-dog-kilo.json")).toBe(true);
  });

  it.each([
    ["face-dog-ginger", "no image or sprite"],
    ["icon-lock", "no tile picture"],
    ["face-dog-pepe", "reaches outside"],
  ])("fail the build for %s: %s", async (key, error) => {
    await expect(disabledArtFiles(readArt, manifest, new Set([key]))).rejects.toThrow(error);
  });
});

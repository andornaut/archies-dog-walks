import { blankImage } from "@andornaut/art-kit/build/rgbaImage";
import { keysOf } from "@andornaut/game-kit/runtime/records";
import { describe, expect, it } from "vitest";

import {
  DOM_CHOICE_CARD_ART,
  DOM_DIM_ART_KEYS,
  DOM_DISABLED_ART_KEYS,
} from "../../assets/domArt.ts";
import type { AssetManifest } from "../../assets/manifest.ts";
import { gameData } from "../../data/index.ts";
import { dimForModal } from "../../ui/dimArt.ts";
import { greysOnTile } from "../../ui/disabledArt.ts";
import { PALETTE } from "../../ui/palette.ts";
import { encodePng } from "./atlasBuild.ts";
import { type ArtCopy, DIM_COPY, DISABLED_COPY } from "./disabledFiles.ts";
import { buildDomSheet, checkDomCopies } from "./domSheets.ts";

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
    { key: "icon-exit", png: "images/icon-exit.png" },
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
    for (const key of [...DOM_CHOICE_CARD_ART.images, ...DOM_CHOICE_CARD_ART.sheets]) {
      expect(DOM_DIM_ART_KEYS.has(key), key).toBe(true);
    }
    for (const key of ["ui-button-go", "ui-panel", "ui-quip", "ui-quip-tail-up"]) {
      expect(DOM_DIM_ART_KEYS.has(key), key).toBe(true);
    }
  });

  it("darkens retained copies by the same ratio for every channel, keeping alpha", () => {
    const pixels = new Uint8ClampedArray(image.data);
    dimForModal(pixels);
    expect([...pixels]).toEqual(
      [...image.data].map((channel, index) =>
        index % 4 === 3 ? channel : Math.round(channel * 0.28),
      ),
    );
  });

  const byName: Readonly<Record<string, ArtCopy>> = {
    [DIM_COPY.name]: DIM_COPY,
    [DISABLED_COPY.name]: DISABLED_COPY,
  };
  it.each([
    [DISABLED_COPY.name, "face-dog-ginger", "no image or sprite"],
    [DISABLED_COPY.name, "icon-lock", "no tile picture"],
    [DISABLED_COPY.name, "face-dog-pepe", "reaches outside"],
    [DIM_COPY.name, "icon-exit", "no covered native art"],
  ])("fail the build for a %s of %s: %s", async (name, key, error) => {
    const copy = byName[name] ?? DISABLED_COPY;
    const keys = {
      copies: [[copy, new Set([key])] as const],
      sheets: new Map([[key, "dom-home" as const]]),
    };
    await expect(
      Promise.resolve().then(() => {
        checkDomCopies(keys);
        return buildDomSheet(readArt, manifest, keys, "dom-home");
      }),
    ).rejects.toThrow(error);
  });
});

it("registers covered native picker chrome and content while leaving walk chrome excluded", () => {
  for (const key of [
    "ui-tile",
    "ui-check",
    "ui-slot-sign",
    "ui-afford",
    "portrait-dog-archie",
    "face-dog-kilo",
  ]) {
    expect(DOM_DIM_ART_KEYS.has(key), key).toBe(true);
  }
  for (const key of [
    "icon-menu",
    "icon-sound",
    "ui-home-cash-well-mid",
    "ui-dog-card",
    "ui-walk-bar",
  ]) {
    expect(DOM_DIM_ART_KEYS.has(key), key).toBe(false);
  }
});

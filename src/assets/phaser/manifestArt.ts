import { itemAt } from "@andornaut/game-kit/runtime/arrays";
import type { Scene, Textures } from "phaser";

import { artUrl } from "../files/index.ts";
import {
  asepriteSheetOf,
  type AssetManifest,
  type AtlasFrame,
  type AtlasManifest,
  atlasPageKey,
  type AtlasTexture,
  BASE_FRAME,
  filtersLinear,
  parseManifest,
  steppedBases,
  unpackAtlasManifest,
  usesPhaserArt,
} from "../index.ts";

export { artUrl };

export const MANIFEST_CACHE_KEY = "art-manifest";

// Call from preload. Production includes the packed atlas in the same manifest; dev keeps
// its raw manifest and own-file loading. Invalid required metadata is reported by create.
export function loadManifest(scene: Scene, queue: (manifest: AssetManifest) => void): void {
  const settle = () => {
    try {
      queue(parseManifest(scene.cache.json.get(MANIFEST_CACHE_KEY)));
    } catch {
      // Reported by create, which parses the manifest again.
    }
  };
  if (scene.cache.json.exists(MANIFEST_CACHE_KEY)) {
    settle();
    return;
  }
  scene.load.once(`filecomplete-json-${MANIFEST_CACHE_KEY}`, settle);
  scene.load.json(MANIFEST_CACHE_KEY, artUrl("manifest.json"));
}

// A replacement cache value, including after Retry, must be parsed independently.
const parsedAtlases = new WeakMap<object, AtlasManifest | undefined>();

// Optional malformed atlas metadata leaves the valid asset manifest available for fallback.
export function atlasManifest(scene: Scene): AtlasManifest | undefined {
  const manifest: unknown = scene.cache.json.get(MANIFEST_CACHE_KEY);
  if (typeof manifest !== "object" || manifest === null || !("atlas" in manifest)) {
    return undefined;
  }
  if (!parsedAtlases.has(manifest)) {
    let atlas: AtlasManifest | undefined;
    try {
      atlas = unpackAtlasManifest(manifest.atlas);
    } catch (error) {
      console.error("The atlas manifest is invalid; loading each image on its own.", error);
    }
    parsedAtlases.set(manifest, atlas);
  }
  return parsedAtlases.get(manifest);
}

// Queues an atlas page's file, unless its texture is loaded.
function queuePage(scene: Scene, atlas: AtlasManifest, page: number): void {
  const key = atlasPageKey(page);
  if (!scene.textures.exists(key)) {
    scene.load.image(key, artUrl(itemAt(atlas.pages, page).file));
  }
}

// Each atlased texture of the build's atlas manifest, by key.
function atlasedTextures(atlas: AtlasManifest | undefined): Map<string, AtlasTexture> {
  return new Map(atlas?.textures.map((texture) => [texture.key, texture]));
}

// Queues the manifest's images and sprites that are not loaded yet, and that include accepts:
// the atlas page each is on, or else its own files. An image or sprite that fails to load
// leaves its key missing, which a scene draws as a placeholder box.
export function queueManifestArt(
  scene: Scene,
  { images, sprites }: AssetManifest,
  include: (key: string) => boolean = () => true,
): void {
  const atlas = atlasManifest(scene);
  const atlased = atlasedTextures(atlas);
  const wanted = ({ key }: { key: string }) =>
    usesPhaserArt(key) && include(key) && !scene.textures.exists(key);
  for (const { key, png } of images.filter(wanted)) {
    const texture = atlased.get(key);
    if (atlas === undefined || texture === undefined) {
      scene.load.image(key, artUrl(png));
    } else {
      queuePage(scene, atlas, texture.page);
    }
  }
  for (const { json, key, png } of sprites.filter(wanted)) {
    const texture = atlased.get(key);
    if (atlas === undefined || texture === undefined) {
      scene.load.aseprite(key, artUrl(png), artUrl(json));
    } else {
      queuePage(scene, atlas, texture.page);
    }
  }
}

// The XML cache key an atlased font's .fnt loads under.
export const fontXmlKey = (key: string): string => `${key}:fnt`;

// Queues the manifest's fonts that are not loaded yet: an atlased font's .fnt and the atlas page
// its PNG is on, which addAtlasFonts makes the font from, or else its own two files.
export function queueFonts(scene: Scene, { fonts }: AssetManifest): void {
  const atlas = atlasManifest(scene);
  const atlased = atlasedTextures(atlas);
  for (const { fnt, key, png } of fonts.filter(({ key }) => usesPhaserArt(key))) {
    if (scene.cache.bitmapFont.exists(key)) {
      continue;
    }
    const texture = atlased.get(key);
    if (atlas === undefined || texture === undefined) {
      scene.load.bitmapFont(key, artUrl(png), artUrl(fnt));
    } else {
      queuePage(scene, atlas, texture.page);
      scene.load.xml(fontXmlKey(key), artUrl(fnt));
    }
  }
}

// Phaser's BitmapText.ParseFromAtlas, passed in so this module imports Phaser's types only.
type ParseFromAtlas = (
  scene: Scene,
  fontName: string,
  textureKey: string,
  frameKey: string,
  xmlKey: string,
) => boolean;

// Makes each atlased font whose .fnt and texture have loaded and that is not made yet, from the
// .fnt and the font PNG's frame on its atlas page. Its glyphs, kerning and line height are the
// .fnt's, as the font's own files give them, and draw the same pixels from the page.
export function addAtlasFonts(
  scene: Scene,
  parseFromAtlas: ParseFromAtlas,
  { fonts }: AssetManifest,
): void {
  for (const { key } of fonts.filter(({ key }) => usesPhaserArt(key))) {
    const xml = fontXmlKey(key);
    if (
      !scene.cache.bitmapFont.exists(key) &&
      scene.cache.xml.exists(xml) &&
      scene.textures.exists(key)
    ) {
      parseFromAtlas(scene, key, key, BASE_FRAME, xml);
    }
  }
}

// Adds a frame to a texture whose source is an atlas page, at its rect there. A trimmed frame
// draws its rect at its offset in the whole frame, and has the whole frame's size, so origins,
// flips and crops measure the whole frame as they do untrimmed.
export function addAtlasFrame(
  texture: Textures.Texture,
  name: string,
  { h, trim, w, x, y }: AtlasFrame,
): void {
  const frame = texture.add(name, 0, x, y, w, h);
  if (trim !== undefined) {
    frame?.setTrim(trim.w, trim.h, trim.x, trim.y, w, h);
  }
}

// A texture keyed as the art manifest keys it, whose frames are rects of a loaded atlas page.
// It shares the page's source, so the page uploads to the GPU once, and code that names the
// key and its frames works as it does with the key's own files. A sprite also gets its
// Aseprite sheet in the JSON cache, where Phaser's Aseprite loader would put it.
function addAtlasTexture(scene: Scene, atlased: AtlasTexture): void {
  const { frames, key, page } = atlased;
  const texture = scene.textures.create(key, []);
  if (texture === null) {
    return;
  }
  texture.source.push(itemAt(scene.textures.get(atlasPageKey(page)).source, 0));
  if (atlased.tags !== undefined) {
    // An Aseprite sheet's base frame is its whole PNG. No code draws it, so the first frame
    // stands in.
    addAtlasFrame(texture, BASE_FRAME, itemAt(frames, 0));
    if (!scene.cache.json.exists(key)) {
      scene.cache.json.add(key, asepriteSheetOf(atlased));
    }
  }
  for (const frame of frames) {
    addAtlasFrame(texture, frame.name, frame);
  }
}

// Phaser's Textures.FilterMode.LINEAR, named here so this module imports Phaser's types only.
const LINEAR_FILTER = 0 as Textures.FilterMode.LINEAR;

// Filters each loaded texture that filtersLinear names linearly, so road art drawn between its
// depth steps shrinks smoothly rather than dropping whole rows and columns of pixels. An
// atlased key shares its page's source, which holds only such art, so the first key filters the
// page and the rest find it done; the dev server's keys each have their own. Every other
// texture keeps the nearest filtering pixelArt gives it.
export function smoothDepthArt(scene: Scene, { images, sprites }: AssetManifest): void {
  const keys = [...images, ...sprites].map(({ key }) => key).filter(usesPhaserArt);
  const stepped = steppedBases(keys);
  for (const key of keys) {
    if (!filtersLinear(stepped, key) || !scene.textures.exists(key)) {
      continue;
    }
    const texture = scene.textures.get(key);
    if (texture.source.some(({ scaleMode }) => scaleMode !== LINEAR_FILTER)) {
      texture.setFilter(LINEAR_FILTER);
    }
  }
}

// Adds a texture for each atlased key whose page has loaded and that has none yet.
export function addAtlasTextures(scene: Scene): void {
  for (const texture of atlasManifest(scene)?.textures ?? []) {
    if (
      usesPhaserArt(texture.key) &&
      !scene.textures.exists(texture.key) &&
      scene.textures.exists(atlasPageKey(texture.page))
    ) {
      addAtlasTexture(scene, texture);
    }
  }
}

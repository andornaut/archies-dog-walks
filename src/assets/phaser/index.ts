// The public entry of src/assets/phaser/: modules outside it import only this file.
export {
  addAtlasFonts,
  addAtlasTextures,
  atlasManifest,
  fontXmlKey,
  loadManifest,
  MANIFEST_CACHE_KEY,
  queueFonts,
  queueManifestArt,
  smoothDepthArt,
} from "./manifestArt.ts";
export {
  addStandingSprite,
  ensurePlaceholder,
  firstTag,
  measureSprite,
  playEffect,
  playFirstTag,
  playTag,
  playTagOnce,
  type Shadow,
  showAtDepth,
  spriteMetrics,
  spriteTopY,
  tagTopY,
} from "./sprites.ts";

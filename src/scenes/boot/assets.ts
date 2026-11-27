import { itemAt } from "@andornaut/game-kit/runtime/arrays";
import type { LoadFailure } from "@andornaut/game-kit/runtime/load/phaser/watchLoader";
import { keysOf } from "@andornaut/game-kit/runtime/records";
import { GameObjects, type Scene, Scenes } from "phaser";

import { artUrl } from "../../assets/files/index.ts";
import {
  animationSpecs,
  type AsepriteSheet,
  type AssetManifest,
  DOG_FRAME_SIDES,
  dogFaceKey,
  dogSpriteKey,
  encounterSpriteKey,
  FLAT_ENCOUNTERS,
  LOADING_ART,
  ownerCardFaceKey,
  ownerFaceKey,
  ROAD_SPRITE_SIZE,
  type SpriteAsset,
  usesPhaserArt,
} from "../../assets/index.ts";
import {
  addAtlasFonts,
  addAtlasTextures,
  atlasManifest,
  ensurePlaceholder,
  measureSprite,
  queueManifestArt,
  smoothDepthArt,
} from "../../assets/phaser/index.ts";
import type { EncounterId } from "../../data/ids.ts";
import { FACE_SIZE, gameData, OWNER_CARD_FACE } from "../../data/index.ts";
import { browserSoundFormat } from "../../pwa/index.ts";
import { PALETTE } from "../../ui/index.ts";
import { blockedFontAtlas } from "./requiredFontLoads.ts";

type Size = { colour: number; height: number; width: number };
const box = (width: number, height: number, colour: number): Size => ({ colour, height, width });

// Every sprite the scenes draw, with the box drawn in its place if it is missing.
function placeholderSizes(): Map<string, Size> {
  const side = ROAD_SPRITE_SIZE;
  const short = side / 2;
  const tallest = side * 1.5;
  const sizes = new Map<string, Size>([
    ["tip", box(short, short, PALETTE.amber)],
    ["treat", box(short, short, PALETTE.tan)],
    [gameData.walkers[gameData.defaultWalker].spriteKey, box(side, tallest, PALETTE.blue)],
  ]);
  for (const dog of keysOf(gameData.dogs)) {
    const dogSide = DOG_FRAME_SIDES[gameData.dogs[dog].size];
    sizes.set(dogSpriteKey(gameData, dog), box(dogSide, dogSide, PALETTE.slate));
    sizes.set(dogFaceKey(gameData, dog), box(FACE_SIZE, FACE_SIZE, PALETTE.slate));
    sizes.set(ownerFaceKey(gameData, dog), box(FACE_SIZE, FACE_SIZE, PALETTE.brown));
    sizes.set(
      ownerCardFaceKey(gameData, dog),
      box(OWNER_CARD_FACE, OWNER_CARD_FACE, PALETTE.brown),
    );
  }
  const tall: readonly EncounterId[] = [
    "droppedIceCream",
    "friendlyNeighbour",
    "bigScreenPromo",
    "thief",
    "weddingPhotoShoot",
  ];
  for (const encounter of keysOf(gameData.encounters)) {
    const height = FLAT_ENCOUNTERS.has(encounter)
      ? short
      : tall.includes(encounter)
        ? tallest
        : side;
    const colour = gameData.encounters[encounter].kind === "lucky" ? PALETTE.green : PALETTE.mauve;
    sizes.set(encounterSpriteKey(encounter), box(side, height, colour));
  }
  return sizes;
}

export function queueBootArt(
  scene: Scene,
  {
    failures,
    manifest,
  }: { readonly failures: readonly LoadFailure[]; readonly manifest: AssetManifest },
  include: (key: string) => boolean,
): void {
  const context = {
    atlas: atlasManifest(scene),
    failures,
    manifest,
  };
  queueManifestArt(scene, manifest, (key) => include(key) && !blockedFontAtlas(context, key));
}

// One file per accepted sound, in the format the service worker precaches.
export function queueBootSounds(
  scene: Scene,
  manifest: AssetManifest,
  include: (key: string) => boolean,
): void {
  const soundFormat = browserSoundFormat();
  if (soundFormat === undefined) {
    return;
  }
  for (const sound of manifest.sounds.filter(({ key }) => include(key))) {
    scene.load.audio(sound.key, artUrl(sound[soundFormat]));
  }
}

// The loading screen's atlas page or its own files, ahead of everything else.
export function queueLoadingArt(scene: Scene, manifest: AssetManifest): void {
  const loadingKeys: ReadonlySet<string> = new Set(Object.values(LOADING_ART));
  queueManifestArt(scene, manifest, (key) => loadingKeys.has(key));
}

// Registers the loaded sprites that include accepts and draws a placeholder for each such key
// that is missing, one step at a time, yielding to the next frame once budgetMs is spent,
// then calls done.
export function processBootAssets(
  scene: Scene,
  {
    budgetMs,
    include,
    manifest,
  }: {
    readonly budgetMs: number;
    readonly include: (key: string) => boolean;
    readonly manifest: () => AssetManifest;
  },
  done: () => void,
): void {
  const steps: (() => void)[] = [
    () => addAtlasTextures(scene),
    () => addAtlasFonts(scene, GameObjects.BitmapText.ParseFromAtlas, manifest()),
    () => smoothDepthArt(scene, manifest()),
  ];
  for (const sprite of manifest().sprites) {
    if (usesPhaserArt(sprite.key) && sprite.key !== LOADING_ART.walker && include(sprite.key)) {
      steps.push(() => registerBootSprite(scene, sprite));
    }
  }
  for (const [key, size] of placeholderSizes()) {
    if (usesPhaserArt(key) && include(key)) {
      steps.push(() => ensurePlaceholder(scene, key, size));
    }
  }
  let next = 0;
  let active = true;
  let frame: number | undefined;
  const cancel = () => {
    active = false;
    if (frame !== undefined) {
      cancelAnimationFrame(frame);
    }
  };
  scene.events.once(Scenes.Events.SHUTDOWN, cancel);
  const runBatch = () => {
    if (!active) {
      return;
    }
    const started = performance.now();
    while (next < steps.length && performance.now() - started < budgetMs) {
      itemAt(steps, next)();
      next += 1;
    }
    if (next < steps.length) {
      if (scene.game.isPaused) {
        frame = requestAnimationFrame(() => {
          frame = undefined;
          runBatch();
        });
      } else {
        scene.time.delayedCall(0, runBatch);
      }
    } else {
      active = false;
      scene.events.off(Scenes.Events.SHUTDOWN, cancel);
      done();
    }
  };
  runBatch();
}

export function registerBootSprite(scene: Scene, { anchor, key }: SpriteAsset): void {
  if (!usesPhaserArt(key) || !scene.textures.exists(key)) {
    return;
  }
  try {
    const sheet = scene.cache.json.get(key) as AsepriteSheet;
    for (const spec of animationSpecs(key, sheet)) {
      const frames = spec.frames.map(({ duration, frame }) => ({ duration, frame, key }));
      const duration = frames.reduce((sum, frame) => sum + frame.duration, 0);
      scene.anims.create({ duration, frames, key: spec.key, repeat: -1 });
    }
    measureSprite(scene, key, anchor);
  } catch (error) {
    console.warn(`Sprite ${key} has no usable animations.`, error);
  }
}

import { itemAt } from "@andornaut/game-kit/runtime/arrays";
import { type LoaderWatch, watchLoader } from "@andornaut/game-kit/runtime/load/phaser/watchLoader";
import { keysOf } from "@andornaut/game-kit/runtime/records";
import { GameObjects, Scene, Scenes, Sound } from "phaser";

import { animationSpecs, type AsepriteSheet } from "../assets/asepriteAnimations.ts";
import { type AssetManifest, parseManifest, type SpriteAsset } from "../assets/manifest.ts";
import {
  addAtlasFonts,
  addAtlasTextures,
  artUrl,
  atlasManifest,
  loadManifest,
  MANIFEST_CACHE_KEY,
  queueFonts,
  queueManifestArt,
  smoothDepthArt,
} from "../assets/phaser/manifestArt.ts";
import { usesPhaserArt } from "../assets/phaserArt.ts";
import {
  DOG_FRAME_SIDES,
  dogFaceKey,
  dogSpriteKey,
  encounterSpriteKey,
  FLAT_ENCOUNTERS,
  LOADING_ART,
  ownerCardFaceKey,
  ownerFaceKey,
  ROAD_SPRITE_SIZE,
} from "../assets/spriteKeys.ts";
import { gameData } from "../data/index.ts";
import type { EncounterId } from "../data/types.ts";
import { devRunLoadout, namesRunSetup } from "../dev/devStart.ts";
import { pageSearch } from "../dev/devTools.ts";
import { pageRunSetup } from "../dev/pageRunSetup.ts";
import { hudArtResources } from "../hud/dom/prepareHudArt.ts";
import { waitedLoad } from "../loadingProgress.ts";
import {
  browserSoundFormat,
  exitShown,
  noteSaveStorage,
  requiredUpdate,
  startWakeLock,
  unlockAudioOnFirstGesture,
} from "../pwa/index.ts";
import { bootHandedOver, bootLoad } from "../pwa/launch.ts";
import { uiLayer } from "../ui/dom/uiLayer.ts";
import { PALETTE } from "../ui/palette.ts";
import { addPillGlyphs, registerFallbackPixelFont } from "../ui/phaser/pixelText.ts";
import { markArtReady, setBootWatch, type WaitedLoad } from "./artReady.ts";
import { addBootPicture } from "./bootPicture.ts";
import { stopOnceRetried } from "./bootRetries.ts";
import { useCheat } from "./cheatSession.ts";
import { waitForNativeHome } from "./nativeHomeReady.ts";
import {
  currentSettings,
  openProfile,
  profileSave,
  resumesWalk,
  storageState,
  takeResumedWalk,
  walkerInUse,
} from "./profileStore.ts";
import {
  blockedFontAtlas,
  REQUIRED_BITMAP_FONTS,
  requiredFontFailure,
  retryRequiredFontLoads,
  unqueuedFonts,
} from "./requiredFontLoads.ts";
import { REQUIRED_UI, type RequiredUiController } from "./requiredUi.ts";
import { nextRunStart } from "./run/runRecorder.ts";
import { resumedRunSceneData, runSceneData } from "./run/runStart.ts";
import { SCENE_KEYS } from "./sceneKeys.ts";
import { ensurePlaceholder, measureSprite, playTag } from "./sprites.ts";

// Processing yields to the next frame once a batch has run this long.
const FRAME_BUDGET_MS = 8;

const always = () => true;

const HOME_UI_KEYS = new Set([
  "icon-menu",
  "icon-sound",
  "ui-icon-button-normal",
  "ui-icon-button-pressed",
]);
const HUD_UI_KEYS = new Set([
  ...HOME_UI_KEYS,
  "icon-pause",
  "ui-dog-card",
  "ui-heart",
  "ui-home-cash-well-left",
  "ui-home-cash-well-mid",
  "ui-home-cash-well-right",
]);

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
    sizes.set(dogFaceKey(gameData, dog), box(32, 32, PALETTE.slate));
    sizes.set(ownerFaceKey(gameData, dog), box(32, 32, PALETTE.brown));
    sizes.set(ownerCardFaceKey(gameData, dog), box(20, 20, PALETTE.brown));
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

// Loads the manifests and fixed loading artwork, then every art file and sound behind the loading
// screen, and processes sprites and metrics in frame-sized batches. Its reads count into the
// launch's one progress value (bootLoad), which fills when the first screen shows
// (bootHandedOver). Required native UI and font failures keep entry blocked behind the existing
// loading error and explicit Retry. Optional world assets keep their placeholders and automatic
// retry rounds.
export class BootScene extends Scene {
  private manifest: AssetManifest = { fonts: [], images: [], sounds: [], sprites: [] };
  private walker: GameObjects.Sprite | undefined;
  private watch: LoaderWatch<WaitedLoad> | undefined;
  private nativeUi: RequiredUiController | undefined;
  private fontMetricsSettled = false;
  private inPreload = false;
  private deferredInitialArt: ((key: string) => boolean) | undefined;
  private manifestReady = false;
  private readonly queuedFontKeys = new Set<string>();

  constructor() {
    super(SCENE_KEYS.boot);
  }

  preload(): void {
    this.inPreload = true;
    this.deferredInitialArt = undefined;
    this.manifestReady = false;
    this.queuedFontKeys.clear();
    this.watch = watchLoader<WaitedLoad>(
      {
        console,
        progress: bootLoad(waitedLoad),
        retryMode: (failure) =>
          requiredFontFailure(this.manifest, atlasManifest(this), failure) ? "manual" : "automatic",
        timer: globalThis,
      },
      this,
    );
    setBootWatch(this.watch);
    this.events.once(Scenes.Events.SHUTDOWN, () => {
      setBootWatch(undefined);
      this.watch = undefined;
    });
    loadManifest(this, (manifest) => {
      this.manifest = manifest;
      this.manifestReady = true;
      if (this.inPreload) {
        this.queueLoadingArt(manifest);
      }
    });
  }

  create(): void {
    let current = true;
    let stopEntry: () => void = () => undefined;
    this.events.once(Scenes.Events.SHUTDOWN, () => {
      current = false;
      stopEntry();
    });
    this.inPreload = false;
    if (this.sound instanceof Sound.WebAudioSoundManager) {
      unlockAudioOnFirstGesture(window, this.sound.context);
    }
    try {
      this.manifest = parseManifest(this.cache.json.get(MANIFEST_CACHE_KEY));
      this.manifestReady = true;
    } catch (error) {
      this.manifestReady = false;
      console.error("The art manifest is invalid; required UI is unavailable.", error);
    }
    // A dev link that names a run starts its walk, and banks a walk left unfinished rather than
    // resuming it.
    const walkNow = namesRunSetup(pageSearch());
    // Open the profile while the art loads. A save from a newer version requires that version.
    // The loading walker then follows the saved reduced-motion setting.
    const profileOpened = openProfile(this, !walkNow).then((load) => {
      if (load.status === "corrupt" || load.status === "newer" || load.status === "unavailable") {
        console.warn(`The save is ${load.status}, so play starts fresh: ${load.reason}`);
      }
      noteSaveStorage(storageState(this));
      this.setWalkerMotion(currentSettings(this).reducedMotion);
    });
    addAtlasTextures(this);
    this.showLoadingScreen();
    this.prepareNativeUi();

    this.queueAvailableArt(always);
    this.queueFirstFonts(this.manifest);
    if (this.manifest.sounds.length > 0 && browserSoundFormat() === undefined) {
      console.warn("This browser plays neither Ogg nor AAC, so the game is silent.");
    }
    this.queueSounds(always);
    this.watch?.waitFor("boot");
    const firstComplete = () => {
      registerFallbackPixelFont(this);
      addPillGlyphs(this);
      this.fontMetricsSettled = true;
      this.nativeUi?.invalidate();
      // While a newer version is required, no walk starts: home says so.
      void profileOpened.then(() => {
        if (!current) {
          return;
        }
        const native = this.nativeUi;
        if (native === undefined) {
          return;
        }
        stopEntry = native.wait(() => {
          if (!current) {
            return;
          }
          if (requiredUpdate() !== undefined) {
            this.showHome();
          } else if (walkNow) {
            this.startWalk();
          } else if (resumesWalk(this)) {
            this.resumeWalk();
          } else {
            this.showHome();
          }
        });
        if (!current) {
          stopEntry();
        }
      });
    };
    this.load.once("complete", () => {
      if (!this.manifestReady) {
        this.deferredInitialArt = always;
        firstComplete();
      } else {
        this.processAssets(always, FRAME_BUDGET_MS, firstComplete);
      }
    });
    this.load.start();
  }

  private prepareNativeUi(): void {
    const layer = uiLayer();
    if (layer === undefined) {
      throw new Error("The native UI layer is unavailable");
    }
    this.fontMetricsSettled = false;
    const requiredLoad = (failure: { readonly key: string; readonly type: string }) =>
      requiredFontFailure(this.manifest, atlasManifest(this), failure);
    const metricsReady = () =>
      this.manifestReady &&
      REQUIRED_BITMAP_FONTS.every((key) => this.cache.bitmapFont.exists(key)) &&
      !this.watch?.failures().some(requiredLoad);
    const native = this.registry.get(REQUIRED_UI) as RequiredUiController | undefined;
    if (native === undefined) {
      throw new Error("The native UI resource controller is unavailable");
    }
    this.nativeUi = native;
    let active = true;
    const metrics = { retrying: false };
    const removeMetrics = native.observe({
      retry: () => {
        const watch = this.watch;
        if (!this.fontMetricsSettled || metricsReady() || metrics.retrying || watch === undefined) {
          return Promise.resolve();
        }
        metrics.retrying = true;
        native.invalidate();
        return retryRequiredFontLoads(
          {
            isCurrent: () => active,
            recoverManifest: async () => {
              this.manifestReady = false;
              this.manifest = parseManifest(this.cache.json.get(MANIFEST_CACHE_KEY));
              this.manifestReady = true;
            },
            required: requiredLoad,
          },
          watch,
        )
          .then(async () => {
            if (active && this.manifestReady && !watch.failures().some(requiredLoad)) {
              await this.queueRecoveredFonts();
            }
            if (active) {
              recovered();
            }
          })
          .finally(() => {
            if (active) {
              metrics.retrying = false;
              native.invalidate();
            }
          });
      },
      status: () =>
        !this.fontMetricsSettled || metrics.retrying
          ? "loading"
          : metricsReady()
            ? "ready"
            : "failed",
    });
    const recovered = () => {
      if (this.fontMetricsSettled) {
        addAtlasTextures(this);
        addAtlasFonts(this, GameObjects.BitmapText.ParseFromAtlas, this.manifest);
        addPillGlyphs(this);
        native.invalidate();
      }
    };
    this.load.on("complete", recovered);
    this.events.once(Scenes.Events.SHUTDOWN, () => {
      active = false;
      this.load.off("complete", recovered);
      removeMetrics();
      this.nativeUi = undefined;
    });
  }

  private queueRecoveredFonts(): Promise<void> {
    return new Promise((resolve, reject) => {
      const initial = this.deferredInitialArt;
      const cancelled = () => {
        this.load.off("complete", done);
        this.events.off(Scenes.Events.SHUTDOWN, cancelled);
        resolve();
      };
      const done = () => {
        this.load.off("complete", done);
        if (initial === undefined) {
          cancelled();
        } else {
          this.processAssets(initial, FRAME_BUDGET_MS, cancelled);
        }
      };
      this.load.once("complete", done);
      this.events.once(Scenes.Events.SHUTDOWN, cancelled);
      try {
        if (initial !== undefined) {
          this.queueAvailableArt(initial);
          this.queueSounds(initial);
          this.deferredInitialArt = undefined;
        }
        const required: ReadonlySet<string> = new Set(REQUIRED_BITMAP_FONTS);
        const queued = this.queueFirstFonts({
          ...this.manifest,
          fonts: this.manifest.fonts.filter(({ key }) => required.has(key)),
        });
        if (!queued && initial === undefined) {
          cancelled();
          return;
        }
        this.watch?.waitFor("boot");
        if (!this.load.isLoading()) {
          this.load.start();
        }
      } catch (error) {
        this.load.off("complete", done);
        this.events.off(Scenes.Events.SHUTDOWN, cancelled);
        reject(error);
      }
    });
  }

  private queueFirstFonts(manifest: AssetManifest): boolean {
    const fonts = unqueuedFonts(
      {
        atlas: atlasManifest(this),
        failures: this.watch?.failures() ?? [],
        queued: this.queuedFontKeys,
      },
      {
        ...manifest,
        fonts: manifest.fonts.filter(({ key }) => !this.cache.bitmapFont.exists(key)),
      },
    );
    if (fonts.length === 0) {
      return false;
    }
    queueFonts(this, { ...manifest, fonts });
    for (const { key } of fonts) {
      this.queuedFontKeys.add(key);
    }
    return true;
  }

  private queueAvailableArt(include: (key: string) => boolean): void {
    const context = {
      atlas: atlasManifest(this),
      failures: this.watch?.failures() ?? [],
      manifest: this.manifest,
    };
    queueManifestArt(this, this.manifest, (key) => include(key) && !blockedFontAtlas(context, key));
  }

  private requireNativeUi(keys: ReadonlySet<string>, ready: () => void): void {
    const layer = uiLayer();
    const native = this.nativeUi;
    if (layer === undefined || native === undefined) {
      return;
    }
    const assets = [
      ...this.manifest.images
        .filter(({ key }) => keys.has(key))
        .map(({ key }) => ({ key, kind: "image" as const })),
      ...this.manifest.sprites
        .filter(({ key }) => keys.has(key))
        .map(({ key }) => ({ key, kind: "sheet" as const })),
    ];
    const present = new Set(assets.map(({ key }) => key));
    const missing = [...keys].filter((key) => !present.has(key));
    if (missing.length > 0) {
      throw new Error(`Required native UI art is absent from the manifest: ${missing.join(", ")}`);
    }
    layer.requireAssets(hudArtResources({ artUrl }, assets));
    const stop = native.wait(ready);
    this.events.once(Scenes.Events.SHUTDOWN, stop);
  }

  // One file per sound that include accepts, in the format the service worker precaches.
  private queueSounds(include: (key: string) => boolean): void {
    const soundFormat = browserSoundFormat();
    if (soundFormat === undefined) {
      return;
    }
    for (const sound of this.manifest.sounds.filter(({ key }) => include(key))) {
      this.load.audio(sound.key, artUrl(sound[soundFormat]));
    }
  }

  // The loading screen's art, its atlas page or its own three files, ahead of everything else.
  private queueLoadingArt(manifest: AssetManifest): void {
    const loadingKeys: ReadonlySet<string> = new Set(Object.values(LOADING_ART));
    queueManifestArt(this, manifest, (key) => loadingKeys.has(key));
  }

  // The backdrop and fixed walker are decorative; only the shared top strip shows progress.
  private showLoadingScreen(): void {
    this.walker = addBootPicture(
      { registerSprite: (sprite) => this.registerSprite(sprite), scene: this },
      this.manifest.sprites,
    );
    this.setWalkerMotion(currentSettings(this).reducedMotion);
  }

  private setWalkerMotion(reduced: boolean): void {
    if (this.walker !== undefined) {
      playTag(this.walker, LOADING_ART.walker, "walk", reduced);
    }
  }

  // Registers the loaded sprites that include accepts and draws a placeholder for each such key
  // that is missing, one step at a time, yielding to the next frame once budgetMs is spent,
  // then calls done.
  private processAssets(
    include: (key: string) => boolean,
    budgetMs: number,
    done: () => void,
  ): void {
    const steps: (() => void)[] = [
      () => addAtlasTextures(this),
      () => addAtlasFonts(this, GameObjects.BitmapText.ParseFromAtlas, this.manifest),
      () => smoothDepthArt(this, this.manifest),
    ];
    for (const sprite of this.manifest.sprites) {
      if (usesPhaserArt(sprite.key) && sprite.key !== LOADING_ART.walker && include(sprite.key)) {
        steps.push(() => this.registerSprite(sprite));
      }
    }
    for (const [key, size] of placeholderSizes()) {
      if (usesPhaserArt(key) && include(key)) {
        steps.push(() => ensurePlaceholder(this, key, size));
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
    this.events.once(Scenes.Events.SHUTDOWN, cancel);
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
        if (this.game.isPaused) {
          frame = requestAnimationFrame(() => {
            frame = undefined;
            runBatch();
          });
        } else {
          this.time.delayedCall(0, runBatch);
        }
      } else {
        active = false;
        this.events.off(Scenes.Events.SHUTDOWN, cancel);
        done();
      }
    };
    runBatch();
  }

  private registerSprite({ anchor, key }: SpriteAsset): void {
    if (!usesPhaserArt(key) || !this.textures.exists(key)) {
      return;
    }
    try {
      const sheet = this.cache.json.get(key) as AsepriteSheet;
      for (const spec of animationSpecs(key, sheet)) {
        const frames = spec.frames.map(({ duration, frame }) => ({ duration, frame, key }));
        const duration = frames.reduce((sum, frame) => sum + frame.duration, 0);
        this.anims.create({ duration, frames, key: spec.key, repeat: -1 });
      }
      measureSprite(this, key, anchor);
    } catch (error) {
      console.warn(`Sprite ${key} has no usable animations.`, error);
    }
  }

  // Launches native home while keeping the loading screen until its usable view is ready, then
  // hands over. Everything has loaded; Boot stops once the walk's native UI is ready and every
  // failed file has been retried.
  private showHome(): void {
    const waiting = waitForNativeHome(this.game.events, {
      loaded: () => this.scene.stop(),
      shown: () => this.clearLoading(),
    });
    this.events.once(Scenes.Events.SHUTDOWN, () => waiting.dispose());
    const keys = exitShown() ? new Set([...HOME_UI_KEYS, "icon-exit"]) : HOME_UI_KEYS;
    this.requireNativeUi(keys, () => this.scene.launch(SCENE_KEYS.start));
    this.requireNativeUi(HUD_UI_KEYS, () => {
      markArtReady(this);
      this.stopOnceRetried(waiting.loaded);
    });
  }

  // A direct walk launch needs no native-home handoff. Boot still runs behind it for retries.
  private leaveFor(key: string, data?: object): void {
    this.clearLoading();
    this.scene.launch(key, data);
  }

  private clearLoading(): void {
    bootHandedOver();
    for (const child of [...this.children.list]) {
      child.destroy();
    }
    this.walker = undefined;
  }

  // Stops once the watch has retried every file that failed (bootRetries.ts). A retried atlas page
  // adds the textures it holds that are still missing; a placeholder already drawn for one stays
  // for the session.
  private stopOnceRetried(
    stop: () => void = () => {
      this.scene.stop();
    },
  ): void {
    const { watch } = this;
    if (watch === undefined) {
      stop();
      return;
    }
    stopOnceRetried(this.load, watch, {
      recovered: () => addAtlasTextures(this),
      stop,
    });
  }

  // Resumes the walk left unfinished, under the pause menu, once the walk's native UI is ready.
  private resumeWalk(): void {
    this.requireNativeUi(HUD_UI_KEYS, () => {
      markArtReady(this);
      const walk = takeResumedWalk(this);
      if (walk === null) {
        this.showHome();
        return;
      }
      startWakeLock();
      this.leaveFor(SCENE_KEYS.run, resumedRunSceneData(pageRunSetup().setup.dev, walk));
      this.stopOnceRetried();
    });
  }

  // Starts the walk a dev link names, with everything loaded. The link's setup is a cheat, so
  // the walk is a cheat session's.
  private startWalk(): void {
    this.requireNativeUi(HUD_UI_KEYS, () => {
      if (requiredUpdate() !== undefined) {
        this.showHome();
        return;
      }
      markArtReady(this);
      const { lastLoadout, owned } = profileSave(this);
      const walker = walkerInUse(profileSave(this));
      const loadout = devRunLoadout(
        lastLoadout,
        walker,
        itemAt(owned.dogs, 0),
        pageRunSetup().setup,
      );
      const pick = { dogSlots: owned.dogSlots.length, loadout };
      useCheat(this);
      startWakeLock();
      this.leaveFor(SCENE_KEYS.run, runSceneData(nextRunStart(), pick));
      this.stopOnceRetried();
    });
  }
}

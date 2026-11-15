import { itemAt } from "@andornaut/game-kit/arrays";
import { type LoaderWatch, watchLoader } from "@andornaut/game-kit/load/phaser/watchLoader";
import type { ProgressHandle } from "@andornaut/game-kit/progressState";
import { keysOf } from "@andornaut/game-kit/records";
import { GameObjects, Scene, Scenes, Sound } from "phaser";

import { animationSpecs, type AsepriteSheet } from "../assets/asepriteAnimations.ts";
import { loadsFirst } from "../assets/atlasGroups.ts";
import { type AssetManifest, parseManifest, type SpriteAsset } from "../assets/manifest.ts";
import {
  addAtlasFonts,
  addAtlasTextures,
  artUrl,
  loadManifest,
  MANIFEST_CACHE_KEY,
  queueFonts,
  queueManifestArt,
  smoothDepthArt,
} from "../assets/phaser/manifestArt.ts";
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
import { HOME_CUES, soundKeysOf } from "../audio/sound.ts";
import { gameData } from "../data/index.ts";
import type { EncounterId } from "../data/types.ts";
import { devRunLoadout, namesRunSetup } from "../dev/devStart.ts";
import { pageSearch } from "../dev/devTools.ts";
import { pageRunSetup } from "../dev/pageRunSetup.ts";
import { hudArtResources } from "../hud/dom/prepareHudArt.ts";
import { LOADING_TRACK, loadingWalkerAt } from "../layout/loadingScreen.ts";
import { waitedLoad } from "../loadingProgress.ts";
import {
  browserSoundFormat,
  noteSaveStorage,
  requiredUpdate,
  startWakeLock,
  unlockAudioOnFirstGesture,
} from "../pwa/index.ts";
import { pageDeviceSettings } from "../save/settings.ts";
import { mountMuteControl } from "../ui/dom/muteControl.ts";
import { uiLayer } from "../ui/dom/uiLayer.ts";
import { PALETTE } from "../ui/palette.ts";
import { addFilledRect } from "../ui/phaser/draw.ts";
import { addPillGlyphs, registerFallbackPixelFont } from "../ui/phaser/pixelText.ts";
import { markArtReady, setBootWatch, type WaitedLoad } from "./artReady.ts";
import { stopOnceRetried } from "./bootRetries.ts";
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
import { REQUIRED_UI, type RequiredUiController } from "./requiredUi.ts";
import { nextRunStart } from "./run/runRecorder.ts";
import { resumedRunSceneData, runSceneData } from "./run/runStart.ts";
import { SCENE_KEYS } from "./sceneKeys.ts";
import { ensurePlaceholder, measureSprite, playTag } from "./sprites.ts";

// Processing yields to the next frame once a batch has run this long: less once the home
// screen shows, which then shares the frame.
const FRAME_BUDGET_MS = 8;
const BEHIND_FRAME_BUDGET_MS = 4;

const HOME_SOUND_KEYS: ReadonlySet<string> = new Set(HOME_CUES.flatMap((cue) => soundKeysOf(cue)));
const loadsSoundFirst = (key: string): boolean => HOME_SOUND_KEYS.has(key);
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
  "ui-debuff-bar",
  "ui-dog-card",
  "ui-heart",
  "ui-home-cash-well-left",
  "ui-home-cash-well-mid",
  "ui-home-cash-well-right",
]);
const REQUIRED_BITMAP_FONTS = [
  "font-body",
  "font-display",
  "font-display-cream",
  "font-title",
] as const;

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

// Loads the art manifest and the loading screen's art, shows the loading screen while what the
// home screen and its menus need loads (the loadsFirst art, the fonts and the home cues'
// sounds), then registers each of those sprites' animations and metrics in batches, a frame
// apart, so the bar and the walker keep moving. The kit's loader watch measures the boot by
// settled files and logs and retries a file that fails, which is replaced by a placeholder box
// meanwhile, never fatal. Then shows the home screen, and keeps running behind it to load and
// register the rest the same way, silent unless Start walk waits for it, then marks the art
// ready. It stops once every file that failed has loaded on a retry or used up its retry rounds.
// A dev link that names a run loads everything before it starts the walk, and a walk the save
// resumes (ProfileSession.open) loads the rest behind the loading screen before it goes on.
export class BootScene extends Scene {
  private manifest: AssetManifest = { fonts: [], images: [], sounds: [], sprites: [] };
  private walker: GameObjects.Sprite | undefined;
  private watch: LoaderWatch<WaitedLoad> | undefined;
  private removeMute: (() => void) | undefined;
  private nativeUi: RequiredUiController | undefined;
  private fontMetricsSettled = false;

  constructor() {
    super(SCENE_KEYS.boot);
  }

  preload(): void {
    const parent = this.game.canvas.parentElement;
    if (parent !== null) {
      try {
        this.removeMute = mountMuteControl(pageDeviceSettings(), parent);
      } catch (error) {
        console.warn("The loading sound control could not open.", error);
      }
      this.events.once(Scenes.Events.SHUTDOWN, () => this.clearMute());
    }
    this.watch = watchLoader<WaitedLoad>(
      { console, progress: waitedLoad, timer: globalThis },
      this,
    );
    setBootWatch(this.watch);
    // The manifests load before the loading screen's art, so their wait has no denominator; the
    // boot's measured load (create) takes it over.
    const manifests = waitedLoad.begin();
    manifests.progress(undefined);
    // The loading walker walks as far as the waited-for load has come.
    const stopWalker = waitedLoad.subscribe(({ value }) => {
      if (value !== undefined) {
        const at = loadingWalkerAt(value);
        this.walker?.setPosition(at.x, at.y);
      }
    });
    this.events.once(Scenes.Events.SHUTDOWN, () => {
      stopWalker();
      manifests.finish();
      setBootWatch(undefined);
      this.watch = undefined;
    });
    loadManifest(this, (manifest) => this.queueLoadingArt(manifest));
  }

  create(): void {
    if (this.sound instanceof Sound.WebAudioSoundManager) {
      unlockAudioOnFirstGesture(window, this.sound.context);
    }
    try {
      this.manifest = parseManifest(this.cache.json.get(MANIFEST_CACHE_KEY));
    } catch (error) {
      console.error("The art manifest is invalid; drawing placeholders instead.", error);
    }
    // A dev link that names a run starts its walk, and banks a walk left unfinished rather than
    // resuming it.
    const walkNow = namesRunSetup(pageSearch());
    // Open the profile while the art loads. A save from a newer version requires that version.
    // The loading walker then follows the saved reduced-motion setting.
    let opened = false;
    const profileOpened = openProfile(this, !walkNow).then((load) => {
      if (load.status === "corrupt" || load.status === "newer" || load.status === "unavailable") {
        console.warn(`The save is ${load.status}, so play starts fresh: ${load.reason}`);
      }
      opened = true;
      noteSaveStorage(storageState(this));
      this.setWalkerMotion(currentSettings(this).reducedMotion);
    });
    addAtlasTextures(this);
    this.showLoadingScreen();
    this.prepareNativeUi();

    const first = walkNow ? always : loadsFirst;
    queueManifestArt(this, this.manifest, first);
    queueFonts(this, this.manifest);
    if (this.manifest.sounds.length > 0 && browserSoundFormat() === undefined) {
      console.warn("This browser plays neither Ogg nor AAC, so the game is silent.");
    }
    this.queueSounds(walkNow ? always : loadsSoundFirst);
    this.watch?.waitFor("boot");
    this.load.once("complete", () =>
      this.processAssets(first, FRAME_BUDGET_MS, () => {
        registerFallbackPixelFont(this);
        addPillGlyphs(this);
        this.fontMetricsSettled = true;
        this.nativeUi?.invalidate();
        // A profile still opening is waited for with no denominator.
        const profile = opened ? undefined : waitedLoad.begin();
        profile?.progress(undefined);
        // While a newer version is required, no walk starts: home says so.
        void profileOpened.then(() => {
          profile?.finish();
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
      }),
    );
    this.load.start();
  }

  private prepareNativeUi(): void {
    const layer = uiLayer();
    if (layer === undefined) {
      throw new Error("The native UI layer is unavailable");
    }
    this.fontMetricsSettled = false;
    const metricsReady = () =>
      REQUIRED_BITMAP_FONTS.every((key) => this.cache.bitmapFont.exists(key));
    const native = this.registry.get(REQUIRED_UI) as RequiredUiController | undefined;
    if (native === undefined) {
      throw new Error("The native UI resource controller is unavailable");
    }
    this.nativeUi = native;
    let retryingMetrics = false;
    const removeMetrics = native.observe({
      retry: () => {
        if (this.fontMetricsSettled && !metricsReady()) {
          retryingMetrics = true;
          queueFonts(this, this.manifest);
          this.watch?.waitFor("boot");
          if (!this.load.isLoading()) {
            this.load.start();
          }
        }
      },
      status: () =>
        !this.fontMetricsSettled || retryingMetrics
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
        retryingMetrics = false;
        native.invalidate();
      }
    };
    this.load.on("complete", recovered);
    this.events.once(Scenes.Events.SHUTDOWN, () => {
      this.load.off("complete", recovered);
      removeMetrics();
      this.nativeUi = undefined;
    });
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

  // Missing loading art keeps its plain track; the shared thin progress line always remains.
  private showLoadingScreen(): void {
    if (this.textures.exists(LOADING_ART.screen)) {
      this.add.image(0, 0, LOADING_ART.screen).setOrigin(0);
    }
    const { x, y } = LOADING_TRACK;
    if (this.textures.exists(LOADING_ART.track)) {
      this.add.image(x, y, LOADING_ART.track).setOrigin(0);
    } else {
      addFilledRect(this, PALETTE.plum, LOADING_TRACK);
    }
    const walker = this.manifest.sprites.find(({ key }) => key === LOADING_ART.walker);
    if (walker !== undefined && this.textures.exists(walker.key)) {
      this.registerSprite(walker);
      const at = loadingWalkerAt(0);
      this.walker = this.add.sprite(at.x, at.y, walker.key).setOrigin(0);
      this.setWalkerMotion(currentSettings(this).reducedMotion);
    }
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
      if (sprite.key !== LOADING_ART.walker && include(sprite.key)) {
        steps.push(() => this.registerSprite(sprite));
      }
    }
    for (const [key, size] of placeholderSizes()) {
      if (include(key)) {
        steps.push(() => ensurePlaceholder(this, key, size));
      }
    }
    let next = 0;
    const runBatch = () => {
      const started = performance.now();
      while (next < steps.length && performance.now() - started < budgetMs) {
        itemAt(steps, next)();
        next += 1;
      }
      if (next < steps.length) {
        this.time.delayedCall(0, runBatch);
      } else {
        done();
      }
    };
    runBatch();
  }

  private registerSprite({ anchor, key }: SpriteAsset): void {
    if (!this.textures.exists(key)) {
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

  // Launches native home while keeping the loading screen until its usable view is ready.
  // The rest loads concurrently, but cannot stop Boot before that handoff.
  private showHome(allLoaded = false): void {
    let native: ProgressHandle | undefined;
    const waiting = waitForNativeHome(this.game.events, {
      loaded: () => this.scene.stop(),
      shown: () => {
        native?.finish();
        this.clearLoading();
      },
    });
    this.events.once(Scenes.Events.SHUTDOWN, () => {
      waiting.dispose();
      native?.finish();
    });
    this.requireNativeUi(HOME_UI_KEYS, () => {
      native = waitedLoad.begin();
      native.progress(undefined);
      this.scene.launch(SCENE_KEYS.start);
    });
    const loaded = () => this.stopOnceRetried(waiting.loaded);
    if (allLoaded) {
      loaded();
    } else {
      this.loadRest(BEHIND_FRAME_BUDGET_MS, loaded);
    }
  }

  // A direct walk launch needs no native-home handoff. Boot still runs behind it for retries.
  private leaveFor(key: string, data?: object): void {
    this.clearLoading();
    this.scene.launch(key, data);
  }

  private clearLoading(): void {
    this.clearMute();
    for (const child of [...this.children.list]) {
      child.destroy();
    }
    this.walker = undefined;
  }

  private clearMute(): void {
    this.removeMute?.();
    this.removeMute = undefined;
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

  // Loads and registers what the home screen did not need, then marks the art ready and calls
  // done. Behind the home screen the load is silent until Start walk waits for it
  // (waitForWalkArt); behind the loading screen, for a resumed walk, it is waited for.
  private loadRest(budgetMs: number, done: () => void, waited = false): void {
    const rest = (key: string) => !loadsFirst(key);
    queueManifestArt(this, this.manifest, rest);
    this.queueSounds((key) => !loadsSoundFirst(key));
    if (waited) {
      this.watch?.waitFor("boot");
    }
    this.load.once("complete", () =>
      this.processAssets(rest, budgetMs, () => {
        this.requireNativeUi(HUD_UI_KEYS, () => {
          markArtReady(this);
          done();
        });
      }),
    );
    this.load.start();
  }

  // Resumes the walk left unfinished, under the pause menu, once the rest has loaded behind the
  // loading screen.
  private resumeWalk(): void {
    this.loadRest(
      FRAME_BUDGET_MS,
      () => {
        const walk = takeResumedWalk(this);
        if (walk === null) {
          this.showHome(true);
          return;
        }
        startWakeLock();
        this.leaveFor(SCENE_KEYS.run, resumedRunSceneData(pageRunSetup().setup.dev, walk));
        this.stopOnceRetried();
      },
      true,
    );
  }

  // Starts the walk a dev link names, with everything loaded.
  private startWalk(): void {
    this.requireNativeUi(HUD_UI_KEYS, () => {
      if (requiredUpdate() !== undefined) {
        this.showHome(true);
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
      startWakeLock();
      this.leaveFor(SCENE_KEYS.run, runSceneData(nextRunStart(), pick));
      this.stopOnceRetried();
    });
  }
}

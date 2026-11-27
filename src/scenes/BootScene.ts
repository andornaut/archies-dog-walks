import { itemAt } from "@andornaut/game-kit/runtime/arrays";
import { type LoaderWatch, watchLoader } from "@andornaut/game-kit/runtime/load/phaser/watchLoader";
import { GameObjects, Scene, Scenes, Sound } from "phaser";

import { type AssetManifest, LOADING_ART, parseManifest } from "../assets/index.ts";
import {
  addAtlasFonts,
  addAtlasTextures,
  atlasManifest,
  loadManifest,
  MANIFEST_CACHE_KEY,
  playTag,
} from "../assets/phaser/index.ts";
import { pageRunSetup, pageSearch } from "../cheats/dom/index.ts";
import { namesRunSetup, runLinkLoadout } from "../cheats/index.ts";
import { waitedLoad } from "../loadingProgress.ts";
import {
  bootHandedOver,
  bootLoad,
  browserSoundFormat,
  exitShown,
  noteSaveStorage,
  requiredUpdate,
  startWakeLock,
  unlockAudioOnFirstGesture,
} from "../pwa/index.ts";
import { uiLayer } from "../ui/dom/index.ts";
import { addPillGlyphs, registerFallbackPixelFont } from "../ui/phaser/index.ts";
import { markArtReady, setBootWatch, type WaitedLoad } from "./boot/artReady.ts";
import {
  processBootAssets,
  queueBootArt,
  queueBootSounds,
  queueLoadingArt,
  registerBootSprite,
} from "./boot/assets.ts";
import { addBootPicture } from "./boot/bootPicture.ts";
import { stopOnceRetried } from "./boot/bootRetries.ts";
import { queueBootFonts } from "./boot/fonts.ts";
import { HOME_UI_KEYS, HUD_UI_KEYS, requireBootNativeUi } from "./boot/nativeArt.ts";
import {
  REQUIRED_BITMAP_FONTS,
  requiredFontFailure,
  retryRequiredFontLoads,
} from "./boot/requiredFontLoads.ts";
import { REQUIRED_UI, type RequiredUiController } from "./boot/requiredUi.ts";
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
import { nextRunStart } from "./run/runRecorder.ts";
import { resumedRunSceneData, runSceneData } from "./run/runStart.ts";
import { SCENE_KEYS } from "./sceneKeys.ts";

// Processing yields to the next frame once a batch has run this long.
const FRAME_BUDGET_MS = 8;

const always = () => true;

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
        queueLoadingArt(this, manifest);
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
    // A run link that names a run starts its walk, and banks a walk left unfinished rather than
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
    queueBootSounds(this, this.manifest, always);
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
        this.processAssets(always, firstComplete);
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
          this.processAssets(initial, cancelled);
        }
      };
      this.load.once("complete", done);
      this.events.once(Scenes.Events.SHUTDOWN, cancelled);
      try {
        if (initial !== undefined) {
          this.queueAvailableArt(initial);
          queueBootSounds(this, this.manifest, initial);
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
    return queueBootFonts(
      this,
      {
        failures: this.watch?.failures() ?? [],
        queued: this.queuedFontKeys,
      },
      manifest,
    );
  }

  private queueAvailableArt(include: (key: string) => boolean): void {
    queueBootArt(
      this,
      { failures: this.watch?.failures() ?? [], manifest: this.manifest },
      include,
    );
  }

  private requireNativeUi(keys: ReadonlySet<string>, ready: () => void): void {
    requireBootNativeUi(this, { manifest: this.manifest, native: this.nativeUi }, keys, ready);
  }

  // The backdrop and fixed walker are decorative; only the shared top strip shows progress.
  private showLoadingScreen(): void {
    this.walker = addBootPicture(
      { registerSprite: (sprite) => registerBootSprite(this, sprite), scene: this },
      this.manifest.sprites,
    );
    this.setWalkerMotion(currentSettings(this).reducedMotion);
  }

  private setWalkerMotion(reduced: boolean): void {
    if (this.walker !== undefined) {
      playTag(this.walker, LOADING_ART.walker, "walk", reduced);
    }
  }

  private processAssets(include: (key: string) => boolean, done: () => void): void {
    processBootAssets(
      this,
      { budgetMs: FRAME_BUDGET_MS, include, manifest: () => this.manifest },
      done,
    );
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

  // Starts the walk a run link names, with everything loaded. It saves like any walk.
  private startWalk(): void {
    this.requireNativeUi(HUD_UI_KEYS, () => {
      if (requiredUpdate() !== undefined) {
        this.showHome();
        return;
      }
      markArtReady(this);
      const { lastLoadout, owned } = profileSave(this);
      const walker = walkerInUse(profileSave(this));
      const loadout = runLinkLoadout(
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

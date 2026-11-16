// First, so the crash screen catches an error thrown while any other module loads.
import "./crash/install.ts";
// Turns the page frame on a touch screen in landscape before any script runs; main.css reads its
// --inset-* safe-area insets.
import "@andornaut/game-kit/runtime/web/view/frameTurnPortraitGame.css";
import "./main.css";

import { MENU_FPS } from "@andornaut/game-kit/runtime/clock/frameCap";
import { capFrameRate } from "@andornaut/game-kit/runtime/clock/phaser/capFrameRate";
import { LOADER_CONFIG } from "@andornaut/game-kit/runtime/load/loaderConfig";
import type { ProgressHandle } from "@andornaut/game-kit/runtime/progressState";
import { MAX_RENDER_SCALE } from "@andornaut/game-kit/runtime/view/renderScale";
import { followFrameTurn } from "@andornaut/game-kit/runtime/web/view/phaser/followFrameTurn";
import { Core, Game, Scale, WEBGL } from "phaser";

import { CRASH_SCREEN } from "./crash/crashScreen.ts";
import { SCREEN_CONFIG } from "./data/screen.ts";
import { applyPendingSaveEdits, type DevPanelHost, mountDevPanel } from "./dev/devPanel.ts";
import { DEV_CHEATS_KEY } from "./dev/devPanelModel.ts";
import { DEV_GAME_GLOBAL, devToolsOn } from "./dev/devTools.ts";
import { pageRunSetup } from "./dev/pageRunSetup.ts";
import { noteKeyPress } from "./input/keyNumbers.ts";
import { bindPressAdmission } from "./input/phaser/pressAdmission.ts";
import { lostTouches } from "./input/touches.ts";
import { createPressAdmission } from "./pressAdmission.ts";
import {
  pageFrameWatch,
  requiredUpdate,
  setOnHomeScreen,
  setupPhoneApp,
  storagePersistence,
} from "./pwa/index.ts";
import { offlineInstallation } from "./pwa/installationState.ts";
import { launchGame } from "./pwa/launchGame.ts";
import { createUpdateIdle } from "./pwa/updateIdle.ts";
import { BootScene } from "./scenes/BootScene.ts";
import { CardScene } from "./scenes/CardScene.ts";
import { CelebrationScene } from "./scenes/CelebrationScene.ts";
import { DevOverlayScene } from "./scenes/DevOverlayScene.ts";
import { EndScene } from "./scenes/EndScene.ts";
import { HelpPictureScene } from "./scenes/HelpPictureScene.ts";
import { HelpScene } from "./scenes/HelpScene.ts";
import { watchHomeScreen } from "./scenes/homeScreen.ts";
import { HudScene } from "./scenes/HudScene.ts";
import { pauseLoadingError } from "./scenes/loadingErrorPause.ts";
import { MenuScene } from "./scenes/MenuScene.ts";
import { PauseScene } from "./scenes/PauseScene.ts";
import { stopResuming } from "./scenes/profileStore.ts";
import { QuitScene } from "./scenes/QuitScene.ts";
import { createRequiredUi, REQUIRED_UI } from "./scenes/requiredUi.ts";
import { RunScene } from "./scenes/RunScene.ts";
import { SCENE_KEYS } from "./scenes/sceneKeys.ts";
import { SettingsScene } from "./scenes/SettingsScene.ts";
import { ShopScene } from "./scenes/ShopScene.ts";
import { StartScene } from "./scenes/StartScene.ts";
import { StatsScene } from "./scenes/StatsScene.ts";
import { TapBurstScene } from "./scenes/TapBurstScene.ts";
import { followWorldCameras } from "./scenes/worldCamera.ts";
import { ZoneCelebrationScene } from "./scenes/ZoneCelebrationScene.ts";
import type { LoadingBar } from "./ui/dom/domLoadingBar.ts";
import { mountLoadingError } from "./ui/dom/loadingError.ts";
import { followModalUnderlay } from "./ui/dom/rampDim.ts";
import { mountUiLayer, setUiLayer } from "./ui/dom/uiLayer.ts";
import { startupLoad } from "./ui/startupProgress.ts";
import { worldViewBox } from "./ui/worldFit.ts";

// The dev panel's view of the game: the cheats are a registry entry RunScene reads each frame.
function devPanelHost(game: Game): DevPanelHost {
  return {
    persistence: storagePersistence(),
    setCheats: (cheats) => {
      game.registry.set(DEV_CHEATS_KEY, cheats);
    },
  };
}

// The element in pages/play/index.html that holds the canvas.
const GAME_PARENT_ID = "game";

// Scenes render in list order: the HUD over the road, cards, the zone celebration and the
// pause menu over the HUD, help (its page's picture of the walk, HUD and card over it),
// settings and stats over those, and the dev overlay, which starts itself, over everything.
// Boot runs first and starts the start screen. The canvas clears to the page's ink, so launch
// shows no rectangle before the loading screen's art; the walk fills its own ink.
export interface GameStartup {
  readonly loading: LoadingBar | undefined;
  readonly nativeProgress: { begin(): ProgressHandle };
}

function bootGame(context: GameStartup): Game {
  const { loading } = context;
  const game = new Game({
    backgroundColor: "#181425",
    height: SCREEN_CONFIG.height,
    // Two touch pointers, so the walk sees a finger that lands while another rests.
    input: { activePointers: 2 },
    // The kit's request timeout and retries for every file the game loads.
    loader: LOADER_CONFIG,
    parent: GAME_PARENT_ID,
    pixelArt: true,
    // The kit owns the device-resolution backing. Scene cameras preserve the logical screen
    // at the top, centred across; the HTML layer follows that same view rather than its bars.
    scale: { autoCenter: Scale.CENTER_HORIZONTALLY, mode: Scale.NONE },
    // Scenes draw in this order. The Logbook, the settings and help, which the home top bar
    // opens over the Pet shop, come after it, help's pictures after help, and the tap bursts
    // over every scene but the dev overlay.
    scene: [
      BootScene,
      StartScene,
      RunScene,
      HudScene,
      CardScene,
      ZoneCelebrationScene,
      PauseScene,
      EndScene,
      ShopScene,
      StatsScene,
      CelebrationScene,
      QuitScene,
      SettingsScene,
      HelpScene,
      HelpPictureScene,
      new HudScene(SCENE_KEYS.helpHud),
      new CardScene(SCENE_KEYS.helpCard),
      MenuScene,
      TapBurstScene,
      DevOverlayScene,
    ],
    // WebGL only: the build's Phaser has no Canvas renderer (src/tools/phaserBuild.ts).
    type: WEBGL,
    width: SCREEN_CONFIG.width,
  });

  // The walk's checkpoints after a crash bank on the next launch rather than resume it.
  CRASH_SCREEN.stopGameOnCrash(() => {
    game.pause();
    game.sound.pauseAll();
    stopResuming(game);
  });
  // Phaser fits, places and reads pointers through the page frame's turn, and refits as #game,
  // the visible area or the turn changes, the dev bar showing under #game after boot included.
  const parent = document.getElementById(GAME_PARENT_ID);
  if (parent !== null) {
    followFrameTurn(pageFrameWatch(), game.scale.gameSize, parent, game, {
      deviceResolution: { max: MAX_RENDER_SCALE },
    });
  }
  followWorldCameras(game);
  const press = createPressAdmission(() => game.input.pointers.some((pointer) => pointer.isDown));
  game.events.once(
    Core.Events.DESTROY,
    bindPressAdmission(game, press, () => game.canvas.parentElement?.inert === true),
  );
  const updateIdle = createUpdateIdle(
    {
      events: window,
      required: () => requiredUpdate() !== undefined,
      timer: globalThis,
    },
    game.loop,
  );
  const mountUi = () => {
    const layer = mountUiLayer(
      document,
      game.canvas,
      (box) => worldViewBox(game.scale, box),
      press,
    );
    setUiLayer(layer);
    if (layer === undefined) {
      return;
    }
    const required = createRequiredUi(
      { installation: offlineInstallation, layer, progress: context.nativeProgress },
      (retry) => pauseLoadingError(game, mountLoadingError({ layer, retry }, document.body)),
    );
    game.registry.set(REQUIRED_UI, required);
    const update = () => layer.update();
    const stopLoadingShade =
      loading === undefined ? undefined : followModalUnderlay(layer.input, loading.element);
    const ready = layer.onReady(() => {
      update();
      updateIdle.invalidate();
    });
    game.events.on(Core.Events.PRE_RENDER, update);
    game.events.once(Core.Events.DESTROY, () => {
      ready();
      stopLoadingShade?.();
      required.dispose();
      if (game.registry.get(REQUIRED_UI) === required) {
        game.registry.remove(REQUIRED_UI);
      }
      game.events.off(Core.Events.PRE_RENDER, update);
      setUiLayer(undefined);
    });
  };
  game.events.once(Core.Events.READY, mountUi);
  game.scale.on(Scale.Events.RESIZE, updateIdle.invalidate);
  game.events.once(Core.Events.DESTROY, () => {
    game.events.off(Core.Events.READY, mountUi);
    game.scale.off(Scale.Events.RESIZE, updateIdle.invalidate);
    updateIdle.dispose();
  });
  // Menus draw at most about 60 frames a second; a walk (RunScene) draws every frame.
  capFrameRate(MENU_FPS, () => game.scene.isActive(SCENE_KEYS.run), game);
  // The installed app has no dev panel, so its #dev-panel stays hidden and no cheat is set.
  if (devToolsOn()) {
    const disposeDevPanel = mountDevPanel(devPanelHost(game), document.getElementById("dev-panel"));
    game.events.once(Core.Events.DESTROY, disposeDevPanel);
  }

  // Captured before the scenes see it, so the key that opens a menu already shows its numbers.
  window.addEventListener("keydown", noteKeyPress, { capture: true });
  game.events.once(Core.Events.DESTROY, () =>
    window.removeEventListener("keydown", noteKeyPress, { capture: true }),
  );

  // Phaser gives a new touch only a free pointer, so a touch whose end the browser never
  // delivered would hold its pointer and every later touch would be dropped. A touchstart lists
  // every touch on the screen, so a pointer holding one no longer there is freed before Phaser
  // handles it; the scenes take the new press on the freed pointer as a fresh one.
  const releaseLostTouches = (event: TouchEvent) => {
    const held = game.input.pointers.filter((pointer) => pointer.active && pointer.wasTouch);
    const lost = lostTouches(
      held.map((pointer) => pointer.identifier),
      Array.from(event.touches, (touch) => touch.identifier),
    );
    held
      .filter((pointer) => lost.includes(pointer.identifier))
      .forEach((pointer) => pointer.reset());
  };
  window.addEventListener("touchstart", releaseLostTouches, { capture: true, passive: true });
  game.events.once(Core.Events.DESTROY, () =>
    window.removeEventListener("touchstart", releaseLostTouches, { capture: true }),
  );

  // With dev=1, the game is reachable from the console and from headless checks.
  if (pageRunSetup().setup.dev) {
    Object.assign(globalThis, { [DEV_GAME_GLOBAL]: game });
  }

  game.events.once(Core.Events.POST_RENDER, () => startupLoad.finish());
  // The update notice shows on the home screen only, where a required update stops the loop.
  watchHomeScreen(game, (onHome) => {
    setOnHomeScreen(onHome);
    updateIdle.home(onHome);
  });
  return game;
}

// A complete update already waiting at document launch may take control before saves or the game
// open. Otherwise the current version boots while later updates stage in the background.
// Queued dev-panel save edits finish before boot, so the game loads the edited save. The
// installed app discards queued edits without changing its save.
export async function startGame(context: GameStartup): Promise<void> {
  await launchGame(applyPendingSaveEdits, () => bootGame(context), setupPhoneApp());
}

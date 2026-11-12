// First, so the crash screen catches an error thrown while any other module loads.
import "./crash/install.ts";
// Turns the page frame on a touch screen in landscape before any script runs; main.css reads its
// --inset-* safe-area insets.
import "@andornaut/game-kit/web/view/frameTurnPortraitGame.css";
import "./main.css";

import { MENU_FPS } from "@andornaut/game-kit/clock/frameCap";
import { capFrameRate } from "@andornaut/game-kit/clock/phaser/capFrameRate";
import { followFrameTurn } from "@andornaut/game-kit/web/view/phaser/followFrameTurn";
import { Core, Game, Scale, WEBGL } from "phaser";

import { CRASH_SCREEN } from "./crash/crashScreen.ts";
import { SCREEN_CONFIG } from "./data/screen.ts";
import { applyPendingSaveEdits, type DevPanelHost, mountDevPanel } from "./dev/devPanel.ts";
import { DEV_CHEATS_KEY } from "./dev/devPanelModel.ts";
import { DEV_GAME_GLOBAL, devToolsOn } from "./dev/devTools.ts";
import { pageRunSetup } from "./dev/pageRunSetup.ts";
import { noteKeyPress } from "./input/keyNumbers.ts";
import { lostTouches } from "./input/touches.ts";
import {
  noteWalkStarted,
  pageFrameWatch,
  setOnHomeScreen,
  setupPhoneApp,
  storagePersistence,
} from "./pwa/index.ts";
import { BootScene } from "./scenes/BootScene.ts";
import { CardScene } from "./scenes/CardScene.ts";
import { CelebrationScene } from "./scenes/CelebrationScene.ts";
import { DevOverlayScene } from "./scenes/DevOverlayScene.ts";
import { EndScene } from "./scenes/EndScene.ts";
import { HelpPictureScene } from "./scenes/HelpPictureScene.ts";
import { HelpScene } from "./scenes/HelpScene.ts";
import { watchHomeScreen } from "./scenes/homeScreen.ts";
import { HudScene } from "./scenes/HudScene.ts";
import { PauseScene } from "./scenes/PauseScene.ts";
import { stopResuming } from "./scenes/profileStore.ts";
import { QuitScene } from "./scenes/QuitScene.ts";
import { RunScene } from "./scenes/RunScene.ts";
import { SCENE_KEYS } from "./scenes/sceneKeys.ts";
import { SettingsScene } from "./scenes/SettingsScene.ts";
import { ShopScene } from "./scenes/ShopScene.ts";
import { StartScene } from "./scenes/StartScene.ts";
import { StatsScene } from "./scenes/StatsScene.ts";
import { TapBurstScene } from "./scenes/TapBurstScene.ts";
import { ZoneCelebrationScene } from "./scenes/ZoneCelebrationScene.ts";
import { mountUiLayer, setUiLayer } from "./ui/dom/uiLayer.ts";
import { htmlUiOn } from "./ui/htmlUi.ts";
import { startupLoad } from "./ui/startupProgress.ts";

// The dev panel's view of the game: the cheats are a registry entry RunScene reads each frame.
function devPanelHost(game: Game): DevPanelHost {
  return {
    persistence: storagePersistence(),
    setCheats: (cheats) => {
      game.registry.set(DEV_CHEATS_KEY, cheats);
    },
  };
}

// Reports the first walk, which counts as the player interacting, then stops watching.
function watchFirstWalk(game: Game): void {
  const check = () => {
    if (game.scene.isActive(SCENE_KEYS.run)) {
      game.events.off(Core.Events.POST_STEP, check);
      noteWalkStarted();
    }
  };
  game.events.on(Core.Events.POST_STEP, check);
}

// The element in pages/play/index.html that holds the canvas.
const GAME_PARENT_ID = "game";

// Scenes render in list order: the HUD over the road, cards, the zone celebration and the
// pause menu over the HUD, help (its page's picture of the walk, HUD and card over it),
// settings and stats over those, and the dev overlay, which starts itself, over everything.
// Boot runs first and starts the start screen. The canvas clears to the page's ink, so launch
// shows no rectangle before the loading screen's art; the walk fills its own ink.
function bootGame(): Game {
  const game = new Game({
    backgroundColor: "#181425",
    height: SCREEN_CONFIG.height,
    // Two touch pointers, so the walk sees a finger that lands while another rests.
    input: { activePointers: 2 },
    parent: GAME_PARENT_ID,
    pixelArt: true,
    // Phaser's Scale Manager fits the canvas to #game at the largest zoom that fits, fractional
    // included, keeping SCREEN_CONFIG's resolution scaled by CSS and drawn nearest-neighbour
    // (pixelArt), at #game's top and centred across, so the spare height sits under the dog
    // cards, where the walk steers from the page too.
    scale: { autoCenter: Scale.CENTER_HORIZONTALLY, mode: Scale.FIT },
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
    followFrameTurn(pageFrameWatch(), SCREEN_CONFIG, parent, game);
  }
  // With the switch on, the HTML interface's layer follows the canvas's box before each frame.
  if (htmlUiOn(location.search)) {
    game.events.once(Core.Events.READY, () => {
      const layer = mountUiLayer(document, game.canvas);
      setUiLayer(layer);
      if (layer !== undefined) {
        game.events.on(Core.Events.PRE_RENDER, () => layer.update());
      }
    });
  }
  // Menus draw at most about 60 frames a second; a walk (RunScene) draws every frame.
  capFrameRate(MENU_FPS, () => game.scene.isActive(SCENE_KEYS.run), game);
  // The installed app has no dev panel, so its #dev-panel stays hidden and no cheat is set.
  if (devToolsOn()) {
    const disposeDevPanel = mountDevPanel(devPanelHost(game), document.getElementById("dev-panel"));
    game.events.once(Core.Events.DESTROY, disposeDevPanel);
  }

  // Captured before the scenes see it, so the key that opens a menu already shows its numbers.
  window.addEventListener("keydown", noteKeyPress, { capture: true });

  // Phaser gives a new touch only a free pointer, so a touch whose end the browser never
  // delivered would hold its pointer and every later touch would be dropped. A touchstart lists
  // every touch on the screen, so a pointer holding one no longer there is freed before Phaser
  // handles it; the scenes take the new press on the freed pointer as a fresh one.
  window.addEventListener(
    "touchstart",
    (event) => {
      const held = game.input.pointers.filter((pointer) => pointer.active && pointer.wasTouch);
      const lost = lostTouches(
        held.map((pointer) => pointer.identifier),
        Array.from(event.touches, (touch) => touch.identifier),
      );
      held
        .filter((pointer) => lost.includes(pointer.identifier))
        .forEach((pointer) => pointer.reset());
    },
    { capture: true, passive: true },
  );

  // With dev=1, the game is reachable from the console and from headless checks.
  if (pageRunSetup().setup.dev) {
    Object.assign(globalThis, { [DEV_GAME_GLOBAL]: game });
  }

  game.events.once(Core.Events.POST_RENDER, () => startupLoad.finish());
  // The update notice shows on the home screen only.
  watchHomeScreen(game, setOnHomeScreen);
  watchFirstWalk(game);
  return game;
}

// The game boots at once from the version that controls the page, while the service worker checks
// for a newer one in the background; a newer version activates only after the player accepts it.
// Queued dev-panel save edits finish before boot, so the game loads the edited save. The
// installed app discards queued edits without changing its save.
setupPhoneApp();
void applyPendingSaveEdits().then(bootGame);

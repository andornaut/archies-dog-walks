import { focusTarget } from "@andornaut/game-kit/runtime/web/ui/dom/focusModality";
import { Core, type Game, Scene, Scenes } from "phaser";

import { gameData } from "../data/index.ts";
import { overlayRegion, updateModalLayout } from "../home/index.ts";
import { isPauseKey, menuKeyActs, screenArea } from "../input/index.ts";
import {
  acceptUpdate,
  bootFinished,
  dismissUpdate,
  PHONE_EVENTS,
  updateAcceptanceFailed,
  updateAccepting,
  updateOffered,
} from "../pwa/index.ts";
import type { DomQuestionPanel } from "../ui/dom/index.ts";
import { barTitleRoom, cardTitleRow, closeControl } from "../ui/index.ts";
import { measureModalTitle, modalTextWidth } from "./modalMeasure.ts";
import { mountNativeOverlay } from "./nativeOverlayReady.ts";
import { listenOutsideTap, nativeSceneAccepts, onBackPressed, onWindowEvent } from "./overlay.ts";
import { profileWritesSettled } from "./profileStore.ts";
import { addHtmlModalCard } from "./questionPanel.ts";
import { addRampDim } from "./rampDim.ts";
import type { RunScene } from "./RunScene.ts";
import { SCENE_KEYS, TAP_BURST_SCENE_KEY } from "./sceneKeys.ts";

// Scenes the prompt leaves running: boot's retries, the tap bursts over every screen, the prompt
// itself, and the walk, which its own pause menu holds (holdForUpdate).
const LEFT_RUNNING: ReadonlySet<string> = new Set([
  SCENE_KEYS.boot,
  SCENE_KEYS.run,
  SCENE_KEYS.update,
  TAP_BURST_SCENE_KEY,
]);

// Holds play still under the prompt: a walk under way pauses under its pause menu, and every
// other running scene pauses as under any overlay, dimmed and inert. pauseOpening says the hold
// opened the walk's pause menu, which launches at Phaser's next step. The release resumes what it
// paused.
export function holdPlay(game: Game): { readonly pauseOpening: boolean; release(): void } {
  const { scene } = game;
  const walk = scene.isActive(SCENE_KEYS.run)
    ? (scene.getScene(SCENE_KEYS.run) as RunScene).holdForUpdate()
    : undefined;
  const paused = scene
    .getScenes(true)
    .map(({ sys }) => sys.settings.key)
    .filter((key) => !LEFT_RUNNING.has(key));
  for (const key of paused) {
    scene.pause(key);
  }
  return {
    pauseOpening: walk?.opened ?? false,
    release() {
      for (const key of paused) {
        if (scene.isPaused(key)) {
          scene.resume(key);
        }
      }
      walk?.release();
    },
  };
}

// Update now's prompt over whatever screen shows: the update modal (homeText.update) in the
// region under the top bar, over the dimmed screen, with play held still under it. Update now
// saves (the walk's checkpoint, then every pending write) and switches to the staged build.
// Cancel, its close control, a tap outside, back, P and Escape dismiss it, and play continues on
// this build until the next launch applies the update. While Update now switches, the card
// closes and the loading line travels; a failed switch shows the card again with the failure
// title.
export class UpdateScene extends Scene {
  private card: DomQuestionPanel | undefined;
  private awaitingPause = false;
  private release: (() => void) | undefined;
  private walking = false;

  constructor() {
    super(SCENE_KEYS.update);
  }

  create(): void {
    this.awaitingPause = false;
    this.walking = this.scene.isActive(SCENE_KEYS.run);
    const invoking =
      typeof document === "undefined" || document.activeElement === document.body
        ? null
        : (document.activeElement as HTMLElement | null);
    const hold = holdPlay(this.game);
    this.release = () => {
      if (this.scene.isPaused(SCENE_KEYS.pause)) {
        this.scene.resume(SCENE_KEYS.pause);
      }
      hold.release();
    };
    this.events.once(Scenes.Events.SHUTDOWN, () => {
      this.card?.destroy();
      this.card = undefined;
      this.release?.();
      this.release = undefined;
      if (invoking !== null && !updateOffered() && !updateAccepting()) {
        // Resumed native views restore admission at their existing render boundary.
        this.game.events.once(Core.Events.POST_RENDER, () => {
          if (
            !updateOffered() &&
            !updateAccepting() &&
            !invoking.ownerDocument.hidden &&
            invoking.isConnected &&
            !invoking.closest("[inert], [hidden]") &&
            invoking.ownerDocument.activeElement !== invoking
          ) {
            focusTarget(invoking);
          }
        });
      }
    });
    onWindowEvent(this, PHONE_EVENTS.updateReady, () => this.sync());
    onBackPressed(this, () => this.dismiss());
    listenOutsideTap(
      this,
      () => (this.card === undefined ? undefined : screenArea([this.layout().panel])),
      () => this.dismiss(),
    );
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (
        nativeSceneAccepts(this) &&
        menuKeyActs(event.repeat, event.code) &&
        isPauseKey(event.code)
      ) {
        this.dismiss();
      }
    });
    addRampDim(this);
    // The card goes over a pause menu the hold opened, so it mounts once that menu's panel takes
    // input (update), and the menu then dims and stills under it as other screens do.
    this.awaitingPause = hold.pauseOpening;
    if (!this.awaitingPause) {
      mountNativeOverlay(this, () => this.mountCard());
    }
  }

  override update(): void {
    const pause = this.scene.get(SCENE_KEYS.pause);
    if (this.awaitingPause && pause.sys.isActive() && nativeSceneAccepts(pause)) {
      this.awaitingPause = false;
      mountNativeOverlay(this, () => this.mountCard());
      this.scene.pause(SCENE_KEYS.pause);
    }
  }

  private dismiss(): void {
    if (this.card !== undefined) {
      dismissUpdate();
    }
  }

  private acceptPressed(): void {
    acceptUpdate(async () => {
      if (this.scene.isActive(SCENE_KEYS.run)) {
        await (this.scene.get(SCENE_KEYS.run) as RunScene).checkpointForUpdate();
      }
      await profileWritesSettled(this);
    });
  }

  // Follows the offer: gone closes the prompt, a switch under way hides the card, and a failed
  // one shows it again with the failure title.
  private sync(): void {
    if (!updateOffered()) {
      this.scene.stop();
      return;
    }
    this.card?.destroy();
    this.card = undefined;
    if (!updateAccepting()) {
      this.mountCard();
    }
  }

  private title(): string {
    const text = gameData.homeText.update;
    return updateAcceptanceFailed() ? text.failure : text.title;
  }

  private layout() {
    const { button } = gameData.homeText.update;
    const title = this.title();
    const area = overlayRegion(this.walking ? "walk" : "home");
    const ink = {
      action: modalTextWidth(this, "title", [button]),
      cancel: modalTextWidth(this, "title", [gameData.homeText.shop.confirmCancel]),
      title: modalTextWidth(this, "title", [title]),
    };
    const layout = updateModalLayout(area, ink);
    const { extraHeight } = measureModalTitle(
      this,
      barTitleRoom(cardTitleRow(layout.panel), closeControl(layout.panel)),
      title,
    );
    return extraHeight === 0
      ? layout
      : updateModalLayout(area, { ...ink, titleExtraHeight: extraHeight });
  }

  private mountCard(): boolean {
    const { button, cancel, panel } = this.layout();
    const text = gameData.homeText.update;
    const dismiss = () => this.dismiss();
    const entries = [
      { label: gameData.homeText.shop.confirmCancel, press: dismiss, primary: false, rect: cancel },
      { label: text.button, press: () => this.acceptPressed(), primary: true, rect: button },
    ];
    this.card = addHtmlModalCard(this, panel, this.title(), entries, dismiss, dismiss);
    return this.card !== undefined;
  }
}

// Opens the prompt once per offer over whatever screen shows, once boot has handed over, so it
// never covers the loading screen.
export function watchUpdateOffer(game: Game): void {
  let opened = false;
  game.events.on(Core.Events.POST_STEP, () => {
    if (!updateOffered()) {
      opened = false;
    } else if (!opened && bootFinished()) {
      opened = true;
      game.scene.run(SCENE_KEYS.update);
    }
  });
}

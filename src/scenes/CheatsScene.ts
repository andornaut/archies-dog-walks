import { Scene, Scenes } from "phaser";

import type { OverlayRegion } from "../home/index.ts";
import { coverHelpUnderlay } from "../hud/dom/index.ts";
import { isMuteKey, isPauseKey, menuKeyActs, sceneKeyAllowed } from "../input/index.ts";
import { type CheatsPage, openCheatsPage } from "./cheatsPage.ts";
import { listenHomeBar } from "./homeBarPress.ts";
import type { MenuSceneData } from "./MenuScene.ts";
import { mountNativeOverlay } from "./nativeOverlayReady.ts";
import {
  BAR_MUTED_EVENT,
  closeOverlay,
  nativeSceneAccepts,
  onBackPressed,
  type OverlayData,
} from "./overlay.ts";
import { toggleMuted } from "./profileStore.ts";
import { htmlPanelPlace } from "./questionPanel.ts";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys.ts";
import { requestTitleReturn } from "./titleNavigation.ts";
import { shownTopSectionRoots } from "./topSection.ts";

// What Cheats opens with: the Menu or Pause under it, which it resumes on close, and where it
// opens, which sets whose top bar stays live over it and where Reset save's question sits: a
// home page's, or on a walk the walk bar.
export interface CheatsData extends OverlayData {
  readonly region: OverlayRegion;
  readonly resume: SceneKey;
}

// The Cheats page (cheatsPage.ts), a page, not a modal, as Help and Settings are: it covers the
// screen under the top bar, which stays live over it, the home bar routed through it
// (listenHomeBar), its Menu opening the page's own Menu over it or returning to the Menu it opened
// from, and on a walk the walk bar, whose Pause closes it back to the pause menu (topBarAction).
// Back, Escape and the system back close Reset save's question first, then the page, which
// resumes the Menu or Pause it opened over; it has no outside. M mutes, as on Help.
export class CheatsScene extends Scene {
  private page: CheatsPage | undefined;
  private resumeKey: SceneKey | undefined;

  constructor() {
    super(SCENE_KEYS.cheats);
  }

  create(data: CheatsData): void {
    this.page = undefined;
    this.resumeKey = data.resume;
    mountNativeOverlay(this, () => this.mount(data));
  }

  private mount(data: CheatsData): boolean {
    const place = htmlPanelPlace(this);
    if (place === undefined) {
      return false;
    }
    // The page hides the screen roots under it but the live top bar's, as Help does; restored
    // before the page is disposed.
    const uncover = coverHelpUnderlay(shownTopSectionRoots(this), place.layer.element);
    this.events.once(Scenes.Events.SHUTDOWN, uncover);
    const page = openCheatsPage(this, data.region === "walk", () => this.close());
    if (page === undefined) {
      uncover();
      return false;
    }
    this.page = page;
    this.events.once(Scenes.Events.SHUTDOWN, () => {
      page.destroy();
      this.page = undefined;
    });
    onBackPressed(this, () => this.back());
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!sceneKeyAllowed(event)) {
        return;
      }
      if (!nativeSceneAccepts(this) || !menuKeyActs(event.repeat, event.code)) {
        return;
      }
      if (isPauseKey(event.code)) {
        this.back();
      } else if (isMuteKey(event.code)) {
        this.game.events.emit(BAR_MUTED_EVENT, toggleMuted(this));
      }
    });
    if (data.region === "home") {
      // The bar's Menu returns to the Menu the page opened from, else opens the page's own Menu.
      listenHomeBar(
        this,
        () => this.page?.back(),
        (): MenuSceneData => ({
          context: "cheats",
          onHeadHome: () => {
            this.close();
            requestTitleReturn(this);
          },
          resume: SCENE_KEYS.cheats,
        }),
        data.resume === SCENE_KEYS.menu ? () => this.close() : undefined,
      );
    }
    return true;
  }

  // Closes Reset save's question if it is open, else the page.
  back(): void {
    if (this.page?.back() !== true) {
      this.close();
    }
  }

  // Closes the page, resuming the Menu or Pause under it, as Back does, and as the walk bar's
  // Pause does over it.
  close(): void {
    closeOverlay(this.resumeKey, this);
  }
}

import { itemAt } from "@andornaut/game-kit/runtime/arrays";
import { containsPoint, type Point, type Rect } from "@andornaut/game-kit/runtime/rect";
import { Scene, Scenes } from "phaser";

import { gameData } from "../data/index.ts";
import type { HelpPictureId } from "../data/types.ts";
import { helpActionForKey, helpActionForPointer } from "../help/helpInput.ts";
import { HELP_LAYOUT } from "../help/helpLayout.ts";
import { applyHelpAction, type HelpAction } from "../help/helpPaging.ts";
import { closeHelp } from "../help/helpSeen.ts";
import { type HelpMeasure, helpView } from "../help/helpView.ts";
import { coverHelpUnderlay } from "../hud/dom/helpUnderlay.ts";
import type { DomQuestionPanel } from "../hud/dom/questionPanel.ts";
import { isMuteKey } from "../input/keyBindings.ts";
import { PALETTE } from "../ui/palette.ts";
import { addFilledRect } from "../ui/phaser/draw.ts";
import { setPixelText, withProbe, wrapPixelText } from "../ui/phaser/pixelText.ts";
import type { HelpPictureData } from "./HelpPictureScene.ts";
import type { HelpData } from "./helpScreen.ts";
import { listenHomeBar } from "./homeBarPress.ts";
import type { MenuSceneData } from "./MenuScene.ts";
import { canvasPanelMeasure } from "./modalMeasure.ts";
import { listenOnePress } from "./onePress.ts";
import { BAR_MUTED_EVENT, closeOverlay, onBackPressed } from "./overlay.ts";
import { currentSettings, onSettingsChanged, toggleMuted, updateProfile } from "./profileStore.ts";
import { addHtmlHelpScreen, htmlPanelInput, htmlPanelPlace } from "./questionPanel.ts";
import { REFUSE } from "./refuseControl.ts";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys.ts";
import { requestTitleReturn } from "./titleNavigation.ts";
import { shownTopSectionRoots } from "./topSection.ts";
import { clearScene } from "./uiKit.ts";

// Emitted on game.events when the help closes, by any route.
export const HELP_CLOSED_EVENT = "help-closed";

// The help's text and art measured on the bitmap fonts scene draws it in: a title-font label's
// lowest ink as Phaser lays it out, and the body wrapped as the help pages' fit test wraps it,
// measured on the font, since Phaser's own wrap counts a line's trailing space and so would break
// a line that fits exactly.
function helpMeasure(scene: Scene): HelpMeasure {
  return {
    ...canvasPanelMeasure(scene),
    titleInkBottom: (scale, text) =>
      withProbe(scene, { colour: PALETTE.amber, font: "title", scale }, (probe) => {
        setPixelText(probe, text);
        return Math.max(
          0,
          ...probe
            .getTextBounds(true)
            .characters.filter(({ h, w }) => w > 0 && h > 0)
            .map(({ h, y }) => y + h),
        );
      }),
    wrapBody: (scale, width, text) =>
      wrapPixelText(scene, { colour: PALETTE.cream, scale }, width, text),
  };
}

// A page, not a modal, as the Logbook is, listed after the scenes it opens over, the home screen
// and the pause menu over the walk, and before its picture's scenes, which draw over it. It covers
// the screen under the top bar, which stays live and undimmed over it: the home bar on a home
// page, routed through help (listenHomeBar), its Menu opening over help; on a walk the walk bar,
// whose Pause closes help back to the pause menu (topBarAction). A modal over help dims and
// stills it with the rest of the background. The caller pauses itself and launches it
// (openHelp); on close, help resumes that scene.
export class HelpScene extends Scene {
  // The page in HTML, while it is drawn there.
  private html: DomQuestionPanel | undefined;
  private page = 0;
  // The page whose picture shows.
  private picturePage: number | undefined;
  private pressStart: { point: Point; accepts: () => boolean } | undefined;
  private resumeKey: SceneKey | undefined;

  constructor() {
    super(SCENE_KEYS.help);
  }

  create(data: HelpData): void {
    const place = htmlPanelPlace(this);
    if (place !== undefined) {
      // Restore covered roots before this scene disposes its page and returns focus.
      this.events.once(
        Scenes.Events.SHUTDOWN,
        coverHelpUnderlay(shownTopSectionRoots(this), place.layer.element),
      );
    }
    this.html = undefined;
    this.page = 0;
    this.picturePage = undefined;
    this.pressStart = undefined;
    this.resumeKey = data.resume;
    this.events.once(Scenes.Events.SHUTDOWN, () => this.scene.stop(SCENE_KEYS.helpPicture));
    this.draw();
    onSettingsChanged(this, () => this.draw());

    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (this.html?.accepts() !== true) {
        return;
      }
      if (!event.repeat && isMuteKey(event.code)) {
        this.game.events.emit(BAR_MUTED_EVENT, toggleMuted(this));
        return;
      }
      const action = helpActionForKey(event.repeat, event.code);
      if (action !== undefined) {
        this.act(action);
      }
    });
    listenOnePress(this, {
      down: (point) => {
        if (
          this.html?.accepts() !== true ||
          !containsPoint(HELP_LAYOUT.presses, point.x, point.y)
        ) {
          return;
        }
        this.beginPagePress(point);
        this.html.burst(point);
      },
      up: (point, cancelled) => {
        this.endPagePress(point, cancelled);
      },
    });
    // Help is a page: only Back, Escape and the system back leave it.
    onBackPressed(this, () => {
      if (this.html?.accepts()) {
        this.close();
      }
    });
    if (data.region === "home") {
      // The bar's Menu opens help's own over it: its Close leaves help too.
      listenHomeBar(
        this,
        () => undefined,
        (): MenuSceneData => ({
          closePage: () => this.close(),
          context: "help",
          onHeadHome: () => {
            this.close();
            requestTitleReturn(this);
          },
          resume: SCENE_KEYS.help,
        }),
      );
    }
  }

  private beginPagePress(point: Point): void {
    if (this.html?.accepts()) {
      this.pressStart = { accepts: this.html.capture(), point };
    }
  }

  private endPagePress(point: Point, cancelled: boolean): boolean {
    const start = this.pressStart;
    this.pressStart = undefined;
    if (start === undefined) {
      return false;
    }
    if (!cancelled && start.accepts()) {
      const action = helpActionForPointer(gameData.help.length, start.point, point);
      if (action !== undefined) {
        this.act(action);
      }
    }
    return true;
  }

  private act(action: HelpAction): void {
    if (action.kind === "previous" && this.page === 0) {
      this.html?.refuse(0, { ...REFUSE, reducedMotion: currentSettings(this).reducedMotion });
      return;
    }
    const outcome = applyHelpAction(gameData.help.length, action, this.page);
    if (outcome.kind === "close") {
      this.close();
      return;
    }
    if (outcome.page !== this.page) {
      this.page = outcome.page;
      this.draw();
    }
  }

  // Closes help, resuming the scene under it.
  close(): void {
    closeOverlay(this.resumeKey, this);
    void updateProfile(this, closeHelp);
    this.game.events.emit(HELP_CLOSED_EVENT);
  }

  // Redrawn whole on every page turn, reading the pages then, so a live text edit shows up: the
  // dark page, the picture's frame and the world picture stay on canvas beneath native controls
  // and copy.
  private draw(): void {
    clearScene(this);
    const view = helpView(gameData, helpMeasure(this), this.page, undefined);
    this.page = view.page;
    view.backdrop.forEach(({ colour, rect }) => addFilledRect(this, colour, rect));
    this.showPicture(itemAt(gameData.help, this.page).art, view.illustration);
    this.html?.destroy();
    const point = (event: PointerEvent) => {
      const place = htmlPanelPlace(this);
      return place === undefined
        ? undefined
        : htmlPanelInput(place).toGame({ x: event.clientX, y: event.clientY });
    };
    this.html = addHtmlHelpScreen(
      this,
      {
        footerPress: () => this.close(),
        gesture: {
          cancel: () => {
            this.pressStart = undefined;
          },
          down: (event) => {
            const at = point(event);
            if (at !== undefined) {
              this.beginPagePress(at);
              this.html?.burst(at);
            }
          },
          up: (event, cancelled) => {
            const at = point(event);
            return at === undefined ? false : this.endPagePress(at, cancelled);
          },
        },
        presses: [() => this.act({ kind: "previous" }), () => this.act({ kind: "advance" })],
      },
      view,
    );
  }

  // The page's picture of the walk screen in frame, drawn over this scene by the picture
  // scenes; started again only when the page changes.
  private showPicture(art: HelpPictureId, frame: Rect): void {
    if (this.picturePage === this.page) {
      return;
    }
    this.picturePage = this.page;
    const data: HelpPictureData = { frame, page: art };
    this.scene.launch(SCENE_KEYS.helpPicture, data);
  }
}

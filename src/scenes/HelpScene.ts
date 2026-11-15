import { itemAt } from "@andornaut/game-kit/runtime/arrays";
import { type Point, type Rect } from "@andornaut/game-kit/runtime/rect";
import { Scene, Scenes } from "phaser";

import { gameData } from "../data/index.ts";
import type { HelpPictureId } from "../data/types.ts";
import { helpActionForKey, helpActionForPointer } from "../help/helpInput.ts";
import { HELP_BAR_BUTTONS, HELP_LAYOUT } from "../help/helpLayout.ts";
import { applyHelpAction, type HelpAction } from "../help/helpPaging.ts";
import { closeHelp } from "../help/helpSeen.ts";
import { type HelpMeasure, helpView } from "../help/helpView.ts";
import type { DomQuestionPanel } from "../hud/dom/questionPanel.ts";
import { isMuteKey } from "../input/keyBindings.ts";
import { screenArea } from "../input/outsideTap.ts";
import type { NativeTopSection } from "../ui/dom/nativeTopSection.ts";
import { PALETTE } from "../ui/palette.ts";
import { addFilledRect } from "../ui/phaser/draw.ts";
import { setPixelText, withProbe, wrapPixelText } from "../ui/phaser/pixelText.ts";
import { topSectionButtonAt } from "../ui/topSection.ts";
import type { HelpPictureData } from "./HelpPictureScene.ts";
import { routeHomeBar } from "./homeBarPress.ts";
import type { MenuSceneData } from "./MenuScene.ts";
import { canvasPanelMeasure } from "./modalMeasure.ts";
import { listenOnePress } from "./onePress.ts";
import {
  BAR_MUTED_EVENT,
  closeOverlay,
  listenDismiss,
  openOverlay,
  type OverlayData,
} from "./overlay.ts";
import {
  currentSettings,
  isMuted,
  onSettingsChanged,
  toggleMuted,
  updateProfile,
} from "./profileStore.ts";
import { addHtmlHelpScreen, htmlPanelInput, htmlPanelPlace } from "./questionPanel.ts";
import { REFUSE } from "./refuseControl.ts";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys.ts";
import { addNativeTopSection } from "./topSection.ts";
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

// A full-screen overlay listed after the scenes it opens over, the home screen and the pause
// menu over the walk, and before its picture's scenes, which draw over it. The caller pauses
// itself and launches it (openHelp); on close, help resumes that scene.
export class HelpScene extends Scene {
  private topSection: NativeTopSection | undefined;
  // The screen in HTML, while it is drawn there.
  private html: DomQuestionPanel | undefined;
  private page = 0;
  // The page whose picture shows.
  private picturePage: number | undefined;
  private pressStart: { point: Point; accepts: () => boolean } | undefined;
  private resumeKey: SceneKey | undefined;

  constructor() {
    super(SCENE_KEYS.help);
  }

  create(data?: OverlayData): void {
    this.html = undefined;
    this.topSection = undefined;
    this.page = 0;
    this.picturePage = undefined;
    this.pressStart = undefined;
    this.resumeKey = data?.resume;
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
          topSectionButtonAt(HELP_BAR_BUTTONS, point.x, point.y) !== undefined
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
    listenDismiss(this, screenArea([HELP_LAYOUT.screen]), () => {
      if (this.html?.accepts()) {
        this.close();
      }
    });
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

  private close(): void {
    closeOverlay(this.resumeKey, this);
    void updateProfile(this, closeHelp);
    this.game.events.emit(HELP_CLOSED_EVENT);
  }

  // Redrawn whole on every page turn, reading the pages then, so a live text edit shows up: the
  // dark backdrop and world picture stay on canvas beneath native controls and copy.
  private draw(): void {
    clearScene(this);
    const view = helpView(gameData, helpMeasure(this), this.page, undefined);
    this.page = view.page;
    view.backdrop.forEach(({ colour, rect }) => addFilledRect(this, colour, rect));
    this.topSection ??= addNativeTopSection(this, {
      accepts: () => true,
      buttons: HELP_BAR_BUTTONS,
      heading: view.heading.text,
      labels: {
        exit: gameData.homeText.quit.quit,
        menu: gameData.menuText.menu.title,
        mute: gameData.menuText.settings.sound,
        pause: gameData.menuText.pause.title,
      },
      muted: isMuted(this),
      press: (id) => {
        if (id !== "menu" && id !== "mute") {
          return;
        }
        if (routeHomeBar(this, id) || !this.sys.isActive() || !this.input.enabled) {
          return;
        }
        if (id === "mute") {
          this.game.events.emit(BAR_MUTED_EVENT, toggleMuted(this));
        } else {
          const data: MenuSceneData = {
            closePage: () => this.close(),
            context: "help",
            resume: SCENE_KEYS.help,
          };
          openOverlay(this, SCENE_KEYS.menu, data);
        }
      },
    });
    this.topSection?.setMuted(isMuted(this));
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
        gesture: {
          cancel: () => {
            this.pressStart = undefined;
          },
          down: (event) => {
            const at = point(event);
            if (at !== undefined) {
              this.beginPagePress(at);
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

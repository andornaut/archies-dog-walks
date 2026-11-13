import { itemAt } from "@andornaut/game-kit/arrays";
import { insetRect, type Point, type Rect } from "@andornaut/game-kit/rect";
import { Scene, Scenes } from "phaser";

import { gameData } from "../data/index.ts";
import type { HelpPictureId } from "../data/types.ts";
import { helpActionForKey, helpActionForPointer } from "../help/helpInput.ts";
import { HELP_LAYOUT, helpActionAt } from "../help/helpLayout.ts";
import { applyHelpAction, type HelpAction } from "../help/helpPaging.ts";
import { closeHelp } from "../help/helpSeen.ts";
import { HELP_DOTS, type HelpMeasure, type HelpPressed, helpView } from "../help/helpView.ts";
import type { DomQuestionPanel } from "../hud/dom/questionPanel.ts";
import { screenArea } from "../input/outsideTap.ts";
import { PALETTE } from "../ui/palette.ts";
import { addFilledRect } from "../ui/phaser/draw.ts";
import { addPixelText, setPixelText, withProbe, wrapPixelText } from "../ui/phaser/pixelText.ts";
import type { HelpPictureData } from "./HelpPictureScene.ts";
import { canvasPanelMeasure } from "./modalMeasure.ts";
import { listenOnePress } from "./onePress.ts";
import { closeOverlay, listenDismiss, type OverlayData } from "./overlay.ts";
import { currentSettings, updateProfile } from "./profileStore.ts";
import { addHtmlHelpScreen } from "./questionPanel.ts";
import { REFUSE } from "./refuseControl.ts";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys.ts";
import { addTopSection, mirrorTopSection, type TopSection } from "./topSection.ts";
import { addMenuButton, addTapBurst, clearScene, type MenuButton } from "./uiKit.ts";

// Emitted on game.events when the help closes, by any route.
export const HELP_CLOSED_EVENT = "help-closed";

type Pressed = HelpPressed;

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

// The control a press starts on shows pressed until it is released.
function pressedBy(action: HelpAction | undefined): Pressed | undefined {
  switch (action?.kind) {
    case "advance":
      return "next";
    case "close":
    case "previous":
      return action.kind;
    default:
      return undefined;
  }
}

// A full-screen overlay listed after the scenes it opens over, the home screen and the pause
// menu over the walk, and before its picture's scenes, which draw over it. The caller pauses
// itself and launches it (openHelp); on close, help resumes that scene.
export class HelpScene extends Scene {
  private topSection: TopSection | undefined;
  // The screen in HTML, while it is drawn there.
  private html: DomQuestionPanel | undefined;
  private previousButton: MenuButton | undefined;
  private page = 0;
  // The page whose picture shows.
  private picturePage: number | undefined;
  private pressed: Pressed | undefined;
  private pressStart: Point | undefined;
  private resumeKey: SceneKey | undefined;

  constructor() {
    super(SCENE_KEYS.help);
  }

  create(data?: OverlayData): void {
    this.html = undefined;
    this.page = 0;
    this.picturePage = undefined;
    this.pressed = undefined;
    this.pressStart = undefined;
    this.resumeKey = data?.resume;
    this.events.once(Scenes.Events.SHUTDOWN, () => this.scene.stop(SCENE_KEYS.helpPicture));
    this.draw();
    mirrorTopSection(this, () => this.topSection?.root);

    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      const action = helpActionForKey(event.repeat, event.code);
      if (action !== undefined) {
        this.act(action);
      }
    });
    // Taps act on release, so a swipe that starts on a button turns the page instead.
    listenOnePress(this, {
      down: (pointer) => {
        // Over the HTML screen, so a burst on a button shows over it.
        if (this.html === undefined) {
          addTapBurst(this, pointer.x, pointer.y);
        } else {
          this.html.burst({ x: pointer.x, y: pointer.y });
        }
        this.pressStart = { x: pointer.x, y: pointer.y };
        this.showPressed(pressedBy(helpActionAt(gameData.help.length, this.pressStart)));
      },
      up: (pointer, cancelled) => {
        const start = this.pressStart;
        this.pressStart = undefined;
        this.showPressed(undefined);
        if (start === undefined || cancelled) {
          return;
        }
        const end = { x: pointer.x, y: pointer.y };
        const action = helpActionForPointer(gameData.help.length, start, end);
        if (action !== undefined) {
          this.act(action);
        }
      },
    });
    listenDismiss(this, screenArea([HELP_LAYOUT.screen]), () => this.close());
  }

  private showPressed(pressed: Pressed | undefined): void {
    if (pressed !== this.pressed) {
      this.pressed = pressed;
      this.draw();
    }
  }

  private act(action: HelpAction): void {
    if (action.kind === "previous" && this.page === 0) {
      this.previousButton?.refuse();
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
  // dark screen, the top bar and the page's picture on the canvas, and the rest in HTML where the
  // page's switch is on and its fonts are ready, else on the canvas too.
  private draw(): void {
    clearScene(this);
    const view = helpView(gameData, helpMeasure(this), this.page, this.pressed);
    this.page = view.page;
    view.backdrop.forEach(({ colour, rect }) => addFilledRect(this, colour, rect));
    this.topSection = addTopSection(this, {
      buttons: ["close"],
      heading: view.heading.text,
    });
    this.topSection.buttons.get("close")?.setPressed(view.closePressed);
    this.showPicture(itemAt(gameData.help, this.page).art, view.illustration);
    this.html?.destroy();
    this.html = addHtmlHelpScreen(this, view);
    if (this.html !== undefined) {
      this.previousButton = undefined;
      return;
    }
    const { body, title } = view;
    view.rules.forEach(({ colour, rect }) => addFilledRect(this, colour, rect));
    addPixelText(this, title.centreX, title.capTop, title.text, {
      colour: title.colour,
      font: "title",
      scale: title.scale,
    });
    // Its lines pitch rows apart: Phaser spaces lines by the font's line height and the spacing.
    const text = addPixelText(this, body.x, body.capTop, body.lines.join("\n"), {
      colour: body.colour,
      scale: body.scale,
    });
    text.setLineSpacing(body.pitch / body.scale - text.fontData.lineHeight);
    view.dots.forEach(({ current, rect }) => {
      if (current) {
        addFilledRect(this, HELP_DOTS.current, rect);
      } else {
        addFilledRect(this, HELP_DOTS.ring, rect);
        addFilledRect(this, PALETTE.darkBrown, insetRect(1, rect));
      }
    });
    // Next is the call to action; Previous is disabled on the first page.
    const buttons = view.buttons.map((button) => {
      const drawn = addMenuButton(this, button.rect, button.label, {
        available: button.available,
        primary: button.primary,
      });
      drawn.setPressed(button.pressed);
      return drawn;
    });
    this.previousButton = buttons[0];
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

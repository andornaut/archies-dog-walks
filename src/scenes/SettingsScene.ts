import { itemAt } from "@andornaut/game-kit/runtime/arrays";
import { containsPoint, type Rect } from "@andornaut/game-kit/runtime/rect";
import { fittingText } from "@andornaut/game-kit/runtime/text/textFit";
import { Scene, Scenes } from "phaser";

import { BUILD_LABEL } from "../buildLabel.ts";
import { gameData } from "../data/index.ts";
import {
  FEEDBACK,
  type Focus,
  INSTALL_STEPS_FIT,
  type InstallStepsLayout,
  installStepsLayout,
  moveFocus,
  noteRoomForControl,
  type OverlayRegion,
  overlayRegion,
  SETTING_ROWS,
  SETTINGS_NOTE_STYLE,
  SETTINGS_ROW,
  type SettingsFonts,
  settingsInstallWidth,
  type SettingsLayout,
  settingsLayout,
  type SettingsRow,
  settingsRows,
  type SettingsRowShape,
  type SettingsTarget,
  type SettingsView,
  settingsView,
  setVolumeSteps,
  type SwitchKey,
  type VolumeKey,
  volumeStepForKey,
  volumeSteps,
} from "../home/index.ts";
import { coverHelpUnderlay, type DomSettings } from "../hud/dom/index.ts";
import {
  focusDirectionForKey,
  isConfirmKey,
  isMuteKey,
  isPauseKey,
  menuKeyActs,
  sceneKeyAllowed,
} from "../input/index.ts";
import { SCREEN_LAYOUT } from "../layout/index.ts";
import {
  installApp,
  installState,
  type InstallStepsKind,
  offersInstall,
  onInstallStateChange,
  stepsKind,
} from "../pwa/index.ts";
import type { Settings } from "../save/index.ts";
import { barTitleRoom, cardTitleRow } from "../ui/index.ts";
import {
  fitPixelText,
  labelInkWidth,
  pixelFontMetrics,
  setPixelText,
  withProbe,
} from "../ui/phaser/index.ts";
import { listenHomeBar } from "./homeBarPress.ts";
import type { MenuSceneData } from "./MenuScene.ts";
import { measureModalTitle, modalTextWidth } from "./modalMeasure.ts";
import { mountNativeOverlay } from "./nativeOverlayReady.ts";
import {
  BAR_MUTED_EVENT,
  closeOverlay,
  nativeSceneAccepts,
  onBackPressed,
  onSceneEvent,
  type OverlayData,
} from "./overlay.ts";
import { currentSettings, setSettings } from "./profileStore.ts";
import { htmlPanelPlace } from "./questionPanel.ts";
import { addRampDim } from "./rampDim.ts";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys.ts";
import { addHtmlSettings } from "./settingsHtml.ts";
import { canvasSettingsMeasure } from "./settingsMeasure.ts";
import { soundboardOf } from "./soundboard.ts";
import { listenTargetPress, sameByValue } from "./targetPress.ts";
import { requestTitleReturn } from "./titleNavigation.ts";
import { shownTopSectionRoots } from "./topSection.ts";
import { BODY_TEXT } from "./uiKit.ts";

// Emitted on game.events when settings close.
export const SETTINGS_CLOSED_EVENT = "settings-closed";

// The open install steps' card, with the kind of steps it shows.
type OpenSteps = InstallStepsLayout & { readonly kind: InstallStepsKind };
type Row = SettingsRow;
type Target = SettingsTarget;

// How many lines a browser's install steps wrap onto in their card.
function stepsLines(scene: Scene, steps: string): string[] {
  return withProbe(scene, BODY_TEXT, (probe) => {
    setPixelText(probe, steps);
    return fitPixelText(probe, INSTALL_STEPS_FIT, 0, 0);
  }).lines;
}

// Each row's shape: its note, wrapped in its room as render sets it, decides how many lines it
// takes.
function rowShapes(scene: Scene, rows: readonly Row[]): SettingsRowShape[] {
  const words = gameData.menuText.settings;
  return rows.map((row) => {
    if (row.kind === "slider") {
      return { kind: "slider" };
    }
    if (row.kind === "button") {
      return {
        controlWidth: settingsInstallWidth(modalTextWidth(scene, "title", [words.install])),
        kind: "button",
        noteLines: 0,
      };
    }
    if (row.note === undefined) {
      return {
        kind: row.kind,
        noteLines: 0,
      };
    }
    const note = words[row.note];
    const controlWidth = SETTINGS_ROW.switch.width;
    const { lines } = withProbe(scene, BODY_TEXT, (probe) =>
      fittingText(
        SETTINGS_NOTE_STYLE,
        labelInkWidth(probe),
        noteRoomForControl(controlWidth),
        note,
      ),
    );
    return {
      kind: row.kind,
      noteLines: lines.length,
    };
  });
}

const NO_FONT = { capHeight: 0, capTop: 0, inkBottom: 0, letterTop: 0, lineHeight: 0 };
const NO_FONTS: SettingsFonts = { body: NO_FONT, title: NO_FONT };

function settingsFonts(scene: Scene): SettingsFonts {
  return { body: pixelFontMetrics(scene, "body"), title: pixelFontMetrics(scene, "title") };
}

// What the settings are launched with: the scene under them, which they resume on close, and
// where they open, which sets whose top bar stays live over them and the safe region the install
// steps' card sits in (overlayRegion): a home page's, or on a walk the walk bar.
export interface SettingsData extends OverlayData {
  readonly region: OverlayRegion;
}

// Sound on or off, music and effects volume, reduced motion and, until the game is installed,
// Install, reachable from the home screen and the pause menu. A page, not a modal, as Help is: it
// covers the screen under the top bar, which stays live over it, the home bar routed through it
// (listenHomeBar), its Menu opening the page's own Menu over it or returning to the Menu it opened
// from, and on a walk the walk bar, whose Pause closes it back to the pause menu (topBarAction).
// Back, Escape and the system back return to the screen it opened over; it has no outside. Every
// change is saved and applied at once. The build's label sits under the rows. A switch row is
// normal and shows its setting in its switch; it dips while held and flips as the tap lifts. A tap
// anywhere on the Install row, its Get button included, opens the browser's install prompt or,
// where the browser holds none, a modal card with that browser's own install steps over the page.
// Up and Down move the keyboard's focus through the rows and Back; Enter or Space presses the
// focused row, and on a slider the left and right keys, Home and End (the kit slider's) and A/D
// and H/L set the volume.
export class SettingsScene extends Scene {
  // The caller's safe region, where the install steps' card sits.
  private dim: Rect = SCREEN_LAYOUT.screen;
  private focus: Focus | null = null;
  // No rows until create measures their notes, so no font is read.
  private layout: SettingsLayout = settingsLayout(NO_FONTS, []);
  private pressed: Target | undefined;
  private resumeKey: SceneKey | undefined;
  private rows: readonly Row[] = SETTING_ROWS;
  // The install steps' card and the kind of steps it shows, and its shade over the canvas, while
  // it is open.
  private steps: OpenSteps | undefined;
  private stepsShade: readonly { destroy(): void }[] = [];
  // The scene owns settings and gestures; the native view owns their rendering.
  private html: DomSettings | undefined;

  constructor() {
    super(SCENE_KEYS.settings);
  }

  create(data: SettingsData): void {
    mountNativeOverlay(this, () => this.mount(data));
  }

  private mount(data: SettingsData): boolean {
    this.resumeKey = data.resume;
    this.dim = overlayRegion(data.region);
    this.rows = settingsRows(offersInstall(installState()));
    this.layout = settingsLayout(settingsFonts(this), rowShapes(this, this.rows));
    this.focus = null;
    this.pressed = undefined;
    this.steps = undefined;
    this.stepsShade = [];
    const place = htmlPanelPlace(this);
    // The page hides the screen roots under it but the live top bar's, as Help does; restored
    // before the page is disposed.
    const uncover =
      place === undefined
        ? undefined
        : coverHelpUnderlay(shownTopSectionRoots(this), place.layer.element);
    if (uncover !== undefined) {
      this.events.once(Scenes.Events.SHUTDOWN, uncover);
    }
    this.html = addHtmlSettings(this, {
      close: () => this.close(),
      closeSteps: () => this.closeSteps(),
      onFocus: (index) => {
        this.focus = index === null ? null : { column: 0, row: index };
      },
      press: {
        activate: (target) => this.tap(target),
        hold: (target) => {
          this.pressed = target;
          this.render();
        },
      },
      reducedMotion: () => currentSettings(this).reducedMotion,
      slide: {
        change: (key, steps) => this.change(setVolumeSteps(key, steps, currentSettings(this))),
        commit: (key) => this.sample(key),
      },
      view: this.view(),
    });
    if (this.html === undefined) {
      uncover?.();
      return false;
    }
    this.render();

    // The install row comes and goes as the game becomes installable or installed.
    const stopWatching = onInstallStateChange(() => this.scene.restart(data));
    this.events.once(Scenes.Events.SHUTDOWN, stopWatching);

    // The switch rows, which dip before they act, the install row, which dips as it opens the
    // browser's prompt or the steps' card, and the steps' card's close control.
    listenTargetPress<Target>(this, {
      dipMs: (target) =>
        target.kind === "switch" || target.kind === "install" ? FEEDBACK.pressDipMs : 0,
      onPressed: (target) => {
        this.pressed = target;
        this.render();
      },
      onTap: (target) => this.tap(target),
      opens: (target) => target.kind === "install",
      same: sameByValue,
      targetAt: (x, y) => this.targetAt(x, y),
    });
    // The system back closes the install steps' card first, then the page. A tap outside the
    // steps' card closes it (its backdrop); the page itself has no outside.
    onBackPressed(this, () => this.back());
    if (data.region === "home") {
      // The bar's Menu returns to the Menu the page opened from, else opens the page's own Menu.
      listenHomeBar(
        this,
        () => this.closeSteps(),
        (): MenuSceneData => ({
          context: "settings",
          onHeadHome: () => {
            this.close();
            requestTitleReturn(this);
          },
          resume: SCENE_KEYS.settings,
        }),
        data.resume === SCENE_KEYS.menu ? () => this.close() : undefined,
      );
    }
    // Sound on the top bar flips the sound switch here too.
    onSceneEvent(this, this.game.events, BAR_MUTED_EVENT, () => this.render());
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!sceneKeyAllowed(event)) {
        return;
      }
      if (!nativeSceneAccepts(this)) {
        return;
      }
      if (menuKeyActs(event.repeat, event.code)) {
        this.onKey(event.code);
      }
    });
    return true;
  }

  private onKey(code: string): void {
    if (this.steps !== undefined) {
      if (isPauseKey(code) || isConfirmKey(code)) {
        this.closeSteps();
      }
      return;
    }
    const focusedRow = this.focus === null ? undefined : this.rows[this.focus.row];
    if (focusedRow?.kind === "slider") {
      const settings = currentSettings(this);
      const current = volumeSteps(settings[focusedRow.key]);
      const steps = volumeStepForKey(code, current);
      if (steps !== undefined) {
        if (settings.muted) {
          this.refuseSlider(focusedRow.key);
        }
        if (!settings.muted && steps !== current) {
          this.change(setVolumeSteps(focusedRow.key, steps, settings));
          this.sample(focusedRow.key);
        }
        return;
      }
    }
    const direction = focusDirectionForKey(code);
    if (direction !== undefined) {
      // The rows, then Back, one per focus row.
      this.focus = moveFocus([...this.rows.map(() => 1), 1], direction, this.focus);
      this.render();
    } else if (isPauseKey(code)) {
      this.close();
    } else if (isConfirmKey(code)) {
      this.confirm(focusedRow);
    } else if (isMuteKey(code)) {
      this.flipAfterDip("muted");
    }
  }

  // Enter or Space flips a focused switch, presses Install, and closes from Back or with nothing
  // focused.
  private confirm(focusedRow: Row | undefined): void {
    if (focusedRow?.kind === "switch") {
      this.flipAfterDip(focusedRow.key);
    } else if (focusedRow?.kind === "button") {
      // Install opens at once, its dip playing on.
      this.pressed = { kind: "install" };
      this.render();
      this.install();
      this.time.delayedCall(FEEDBACK.pressDipMs, () => {
        this.pressed = undefined;
        this.render();
      });
    } else if (focusedRow === undefined) {
      this.close();
    }
  }

  private tap(target: Target): void {
    switch (target.kind) {
      case "install":
        this.install();
        return;
      case "stepsClose":
        this.closeSteps();
        return;
      case "switch":
        this.flip(target.key);
    }
  }

  // The browser's install prompt, asked for while the tap still counts as the player's
  // gesture, or the browser's own install steps when it holds no prompt.
  private install(): void {
    void installApp().then((outcome) => {
      if (outcome === "steps" && this.scene.isActive()) {
        this.openSteps(stepsKind());
      }
    });
  }

  private openSteps(kind: InstallStepsKind): void {
    const words = gameData.menuText.settings.installSteps[kind];
    const lines = stepsLines(this, words.steps);
    const ink = {
      steps: modalTextWidth(this, "body", lines),
      title: modalTextWidth(this, "title", [words.title]),
    };
    const preview = installStepsLayout(this.dim, lines.length, ink);
    const { extraHeight } = measureModalTitle(
      this,
      barTitleRoom(cardTitleRow(preview.card), preview.close),
      words.title,
    );
    this.steps = {
      ...installStepsLayout(this.dim, lines.length, {
        ...ink,
        titleExtraHeight: extraHeight,
      }),
      kind,
    };
    this.stepsShade = addRampDim(this);
    this.render();
  }

  private closeSteps(): void {
    if (this.steps === undefined) {
      return;
    }
    const row = this.rowIndex("install");
    this.steps = undefined;
    this.stepsShade.forEach((shade) => shade.destroy());
    this.stepsShade = [];
    this.pressed = undefined;
    this.focus = row < 0 ? null : { column: 0, row };
    this.render();
  }

  // Back closes the install steps first, then Settings.
  private back(): void {
    if (this.steps === undefined) {
      this.close();
    } else {
      this.closeSteps();
    }
  }

  private rowIndex(key: Row["key"]): number {
    return this.rows.findIndex((row) => row.key === key);
  }

  private rowRect(index: number): Rect {
    return itemAt(this.layout.rows, index).rect;
  }

  private targetAt(x: number, y: number): Target | undefined {
    if (!nativeSceneAccepts(this)) {
      return undefined;
    }
    if (this.steps !== undefined) {
      return containsPoint(this.steps.close.hit, x, y) ? { kind: "stepsClose" } : undefined;
    }
    const row = this.rows.find((_, i) => containsPoint(this.rowRect(i), x, y));
    if (row?.kind === "switch") {
      return { key: row.key, kind: "switch" };
    }
    return row?.kind === "button" ? { kind: "install" } : undefined;
  }

  // A key presses the switch row: it dips, then flips.
  private flipAfterDip(key: SwitchKey): void {
    this.pressed = { key, kind: "switch" };
    this.render();
    this.time.delayedCall(FEEDBACK.pressDipMs, () => this.flip(key));
  }

  private flip(key: SwitchKey): void {
    this.pressed = undefined;
    const settings = currentSettings(this);
    this.change({ ...settings, [key]: !settings[key] });
  }

  // A sample at a changed effects volume, after a key or as a drag or tap ends, so the player
  // hears what they picked.
  private sample(key: VolumeKey): void {
    if (key === "sfxVolume") {
      soundboardOf(this).play("tip");
    }
  }

  private change(settings: Settings): void {
    setSettings(this, settings);
    this.render();
  }

  // Closes the settings, as Back does, and as the walk bar's Pause does over them.
  close(): void {
    closeOverlay(this.resumeKey, this);
    this.game.events.emit(SETTINGS_CLOSED_EVENT);
  }

  // The page as it stands, measured on the scene's fonts.
  private view(): SettingsView {
    return settingsView(
      canvasSettingsMeasure(this),
      {
        art: (key) => {
          if (!this.textures.exists(key)) {
            return undefined;
          }
          const frame = this.textures.getFrame(key);
          return { height: frame.realHeight, width: frame.realWidth };
        },
        buildLabel: BUILD_LABEL,
        layout: this.layout,
        rows: this.rows,
        words: gameData.menuText.settings,
      },
      {
        dim: this.dim,
        focus: this.focus?.row ?? null,
        pressed: this.pressed,
        settings: currentSettings(this),
        steps: this.steps,
      },
    );
  }

  private render(): void {
    this.html?.update(this.view(), this.focus?.row ?? null);
  }

  private refuseSlider(key: VolumeKey): void {
    this.html?.refuse(this.rowIndex(key), currentSettings(this).reducedMotion);
  }
}

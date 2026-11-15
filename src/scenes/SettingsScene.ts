import { itemAt } from "@andornaut/game-kit/runtime/arrays";
import { containsPoint, type Rect } from "@andornaut/game-kit/runtime/rect";
import { fittingText } from "@andornaut/game-kit/runtime/text/textFit";
import { Scene, Scenes } from "phaser";

import { gameData } from "../data/index.ts";
import { SCREEN_CONFIG, SCREEN_LAYOUT } from "../data/screen.ts";
import { FEEDBACK } from "../home/feedback.ts";
import { type Focus, focusDirectionForKey, moveFocus } from "../home/focus.ts";
import { type OverlayRegion, overlayRegion } from "../home/homeBar.ts";
import {
  INSTALL_STEPS_FIT,
  type InstallStepsLayout,
  installStepsLayout,
  noteRoomForControl,
  SETTINGS_NOTE_STYLE,
  SETTINGS_ROW,
  type SettingsFonts,
  type SettingsLayout,
  settingsLayout,
  type SettingsRowShape,
  setVolumeSteps,
  type VolumeKey,
  volumeStepAt,
  volumeStepForKey,
  volumeSteps,
} from "../home/settings.ts";
import {
  hasNote,
  INSTALL_ROW,
  SETTING_ROWS,
  type SettingsRow,
  type SettingsTarget,
  type SettingsView,
  settingsView,
  type SwitchKey,
} from "../home/settingsView.ts";
import type { DomSettings } from "../hud/dom/settings.ts";
import { isConfirmKey, isMuteKey, isPauseKey, menuKeyActs } from "../input/keyBindings.ts";
import {
  installApp,
  installState,
  type InstallStepsKind,
  offersInstall,
  onInstallStateChange,
  stepsKind,
} from "../pwa/index.ts";
import type { Settings } from "../save/settings.ts";
import { barTitleRoom } from "../ui/barTitle.ts";
import { modalActionWidth } from "../ui/modal/layout.ts";
import { cardTitleRow } from "../ui/modal/titleRow.ts";
import {
  fitPixelText,
  labelInkWidth,
  pixelFontMetrics,
  setPixelText,
  withProbe,
} from "../ui/phaser/pixelText.ts";
import { addRampDim } from "../ui/phaser/rampDim.ts";
import { listenHomeBar, sceneRegionOutside } from "./homeBarPress.ts";
import { measureModalTitle, modalTextWidth } from "./modalMeasure.ts";
import { mountNativeOverlay } from "./nativeOverlayReady.ts";
import {
  BAR_MUTED_EVENT,
  closeOverlay,
  listenOutsideTap,
  nativeSceneAccepts,
  onBackPressed,
  onSceneEvent,
  type OverlayData,
} from "./overlay.ts";
import { currentSettings, setSettings } from "./profileStore.ts";
import { SCENE_KEYS, type SceneKey } from "./sceneKeys.ts";
import { addHtmlSettings } from "./settingsHtml.ts";
import { canvasSettingsMeasure } from "./settingsMeasure.ts";
import { soundboardOf } from "./soundboard.ts";
import { listenTargetPress, sameByValue, type TargetPressListener } from "./targetPress.ts";
import { BODY_TEXT } from "./uiKit.ts";

// Emitted on game.events when settings close.
export const SETTINGS_CLOSED_EVENT = "settings-closed";

// The open install steps' card, with the kind of steps it shows.
type OpenSteps = InstallStepsLayout & { readonly kind: InstallStepsKind };
type Row = SettingsRow;
type Target = SettingsTarget;

function settingsRows(installable: boolean): readonly Row[] {
  return installable ? [...SETTING_ROWS, INSTALL_ROW] : SETTING_ROWS;
}

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
    if (!hasNote(row)) {
      return { kind: row.kind };
    }
    const controlWidth =
      row.kind === "button"
        ? modalActionWidth(modalTextWidth(scene, "title", [words[row.button]]))
        : SETTINGS_ROW.switch.width;
    const { lines } = withProbe(scene, BODY_TEXT, (probe) =>
      fittingText(
        SETTINGS_NOTE_STYLE,
        labelInkWidth(probe),
        noteRoomForControl(controlWidth),
        words[row.note],
      ),
    );
    return {
      kind: row.kind,
      noteLines: lines.length,
      ...(row.kind === "button" ? { controlWidth } : {}),
    };
  });
}

const NO_FONT = { capHeight: 0, capTop: 0, inkBottom: 0, letterTop: 0, lineHeight: 0 };
const NO_FONTS: SettingsFonts = { body: NO_FONT, title: NO_FONT };

function settingsFonts(scene: Scene): SettingsFonts {
  return { body: pixelFontMetrics(scene, "body"), title: pixelFontMetrics(scene, "title") };
}

// What the settings are launched with: the scene under them, which they resume on close, and
// where they open, which sets the part of the screen they dim (overlayRegion): a home page under
// its lit top bar, whose buttons keep working (listenHomeBar), or the walk view the pause menu
// dims.
export interface SettingsData extends OverlayData {
  // The debuff bars showing under the walk bar: none on a home page.
  readonly debuffs: number;
  readonly region: OverlayRegion;
}

// Sound on or off, music and effects volume, reduced motion and, until the game is installed,
// Install, reachable from the home screen and the pause menu. The card draws over the screen it
// opens from, its dim part ramp-dimmed as under the pause menu. Every change is saved and applied
// at once. The build's label sits under the rows. A switch row is normal and shows its setting in
// its switch; a tap dips the row, then flips it. A tap anywhere on the Install row, its Get button
// included, dips it, then opens the browser's install prompt or, where the browser holds none, a
// card with that browser's own install steps over the settings. Up and Down move the keyboard's
// focus through the rows and the close control; Enter or Space presses the focused row, and on a
// slider the left and right keys, Home and End set the volume.
export class SettingsScene extends Scene {
  private dim: Rect = SCREEN_LAYOUT.screen;
  private dragging: VolumeKey | undefined;
  private focus: Focus | null = null;
  // No rows until create measures their notes, so no font is read.
  private layout: SettingsLayout = settingsLayout(NO_FONTS, SCREEN_CONFIG, []);
  private pressed: Target | undefined;
  private resumeKey: SceneKey | undefined;
  private rows: readonly Row[] = SETTING_ROWS;
  // The install steps' card and the kind of steps it shows, while it is open.
  private steps: OpenSteps | undefined;
  // The scene owns settings and gestures; the native view owns their rendering.
  private html: DomSettings | undefined;
  private presses: TargetPressListener<Target> | undefined;

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
    this.layout = settingsLayout(settingsFonts(this), SCREEN_CONFIG, rowShapes(this, this.rows));
    this.dragging = undefined;
    this.focus = null;
    this.pressed = undefined;
    this.steps = undefined;
    this.html = addHtmlSettings(this, {
      close: () => this.close(),
      closeSteps: () => this.closeSteps(),
      onFocus: (index) => {
        this.focus = index === null ? null : { column: 0, row: index };
      },
      press: {
        down: (target) => this.presses?.down(target),
        up: (released, cancelled) => this.presses?.up(released, cancelled),
      },
      slide: {
        end: (cancelled) => this.slideEnd(cancelled),
        move: (x) => this.slideTo(x),
        start: (key, x) => this.slideFrom(key, x),
      },
      view: this.view(),
    });
    if (this.html === undefined) {
      return false;
    }
    addRampDim(this, this.dim);
    this.render();

    // The install row comes and goes as the game becomes installable or installed.
    const stopWatching = onInstallStateChange(() => this.scene.restart(data));
    this.events.once(Scenes.Events.SHUTDOWN, stopWatching);

    // The close control, the switch rows, which dip before they act, the install row, which
    // dips as it opens the browser's prompt or the steps' card, and the steps' card's close
    // control.
    this.presses = listenTargetPress<Target>(this, {
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
    // The back button and a tap anywhere around the card close it, as the close control in its
    // band does: the dim, the lit top bar's empty area and, over the walk, the dog cards; the top
    // bar's buttons keep their own taps. While the steps' card is open, the back button and a
    // tap around that card close it, the settings card included. As listenDismiss, with the area
    // read as each press lands.
    onBackPressed(this, () => this.back());
    listenOutsideTap(
      this,
      () =>
        this.steps === undefined
          ? sceneRegionOutside(this, data.region, data.debuffs, [this.layout.panel])
          : sceneRegionOutside(this, data.region, data.debuffs, [this.steps.card]),
      () => this.back(),
    );
    // Over the walk, the HUD takes the walk bar's presses (topBarAction).
    if (data.region === "home") {
      listenHomeBar(this, () => this.close());
    }
    // Sound on the top bar flips the sound switch here too.
    onSceneEvent(this, this.game.events, BAR_MUTED_EVENT, () => this.render());
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
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
          // A sample at the new level, as after a drag.
          if (focusedRow.key === "sfxVolume") {
            soundboardOf(this).play("tip");
          }
        }
        return;
      }
    }
    const direction = focusDirectionForKey(code);
    if (direction !== undefined) {
      // The rows, then the close control, one per focus row.
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

  // Enter or Space flips a focused switch, presses Install, and closes from the close
  // control or with nothing focused.
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
      case "close":
        this.close();
        return;
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
    const preview = installStepsLayout(SCREEN_CONFIG, lines.length, ink);
    const { extraHeight } = measureModalTitle(
      this,
      barTitleRoom(cardTitleRow(preview.card), preview.close),
      words.title,
    );
    this.steps = {
      ...installStepsLayout(SCREEN_CONFIG, lines.length, {
        ...ink,
        titleExtraHeight: extraHeight,
      }),
      kind,
    };
    this.render();
  }

  private closeSteps(): void {
    this.steps = undefined;
    this.pressed = undefined;
    this.render();
  }

  // The back button and a tap outside the open card close the steps' card first.
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
    if (containsPoint(this.layout.close.hit, x, y)) {
      return { kind: "close" };
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

  // A press on a slider's row drags it, or, muted, is refused.
  private slideFrom(key: VolumeKey, x: number): void {
    if (this.steps !== undefined) {
      return;
    }
    if (currentSettings(this).muted) {
      this.refuseSlider(key);
      return;
    }
    this.dragging = key;
    this.slideTo(x);
    // The knob shows pressed while held.
    this.render();
  }

  private slideEnd(cancelled: boolean): void {
    if (this.dragging === undefined) {
      return;
    }
    // A sample at the new level, so the player hears what they picked.
    if (!cancelled && this.dragging === "sfxVolume") {
      soundboardOf(this).play("tip");
    }
    this.dragging = undefined;
    this.render();
  }

  private slideTo(x: number): void {
    const key = this.dragging;
    if (key === undefined) {
      return;
    }
    const settings = currentSettings(this);
    const steps = volumeStepAt(this.layout.track, x);
    if (steps !== volumeSteps(settings[key])) {
      this.change(setVolumeSteps(key, steps, settings));
    }
  }

  private change(settings: Settings): void {
    setSettings(this, settings);
    this.render();
  }

  // Closes the settings, as their close control does, and as the walk bar's Settings button
  // does over them (MenuFlow.closeSettings).
  close(): void {
    closeOverlay(this.resumeKey, this);
    this.game.events.emit(SETTINGS_CLOSED_EVENT);
  }

  // The card as it stands, measured on the scene's fonts.
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
        layout: this.layout,
        rows: this.rows,
        words: gameData.menuText.settings,
      },
      {
        dim: this.dim,
        dragging: this.dragging,
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

import { Scene, Scenes } from "phaser";

import { DEV_STATE_EVENT, devOverlayLines, type DevState } from "../dev/devOverlay.ts";
import { cheatsFrom, DEV_CHEATS_KEY } from "../dev/devPanelModel.ts";
import { mountDevOverlay } from "../dev/dom/devOverlay.ts";
import { pageRunSetup } from "../dev/pageRunSetup.ts";
import { runSetupLink } from "../dev/runSetup.ts";
import { uiLayer } from "../ui/dom/uiLayer.ts";
import { onSceneEvent } from "./overlay.ts";
import { SCENE_KEYS } from "./sceneKeys.ts";

const DEV_OVERLAY_SCENE_KEY = "dev-overlay";

const REDRAW_INTERVAL_MS = 250;
const STATUS_DURATION_MS = 2000;

// Starts with the game and runs for the page's life. It shows while the dev panel's "Show dev
// stats" cheat is on, read from the registry each frame, and draws only while the run scene is
// active. Listed last in the game config to draw over every scene.
// It learns about the run only from DEV_STATE_EVENT on game.events.
export class DevOverlayScene extends Scene {
  private runActive = false;
  private sinceRedrawMs = 0;
  private state: DevState | undefined;
  private status: { readonly text: string; readonly untilMs: number } | undefined;
  private view: ReturnType<typeof mountDevOverlay> | undefined;
  // Whether the Show dev stats cheat is on, apart from whether the run scene is up.
  private wanted = false;

  constructor() {
    super({ active: true, key: DEV_OVERLAY_SCENE_KEY });
  }

  create(): void {
    this.wanted = this.cheatOn();
    this.runActive = this.scene.isActive(SCENE_KEYS.run);
    this.mountView();
    this.events.once(Scenes.Events.SHUTDOWN, () => {
      this.view?.dispose();
      this.view = undefined;
    });
    this.applyVisible();

    onSceneEvent(this, this.game.events, DEV_STATE_EVENT, (state: DevState) => {
      this.state = state;
    });
    const runEvents = this.scene.get(SCENE_KEYS.run).events;
    const runListeners: readonly (readonly [string, () => void])[] = [
      [Scenes.Events.START, () => this.setRunActive(true)],
      [Scenes.Events.WAKE, () => this.setRunActive(true)],
      [Scenes.Events.SHUTDOWN, () => this.setRunActive(false)],
      [Scenes.Events.SLEEP, () => this.setRunActive(false)],
    ];
    for (const [event, listener] of runListeners) {
      onSceneEvent(this, runEvents, event, listener);
    }

    if (this.input.keyboard !== null) {
      onSceneEvent(this, this.input.keyboard, "keydown", (event: KeyboardEvent) => {
        if (event.code === "KeyC" && this.view?.visible() === true) {
          this.copyLink();
        }
      });
    }
  }

  override update(_time: number, delta: number): void {
    if (this.view === undefined) {
      this.mountView();
      this.applyVisible();
    }
    const wanted = this.cheatOn();
    if (wanted !== this.wanted) {
      this.wanted = wanted;
      this.applyVisible();
    }
    this.sinceRedrawMs += delta;
    if (this.sinceRedrawMs >= REDRAW_INTERVAL_MS) {
      this.redraw();
    }
  }

  private mountView(): void {
    const layer = uiLayer();
    if (layer !== undefined) {
      this.view = mountDevOverlay(document, layer);
    }
  }

  private cheatOn(): boolean {
    return cheatsFrom(this.registry.get(DEV_CHEATS_KEY)).devStats;
  }

  private setRunActive(active: boolean): void {
    this.runActive = active;
    this.applyVisible();
  }

  // The overlay draws while the cheat is on and only during a run: elsewhere it would cover the
  // home screen and the Pet shop.
  private applyVisible(): void {
    this.view?.setVisible(this.wanted && this.runActive);
    this.redraw();
  }

  private redraw(): void {
    this.sinceRedrawMs = 0;
    if (this.view?.visible() !== true) {
      return;
    }
    const now = this.time.now;
    if (this.status !== undefined && now >= this.status.untilMs) {
      this.status = undefined;
    }
    this.view.setLines(
      devOverlayLines(this.game.loop.actualFps, this.status?.text, this.setup(), this.state),
    );
  }

  // The running scene's setup once it reports one, else the URL's.
  private setup() {
    return this.state?.setup ?? pageRunSetup().setup;
  }

  // The link always goes to the console too: the clipboard needs a secure context and
  // permission, and is undefined without a secure context.
  private copyLink(): void {
    const link = runSetupLink(globalThis.location.href, this.setup());
    console.info(`Run link: ${link}`);
    const clipboard: Clipboard | undefined = globalThis.navigator.clipboard;
    if (clipboard === undefined) {
      this.showStatus("no clipboard: link in console");
      return;
    }
    clipboard.writeText(link).then(
      () => this.showStatus("link copied"),
      () => this.showStatus("copy failed: link in console"),
    );
  }

  private showStatus(text: string): void {
    this.status = { text, untilMs: this.time.now + STATUS_DURATION_MS };
    this.redraw();
  }
}

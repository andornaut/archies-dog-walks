import { type Point, type Rect } from "@andornaut/game-kit/runtime/rect";
import { Core, Scene, Scenes } from "phaser";

import { gameData } from "../data/index.ts";
import { SCREEN_LAYOUT } from "../data/screen.ts";
import { type ChoiceEntry } from "../hud/choiceCardView.ts";
import { type NativeChoiceCards, showChoiceCards } from "../hud/dom/choiceCards.ts";
import { type HoldPress, holdRule, startHold, tickHold } from "../input/hold.ts";
import { cardNumberForKey, menuKeyActs } from "../input/keyBindings.ts";
import { keyNumbersShown } from "../input/keyNumbers.ts";
import { pressDown, pressUp, type TargetPress } from "../input/targetPress.ts";
import { cardRowIn } from "../layout/cardLayout.ts";
import { type CardView, type Choice, MAX_CARD_OPTIONS } from "../rules/choices.ts";
import type { UiLayer } from "../ui/dom/uiLayer.ts";
import { rectIndexAt } from "../ui/grid.ts";
import { displayBitmapFont } from "../ui/phaser/displayText.ts";
import { addRampDim } from "../ui/phaser/rampDim.ts";
import { REFUSE } from "../ui/refuse.ts";
import { mountNativeOverlay } from "./nativeOverlayReady.ts";
import { createNativePicture } from "./nativePicture.ts";
import { nativeSceneAccepts, onSceneEvent } from "./overlay.ts";
import { currentSettings } from "./profileStore.ts";
import { followScene, htmlArtInput, htmlPanelPlace } from "./questionPanel.ts";
import { refuseMotion } from "./refuseMotion.ts";
import { SCENE_KEYS } from "./sceneKeys.ts";
import { type ScenePicture, showAsPicture } from "./scenePicture.ts";
import { guardScreenInput } from "./screenGuard.ts";

export interface CardSceneData {
  onChoose: (choice: Choice) => void;
  onHeadHome: (() => void) | null;
  picture?: ScenePicture;
  view: CardView;
}
const PRESS_RULE = {
  dipMs: () => 0,
  opens: () => false,
  same: (left: number, right: number | undefined) => left === right,
};

// Cards retain game-owned choice and hold state; their complete interface is native.
export class CardScene extends Scene {
  private chosen = false;
  private entries: readonly ChoiceEntry[] = [];
  private hold: HoldPress | undefined;
  private large: number | undefined;
  private native: NativeChoiceCards | undefined;
  private press: TargetPress<number> | undefined;
  private pressed: number | undefined;
  private rects: readonly Rect[] = [];
  private refusing = false;
  private drawn: (() => void) | undefined;
  private onChoose: (choice: Choice) => void = () => {};
  constructor(key: string = SCENE_KEYS.card) {
    super(key);
  }

  create(data: CardSceneData): void {
    this.chosen = false;
    this.hold = undefined;
    this.large = undefined;
    this.native = undefined;
    this.press = undefined;
    this.pressed = undefined;
    this.refusing = false;
    this.onChoose = data.onChoose;
    this.entries = [
      ...data.view.options.map((option) => ({
        choice: option.index,
        enabled: option.availability.enabled,
        option,
      })),
      ...(data.view.skip ? [{ choice: "skip" as const, enabled: true }] : []),
    ];
    this.rects = cardRowIn(SCREEN_LAYOUT.walkView, MAX_CARD_OPTIONS, this.entries.length);
    if (data.picture !== undefined) {
      showAsPicture(this, data.picture);
    }
    this.drawn = data.picture === undefined ? guardScreenInput(this).drawn : undefined;
    addRampDim(this);
    mountNativeOverlay(this, () => this.mount(data));
    if (data.picture !== undefined) {
      return;
    }
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!nativeSceneAccepts(this)) {
        return;
      }
      const number = cardNumberForKey(this.entries.length, event.code);
      if (number !== undefined && menuKeyActs(event.repeat, event.code)) {
        this.choose(number - 1);
      }
    });
    onSceneEvent(this, this.events, Scenes.Events.PAUSE, () => this.cancel());
  }

  private mount(data: CardSceneData): boolean {
    const place = htmlPanelPlace(this);
    if (place === undefined) {
      return false;
    }
    const source = {
      ...htmlArtInput(place),
      choose: (index: number) => this.choose(index),
      data: gameData,
      entries: this.entries,
      everyFrame: (step: () => void) => {
        this.game.events.on(Core.Events.PRE_RENDER, step);
        return () => this.game.events.off(Core.Events.PRE_RENDER, step);
      },
      fonts: {
        ...place.fonts,
        ...(displayBitmapFont(this) === undefined ? {} : { display: displayBitmapFont(this)! }),
      },
      headHome: data.onHeadHome,
      imageSize: (key: string) => {
        const frame = this.textures.getFrame(key);
        return { height: frame.realHeight, width: frame.realWidth };
      },
      keyed: data.picture === undefined && keyNumbersShown(),
      now: () => this.time.now,
      ...(this.drawn === undefined ? {} : { onPaint: this.drawn }),
      reduced: currentSettings(this).reducedMotion,
      subtitle: this.subtitle(data.view),
      view: data.view,
    };
    if (data.picture !== undefined) {
      this.mountPicture(place.layer, source, data.picture);
      return true;
    }
    const point = (event: PointerEvent) => source.toGame({ x: event.clientX, y: event.clientY });
    const panel = showChoiceCards(place.layer, {
      ...source,
      gesture: {
        cancel: () => this.cancel(),
        down: (event) => this.begin(point(event)),
        up: (event, cancelled) => this.release(point(event), cancelled),
      },
    });
    this.native = followScene(this, panel);
    return true;
  }

  private mountPicture(
    layer: UiLayer,
    source: Parameters<typeof showChoiceCards>[1],
    picture: ScenePicture,
  ): void {
    const host = createNativePicture(layer, picture);
    const panels = host.layers.map((context) =>
      showChoiceCards(context, { ...source, headHome: null, picture: true }),
    );
    this.events.once(Scenes.Events.SHUTDOWN, () => {
      panels.forEach((panel) => panel.destroy());
      host.dispose();
    });
  }

  private begin(point: Point): void {
    const index = rectIndexAt(this.rects, point.x, point.y);
    this.press = pressDown(this.time.now, index);
    this.pressed = index;
    this.native?.setPressed(index);
    this.hold =
      index === undefined
        ? undefined
        : startHold(holdRule(gameData.tuning, Number.POSITIVE_INFINITY), point, this.time.now);
  }
  private release(point: Point, cancelled: boolean): boolean {
    const index = rectIndexAt(this.rects, point.x, point.y);
    const result = pressUp(PRESS_RULE, this.time.now, cancelled, this.press, index);
    const handled = this.pressed !== undefined || this.large !== undefined;
    this.cancel();
    if (result.kind === "tap") {
      this.choose(result.target);
    }
    return handled;
  }
  private cancel(): void {
    this.hold = undefined;
    this.large = undefined;
    this.press = undefined;
    this.pressed = undefined;
    this.native?.setPressed(undefined);
    this.native?.setLarge(undefined);
  }
  holding(): boolean {
    return this.large !== undefined;
  }
  override update(): void {
    if (this.hold === undefined) {
      return;
    }
    const { fire, press } = tickHold(this.time.now, this.hold);
    this.hold = press;
    if (fire && this.pressed !== undefined) {
      const index = this.pressed;
      this.press = undefined;
      this.pressed = undefined;
      this.large = index;
      this.native?.setPressed(undefined);
      this.native?.setLarge(index);
    }
  }
  private choose(index: number): void {
    if (this.chosen || !nativeSceneAccepts(this)) {
      return;
    }
    const entry = this.entries[index];
    if (entry?.enabled) {
      this.chosen = true;
      this.onChoose(entry.choice);
    } else if (entry !== undefined && !this.refusing) {
      this.refusing = true;
      const motion = { x: 0 };
      let red = false;
      const paint = () => this.native?.setRefusal(index, motion.x, red);
      refuseMotion(this, currentSettings(this).reducedMotion, {
        complete: () => {
          this.refusing = false;
        },
        emphasis: (value) => {
          red = value;
          paint();
        },
        motion: { targets: [motion], update: paint, x: REFUSE.shake },
      });
    }
  }
  private subtitle(view: CardView): string {
    if (view.source.kind === "encounter") {
      const names = view.affected.map((dog) => gameData.dogs[dog].name);
      return names.length === 0 ? gameData.runText.card.pickOne : names.join(", ");
    }
    return view.source.kind === "fork" ? gameData.runText.card.forkSubtitle : "";
  }
}

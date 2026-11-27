import { animationKey } from "@andornaut/game-kit/runtime/art/aseprite";
import { guardSceneInput } from "@andornaut/game-kit/runtime/input/phaser/guardSceneInput";
import { Math as PhaserMath, Scene } from "phaser";

import { ZONE_CELEBRATION_ART as ART } from "../assets/index.ts";
import { playFirstTag } from "../assets/phaser/index.ts";
import { gameData, MENU_BUTTON_KEY_GAP } from "../data/index.ts";
import { showZoneCelebration } from "../hud/dom/index.ts";
import {
  CELEBRATION_LAYOUT as LAYOUT,
  celebrationAdvance,
  celebrationText,
  type ZoneCelebration,
  zoneCelebrationView,
} from "../hud/index.ts";
import {
  cardNumberForKey,
  isConfirmKey,
  keyNumbersShown,
  menuKeyActs,
  sceneKeyAllowed,
} from "../input/index.ts";
import type { DomQuestionPanel } from "../ui/dom/index.ts";
import { displayBitmapFont } from "../ui/phaser/index.ts";
import { addConfetti } from "./badges.ts";
import { canvasCelebrationMeasure } from "./modalMeasure.ts";
import { mountNativeOverlay } from "./nativeOverlayReady.ts";
import { closeOverlay, nativeSceneAccepts, type OverlayData } from "./overlay.ts";
import { currentSettings, walkerSpriteKey } from "./profileStore.ts";
import { followScene, htmlArtInput, htmlPanelPlace } from "./questionPanel.ts";
import { addRampDim } from "./rampDim.ts";
import { SCENE_KEYS } from "./sceneKeys.ts";
import { soundboardOf } from "./soundboard.ts";

export interface ZoneCelebrationSceneData extends OverlayData {
  celebration: ZoneCelebration;
  // Called once the celebration has closed.
  onDone: () => void;
  // Opens the pause menu over the celebration, which pauses it, as P does; the run
  // scene opens it on the phone's back button.
  openPause: () => void;
}

// Over the paused walk: between zones, the walker cheers on a starburst under the zone's name
// and earnings over a button, and waits for its button or key 1; before the end screen, a walker the
// walk unlocked hops in, greets the pack in a bubble with their agility and perk, and waits for
// Welcome! (key 1).
// Confetti falls in both, unless motion is reduced. Both require a fresh button press
// after their first drawn frame, with no timed delay.
export class ZoneCelebrationScene extends Scene {
  constructor() {
    super(SCENE_KEYS.zoneCelebration);
  }

  create(data: ZoneCelebrationSceneData): void {
    const reduced = currentSettings(this).reducedMotion;
    const guard = guardSceneInput(0, this);
    addRampDim(this);
    if (!reduced) {
      this.dropConfetti();
    }
    const text = celebrationText(gameData, data.celebration);
    const version = text.kind === "zoneDone" ? LAYOUT.zoneDone : LAYOUT.newWalker;
    if (this.textures.exists(ART.burst)) {
      this.add.image(version.burst.x, version.burst.y, ART.burst).setOrigin(0);
    }
    this.addWalker(data.celebration, reduced, version.feetY);
    // A finished neighbourhood plays its own sound; a walker unlocked plays the badge's.
    soundboardOf(this).play(text.kind === "zoneDone" ? "zoneDone" : "badge");

    const finish = celebrationAdvance({
      accepts: () => nativeSceneAccepts(this),
      close: () => closeOverlay(data.resume, this),
      done: data.onDone,
    });
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!nativeSceneAccepts(this) || !sceneKeyAllowed(event)) {
        return;
      }
      if (event.code === "Escape") {
        event.preventDefault();
        return;
      }
      if (!menuKeyActs(event.repeat, event.code)) {
        return;
      }
      if (event.code === "KeyP") {
        event.preventDefault();
        data.openPause();
      } else if (isConfirmKey(event.code) || cardNumberForKey(1, event.code) !== undefined) {
        event.preventDefault();
        finish();
      }
    });
    const keyed = keyNumbersShown() ? { gap: MENU_BUTTON_KEY_GAP } : undefined;
    let html: DomQuestionPanel | undefined;
    const mount = () => {
      if (html !== undefined) {
        return true;
      }
      const place = htmlPanelPlace(this);
      const display = displayBitmapFont(this);
      if (place === undefined || display === undefined) {
        return false;
      }
      const view = zoneCelebrationView(canvasCelebrationMeasure(this), keyed, text);
      html = followScene(
        this,
        showZoneCelebration(place.layer, {
          ...htmlArtInput(place),
          headline: { font: display, text },
          label: `${text.title} ${text.subtitle}`,
          onPaint: guard.drawn,
          press: finish,
          view,
        }),
      );
      return true;
    };
    mountNativeOverlay(this, mount);
  }

  // The walker's celebration at 2x, its frame's bottom centre on the feet line. Mr. B's welcome
  // prefers his phone animation. A new walker hops in from past the right edge, and fx-confetti
  // bursts as they land. Reduced motion shows the selected tag's first frame, in place.
  private addWalker(celebration: ZoneCelebration, reduced: boolean, feetY: number): void {
    const { centreX, runIn, walkerScale } = LAYOUT;
    const key = walkerSpriteKey(this, celebration.walker);
    const sprite = this.add.sprite(centreX, feetY, key).setOrigin(0.5, 1).setScale(walkerScale);
    const tags =
      celebration.kind === "newWalker" && celebration.walker === "mrB"
        ? ["phone", ...ART.walkerTags]
        : ART.walkerTags;
    playFirstTag(sprite, key, tags, reduced);
    if (reduced || celebration.kind === "zoneDone") {
      return;
    }
    sprite.setX(runIn.fromX);
    this.tweens.add({
      duration: runIn.durationMs,
      ease: "Cubic.easeOut",
      onComplete: () => addConfetti(this, false, 1, centreX, runIn.burstY),
      targets: sprite,
      x: centreX,
    });
  }

  // About LAYOUT.confetti.bits fx-confetti-bit, each a random colour from a random frame,
  // falling and swaying down the road view under everything else, from staggered starts within
  // fallMs.
  private dropConfetti(): void {
    const { bits, fallMs, fromX, fromY, sway, swayMs, toX, toY } = LAYOUT.confetti;
    const colours = ART.confettiBitTags.filter((tag) =>
      this.anims.exists(animationKey(ART.confettiBit, tag)),
    );
    if (colours.length === 0) {
      return;
    }
    for (let i = 0; i < bits; i++) {
      const colour = colours[PhaserMath.Between(0, colours.length - 1)] ?? colours[0];
      const animation = animationKey(ART.confettiBit, colour ?? "");
      const frames = this.anims.get(animation)?.frames.length ?? 1;
      const x = PhaserMath.Between(fromX, toX);
      const bit = this.add
        .sprite(x, fromY, ART.confettiBit)
        .setOrigin(0)
        .setVisible(false)
        .play({ key: animation, repeat: -1, startFrame: PhaserMath.Between(0, frames - 1) });
      // Each falls for at least half of fallMs, starting early enough to land within it.
      const duration = PhaserMath.Between(fallMs / 2, fallMs);
      const delay = PhaserMath.Between(0, fallMs - duration);
      const swaying = this.tweens.add({
        delay,
        duration: swayMs,
        ease: "Sine.easeInOut",
        repeat: -1,
        targets: bit,
        x: x + (i % 2 === 0 ? sway : -sway),
        yoyo: true,
      });
      this.tweens.add({
        delay,
        duration,
        onComplete: () => {
          swaying.remove();
          bit.destroy();
        },
        onStart: () => bit.setVisible(true),
        targets: bit,
        y: toY,
      });
    }
  }
}

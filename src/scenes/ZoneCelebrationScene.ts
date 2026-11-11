import { animationKey } from "@andornaut/game-kit/art/aseprite";
import { guardSceneInput } from "@andornaut/game-kit/input/phaser/guardSceneInput";
import type { Rect } from "@andornaut/game-kit/rect";
import { Math as PhaserMath, Scene } from "phaser";

import { ZONE_CELEBRATION_ART as ART } from "../assets/spriteKeys.ts";
import { gameData } from "../data/index.ts";
import { CELEBRATION_LAYOUT as LAYOUT } from "../hud/celebrationLayout.ts";
import { type ZoneCelebrationView, zoneCelebrationView } from "../hud/celebrationView.ts";
import { celebrationText, type ZoneCelebration } from "../hud/zoneCelebration.ts";
import { cardNumberForKey, isConfirmKey, isPauseKey, menuKeyActs } from "../input/keyBindings.ts";
import { keyNumbersShown } from "../input/keyNumbers.ts";
import { PALETTE } from "../ui/palette.ts";
import { fillRect } from "../ui/phaser/draw.ts";
import { addRampDim } from "../ui/phaser/rampDim.ts";
import { addConfetti } from "./badges.ts";
import { addCelebrationHeadline } from "./celebrationHeadline.ts";
import { addDetailText } from "./homePanels.ts";
import { addHtmlLabels } from "./htmlLabels.ts";
import { canvasCelebrationMeasure } from "./modalMeasure.ts";
import { closeOverlay, type OverlayData } from "./overlay.ts";
import { currentSettings, walkerSpriteKey } from "./profileStore.ts";
import { addHtmlZoneCelebration } from "./questionPanel.ts";
import { SCENE_KEYS } from "./sceneKeys.ts";
import { soundboardOf } from "./soundboard.ts";
import { playFirstTag } from "./sprites.ts";
import { listenTargetPress } from "./targetPress.ts";
import {
  addMenuButton,
  addPanel,
  addTapBurst,
  listenButtonTap,
  MENU_BUTTON_KEY_GAP,
} from "./uiKit.ts";

export interface ZoneCelebrationSceneData extends OverlayData {
  celebration: ZoneCelebration;
  // Called once the celebration has closed.
  onDone: () => void;
  // Opens the pause menu over the celebration, which pauses it, as P and Escape do; the run
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
  private done = false;

  constructor() {
    super(SCENE_KEYS.zoneCelebration);
  }

  create(data: ZoneCelebrationSceneData): void {
    this.done = false;
    const reduced = currentSettings(this).reducedMotion;
    addRampDim(this, LAYOUT.dim, guardSceneInput(0, this).drawn);
    if (!reduced) {
      this.dropConfetti();
    }
    const text = celebrationText(gameData, data.celebration);
    const version = text.kind === "zoneDone" ? LAYOUT.zoneDone : LAYOUT.newWalker;
    addCelebrationHeadline(this, text);
    if (this.textures.exists(ART.burst)) {
      this.add.image(version.burst.x, version.burst.y, ART.burst).setOrigin(0);
    }
    this.addWalker(data.celebration, reduced, version.feetY);
    // A finished neighbourhood plays its own sound; a walker unlocked plays the badge's.
    soundboardOf(this).play(text.kind === "zoneDone" ? "zoneDone" : "badge");

    const finish = () => {
      if (this.done) {
        return;
      }
      this.done = true;
      closeOverlay(data.resume, this);
      data.onDone();
    };
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!menuKeyActs(event.repeat, event.key)) {
        return;
      }
      if (isPauseKey(event.key)) {
        data.openPause();
      } else if (isConfirmKey(event.key) || cardNumberForKey(1, event.key) !== undefined) {
        finish();
      }
    });
    const keyed = keyNumbersShown() ? { gap: MENU_BUTTON_KEY_GAP } : undefined;
    const view = zoneCelebrationView(canvasCelebrationMeasure(this), keyed, text);
    // In HTML where the page's switch is on and its fonts are ready, else on the canvas; every
    // press bursts where it lands, as over the canvas's button.
    const html = addHtmlZoneCelebration(this, view, `${text.title} ${text.subtitle}`, finish);
    if (html !== undefined) {
      // The headline's display lettering too, which the celebration's dialog names.
      addHtmlLabels(this, undefined);
      listenTargetPress<never>(this, {
        onDown: (pointer) => addTapBurst(this, pointer.x, pointer.y),
        onPressed: () => undefined,
        onTap: () => undefined,
        targetAt: () => undefined,
      });
      return;
    }
    this.addPanel(view);
    this.addButton(view.button.rect, view.button.label, keyed !== undefined, finish);
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

  // The zone's earnings on a cream plate, the amounts in forest; or the walker's line in a
  // speech bubble whose tail points up at them, a dotted rule, and their agility over their perk
  // under it: as the view lays them out.
  private addPanel(view: ZoneCelebrationView): void {
    addPanel(this, view.frame.rect, view.frame.key);
    for (const art of view.art) {
      this.add.image(art.x, art.y, art.key).setOrigin(0);
    }
    const { rule } = view;
    if (rule !== undefined) {
      const dots = this.add.graphics();
      for (let i = 0; i < rule.dots; i++) {
        fillRect(dots, PALETTE.tan, {
          height: 1,
          width: 1,
          x: rule.fromX + i * rule.step,
          y: rule.y,
        });
      }
    }
    for (const text of view.texts) {
      addDetailText(this, undefined, text);
    }
    for (const { items } of view.rows) {
      for (const item of items) {
        if ("art" in item) {
          this.add.image(item.art.x, item.art.y, item.art.key).setOrigin(0);
        } else {
          addDetailText(this, undefined, item.text);
        }
      }
    }
  }

  // The version's button, with the key that presses it in its left end once a key has been
  // pressed.
  private addButton(place: Rect, label: string, keyed: boolean, onTap: () => void): void {
    const button = addMenuButton(this, place, label, {
      available: true,
      primary: true,
      ...(keyed ? { keyNumber: "1" } : {}),
    });
    listenButtonTap(this, button, onTap);
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

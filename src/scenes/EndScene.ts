import { itemAt } from "@andornaut/game-kit/arrays";
import { guardSceneInput } from "@andornaut/game-kit/input/phaser/guardSceneInput";
import type { Rect } from "@andornaut/game-kit/rect";
import { type GameObjects, Scene } from "phaser";

import { ownerFaceKey } from "../assets/spriteKeys.ts";
import { gameData } from "../data/index.ts";
import { SCREEN_CONFIG, SCREEN_LAYOUT } from "../data/screen.ts";
import { badgeStripHits, type BadgeView } from "../home/badgesView.ts";
import { END_LAYOUT } from "../home/endLayout.ts";
import { endScreenView } from "../home/endScreenView.ts";
import { closingLines, earningsBreakdown, type EndTarget, endTargetAt } from "../home/endView.ts";
import { bobOffset } from "../home/feedback.ts";
import {
  homecomers,
  type ReturnPhase,
  returnPhase,
  walkUpOffset,
  waveOffset,
} from "../home/returnHome.ts";
import type { DomEndScreen } from "../hud/dom/endScreen.ts";
import type { DomQuestionPanel } from "../hud/dom/questionPanel.ts";
import {
  type HoldPress,
  holdRule,
  moveHold,
  startHold,
  tickHold,
  TILE_SLOP_PX,
} from "../input/hold.ts";
import { isConfirmKey } from "../input/keyBindings.ts";
import { screenArea } from "../input/outsideTap.ts";
import { PackFigures } from "../pack/phaser/packFigures.ts";
import { stopWakeLock } from "../pwa/index.ts";
import type { LastWalk } from "../save/schema.ts";
import { PALETTE } from "../ui/palette.ts";
import { addDisplayText, hasDisplayFont } from "../ui/phaser/displayText.ts";
import { fillRect } from "../ui/phaser/draw.ts";
import { addPixelText, inkSpan } from "../ui/phaser/pixelText.ts";
import { onceBeforeRender } from "../ui/phaser/rampDim.ts";
import { TEXT_SCALE } from "../ui/textFit.ts";
import {
  addBadgeCelebration,
  addBurst,
  addCheeringFace,
  badgeCard,
  badgeCelebrationNames,
  drawBadgeCard,
  NEW_BEST_BURST,
} from "./badges.ts";
import { addDetailContent } from "./homePanels.ts";
import { canvasEndMeasure } from "./modalMeasure.ts";
import { listenOutsideTap, onBackPressed } from "./overlay.ts";
import { addOwnerFigure, ownerSpriteKey } from "./ownerFigure.ts";
import {
  currentSettings,
  lastRunEnd,
  profileSave,
  walkerInUse,
  walkerSpriteKey,
} from "./profileStore.ts";
import { addHtmlBadgeCard, addHtmlEndScreen } from "./questionPanel.ts";
import { SCENE_KEYS } from "./sceneKeys.ts";
import { soundboardOf } from "./soundboard.ts";
import { firstTag, playTag } from "./sprites.ts";
import { listenTargetPress, sameByValue, type TargetPressListener } from "./targetPress.ts";
import { addMenuButton, addPanel, addScreenBackdrop, addTapBurst } from "./uiKit.ts";

const END_SCREEN_KEY = "screen-end";
const LOGO = { ...END_LAYOUT.logo, key: "logo" };
const RIBBON = { ...END_LAYOUT.ribbon, dropMs: 360, key: "ui-new-best", riseFrom: 12 };
const RIBBON_BURST = END_LAYOUT.ribbonBurst;
const SIDE = END_LAYOUT.side;
const BADGE_SOUND_AFTER_BEST_MS = 1200;
const RETURN_HOME_SCENE = END_LAYOUT.returnHome;
const BUTTON: Rect = END_LAYOUT.button;
// An open badge's card, over the badges just earned.
const CARD_DEPTH = 2;

// The walk's result, already banked: what made up the total, zones walked, the bank, a ribbon
// for a new best walk, and a closing line from each owner. Badges the run earned burst in
// under the panel while the owners still walking cheer, and a tap or a hold on one opens its
// card, as on the Logbook. Back to title returns to the start screen. The screen takes no input
// until its first drawn frame; only a fresh press on a control can act.
export class EndScene extends Scene {
  // The badges just earned, in their slots' order.
  private badges: BadgeView[] = [];
  // The open badge's card.
  private card: GameObjects.Container | undefined;
  // A press on a badge, until its hold opens the card.
  private hold: { readonly badge: number; readonly press: HoldPress } | undefined;
  private presses: TargetPressListener | undefined;
  private reduced = false;
  // Back to title, which bobs as Start walk does, and still while pressed.
  private button: { readonly container: GameObjects.Container; pressed: boolean } | undefined;
  private returnHomeStep: (() => void) | undefined;
  // The screen's text, pips, bubbles and Back to title in HTML, where they draw there, and the
  // open badge's card.
  private html: DomEndScreen | undefined;
  private htmlCard: DomQuestionPanel | undefined;

  constructor() {
    super(SCENE_KEYS.end);
  }

  create(): void {
    soundboardOf(this).stopMusic();
    stopWakeLock();
    const save = profileSave(this);
    const walk = save.stats.lastWalk;
    const goHome = () => this.scene.start(SCENE_KEYS.start);
    this.returnHomeStep = undefined;
    this.button = undefined;
    this.html = undefined;
    this.htmlCard = undefined;
    this.badges = [];
    this.card = undefined;
    this.hold = undefined;
    if (walk === null) {
      goHome();
      return;
    }
    onceBeforeRender(this, guardSceneInput(0, this).drawn);
    const ended = lastRunEnd(this);
    const earned = ended?.achievements ?? [];
    const reduced = currentSettings(this).reducedMotion;
    this.reduced = reduced;
    addScreenBackdrop(this, END_SCREEN_KEY);
    this.addReturnHome(reduced, walk);
    // Over the house's roof, clear of the walker's head.
    if (this.textures.exists(LOGO.key)) {
      this.add.image(LOGO.x, LOGO.y, LOGO.key).setOrigin(0);
    }
    const resultsStart = this.children.getChildren().length;
    // A walk that earned nothing is no best, even the first.
    const newBest = ended?.newBestWalk === true && walk.earnedCents > 0;
    if (newBest && this.textures.exists(RIBBON.key)) {
      // Behind the panel, so the sparkles rise from behind the ribbon and never cover the title.
      // With reduced motion the burst holds one still frame.
      const { height, width, x, y } = RIBBON_BURST;
      addBurst(this, reduced, NEW_BEST_BURST, 1, x + width / 2, y + height / 2);
    }
    const view = endScreenView(gameData, canvasEndMeasure(this), {
      closing: closingLines(gameData, Math.random, walk),
      earned,
      lines:
        ended === null
          ? []
          : earningsBreakdown(gameData, ended.changes, {
              earned: walk.earnedCents,
              lost: ended.lostCents,
            }),
      stripNames: (strip, rows) => badgeCelebrationNames(this, strip, rows, earned, false),
      walk,
    });
    const { results, strip } = view;
    // In HTML where the page's switch is on and its fonts are ready, over the parts the canvas
    // keeps, else all on the canvas.
    const html = hasDisplayFont(this, results.title.text)
      ? addHtmlEndScreen(this, view)
      : undefined;
    this.html = html;
    addPanel(this, results.panel);
    const g = this.add.graphics();
    const { band } = results;
    fillRect(g, PALETTE[SIDE.band.outline], band.outline);
    fillRect(g, PALETTE[SIDE.band.fill], band.fill);
    fillRect(g, PALETTE[SIDE.band.lip], band.lip);
    fillRect(g, PALETTE.tan, results.rule);
    for (const well of results.wells) {
      fillRect(g, PALETTE.tan, well);
    }
    for (const face of results.faces) {
      if (face.cheering) {
        addCheeringFace(this, reduced, face.dog, face.x, face.y);
      } else {
        const key = ownerFaceKey(gameData, face.dog);
        const sprite = this.add.sprite(face.x, face.y, key).setOrigin(0);
        playTag(sprite, key, face.fired ? "fired" : "happy", reduced);
      }
    }
    if (html === undefined) {
      const { title } = results;
      addDisplayText(this, title.centreX, title.capTop, title.text, {
        colour: PALETTE.plum,
        font: "title",
        originX: 0.5,
        scale: TEXT_SCALE,
      });
    }
    if (newBest) {
      this.showRibbon(reduced);
      soundboardOf(this).play("newBest");
    }
    if (html === undefined) {
      for (const box of results.framed) {
        fillRect(g, box.fill, box.rect);
      }
      for (const bubble of results.bubbles) {
        addPanel(this, bubble, "ui-quip");
      }
      addDetailContent(this, this.add.container(0, 0), { ...results, framed: [] });
      // Each owner's name under the well, at 1x, its ink centred there.
      for (const name of results.names) {
        const label = addPixelText(this, 0, name.capTop, name.text, {
          colour: name.colour,
          scale: name.scale,
        });
        const ink = inkSpan(label);
        label.setX(name.centreX - (ink.right - ink.left) / 2 - ink.left);
      }
    }

    // Move the complete results group together, including its ribbon, bursts and owner rows.
    const resultObjects = this.children.getChildren().slice(resultsStart);
    this.add.container(0, view.offsetY).add(resultObjects);

    const celebrating = strip !== undefined;
    if (celebrating) {
      this.badges = addBadgeCelebration(
        this,
        reduced,
        strip.panel,
        strip.rows,
        earned,
        false,
        html === undefined,
      );
      // After a new best's fanfare, so the two do not play over each other.
      this.time.delayedCall(newBest ? BADGE_SOUND_AFTER_BEST_MS : 0, () =>
        soundboardOf(this).play("badge"),
      );
    }

    const words = gameData.menuText.end;
    const container = this.add.container(0, 0);
    const button =
      html === undefined
        ? addMenuButton(
            this,
            BUTTON,
            words.headHome,
            { available: true, labelAt: END_LAYOUT.buttonLabel, primary: true },
            container,
          )
        : undefined;
    this.button = { container, pressed: false };
    const badgeHits =
      strip === undefined ? [] : badgeStripHits(strip.panel, strip.rows, this.badges.length);
    // Badges have no tap action of their own, so a tap opens a badge's card as a hold does.
    // With a card open, a tap anywhere closes it.
    this.presses = listenTargetPress<EndTarget>(this, {
      onDown: (pointer, target) => {
        // Over the HTML, so a burst on Back to title shows over it.
        if (html === undefined) {
          addTapBurst(this, pointer.x, pointer.y);
        } else {
          html.burst({ x: pointer.x, y: pointer.y });
        }
        const at = { x: pointer.x, y: pointer.y };
        const rule = holdRule(gameData.tuning, TILE_SLOP_PX);
        this.hold =
          typeof target === "object"
            ? { badge: target.badge, press: startHold(rule, at, this.time.now) }
            : undefined;
      },
      onMove: (pointer) => {
        if (this.hold !== undefined && pointer.isDown) {
          const press = moveHold({ x: pointer.x, y: pointer.y }, this.hold.press);
          this.hold = { ...this.hold, press };
        }
      },
      onPressed: (target) => {
        const pressed = target === "home";
        button?.setPressed(pressed);
        if (this.button !== undefined) {
          this.button.pressed = pressed;
        }
        if (target === undefined) {
          this.hold = undefined;
        }
      },
      onTap: (target) => {
        if (target === "dismiss") {
          this.closeCard();
        } else if (target === "home") {
          goHome();
        } else {
          this.openCard(target.badge);
        }
      },
      same: sameByValue,
      targetAt: (x, y) =>
        endTargetAt({ badgeHits, button: BUTTON, cardOpen: this.card !== undefined }, x, y),
    });
    // A tap on the page beside the game closes an open card too.
    listenOutsideTap(
      this,
      () => (this.card === undefined ? undefined : screenArea([SCREEN_LAYOUT.screen])),
      () => this.closeCard(),
    );
    // Back to title is the page's way out, so Escape and back take it too, once any open card has
    // closed. P does not: a player pausing as the walk ends would skip the page. A key's
    // auto-repeat does nothing.
    const back = () => (this.card === undefined ? goHome() : this.closeCard());
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (!event.repeat && (isConfirmKey(event.code) || event.code === "Escape")) {
        back();
      }
    });
    onBackPressed(this, back);
  }

  // The badge's card over the screen, bursting with confetti as it opens (badgeCardView): in
  // HTML over the shared shade where the page's switch is on and its fonts are ready, else on the
  // canvas.
  private openCard(index: number): void {
    const badge = this.badges[index];
    if (badge === undefined) {
      return;
    }
    this.closeCard();
    const view = badgeCard(this, SCREEN_LAYOUT.screen, {
      badge,
      burst: true,
      reduced: this.reduced,
    });
    this.card = this.add.container(0, 0).setDepth(CARD_DEPTH);
    this.htmlCard = addHtmlBadgeCard(this, view);
    if (this.htmlCard === undefined) {
      drawBadgeCard(this, this.card, view);
    }
  }

  private closeCard(): void {
    this.htmlCard?.destroy();
    this.htmlCard = undefined;
    this.card?.destroy();
    this.card = undefined;
  }

  // The walker and the dogs still walking come up the front path from RETURN_HOME.risePx
  // under their spots (walkUpOffset), then their owners wave. Drawn before the panel, so the
  // pack rises from behind its top edge.
  private addReturnHome(reduced: boolean, walk: Pick<LastWalk, "dogs" | "firings">): void {
    const scene = RETURN_HOME_SCENE;
    if (!this.textures.exists(END_SCREEN_KEY)) {
      const ground = this.add.graphics();
      fillRect(ground, PALETTE.green, scene.lawn);
      fillRect(ground, PALETTE.darkGreen, { ...scene.lawn, height: 2 });
      fillRect(ground, PALETTE.tan, scene.path);
      fillRect(ground, PALETTE.brown, scene.step);
    }
    const dogs = homecomers(walk);
    const owners = dogs.map((dog, i) => {
      const at = itemAt(scene.owners, i);
      const sprite = addOwnerFigure(this, gameData, reduced, dog, { footY: at.y, x: at.x }, [
        "idle",
      ]);
      return { at, dog, sprite };
    });

    const pack = this.add.container(0, 0);
    const shadows = this.add.graphics();
    pack.add(shadows);
    const walkerKey = walkerSpriteKey(this, walkerInUse(profileSave(this)));
    const { walker: walkerAt } = scene;
    const figures = new PackFigures(this, { still: reduced, tag: "walk" }, walkerKey, dogs);
    const standing = dogs.map((dog, rank) => {
      const { x, y } = itemAt(scene.dogs, rank);
      const placement = { dx: x - walkerAt.x, footDy: y - walkerAt.y };
      return { dog, feet: { footY: y, x }, placement, rank };
    });
    figures.standInYard(
      shadows,
      { path: scene.path, shadows: true },
      {
        dogs: standing,
        walker: { footY: walkerAt.y, x: walkerAt.x },
      },
    );
    pack.add(figures.layers());

    // The game loop's time: in create, the scene clock still reads the time the scene booted
    // or last ran, until its first frame.
    const startedMs = this.game.loop.time;
    let shown: ReturnPhase | undefined;
    const step = () => {
      const elapsed = this.game.loop.time - startedMs;
      pack.setY(walkUpOffset(reduced, elapsed));
      const phase = returnPhase(reduced, elapsed);
      if (phase !== shown) {
        shown = phase;
        figures.play(reduced, phase === "walking" ? "walk" : "idle");
        for (const { dog, sprite } of owners) {
          const body = ownerSpriteKey(gameData, dog);
          const tag = firstTag(this, body, phase === "waving" ? ["wave", "idle"] : ["idle"]);
          if (sprite.texture.key === body && tag !== undefined) {
            playTag(sprite, body, tag, reduced);
          }
        }
      }
      for (const { at, dog, sprite } of owners) {
        const faceOnly = sprite.texture.key !== ownerSpriteKey(gameData, dog);
        sprite.setX(at.x + (faceOnly ? waveOffset(reduced, elapsed) : 0));
      }
    };
    step();
    this.returnHomeStep = step;
  }

  override update(): void {
    this.returnHomeStep?.();
    if (this.button !== undefined) {
      const { container, pressed } = this.button;
      const bob = pressed ? 0 : bobOffset(this.reduced, this.time.now, true);
      container.setY(bob);
      this.html?.setButton(pressed, bob);
    }
    if (this.hold !== undefined) {
      const { fire, press } = tickHold(this.time.now, this.hold.press);
      this.hold = { ...this.hold, press };
      // A hold opens the card while the finger is still down; its release then taps nothing.
      if (fire) {
        this.presses?.cancel();
        this.openCard(this.hold.badge);
      }
    }
  }

  // The new-best ribbon drops into place; with reduced motion it is simply there.
  private showRibbon(reduced: boolean): void {
    if (!this.textures.exists(RIBBON.key)) {
      addDisplayText(this, SCREEN_CONFIG.width / 2, RIBBON.y + 4, gameData.menuText.end.newBest, {
        colour: PALETTE.darkRed,
        font: "title",
        originX: 0.5,
        scale: TEXT_SCALE,
      });
      return;
    }
    const ribbon = this.add.image(RIBBON.x, RIBBON.y, RIBBON.key).setOrigin(0);
    if (reduced) {
      return;
    }
    ribbon.setY(RIBBON.y - RIBBON.riseFrom).setAlpha(0);
    this.tweens.add({
      alpha: 1,
      duration: RIBBON.dropMs,
      ease: "Back.easeOut",
      targets: ribbon,
      y: RIBBON.y,
    });
  }
}

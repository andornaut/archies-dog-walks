import { itemAt } from "@andornaut/game-kit/runtime/arrays";
import { guardSceneInput } from "@andornaut/game-kit/runtime/input/phaser/guardSceneInput";
import { type GameObjects, Scene } from "phaser";

import { firstTag, playTag } from "../assets/phaser/index.ts";
import { gameData, SCREEN_CONFIG } from "../data/index.ts";
import {
  BADGE_CHEER,
  BADGE_POP,
  type BadgeView,
  bobOffset,
  closingLines,
  earnedBadges,
  earningsBreakdown,
  END_LAYOUT,
  endScreenView,
  homecomers,
  type ReturnPhase,
  returnPhase,
  walkUpOffset,
  waveOffset,
} from "../home/index.ts";
import { nativeFrames } from "../home/phaser/index.ts";
import type { DomEndScreen } from "../hud/dom/index.ts";
import { isForegroundConfirmKey, isMuteKey, sceneKeyAllowed, screenArea } from "../input/index.ts";
import { SCREEN_LAYOUT } from "../layout/index.ts";
import { PackFigures } from "../pack/phaser/index.ts";
import { stopWakeLock } from "../pwa/index.ts";
import type { LastWalk } from "../save/index.ts";
import type { DomQuestionPanel } from "../ui/dom/index.ts";
import { PALETTE, TEXT_SCALE, topSectionButtonAt } from "../ui/index.ts";
import { fillRect, hasDisplayFont } from "../ui/phaser/index.ts";
import { addBurst, badgeCard, badgeCelebrationNames, NEW_BEST_BURST } from "./badges.ts";
import { routeHomeBar } from "./homeBarPress.ts";
import type { MenuSceneData } from "./MenuScene.ts";
import { canvasEndMeasure } from "./modalMeasure.ts";
import { BAR_MUTED_EVENT, listenOutsideTap, onBackPressed, openOverlay } from "./overlay.ts";
import { addOwnerFigure, ownerSpriteKey } from "./ownerFigure.ts";
import {
  currentSettings,
  isMuted,
  lastRunEnd,
  onSettingsChanged,
  profileSave,
  toggleMuted,
  walkerInUse,
  walkerSpriteKey,
} from "./profileStore.ts";
import {
  addHtmlBadgeCard,
  addHtmlEndScreen,
  htmlPanelInput,
  htmlPanelPlace,
} from "./questionPanel.ts";
import { onceBeforeRender } from "./rampDim.ts";
import { SCENE_KEYS } from "./sceneKeys.ts";
import { soundboardOf } from "./soundboard.ts";
import { listenTargetPress, sameByValue, type TargetPressListener } from "./targetPress.ts";
import { addNativeTopSection } from "./topSection.ts";
import { addScreenBackdrop } from "./uiKit.ts";

const END_SCREEN_KEY = "screen-end";
const END_BAR_BUTTONS = ["mute", "menu"] as const;
const LOGO = { ...END_LAYOUT.logo, key: "logo" };
const RIBBON = { ...END_LAYOUT.ribbon, dropMs: 360, key: "ui-new-best", riseFrom: 12 };
const RIBBON_BURST = END_LAYOUT.ribbonBurst;
const BADGE_SOUND_AFTER_BEST_MS = 1200;
const RETURN_HOME_SCENE = END_LAYOUT.returnHome;
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
  private presses: TargetPressListener | undefined;
  private reduced = false;
  private nativeStep: (() => void) | undefined;
  private beginNative: (() => void) | undefined;
  private returnHomeStep: (() => void) | undefined;
  // Native results and the open badge card.
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
    this.nativeStep = undefined;
    this.beginNative = undefined;
    this.html = undefined;
    this.htmlCard = undefined;
    this.badges = [];
    this.card = undefined;
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
    const topSection = addNativeTopSection(this, {
      accepts: () => true,
      buttons: END_BAR_BUTTONS,
      labels: {
        exit: gameData.homeText.quit.quit,
        menu: gameData.menuText.menu.title,
        mute: gameData.menuText.settings.sound,
        pause: gameData.menuText.pause.title,
      },
      muted: isMuted(this),
      press: (id) => {
        if (id !== "mute" && id !== "menu") {
          return;
        }
        if (routeHomeBar(this, id) || !this.sys.isActive() || !this.input.enabled) {
          return;
        }
        if (id === "mute") {
          this.game.events.emit(BAR_MUTED_EVENT, toggleMuted(this));
        } else {
          const data: MenuSceneData = {
            context: "end",
            onHeadHome: goHome,
            resume: SCENE_KEYS.end,
          };
          openOverlay(this, SCENE_KEYS.menu, data);
        }
      },
    });
    onSettingsChanged(this, ({ muted }) => topSection?.setMuted(muted));
    // Over the house's roof, clear of the walker's head.
    if (this.textures.exists(LOGO.key)) {
      this.add.image(LOGO.x, LOGO.y, LOGO.key).setOrigin(0);
    }
    const newBest = ended?.newBestWalk === true && walk.earnedCents > 0;
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
    this.badges = earnedBadges(gameData, earned);
    const targetAt = (x: number, y: number) =>
      topSectionButtonAt(END_BAR_BUTTONS, x, y) === undefined && this.card !== undefined
        ? ("dismiss" as const)
        : undefined;
    const place = htmlPanelPlace(this);
    const point = (event: PointerEvent) =>
      place === undefined
        ? undefined
        : htmlPanelInput(place).toGame({ x: event.clientX, y: event.clientY });
    const cancel = () => {
      this.presses?.cancel();
    };
    const ribbon = !newBest
      ? undefined
      : {
          art: this.textures.exists(RIBBON.key)
            ? {
                key: RIBBON.key,
                ...END_LAYOUT.ribbon,
                scale: 1,
                size: this.textures.getFrame(RIBBON.key),
              }
            : undefined,
          fallback: {
            capTop: RIBBON.y + 4,
            centre: "advance" as const,
            centreX: SCREEN_CONFIG.width / 2,
            colour: hasDisplayFont(this, gameData.menuText.end.newBest)
              ? PALETTE.yellow
              : PALETTE.darkRed,
            font: hasDisplayFont(this, gameData.menuText.end.newBest)
              ? ("display" as const)
              : ("title" as const),
            scale: hasDisplayFont(this, gameData.menuText.end.newBest) ? 1 : TEXT_SCALE,
            text: gameData.menuText.end.newBest,
          },
        };
    const html = addHtmlEndScreen(
      this,
      {
        badges: this.badges,
        gesture: {
          cancel,
          down: (event) => {
            const at = point(event);
            if (at !== undefined) {
              this.html?.burst(at);
              const target = targetAt(at.x, at.y);
              this.presses?.down(target);
            }
          },
          up: (event, cancelled) => {
            const at = point(event);
            this.presses?.up(at === undefined ? undefined : targetAt(at.x, at.y), cancelled);
            return true;
          },
        },
        home: goHome,
        openBadge: (index) => this.openCard(index),
        reduced,
        ribbon,
      },
      view,
    );
    this.html = html;
    const frame = nativeFrames();
    let facesStarted = this.time.now;
    const faces = results.faces.map(() => ({ y: 0 }));
    const ribbonMotion = {
      alpha: reduced || ribbon?.art === undefined ? 1 : 0,
      y: reduced || ribbon?.art === undefined ? 0 : -RIBBON.riseFrom,
    };
    html?.setRibbon(ribbonMotion.alpha, ribbonMotion.y);
    if (!reduced) {
      this.badges.forEach((_badge, index) => html?.setBadgePop(index, 0));
    }
    this.nativeStep = () => {
      results.faces.forEach((face, index) =>
        html?.setFace(
          index,
          frame(face.key, face.fired ? "fired" : "happy", reduced, this.time.now - facesStarted),
          faces[index]?.y ?? 0,
        ),
      );
      html?.setRibbon(ribbonMotion.alpha, ribbonMotion.y);
    };
    this.beginNative = () => {
      facesStarted = this.time.now;
      results.faces.forEach((face, index) => {
        if (face.cheering && !reduced) {
          this.tweens.add({
            duration: BADGE_CHEER.duration,
            ease: BADGE_CHEER.ease,
            hold: BADGE_CHEER.hold,
            repeat: -1,
            repeatDelay: BADGE_CHEER.repeatDelay,
            targets: faces[index],
            y: -BADGE_CHEER.rise,
            yoyo: true,
          });
        }
      });
      if (newBest) {
        if (ribbon?.art !== undefined) {
          const { height, width, x, y } = RIBBON_BURST;
          addBurst(this, reduced, NEW_BEST_BURST, 1, x + width / 2, y + height / 2 + view.offsetY);
          if (!reduced) {
            this.tweens.add({
              alpha: 1,
              duration: RIBBON.dropMs,
              ease: "Back.easeOut",
              targets: ribbonMotion,
              y: 0,
            });
          }
        }
        soundboardOf(this).play("newBest");
      }
      if (strip !== undefined) {
        this.badges.forEach((_badge, index) => {
          if (reduced) {
            html?.burstBadge(index);
            return;
          }
          this.time.delayedCall(index * BADGE_POP.delayMs, () => {
            html?.burstBadge(index);
            const pop = { scale: 0 };
            this.tweens.add({
              duration: BADGE_POP.durationMs,
              ease: BADGE_POP.ease,
              onUpdate: () => html?.setBadgePop(index, pop.scale),
              scale: 1,
              targets: pop,
            });
          });
        });
        this.time.delayedCall(newBest ? BADGE_SOUND_AFTER_BEST_MS : 0, () =>
          soundboardOf(this).play("badge"),
        );
      }
    };
    // Shared native badge controls own tap and hold. The remaining scene target only
    // dismisses an open card when its backdrop is tapped.
    this.presses = listenTargetPress<"dismiss">(this, {
      onPressed: () => undefined,
      onTap: () => this.closeCard(),
      same: sameByValue,
      targetAt,
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
      if (!sceneKeyAllowed(event)) {
        return;
      }
      if ((this.htmlCard ?? this.html)?.accepts() !== true) {
        return;
      }
      // M is the top bar's Sound, which an open card leaves dimmed and inactive.
      if (!event.repeat && isMuteKey(event.code)) {
        if (this.card === undefined) {
          this.game.events.emit(BAR_MUTED_EVENT, toggleMuted(this));
        }
        return;
      }
      if (!event.repeat && (isForegroundConfirmKey(event.code) || event.code === "Escape")) {
        back();
      }
    });
    onBackPressed(this, () => {
      if ((this.htmlCard ?? this.html)?.accepts() === true) {
        back();
      }
    });
  }

  // A native badge card over the dimmed result screen and world.
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
    this.htmlCard = addHtmlBadgeCard(this, view, () => this.closeCard());
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
    if (this.beginNative !== undefined && this.html?.accepts() === true) {
      const begin = this.beginNative;
      this.beginNative = undefined;
      begin();
    }
    this.nativeStep?.();
    this.html?.setBackToTitle(false, bobOffset(this.reduced, this.time.now, true));
  }
}

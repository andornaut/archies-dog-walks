import { insetRect, type Point, type Rect, ringRects } from "@andornaut/game-kit/runtime/rect";
import type { Scene, Tweens } from "phaser";

import type { DogId } from "../data/ids.ts";
import { CHANGE_CHIP, gameData, SCREEN_CONFIG } from "../data/index.ts";
import type { HudMoment, HudMomentPainter } from "../hud/dom/index.ts";
import {
  arcControl,
  cardHearts,
  type ChangeLabel,
  collisionHeartRow,
  FEEDBACK,
  FLY_HEART,
  heartNoticeLayout,
  heartPopBlocked,
  heartPopCovers,
  heartPopFrame,
  REACH_ICON,
  reachIconBeside,
} from "../hud/index.ts";
import { SCREEN_LAYOUT } from "../layout/index.ts";
import { slotIndexOf } from "../state/index.ts";
import { lineInk, PALETTE, plainMarks, TEXT_SCALE } from "../ui/index.ts";
import { arcFlight } from "./arcFlight.ts";
import { FEEDBACK_ART } from "./feedbackArt.ts";
import { HUD_DEPTH } from "./hudDepth.ts";
import type { HudWalk } from "./hudWalk.ts";
import { TimedGroup } from "./timedGroup.ts";
const CHIP_PAD = 4;
const OVER_CARD = 8;
const HEART_CELL = { height: 7, width: 8 } as const;
const FORGIVEN_PERK = { gap: 2, size: 16 } as const;
interface HeartPop {
  delayMs: number;
  dogTop: Point;
  label: ChangeLabel;
  lane: Rect;
  slot: number;
  to: Point;
}
interface ActivePop {
  covers: Rect[];
  land: () => void;
  parts: HudMoment[];
  tween: Tweens.Tween | undefined;
}
interface HeartHooks {
  clearOf: () => readonly Rect[];
  flashCard: (slot: number) => void;
  landed: (label: ChangeLabel, lane: Rect) => void;
  painter: HudMomentPainter;
  still: () => boolean;
  tabTop: number;
}
// Scene timers own pause and flight; native card and moment renderers own their pixels.
export class HeartFeedback {
  private readonly active = new Set<ActivePop>();
  private readonly group = new TimedGroup();
  private readonly hooks: HeartHooks;
  private readonly scene: Scene;
  constructor(scene: Scene, hooks: HeartHooks) {
    this.hooks = hooks;
    this.scene = scene;
  }
  hold(paused: boolean): void {
    this.group.hold(paused);
  }
  play(pop: HeartPop): void {
    if (pop.delayMs > 0) {
      this.group.after(this.scene, pop.delayMs, () => this.show(pop));
    } else {
      this.show(pop);
    }
  }
  forgive(at: Point, perkKey: string): void {
    const { blinkMs, blinks } = FEEDBACK.forgiven;
    const markMs = blinkMs * (2 * blinks - 1);
    const marks = this.hooks.painter.group(HUD_DEPTH.heart);
    for (const rect of ringRects(1, insetRect(-1, { ...HEART_CELL, ...at }))) {
      marks.panel(rect, undefined, { border: PALETTE.amber, fill: PALETTE.amber });
    }
    const { gap, size } = FORGIVEN_PERK;
    marks.art({
      at: {
        x: at.x + HEART_CELL.width + gap,
        y: at.y + Math.floor((HEART_CELL.height - size) / 2),
      },
      image: { height: size, width: size },
      key: perkKey,
    });
    const sparkle = this.hooks.painter.group(HUD_DEPTH.heart);
    sparkle.art({
      at: { x: at.x + 4, y: at.y + 3 },
      key: "fx-sparkle",
      onComplete: () => sparkle.dispose(),
      origin: { x: 0.5, y: 0.5 },
      tags: ["play"],
    });
    const empty = this.hooks.painter.group(HUD_DEPTH.heart);
    empty.art({ at, key: "ui-heart", tags: ["empty-dark"] });
    this.group.every(this.scene, blinkMs, 2 * blinks - 2, () => {
      empty.state.visible = !empty.state.visible;
    });
    this.group.after(this.scene, markMs, () => {
      marks.dispose();
      empty.dispose();
    });
  }
  clearWay(): void {
    const clearOf = this.hooks.clearOf();
    for (const active of [...this.active]) {
      if (heartPopBlocked(clearOf, active.covers)) {
        active.tween?.remove();
        active.parts.forEach((part) => part.dispose());
        this.finish(active);
      }
    }
  }
  private show(pop: HeartPop): void {
    const loss = pop.label.amount < 0;
    const art = loss ? FEEDBACK_ART.heartLoss : FEEDBACK_ART.heartGain;
    const hasArt = this.hooks.painter.hasArt(art.key);
    if (!hasArt && pop.label.collision?.forgivenAtMs === undefined) {
      this.land(loss, pop);
      return;
    }
    const { to } = pop;
    const number = this.addNumber(pop.label, heartPopFrame(pop.dogTop), art.popInk);
    if (!hasArt) {
      number.chip.dispose();
      this.land(loss, pop);
      return;
    }
    const { frame } = number;
    const half = FLY_HEART.frame / 2;
    const centre = { x: frame.x + half, y: frame.y + half };
    const covers = heartPopCovers({ chip: number.rect, frame, to }, FEEDBACK.heart.peak);
    if (heartPopBlocked(this.hooks.clearOf(), covers)) {
      number.chip.dispose();
      this.land(loss, pop);
      return;
    }
    const heart = this.hooks.painter.group(HUD_DEPTH.heart);
    heart.state.x = centre.x;
    heart.state.y = centre.y;
    const active: ActivePop = {
      covers,
      land: () => this.land(loss, pop),
      parts: [heart, number.chip],
      tween: undefined,
    };
    this.active.add(active);
    const playback = heart.art({
      at: { x: 0, y: 0 },
      key: art.key,
      onComplete: () => {
        number.chip.dispose();
        heart.dispose();
        if (this.hooks.still()) {
          this.finish(active);
          return;
        }
        const flying = this.hooks.painter.group(HUD_DEPTH.heart);
        flying.state.x = centre.x;
        flying.state.y = centre.y;
        flying.art({
          at: { x: 0, y: 0 },
          key: art.key,
          loop: true,
          origin: { x: 0.5, y: 0.5 },
          tags: [art.fly],
        });
        const reach = pop.label.reachIcon;
        if (reach !== undefined) {
          flying.art({
            at: reachIconBeside({ x: 0, y: 0 }),
            image: { height: REACH_ICON.size, width: REACH_ICON.size },
            key: reach,
          });
        }
        active.parts.push(flying);
        active.tween = this.group.tween(
          this.scene,
          arcFlight(
            { control: arcControl(centre, to, FEEDBACK.heart.peak), from: centre, to },
            {
              duration: FEEDBACK.heart.flyMs,
              ease: "Sine.easeIn",
              onComplete: () => {
                flying.dispose();
                this.finish(active);
              },
            },
            (point) => {
              flying.state.x = point.x;
              flying.state.y = point.y;
            },
          ),
        );
      },
      origin: { x: 0.5, y: 0.5 },
      ...(pop.label.collision === undefined ? {} : { projection: "layout" }),
      tags: [art.pop],
    });
    const missing = () => {
      if (this.active.has(active)) {
        active.parts.forEach((part) => part.dispose());
        this.finish(active);
      }
    };
    void playback.ready.then((frames) => {
      if (frames.length === 0) {
        missing();
      }
    }, missing);
  }
  private finish(active: ActivePop): void {
    if (!this.active.delete(active)) {
      return;
    }
    active.land();
  }
  private addNumber(
    label: ChangeLabel,
    frame: Point,
    artInk: { bottom: number; left: number; right: number; top: number },
  ): {
    chip: HudMoment;
    frame: Point;
    rect: Rect;
  } {
    const text = `${label.amount < 0 ? "−" : "+"}${Math.abs(label.amount)}`;
    const { bottom, left, right, top } = lineInk(
      this.hooks.painter.fonts.title,
      plainMarks(text),
      TEXT_SCALE,
    );
    const size = {
      height: Math.ceil(bottom - top) + 2 * CHIP_PAD,
      width: Math.ceil(right - left) + 2 * CHIP_PAD,
    };
    const bottomEdge = this.hooks.tabTop - 1;
    let placed = heartNoticeLayout(
      { bottom: bottomEdge, screenWidth: SCREEN_CONFIG.width },
      { chip: size, frame, inkRight: artInk.right },
    );
    if (label.collision !== undefined) {
      const { forgivenAtMs, head } = label.collision;
      const topEdge = SCREEN_LAYOUT.walkView.y;
      const slots = [{ ...size, padX: CHIP_PAD }];
      if (forgivenAtMs !== undefined) {
        const ink = lineInk(this.hooks.painter.fonts.body, gameData.runText.forgiven, TEXT_SCALE);
        slots.push({
          height: Math.max(CHANGE_CHIP.height, ink.bottom - ink.top + 2 * CHANGE_CHIP.padY),
          padX: CHANGE_CHIP.padX,
          width: ink.right - ink.left + 2 * CHANGE_CHIP.padX,
        });
      }
      const { chips, frame } = collisionHeartRow(
        { height: bottomEdge - topEdge, width: SCREEN_CONFIG.width, x: 0, y: topEdge },
        head,
        {
          height: artInk.bottom - artInk.top,
          width: artInk.right - artInk.left,
          x: artInk.left,
          y: artInk.top,
        },
        slots,
      );
      placed = { chip: chips[0]!, frame };
      if (forgivenAtMs !== undefined) {
        const rect = chips[1]!;
        const show = () => this.showForgiven(rect);
        if (forgivenAtMs === 0) {
          show();
        } else {
          this.group.after(this.scene, forgivenAtMs, show);
        }
      }
    }
    const chip = this.hooks.painter.group(HUD_DEPTH.heart);
    chip.panel(placed.chip);
    chip.text({
      anchor: "ink",
      backing: placed.chip,
      capTop: placed.chip.y + CHIP_PAD,
      colour: label.amount < 0 ? PALETTE.darkRed : PALETTE.forest,
      font: "title",
      lines: [text],
      scale: TEXT_SCALE,
      x: placed.chip.x + CHIP_PAD,
    });
    return { chip, frame: placed.frame, rect: placed.chip };
  }
  private showForgiven(rect: Rect): void {
    if (heartPopBlocked(this.hooks.clearOf(), [rect])) {
      return;
    }
    const caption = this.hooks.painter.group(HUD_DEPTH.heart);
    caption.panel(rect);
    caption.text({
      backing: rect,
      capTop: rect.y,
      colour: PALETTE.forest,
      font: "body",
      lines: [gameData.runText.forgiven],
      scale: TEXT_SCALE,
      x: rect.x,
    });
    const { holdMs, ms, rise } = FEEDBACK.forgiven;
    this.group.tween(this.scene, {
      alpha: 0,
      delay: holdMs,
      duration: ms - holdMs,
      onComplete: () => caption.dispose(),
      targets: caption.state,
      y: this.hooks.still() ? 0 : -rise,
    });
  }
  private land(loss: boolean, pop: HeartPop): void {
    this.hooks.landed(pop.label, pop.lane);
    if (loss) {
      this.hooks.flashCard(pop.slot);
    }
  }
}
// One queued pop per actual heart change, anchored to the road dog or its native card.
export function heartPops(
  hud: {
    lanes: readonly Rect[];
    run: Pick<HudWalk, "dogPoint" | "hudView">;
  },
  labels: readonly ChangeLabel[],
  slotOf: (slot: number) => Point | undefined,
): HeartPop[] {
  const pack = hud.run.hudView()?.run.pack ?? [];
  const shown = new Map<DogId, number>();
  return labels.flatMap((label): HeartPop[] => {
    if (label.target.kind !== "dog") {
      return [];
    }
    const { cell, dog } = label.target;
    const slot = slotIndexOf(pack, dog);
    const lane = hud.lanes[slot];
    const view = slotOf(slot);
    const heart = cardHearts(0, cell + 1)[cell];
    if (lane === undefined || view === undefined || heart === undefined) {
      return [];
    }
    const before = shown.get(dog) ?? 0;
    shown.set(dog, before + 1);
    const over = { x: lane.x + Math.round(lane.width / 2), y: view.y - OVER_CARD };
    return [
      {
        delayMs: label.collision?.delayMs ?? before * FEEDBACK.heart.staggerMs,
        dogTop: hud.run.dogPoint(dog) ?? over,
        label,
        lane,
        slot,
        to: {
          x: view.x + heart.x + HEART_CELL.width / 2,
          y: view.y + heart.y + HEART_CELL.height / 2,
        },
      },
    ];
  });
}

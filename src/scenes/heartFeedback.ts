import { insetRect, type Point, type Rect, ringRects } from "@andornaut/game-kit/rect";
import { laidGlyphs } from "@andornaut/game-kit/text/bitmapFont";
import type { Scene, Tweens } from "phaser";

import { SCREEN_CONFIG } from "../data/screen.ts";
import type { DogId } from "../data/types.ts";
import type { HudMoment, HudMomentPainter } from "../hud/dom/hudMoments.ts";
import {
  FEEDBACK,
  heartNoticeLayout,
  heartPopBlocked,
  heartPopCovers,
  heartPopFrame,
  reachIconBeside,
} from "../hud/feedback.ts";
import type { ChangeLabel } from "../hud/hudView.ts";
import { arcControl } from "../hud/moments.ts";
import { slotIndexOf } from "../state/pack.ts";
import { PALETTE } from "../ui/palette.ts";
import { plainMarks } from "../ui/pixelFont.ts";
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
    if (!this.hooks.painter.hasArt(art.key)) {
      this.land(loss, pop);
      return;
    }
    const to = { x: pop.lane.x + Math.round(pop.lane.width / 2), y: pop.lane.y };
    const number = this.addNumber(pop.label, heartPopFrame(pop.dogTop), art.popInk.right);
    const { frame } = number;
    const centre = { x: frame.x + 16, y: frame.y + 16 };
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
            image: { height: 16, width: 16 },
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
    inkRight: number,
  ): {
    chip: HudMoment;
    frame: Point;
    rect: Rect;
  } {
    const text = `${label.amount < 0 ? "−" : "+"}${Math.abs(label.amount)}`;
    const glyphs = laidGlyphs(this.hooks.painter.fonts.title, 2, plainMarks(text)).flatMap(
      ({ ink }) => (ink === null ? [] : [ink]),
    );
    const left = Math.min(...glyphs.map((ink) => ink.left));
    const right = Math.max(...glyphs.map((ink) => ink.right));
    const rows = [...plainMarks(text)].flatMap((char) => {
      const glyph = this.hooks.painter.fonts.title.glyphs.get(char);
      return glyph !== undefined && glyph.width > 0 && glyph.height > 0 ? [glyph] : [];
    });
    const top = Math.min(...rows.map((glyph) => glyph.yOffset * 2));
    const bottom = Math.max(...rows.map((glyph) => (glyph.yOffset + glyph.height) * 2));
    const size = {
      height: Math.ceil(bottom - top) + 2 * CHIP_PAD,
      width: Math.ceil(right - left) + 2 * CHIP_PAD,
    };
    const placed = heartNoticeLayout(
      { bottom: this.hooks.tabTop - 1, screenWidth: SCREEN_CONFIG.width },
      { chip: size, frame, inkRight },
    );
    const chip = this.hooks.painter.group(HUD_DEPTH.heart);
    chip.panel(placed.chip);
    chip.text({
      anchor: "ink",
      backing: placed.chip,
      capTop: placed.chip.y + CHIP_PAD,
      colour: label.amount < 0 ? PALETTE.darkRed : PALETTE.forest,
      font: "title",
      lines: [text],
      scale: 2,
      x: placed.chip.x + CHIP_PAD,
    });
    return { chip, frame: placed.frame, rect: placed.chip };
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
    const { dog } = label.target;
    const slot = slotIndexOf(pack, dog);
    const lane = hud.lanes[slot];
    const view = slotOf(slot);
    if (lane === undefined || view === undefined) {
      return [];
    }
    const before = shown.get(dog) ?? 0;
    shown.set(dog, before + 1);
    const over = { x: lane.x + Math.round(lane.width / 2), y: view.y - OVER_CARD };
    return [
      {
        delayMs: before * FEEDBACK.heart.staggerMs,
        dogTop: hud.run.dogPoint(dog) ?? over,
        label,
        lane,
        slot,
      },
    ];
  });
}

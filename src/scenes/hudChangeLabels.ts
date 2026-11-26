import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";
import { inkWidth } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { fittingText } from "@andornaut/game-kit/runtime/text/textFit";
import type { Scene } from "phaser";

import { SCREEN_CONFIG } from "../data/index.ts";
import type { HudMoment, HudMomentPainter } from "../hud/dom/index.ts";
import {
  cashChipPlace,
  CHANGE_LABEL_STYLE,
  changeChipPlace,
  type ChangeLabel,
  changeLabelRoom,
  FEEDBACK,
  freeCashSlot,
  LABEL_FADE_MS,
  mergeTips,
  MONEY_LABEL,
  moneyChipPlace,
  moneyFlightPath,
  REACH_ICON,
  reachChipPlace,
  stackOrders,
} from "../hud/index.ts";
import { pixelFontMetrics } from "../ui/phaser/index.ts";
import { arcFlight } from "./arcFlight.ts";
import { changeLabelColour } from "./changeLabelColours.ts";
import { HUD_DEPTH } from "./hudDepth.ts";
import type { TimedGroup } from "./timedGroup.ts";

// A change label's parts on screen, and its chip's rect.
interface ChangeChip {
  parts: HudMoment[];
  rect: Rect;
}
// The tip label showing by the cash before it goes in: its label, its chip, its slot in the
// cash's column, and the money it keeps off the counter until it lands.
interface ShowingTip {
  chip: ChangeChip;
  held: number;
  label: ChangeLabel;
  slot: number;
}

export class HudChangeLabels {
  private readonly scene: Scene;
  private readonly labels: Pick<TimedGroup, "after" | "tween">;
  private readonly painter: Pick<HudMomentPainter, "fonts" | "group" | "hasArt">;
  private readonly reducedMotion: () => boolean;
  private readonly cashSlots = new Set<number>();
  private tip: ShowingTip | undefined;
  // Money still flying to the cash, which the counter leaves out until it lands.
  private heldMoney = 0;

  constructor(
    scene: Scene,
    hooks: {
      labels: Pick<TimedGroup, "after" | "tween">;
      painter: Pick<HudMomentPainter, "fonts" | "group" | "hasArt">;
      reducedMotion: () => boolean;
    },
  ) {
    this.scene = scene;
    this.labels = hooks.labels;
    this.painter = hooks.painter;
    this.reducedMotion = hooks.reducedMotion;
  }

  get inFlight(): number {
    return this.heldMoney;
  }

  showMoneyChanges(labels: readonly ChangeLabel[]): void {
    const body = pixelFontMetrics(this.scene, "body");
    const money = labels.flatMap((label) =>
      label.target.kind === "bank" ? [{ from: label.target.from, label }] : [],
    );
    const orders = stackOrders(money.map(({ from }) => from));
    money.forEach(({ from, label }, i) => {
      const order = orders[i] ?? 0;
      this.showMoneyLabel(label, (shown) =>
        moneyChipPlace(body, SCREEN_CONFIG.width, from, order, shown),
      );
    });
    for (const label of labels) {
      if (label.target.kind === "cash") {
        if (label.target.tip) {
          this.showTipLabel(label);
        } else {
          this.showCashLabel(label);
        }
      }
    }
  }

  // A money change pops on its chip where place puts it and holds as a heart's pop does; then it
  // goes into the cash (sendMoneyLabel), calling left once it has left its place. Reduced motion
  // keeps the pop and fades it at once. depth: the chip's, as addChangeChip draws it.
  private showMoneyLabel(
    label: ChangeLabel,
    place: (shown: { lines: number; scale: number; width: number }) => {
      chip: Rect;
      text: Point;
    },
    left: () => void = () => undefined,
    depth = 0,
  ): void {
    const chip = this.addChangeChip(label, MONEY_LABEL.room, place, depth);
    const held = this.holdOffCounter(label.amount);
    if (this.reducedMotion()) {
      this.sendMoneyLabel(chip, held, left);
      return;
    }
    this.labels.after(this.scene, MONEY_LABEL.holdMs, () => this.sendMoneyLabel(chip, held, left));
  }
  // A money gain's label that is not a tip's, or the cash lost with the last firing
  // (cashLostLabel), pops by the cash in the cash column's first free slot, which it holds until
  // it leaves, and goes in as any money label does (showMoneyLabel). It never adds up with a
  // tip's.
  private showCashLabel(label: ChangeLabel): void {
    const body = pixelFontMetrics(this.scene, "body");
    const slot = this.takeCashSlot();
    this.showMoneyLabel(
      label,
      (shown) => cashChipPlace(body, slot, shown),
      () => this.cashSlots.delete(slot),
      HUD_DEPTH.cashChip,
    );
  }
  // A tip's label pops by the cash, in the cash column's first free slot, and holds as a heart's
  // pop does, then goes into the cash (sendMoneyLabel); with reduced motion it fades after the
  // hold. A tip grabbed while one shows adds up with it on one chip in its slot and restarts the
  // hold (mergeTips); one that cannot, as a Stinky "+$0" beside a paying tip, sends the showing
  // label in now and takes the first free slot.
  private showTipLabel(label: ChangeLabel): void {
    const showing = this.tip;
    const merged = showing === undefined ? undefined : mergeTips(showing.label, label);
    if (showing !== undefined) {
      if (merged === undefined) {
        this.sendMoneyLabel(showing.chip, showing.held, () => this.cashSlots.delete(showing.slot));
      } else {
        showing.chip.parts.forEach((part) => part.dispose());
      }
    }
    const tipLabel = merged ?? label;
    const slot = merged === undefined || showing === undefined ? this.takeCashSlot() : showing.slot;
    const body = pixelFontMetrics(this.scene, "body");
    const chip = this.addChangeChip(
      tipLabel,
      MONEY_LABEL.room,
      (shown) => cashChipPlace(body, slot, shown),
      HUD_DEPTH.cashChip,
    );
    const before = merged === undefined ? 0 : (showing?.held ?? 0);
    const held = before + this.holdOffCounter(label.amount);
    const tip = { chip, held, label: tipLabel, slot };
    this.tip = tip;
    this.labels.after(this.scene, MONEY_LABEL.holdMs, () => {
      if (this.tip === tip) {
        this.tip = undefined;
        this.sendMoneyLabel(chip, held, () => this.cashSlots.delete(slot));
      }
    });
  }
  // A zone's pay, its total, pops by the cash in the cash column's first free slot, which it holds
  // until it has faded: it shows while the fees' coins fly, timing's holdMs, then fades in place
  // over its fadeMs. The coins carry its money to the counter, so it never flies.
  showPayTotal(
    label: ChangeLabel,
    timing: {
      fadeMs: number;
      holdMs: number;
    },
  ): void {
    const body = pixelFontMetrics(this.scene, "body");
    const slot = this.takeCashSlot();
    const chip = this.addChangeChip(
      label,
      MONEY_LABEL.room,
      (shown) => cashChipPlace(body, slot, shown),
      HUD_DEPTH.cashChip,
    );
    this.labels.after(this.scene, timing.holdMs, () => {
      const fade = { ms: timing.fadeMs, rise: 0 };
      this.fadeChip(chip, fade.ms, () => this.cashSlots.delete(slot));
    });
  }
  // The cash column's first free slot, now held.
  private takeCashSlot(): number {
    const slot = freeCashSlot(this.cashSlots);
    this.cashSlots.add(slot);
    return slot;
  }
  // The money a label keeps off the counter until it lands, of amount: all of it, or none with
  // reduced motion, where the counter counts it at once.
  private holdOffCounter(amount: number): number {
    const held = this.reducedMotion() ? 0 : amount;
    this.heldMoney += held;
    return held;
  }
  // A money label's chip flies along a heart's arc into the cash, which counts held as it lands,
  // calling left as it sets off. Reduced motion fades it in place, as a heart lands without
  // flying, and calls left once it has faded.
  private sendMoneyLabel(chip: ChangeChip, held: number, left: () => void): void {
    if (this.reducedMotion()) {
      this.heldMoney -= held;
      this.fadeChip(chip, LABEL_FADE_MS, left);
      return;
    }
    left();
    const land = () => {
      this.heldMoney -= held;
      chip.parts.forEach((part) => part.dispose());
    };
    const path = moneyFlightPath(chip.rect);
    const bases = chip.parts.map(({ state }) => ({ x: state.x, y: state.y }));
    const flight = { duration: FEEDBACK.heart.flyMs, ease: "Sine.easeIn", onComplete: land };
    this.labels.tween(
      this.scene,
      arcFlight(path, flight, (point) => {
        const dx = point.x - path.from.x;
        const dy = point.y - path.from.y;
        chip.parts.forEach((part, i) => {
          const base = bases[i] ?? part.state;
          part.state.x = base.x + dx;
          part.state.y = base.y + dy;
        });
      }),
    );
  }
  // A heart change's label in the middle of its card's bottom rows, once its heart has landed,
  // fading in place.
  showHeartLabel(label: ChangeLabel, lane: Rect): void {
    const body = pixelFontMetrics(this.scene, "body");
    const chip = this.addChangeChip(label, changeLabelRoom(lane.width), (shown) =>
      changeChipPlace(body, lane, shown),
    );
    this.fadeChip(chip, LABEL_FADE_MS);
  }
  // A change on a cream chip in its changeLabelColour, so it reads over anything; set within
  // room in CHANGE_LABEL_STYLE, placed by place, at depth (its text a depth over it). A label
  // with a reach icon shows it at the chip's left, over the chip as its text is, the chip widened
  // to hold it (reachChipPlace). Its parts, and its chip's rect.
  private addChangeChip(
    label: ChangeLabel,
    room: number,
    place: (shown: { lines: number; scale: number; width: number }) => {
      chip: Rect;
      text: Point;
    },
    depth = 0,
  ): ChangeChip {
    const painter = this.painter;
    const reached = label.reachIcon !== undefined && painter.hasArt(label.reachIcon);
    // The icon takes its span of the room.
    const fitted = fittingText(
      CHANGE_LABEL_STYLE,
      (style, line) => inkWidth(painter.fonts.body, style.scale, line),
      room - (reached ? REACH_ICON.span : 0),
      label.text,
    );
    const scale = fitted.style.scale;
    const width = Math.max(
      ...fitted.lines.map((line) => inkWidth(painter.fonts.body, scale, line)),
    );
    const placed = reachChipPlace(place, reached, { lines: fitted.lines.length, scale, width });
    const chip = painter.group(depth);
    chip.panel(placed.chip);
    chip.text({
      anchor: "ink",
      backing:
        placed.icon === null
          ? placed.chip
          : {
              ...placed.chip,
              width: placed.chip.width - REACH_ICON.span,
              x: placed.chip.x + REACH_ICON.span,
            },
      capTop: placed.text.y,
      colour: changeLabelColour(label),
      font: "body",
      lines: fitted.lines,
      scale,
      x: placed.text.x,
    });
    if (reached && placed.icon !== null) {
      chip.art({
        at: placed.icon,
        image: { height: REACH_ICON.size, width: REACH_ICON.size },
        key: label.reachIcon!,
      });
    }
    return { parts: [chip], rect: placed.chip };
  }
  private fadeChip(chip: ChangeChip, ms: number, done: () => void = () => undefined): void {
    const parts = chip.parts;
    this.labels.tween(this.scene, {
      alpha: 0,
      duration: ms,
      onComplete: () => {
        parts.forEach((part) => part.dispose());
        done();
      },
      targets: parts.map(({ state }) => state),
    });
  }
}

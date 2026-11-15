import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";
import { fontMetrics } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { fittingText } from "@andornaut/game-kit/runtime/text/textFit";
import type { GameObjects, Scene, Tweens, Types } from "phaser";

import { ownerFaceKey, WARNING_KEY, WARNING_TAG } from "../assets/spriteKeys.ts";
import { gameData } from "../data/index.ts";
import { SLICES } from "../data/layout.ts";
import { SCREEN_CONFIG, SCREEN_LAYOUT } from "../data/screen.ts";
import type { DogId } from "../data/types.ts";
import type { HudMoment, HudMomentPainter } from "../hud/dom/hudMoments.ts";
import { inlineFaceBox, styledFaceRows } from "../hud/faceText.ts";
import { type MoneyTick, retarget, tickShown } from "../hud/feedback.ts";
import type { ChangeLabel } from "../hud/hudView.ts";
import {
  arcControl,
  bowRightControl,
  downTail,
  FIRED_LINE,
  FIRED_LINE_FIT,
  firedLineHeight,
  firedLineX,
  FIRING_EVENT,
  FIRING_PARTS,
  type FiringCue,
  firingLayout,
  firingTimeline,
  lastLandMs,
  LOW_CHIP,
  LOW_CHIP_FIT,
  lowChipPlace,
  lowHeartDogs,
  lowHeartsText,
  MOMENTS,
  newlyLow,
  type Payout,
  PAYOUT_EVENT,
  type PayoutFlight,
  payoutFlights,
  SPARE_TREAT_EVENT,
  type SpareTreatCue,
  TOP_BAR_POINTS,
  TREAT_EVENT,
  type TreatCue,
  trotOffX,
} from "../hud/moments.ts";
import { playerPaused, type RunPause, walkPaused } from "../hud/topBar.ts";
import { DOG_CARD } from "../hud/walkHud.ts";
import { slotIndexOf } from "../state/pack.ts";
import type { RunState } from "../state/runState.ts";
import { PALETTE } from "../ui/palette.ts";
import { type Cents, cents } from "../units.ts";
import { arcFlight } from "./arcFlight.ts";
import { HUD_DEPTH } from "./hudDepth.ts";
import type { HudWalk } from "./hudWalk.ts";
import { onSceneEvent } from "./overlay.ts";
import { playTag } from "./sprites.ts";
import { TimedGroup } from "./timedGroup.ts";
const LAYOUT = SCREEN_LAYOUT;
const FACE = { scale: 2, size: 32 };
const LINE_TAIL_WIDTH = 8;
interface FiredLine {
  at: Point;
  tail: Point;
  text: string;
}
interface HudFeedbackHooks {
  painter: HudMomentPainter;
  effectWell: (index: number) => Rect | undefined;
  firingShown: () => void;
  floatLabels: (ownerMs: number, labels: ChangeLabel[]) => void;
  payTotal: (
    label: ChangeLabel,
    timing: {
      fadeMs: number;
      holdMs: number;
    },
  ) => void;
  popOwner: (dog: DogId, mood: string, ms: number) => void;
}
interface SlotWarning {
  view?: HudMoment | undefined;
  pulse?: Tweens.Tween | undefined;
}
function dogFaceCentre(rect: Rect): Point {
  return {
    x: rect.x + DOG_CARD.dogFace.x + FACE.size / 2,
    y: rect.y + DOG_CARD.dogFace.y + FACE.size / 2,
  };
}
// Native UI moments retain their existing scene timers and the two independently held groups.
export class HudFeedback {
  private inFlight = 0;
  private readonly firingParts = new Set<Rect>();
  private lines: {
    cover: Rect;
    depth: number;
    line: FiredLine;
    view: HudMoment;
    rect: Rect;
  }[] = [];
  private linesWaiting: FiredLine[] = [];
  private low: DogId[] = [];
  private lowShown = "";
  private moneyTick: MoneyTick | undefined;
  private readonly firing = new TimedGroup();
  private readonly moments = new TimedGroup();
  private readonly warnings: SlotWarning[] = LAYOUT.dogSlots.map(() => ({}));
  private readonly scene: Scene;
  private readonly run: Pick<HudWalk, "events" | "hudView" | "reducedMotion">;
  private readonly hooks: HudFeedbackHooks;
  constructor(
    scene: Scene,
    run: Pick<HudWalk, "events" | "hudView" | "reducedMotion">,
    hooks: HudFeedbackHooks,
  ) {
    this.scene = scene;
    this.run = run;
    this.hooks = hooks;
    onSceneEvent(scene, run.events, FIRING_EVENT, (cue: FiringCue) => this.playFiring(cue));
    onSceneEvent(scene, run.events, PAYOUT_EVENT, (payout: Payout) => this.playPayout(payout));
    onSceneEvent(scene, run.events, TREAT_EVENT, (cue: TreatCue) => this.playTreat(cue));
    onSceneEvent(scene, run.events, SPARE_TREAT_EVENT, (cue: SpareTreatCue) =>
      this.playSpareTreat(cue),
    );
  }
  update(run: RunState, pause: RunPause): void {
    this.moments.hold(playerPaused(pause));
    this.firing.hold(walkPaused(pause));
    this.showLowHearts(run);
  }
  firingRects(): Rect[] {
    return [...this.firingParts, ...this.lines.map(({ cover }) => cover)];
  }
  shownMoney(money: Cents): Cents {
    const target = cents(Math.max(0, money - this.inFlight));
    const now = this.scene.time.now;
    this.moneyTick = retarget(!this.run.reducedMotion(), now, target, this.moneyTick);
    return tickShown(now, this.moneyTick);
  }
  private tween(config: Types.Tweens.TweenBuilderConfig, group = this.moments): Tweens.Tween {
    return group.tween(this.scene, config);
  }
  private after(ms: number, callback: () => void, group = this.moments): void {
    group.after(this.scene, ms, callback);
  }
  private fadeOut(views: HudMoment[], delay: number, ms: number, group = this.moments): void {
    this.tween(
      {
        alpha: 0,
        delay,
        duration: ms,
        onComplete: () => views.forEach((view) => view.dispose()),
        targets: views.map(({ state }) => state),
      },
      group,
    );
  }
  private fly(
    view: HudMoment,
    path: {
      control: Point;
      from: Point;
      to: Point;
    },
    ms: number,
    done: () => void,
  ): void {
    this.tween(
      arcFlight(path, { duration: ms, onComplete: done }, (point) => {
        view.state.x = point.x - path.from.x;
        view.state.y = point.y - path.from.y;
      }),
    );
  }
  private slotOf(dog: DogId): Rect | undefined {
    return LAYOUT.dogSlots[slotIndexOf(this.run.hudView()?.run.pack ?? [], dog)];
  }
  private playFiring(cue: FiringCue): void {
    const rect = this.slotOf(cue.dog);
    if (rect === undefined) {
      return;
    }
    const painter = this.hooks.painter;
    const still = this.run.reducedMotion();
    const layout = firingLayout(LAYOUT.walkView, rect);
    const timeline = firingTimeline(cue.seconds, still);
    const pop = painter.hasArt("fx-fired-pop")
      ? painter.group(HUD_DEPTH.moment, "firingNow")
      : undefined;
    const face = painter.group(HUD_DEPTH.moment, "firingNow");
    face.state.x = layout.face.x;
    face.state.y = layout.face.y;
    const key = ownerFaceKey(gameData, cue.dog);
    const size = FACE.size * FACE.scale;
    if (painter.hasArt(key)) {
      face.art({
        at: { x: 0, y: 0 },
        clock: "now",
        key,
        loop: true,
        origin: { x: 0.5, y: 0.5 },
        scale: FACE.scale,
        tags: ["fired", "upset"],
      });
    } else {
      face.panel({ height: size, width: size, x: -size / 2, y: -size / 2 });
      face.text({
        anchor: "centre",
        capTop: 0,
        colour: PALETTE.plum,
        font: "body",
        lines: [gameData.dogs[cue.dog].owner.name],
        scale: 1,
        x: 0,
      });
    }
    if (pop !== undefined) {
      pop.art({
        at: layout.pop,
        key: "fx-fired-pop",
        last: still,
        onFrame: (index) => {
          if (!still) {
            face.state.visible = index > 0;
            face.state.scale = index === 1 ? 0.5 : 1;
          }
        },
        scale: 2,
        still,
        tags: ["play"],
      });
      if (!still) {
        face.state.visible = false;
      }
    } else if (!still) {
      face.state.scale = 0;
      this.tween(
        { duration: timeline.popMs, ease: "Back.easeOut", scale: 1, targets: face.state },
        this.firing,
      );
    }
    const plate = painter.group(HUD_DEPTH.moment, "firingNow");
    plate.panel(
      layout.plate,
      {
        key: painter.hasArt("ui-fired-plate") ? "ui-fired-plate" : "ui-hit-label",
        kind: "sheet",
        slices: { bottom: 8, left: 8, right: 8, top: 8 },
        tag: "normal",
      },
      { border: PALETTE.plum, fill: PALETTE.darkRed },
    );
    plate.text({
      anchor: "centre",
      capTop: layout.plate.y + FIRING_PARTS.plateText.y,
      colour: PALETTE.yellow,
      font: "display",
      lines: [gameData.runText.fired],
      scale: 1,
      x: layout.plate.x + layout.plate.width / 2,
    });
    if (!still) {
      plate.state.y = -8;
      plate.state.alpha = 0;
      this.tween(
        { alpha: 1, duration: timeline.plateMs, ease: "Back.easeOut", targets: plate.state, y: 0 },
        this.firing,
      );
    }
    const covered = [
      { height: size, width: size, x: layout.face.x - size / 2, y: layout.face.y - size / 2 },
      layout.plate,
    ];
    covered.forEach((part) => this.firingParts.add(part));
    this.fadeOut(
      pop === undefined ? [face, plate] : [pop, face, plate],
      timeline.fadeAtMs,
      timeline.fadeMs,
      this.firing,
    );
    const line = { at: layout.line, tail: layout.tail, text: cue.line };
    this.linesWaiting.push(line);
    this.showWaitingLines();
    this.after(
      timeline.fadeAtMs,
      () => {
        covered.forEach((part) => this.firingParts.delete(part));
        this.closeLine(line, timeline.fadeMs);
      },
      this.firing,
    );
    this.hooks.firingShown();
  }
  private closeLine(line: FiredLine, ms: number): void {
    this.linesWaiting = this.linesWaiting.filter((waiting) => waiting !== line);
    const entry = this.lines.find((shown) => shown.line === line);
    if (entry === undefined) {
      return;
    }
    this.tween(
      {
        alpha: 0,
        duration: ms,
        onComplete: () => {
          entry.view.dispose();
          this.lines = this.lines.filter((shown) => shown !== entry);
          this.showWaitingLines();
        },
        targets: entry.view.state,
      },
      this.firing,
    );
  }
  private showWaitingLines(): void {
    this.linesWaiting = this.linesWaiting.filter((line) => !this.addLine(line));
  }
  private addLine(line: FiredLine): boolean {
    const painter = this.hooks.painter;
    const fitted = fittingText(
      FIRED_LINE_FIT.style,
      (fit, text) => painter.inkWidth(fit.scale, text),
      FIRED_LINE_FIT.room,
      line.text,
    );
    const width =
      Math.ceil(
        Math.max(0, ...fitted.lines.map((text) => painter.width(fitted.style.scale, text))),
      ) +
      2 * FIRED_LINE.padding;
    const height = firedLineHeight(fontMetrics(painter.fonts.body), fitted.lines.length);
    const tail = downTail((key) => painter.hasArt(key));
    const tailX = line.tail.x - (tail?.tipX ?? LINE_TAIL_WIDTH / 2);
    const x = firedLineX(
      SCREEN_CONFIG.width,
      this.lines.map(({ rect }) => rect),
      { width: LINE_TAIL_WIDTH, x: tailX },
      width,
    );
    if (x === undefined) {
      return false;
    }
    const rect = { height, width, x, y: line.at.y - height };
    let depth = HUD_DEPTH.firedLine;
    while (this.lines.some((shown) => shown.depth === depth)) {
      depth += 2;
    }
    const view = painter.group(depth, "firingNow");
    view.panel(rect, {
      key: "ui-quip",
      kind: "image",
      native: { height: 24, width: 24 },
      slices: SLICES["ui-quip"],
    });
    if (tail !== undefined) {
      view.art({
        at: { x: tailX, y: line.tail.y },
        image: { height: tail.height, width: LINE_TAIL_WIDTH },
        key: tail.key,
      });
    }
    view.text({
      capTop: rect.y + FIRED_LINE.padding,
      colour: PALETTE.plum,
      font: "body",
      lines: fitted.lines,
      scale: fitted.style.scale,
      x: x + FIRED_LINE.padding,
    });
    const cover = { ...rect, height: Math.max(height, line.tail.y + (tail?.height ?? 0) - rect.y) };
    this.lines.push({ cover, depth, line, rect, view });
    return true;
  }
  private playPayout(payout: Payout): void {
    const pack = this.run.hudView()?.run.pack;
    if (pack === undefined) {
      return;
    }
    const flights = payoutFlights(payout.fees, pack, this.run.reducedMotion());
    for (const flight of flights) {
      const rect = LAYOUT.dogSlots[flight.slot];
      if (rect !== undefined) {
        this.flyFee(flight, rect);
      }
    }
    if (payout.total !== null) {
      this.hooks.payTotal(payout.total, {
        fadeMs: MOMENTS.payout.chipMs,
        holdMs: lastLandMs(flights),
      });
    }
  }
  private flyFee(flight: PayoutFlight, rect: Rect): void {
    if (flight.landMs === flight.startMs) {
      return;
    }
    const from = { x: rect.x + MOMENTS.payout.roof.x, y: rect.y + MOMENTS.payout.roof.y };
    this.inFlight += flight.amount;
    this.after(flight.startMs, () => {
      const coin = this.hooks.painter.group(HUD_DEPTH.moment + 1);
      if (this.hooks.painter.hasArt("fx-coin-fly")) {
        coin.art({
          at: from,
          key: "fx-coin-fly",
          loop: true,
          origin: { x: 0.5, y: 0.5 },
          tags: ["spin"],
        });
      } else {
        coin.panel({ height: 10, width: 10, x: from.x - 5, y: from.y - 5 }, undefined, {
          border: PALETTE.amber,
          fill: PALETTE.amber,
        });
      }
      const bank = TOP_BAR_POINTS.bank;
      this.fly(
        coin,
        { control: bowRightControl(from, bank, MOMENTS.payout.bow), from, to: bank },
        flight.landMs - flight.startMs,
        () => {
          this.inFlight -= flight.amount;
          coin.dispose();
        },
      );
    });
  }
  private playSpareTreat(cue: SpareTreatCue): void {
    const rect = this.slotOf(cue.dog);
    const well = this.hooks.effectWell(cue.well);
    if (
      rect === undefined ||
      well === undefined ||
      this.run.reducedMotion() ||
      !this.hooks.painter.hasArt("icon-treat")
    ) {
      this.playTreat(cue);
      return;
    }
    const from = { x: well.x + well.width / 2, y: well.y + well.height / 2 };
    const to = dogFaceCentre(rect);
    const treat = this.hooks.painter.group(HUD_DEPTH.moment + 1);
    treat.art({
      at: { x: from.x - 8, y: from.y - 8 },
      image: { height: 16, width: 16 },
      key: "icon-treat",
    });
    this.fly(
      treat,
      { control: arcControl(from, to, MOMENTS.spareTreat.peak), from, to },
      MOMENTS.spareTreat.flyMs,
      () => {
        treat.dispose();
        this.playTreat(cue);
      },
    );
  }
  private playTreat(cue: TreatCue): void {
    const rect = this.slotOf(cue.dog);
    if (rect === undefined) {
      this.hooks.floatLabels(MOMENTS.treat.smileMs, cue.labels);
      return;
    }
    const key = this.hooks.painter.hasArt("fx-treat-pop") ? "fx-treat-pop" : "fx-sparkle";
    const view = this.hooks.painter.group(HUD_DEPTH.moment, "now");
    view.art({
      at: dogFaceCentre(rect),
      key,
      onComplete: () => view.dispose(),
      origin: { x: 0.5, y: 0.5 },
      tags: ["play"],
    });
    this.hooks.popOwner(cue.dog, "happy", MOMENTS.treat.smileMs);
    this.hooks.floatLabels(MOMENTS.treat.smileMs, cue.labels);
  }
  private showLowHearts(run: RunState): void {
    const low = lowHeartDogs(run.pack);
    const still = this.run.reducedMotion();
    newlyLow(this.low, low).forEach((dog) => this.cueLow(dog));
    this.low = low;
    const shown = `${low.join()}|${still}`;
    if (shown === this.lowShown) {
      return;
    }
    this.lowShown = shown;
    LAYOUT.dogSlots.forEach((rect, index) => {
      const dog = run.pack[index]?.dog;
      this.warn(index, rect, dog !== undefined && low.includes(dog) ? dog : undefined, still);
    });
  }
  private warn(slot: number, rect: Rect, dog: DogId | undefined, still: boolean): void {
    const warning = this.warnings[slot];
    if (warning === undefined) {
      return;
    }
    warning.pulse?.remove();
    warning.view?.dispose();
    warning.view = undefined;
    warning.pulse = undefined;
    if (dog === undefined) {
      return;
    }
    const view = this.hooks.painter.group(0, "now");
    warning.view = view;
    if (this.hooks.painter.hasArt("ui-dog-card-warn")) {
      view.art({
        at: rect,
        key: "ui-dog-card-warn",
        loop: true,
        tags: [still ? "static" : "pulse"],
      });
    } else {
      view.ring(rect, PALETTE.red, 2);
      view.art({
        at: { x: rect.x + rect.width - 18, y: rect.y + 2 },
        key: WARNING_KEY,
        loop: true,
        still,
        tags: [WARNING_TAG],
      });
      if (!still) {
        warning.pulse = this.scene.tweens.add({
          alpha: 0.35,
          duration: 600,
          ease: "Sine.easeInOut",
          repeat: -1,
          targets: view.state,
          yoyo: true,
        });
      }
    }
  }
  private cueLow(dog: DogId): void {
    const rect = this.slotOf(dog);
    if (rect === undefined) {
      return;
    }
    this.hooks.popOwner(dog, "worried", MOMENTS.lowCueMs);
    const painter = this.hooks.painter;
    const body = fontMetrics(painter.fonts.body);
    const box = inlineFaceBox(body, LOW_CHIP_FIT.style.scale);
    const rows = styledFaceRows(
      LOW_CHIP_FIT.style,
      (fit, text) => painter.width(fit.scale, text),
      box,
      LOW_CHIP_FIT.room,
      lowHeartsText(gameData, dog),
    );
    const row = rows[0];
    const place = lowChipPlace(body, SCREEN_CONFIG.width, rect, {
      ...(box !== undefined && row !== undefined && row.faces.length > 0 ? { face: box } : {}),
      scale: LOW_CHIP_FIT.style.scale,
      width: Math.ceil(row?.width ?? 0),
    });
    const view = painter.group(HUD_DEPTH.moment);
    view.panel(place.box);
    view.faceRows(
      { capsTop: place.text.y, x: place.text.x },
      box,
      LOW_CHIP_FIT.style.scale,
      PALETTE.darkRed,
      rows,
    );
    if (!this.run.reducedMotion()) {
      this.tween({ duration: MOMENTS.lowCueMs, targets: view.state, y: -LOW_CHIP.rise });
    }
    this.fadeOut([view], MOMENTS.lowCueMs / 2, MOMENTS.lowCueMs / 2);
  }
}
// A fired dog trots off the road by its nearer edge over ms, off the side of the screen.
// Reduced motion fades it out where it stands. Returns the tween, so the walk can hold it.
export function trotOffRoad(
  scene: Scene,
  trot: {
    ms: number;
    road: Rect;
    still: boolean;
  },
  sprite: GameObjects.Sprite,
  done: () => void,
): Tweens.Tween {
  const duration = trot.ms;
  if (trot.still) {
    return scene.tweens.add({
      alpha: 0,
      duration,
      onComplete: () => {
        sprite.setAlpha(1);
        done();
      },
      targets: sprite,
    });
  }
  const toX = trotOffX(trot.road, sprite.displayWidth / 2, sprite.x);
  playTag(sprite, sprite.texture.key, "walk");
  sprite.setFlipX(toX < sprite.x);
  return scene.tweens.add({
    duration,
    onComplete: () => {
      sprite.setFlipX(false);
      done();
    },
    targets: sprite,
    x: toX,
  });
}

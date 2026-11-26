import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";
import type { Scene } from "phaser";

import type { DogId } from "../data/ids.ts";
import { FACE_SIZE } from "../data/index.ts";
import type { HudMoment, HudMomentPainter } from "../hud/dom/index.ts";
import {
  arcControl,
  bowRightControl,
  type ChangeLabel,
  DOG_CARD,
  FIRING_EVENT,
  type FiringCue,
  lastLandMs,
  MOMENTS,
  type MoneyTick,
  type Payout,
  PAYOUT_EVENT,
  type PayoutFlight,
  payoutFlights,
  playerPaused,
  retarget,
  type RunPause,
  SPARE_TREAT_EVENT,
  type SpareTreatCue,
  tickShown,
  TOP_BAR_POINTS,
  TREAT_EVENT,
  type TreatCue,
  walkPaused,
} from "../hud/index.ts";
import { SCREEN_LAYOUT } from "../layout/index.ts";
import { type RunState, slotIndexOf } from "../state/index.ts";
import { PALETTE } from "../ui/index.ts";
import { type Cents, cents } from "../units.ts";
import { arcFlight } from "./arcFlight.ts";
import { FiringMoment } from "./firingMoment.ts";
import { HUD_DEPTH } from "./hudDepth.ts";
import type { HudWalk } from "./hudWalk.ts";
import { LowHeartsWarning } from "./lowHeartsWarning.ts";
import { onSceneEvent } from "./overlay.ts";
import { TimedGroup } from "./timedGroup.ts";
const LAYOUT = SCREEN_LAYOUT;
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
function dogFaceCentre(rect: Rect): Point {
  return {
    x: rect.x + DOG_CARD.dogFace.x + FACE_SIZE / 2,
    y: rect.y + DOG_CARD.dogFace.y + FACE_SIZE / 2,
  };
}
// Native UI moments retain their existing scene timers and the two independently held groups.
export class HudFeedback {
  private inFlight = 0;
  private moneyTick: MoneyTick | undefined;
  private readonly firing: FiringMoment;
  private readonly lowHearts: LowHeartsWarning;
  private readonly moments = new TimedGroup();
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
    this.firing = new FiringMoment(scene, run, hooks);
    this.lowHearts = new LowHeartsWarning(scene, this.moments, run, hooks, (dog) =>
      this.slotOf(dog),
    );
    onSceneEvent(scene, run.events, FIRING_EVENT, (cue: FiringCue) => {
      const rect = this.slotOf(cue.dog);
      if (rect !== undefined) {
        this.firing.play(rect, cue);
      }
    });
    onSceneEvent(scene, run.events, PAYOUT_EVENT, (payout: Payout) => this.playPayout(payout));
    onSceneEvent(scene, run.events, TREAT_EVENT, (cue: TreatCue) => this.playTreat(cue));
    onSceneEvent(scene, run.events, SPARE_TREAT_EVENT, (cue: SpareTreatCue) =>
      this.playSpareTreat(cue),
    );
  }
  update(run: RunState, pause: RunPause): void {
    this.moments.hold(playerPaused(pause));
    this.firing.hold(walkPaused(pause));
    this.lowHearts.update(run);
  }
  firingRects(): Rect[] {
    return this.firing.rects();
  }
  shownMoney(money: Cents): Cents {
    const target = cents(Math.max(0, money - this.inFlight));
    const now = this.scene.time.now;
    this.moneyTick = retarget(!this.run.reducedMotion(), now, target, this.moneyTick);
    return tickShown(now, this.moneyTick);
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
    this.moments.tween(
      this.scene,
      arcFlight(path, { duration: ms, onComplete: done }, (point) => {
        view.state.x = point.x - path.from.x;
        view.state.y = point.y - path.from.y;
      }),
    );
  }
  private slotOf(dog: DogId): Rect | undefined {
    return LAYOUT.dogSlots[slotIndexOf(this.run.hudView()?.run.pack ?? [], dog)];
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
    this.moments.after(this.scene, flight.startMs, () => {
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
}

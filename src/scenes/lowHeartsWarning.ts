import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { fontMetrics } from "@andornaut/game-kit/runtime/text/bitmapFont";
import type { Scene, Tweens } from "phaser";

import { WARNING_KEY, WARNING_TAG } from "../assets/index.ts";
import type { DogId } from "../data/ids.ts";
import { gameData, LOW_CHIP, SCREEN_CONFIG } from "../data/index.ts";
import type { HudMoment, HudMomentPainter } from "../hud/dom/index.ts";
import {
  LOW_CHIP_FIT,
  lowChipPlace,
  lowHeartDogs,
  lowHeartsText,
  MOMENTS,
  newlyLow,
  styledNoticeRows,
} from "../hud/index.ts";
import { SCREEN_LAYOUT } from "../layout/index.ts";
import type { RunState } from "../state/index.ts";
import { PALETTE } from "../ui/index.ts";
import { fadeFeedback } from "./feedbackFade.ts";
import { HUD_DEPTH } from "./hudDepth.ts";
import type { HudWalk } from "./hudWalk.ts";
import type { TimedGroup } from "./timedGroup.ts";

interface SlotWarning {
  view?: HudMoment | undefined;
  pulse?: Tweens.Tween | undefined;
}

interface WarningHooks {
  painter: HudMomentPainter;
  popOwner: (dog: DogId, mood: string, ms: number) => void;
}

export class LowHeartsWarning {
  private low: DogId[] = [];
  private lowShown = "";
  private readonly warnings: SlotWarning[] = SCREEN_LAYOUT.dogSlots.map(() => ({}));
  private readonly scene: Scene;
  private readonly moments: TimedGroup;
  private readonly run: Pick<HudWalk, "reducedMotion">;
  private readonly hooks: WarningHooks;
  private readonly slotOf: (dog: DogId) => Rect | undefined;

  constructor(
    scene: Scene,
    moments: TimedGroup,
    run: Pick<HudWalk, "reducedMotion">,
    hooks: WarningHooks,
    slotOf: (dog: DogId) => Rect | undefined,
  ) {
    this.scene = scene;
    this.moments = moments;
    this.run = run;
    this.hooks = hooks;
    this.slotOf = slotOf;
  }

  update(run: RunState): void {
    const low = lowHeartDogs(run.pack);
    const still = this.run.reducedMotion();
    newlyLow(this.low, low).forEach((dog) => this.cueLow(dog));
    this.low = low;
    const shown = `${low.join()}|${still}`;
    if (shown === this.lowShown) {
      return;
    }
    this.lowShown = shown;
    SCREEN_LAYOUT.dogSlots.forEach((rect, index) => {
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
    const rows = styledNoticeRows(
      LOW_CHIP_FIT.style,
      (fit, text) => painter.width(fit.scale, text),
      LOW_CHIP_FIT.room,
      lowHeartsText(gameData, dog),
    );
    const row = rows[0];
    const place = lowChipPlace(body, SCREEN_CONFIG.width, rect, {
      scale: LOW_CHIP_FIT.style.scale,
      width: Math.ceil(row?.width ?? 0),
    });
    const view = painter.group(HUD_DEPTH.moment);
    view.panel(place.box);
    view.text({
      capTop: place.text.y,
      colour: PALETTE.darkRed,
      font: "body",
      lines: rows.map(({ text }) => text),
      scale: LOW_CHIP_FIT.style.scale,
      x: place.text.x,
    });
    if (!this.run.reducedMotion()) {
      this.moments.tween(this.scene, {
        duration: MOMENTS.lowCueMs,
        targets: view.state,
        y: -LOW_CHIP.rise,
      });
    }
    fadeFeedback(this.scene, this.moments, [view], MOMENTS.lowCueMs / 2, MOMENTS.lowCueMs / 2);
  }
}

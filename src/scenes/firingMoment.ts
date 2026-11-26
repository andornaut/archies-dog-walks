import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";
import { fontMetrics } from "@andornaut/game-kit/runtime/text/bitmapFont";
import { fittingText } from "@andornaut/game-kit/runtime/text/textFit";
import type { Scene } from "phaser";

import { ownerFaceKey } from "../assets/index.ts";
import {
  FACE_SIZE,
  FIRED_LINE,
  gameData,
  MOMENT_PARTS,
  SCREEN_CONFIG,
  SLICES,
} from "../data/index.ts";
import type { HudMoment, HudMomentPainter } from "../hud/dom/index.ts";
import {
  downTail,
  FIRED_LINE_FIT,
  firedLineHeight,
  firedLineX,
  FIRING_PARTS,
  type FiringCue,
  firingLayout,
  firingTimeline,
} from "../hud/index.ts";
import { SCREEN_LAYOUT } from "../layout/index.ts";
import { PALETTE } from "../ui/index.ts";
import { fadeFeedback } from "./feedbackFade.ts";
import { HUD_DEPTH } from "./hudDepth.ts";
import type { HudWalk } from "./hudWalk.ts";
import { TimedGroup } from "./timedGroup.ts";

const FACE = { scale: MOMENT_PARTS.firing.faceScale, size: FACE_SIZE };
const LINE_TAIL_WIDTH = 8;
interface FiredLine {
  at: Point;
  tail: Point;
  text: string;
}

interface FiringHooks {
  painter: HudMomentPainter;
  firingShown: () => void;
}

export class FiringMoment {
  private readonly firingParts = new Set<Rect>();
  private lines: {
    cover: Rect;
    depth: number;
    line: FiredLine;
    view: HudMoment;
    rect: Rect;
  }[] = [];
  private linesWaiting: FiredLine[] = [];
  private readonly timing = new TimedGroup();
  private readonly scene: Scene;
  private readonly run: Pick<HudWalk, "reducedMotion">;
  private readonly hooks: FiringHooks;

  constructor(scene: Scene, run: Pick<HudWalk, "reducedMotion">, hooks: FiringHooks) {
    this.scene = scene;
    this.run = run;
    this.hooks = hooks;
  }

  hold(paused: boolean): void {
    this.timing.hold(paused);
  }

  rects(): Rect[] {
    return [...this.firingParts, ...this.lines.map(({ cover }) => cover)];
  }

  play(rect: Rect, cue: FiringCue): void {
    const painter = this.hooks.painter;
    const still = this.run.reducedMotion();
    const layout = firingLayout(SCREEN_LAYOUT.walkView, rect);
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
      this.timing.tween(this.scene, {
        duration: timeline.popMs,
        ease: "Back.easeOut",
        scale: 1,
        targets: face.state,
      });
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
      this.timing.tween(this.scene, {
        alpha: 1,
        duration: timeline.plateMs,
        ease: "Back.easeOut",
        targets: plate.state,
        y: 0,
      });
    }
    const covered = [
      { height: size, width: size, x: layout.face.x - size / 2, y: layout.face.y - size / 2 },
      layout.plate,
    ];
    covered.forEach((part) => this.firingParts.add(part));
    fadeFeedback(
      this.scene,
      this.timing,
      pop === undefined ? [face, plate] : [pop, face, plate],
      timeline.fadeAtMs,
      timeline.fadeMs,
    );
    const line = { at: layout.line, tail: layout.tail, text: cue.line };
    this.linesWaiting.push(line);
    this.showWaitingLines();
    this.timing.after(this.scene, timeline.fadeAtMs, () => {
      covered.forEach((part) => this.firingParts.delete(part));
      this.closeLine(line, timeline.fadeMs);
    });
    this.hooks.firingShown();
  }
  private closeLine(line: FiredLine, ms: number): void {
    this.linesWaiting = this.linesWaiting.filter((waiting) => waiting !== line);
    const entry = this.lines.find((shown) => shown.line === line);
    if (entry === undefined) {
      return;
    }
    this.timing.tween(this.scene, {
      alpha: 0,
      duration: ms,
      onComplete: () => {
        entry.view.dispose();
        this.lines = this.lines.filter((shown) => shown !== entry);
        this.showWaitingLines();
      },
      targets: entry.view.state,
    });
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
}

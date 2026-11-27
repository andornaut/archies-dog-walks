import { clampInto, containsPoint, type Point } from "@andornaut/game-kit/runtime/rect";
import type { Input, Scene } from "phaser";

import { gameData, LANE_COUNT } from "../../data/index.ts";
import {
  debuffBarRects,
  type ExplainShown,
  type ExplainTarget,
  explainTargetAt,
  gameplayAllowed,
  opensOnTap,
  type RunPause,
  topBarButtonAt,
  walkPresses,
} from "../../hud/index.ts";
import {
  type GestureAction,
  holdRule,
  idleTrack,
  type PointerPhase,
  type PointerSample,
  type PointerTrack,
  type Press,
  type PressMode,
  sceneKeyAllowed,
  tickTrack,
  type TrackContext,
  trackPointer,
  walkKeyAction,
  walkPagePoint,
} from "../../input/index.ts";
import {
  canvasInputBlocked,
  canvasPressAllowed,
  logicalPoint,
  primaryCanvasContact,
} from "../../input/phaser/index.ts";
import type { LaneDirection } from "../../layout/index.ts";
import { read } from "../../rules/index.ts";
import { type SessionInput, steerWalk, type Walk } from "../../runner/index.ts";
import { deviceFitOwned } from "../../ui/index.ts";
import { listenPagePresses } from "../pagePresses.ts";
import { addTapBurst } from "../uiKit.ts";
import { leadWalk } from "./interpolate.ts";
import { LAYOUT } from "./stage.ts";

// What the walk's input reads of the run. explainShown: what the HUD shows that a held press
// can explain.
interface RunInputHost {
  explainShown: () => ExplainShown;
  // Whether a replay drives the run, which then takes no live lane moves.
  replaying: () => boolean;
  runPause: () => RunPause;
  walk: () => Walk | undefined;
}

// Keys, the press driving the walk's gestures, the lane moves they queue for the next
// simulation step, and the explanation a still press on a HUD element opens.
export class RunInput {
  private readonly host: RunInputHost;
  private pending: SessionInput[] = [];
  private pointers: PointerTrack<ExplainTarget> = idleTrack;
  private readonly scene: Scene;

  constructor(scene: Scene, host: RunInputHost) {
    this.scene = scene;
    this.host = host;
  }

  // A press on the page beside the canvas acts as one at the nearest point of the screen
  // (walkPagePoint), so the margins below the dog cards and beside the road steer too; one
  // beside or above the walk bar does nothing, and its moves and release then match no press.
  listen(): void {
    const { input } = this.scene;
    input.keyboard?.on("keydown", (event: KeyboardEvent) => this.onKey(event));
    input.on("pointerdown", (pointer: Input.Pointer) => this.onPointer("down", pointer));
    input.on("pointermove", (pointer: Input.Pointer) => this.onPointer("move", pointer));
    input.on("pointerup", (pointer: Input.Pointer) => this.onPointer("up", pointer));
    input.on("pointerupoutside", (pointer: Input.Pointer) => this.onPointer("up", pointer));
    const onScreen = (point: Point) => clampInto(LAYOUT.screen, point);
    listenPagePresses(this.scene, {
      cancel: (press, point) => this.onPress("cancel", press, onScreen(point), false),
      down: (press, point) => {
        const landed = walkPagePoint(LAYOUT, point);
        if (landed !== undefined) {
          this.onPress("down", press, landed, false);
        }
      },
      move: (press, point) => this.onPress("move", press, onScreen(point), false),
      up: (press, point) => this.onPress("up", press, onScreen(point), false),
    });
  }

  // The lane moves queued for the next step, which the pack's drawing leads with.
  queued(): readonly SessionInput[] {
    return this.pending;
  }

  // The lane moves queued since the last step.
  takePending(): SessionInput[] {
    const inputs = this.pending;
    this.pending = [];
    return inputs;
  }

  // A press under way when a card or the menu opens, or the page loses focus, is dropped:
  // its release may never arrive. An open explanation closes with it.
  dropPress(): void {
    this.pointers = idleTrack;
  }

  // The explanation a hold opened, while it is open; the walk stays paused until a tap closes
  // it.
  explanation(): ExplainTarget | undefined {
    return this.pointers.open;
  }

  // The effect well a press is down on while it is still a hold candidate, which shows pressed.
  pressedEffect(): number | undefined {
    const { hold } = this.pointers;
    const target = hold === undefined ? undefined : this.context().explainAt(hold.start);
    return target?.kind === "effect" ? target.effect : undefined;
  }

  // Each frame: a press held still on an element long enough opens its explanation.
  tick(nowMs: number): void {
    const presses = this.presses();
    this.pointers = tickTrack(this.context(), presses, nowMs, this.pointers);
  }

  // M, P and Escape are the walk bar's keys, which the HUD handles. Phaser hands a key down to
  // this listener as the browser fires it, auto-repeats included.
  private onKey(event: KeyboardEvent): void {
    if (!sceneKeyAllowed(event) || canvasInputBlocked(this.scene)) {
      return;
    }
    const action = walkKeyAction(event.code, event.repeat);
    if (action !== undefined && this.act(action)) {
      event.preventDefault();
    }
  }

  // What the walk's presses do now: nothing once the walk is over or before it starts. A card
  // open is part of the walk.
  private presses(): PressMode {
    if (canvasInputBlocked(this.scene)) {
      return "none";
    }
    const walk = this.host.walk();
    const going = walk !== undefined && walk.run.phase.kind !== "ended";
    return going ? walkPresses(this.host.runPause()) : "none";
  }

  // Phaser reports a cancelled touch as a release with wasCanceled set.
  private onPointer(phase: "down" | "move" | "up", pointer: Input.Pointer): void {
    if (
      !primaryCanvasContact(phase, pointer) ||
      (phase === "down" && !canvasPressAllowed(this.scene))
    ) {
      return;
    }
    const press = { downTime: pointer.downTime, id: pointer.id };
    const logical = logicalPoint(this.scene, pointer);
    // The native backing includes the page margins. Keep their existing page-press policy
    // rather than treating a new backing pixel as a new logical control area.
    const outside =
      deviceFitOwned(this.scene.scale) && !containsPoint(LAYOUT.screen, logical.x, logical.y);
    const point = !outside
      ? logical
      : phase === "down"
        ? walkPagePoint(LAYOUT, logical)
        : clampInto(LAYOUT.screen, logical);
    if (point === undefined) {
      return;
    }
    const debuffs = this.host.explainShown().debuffs.length;
    const onButton = phase === "down" && topBarButtonAt(debuffs, point.x, point.y) !== undefined;
    this.onPress(phase === "up" && pointer.wasCanceled ? "cancel" : phase, press, point, onButton);
  }

  // A press on the canvas or on the page beside it, at point in game pixels. onButton: it went
  // down on a walk-bar button. The run scene keeps running while a card, the zone celebration or
  // the pause menu covers the walk, and the press is theirs then (walkPresses). A press on what
  // opens on a tap bursts as it lands, as a button's does, and its tap opens the explanation at
  // once, the burst playing on over it.
  private onPress(phase: PointerPhase, press: Press, point: Point, onButton: boolean): void {
    const presses = this.presses();
    const context = this.context();
    if (phase === "down" && presses !== "none" && this.pointers.open === undefined) {
      const target = context.explainAt(point);
      if (target !== undefined && context.opensOnTap(target)) {
        addTapBurst(this.scene, point.x, point.y);
      }
    }
    const sample: PointerSample = {
      onButton,
      phase,
      point,
      press,
      timeMs: this.scene.game.loop.time,
    };
    const result = trackPointer(context, presses, sample, this.pointers);
    this.pointers = result.track;
    result.actions.forEach((action) => this.act(action));
    const { tapped } = result;
    if (tapped !== undefined) {
      this.openTapped(tapped);
    }
  }

  // Opens the explanation of what a tap at point landed on, if presses reach it and none is
  // open, dropping every press as a hold's opening does.
  private openTapped(point: Point): void {
    const presses = this.presses();
    if (presses === "none" || this.pointers.open !== undefined) {
      return;
    }
    const open = this.context().explainAt(point);
    if (open !== undefined) {
      this.pointers = { ...idleTrack, open };
    }
  }

  private context(): TrackContext<ExplainTarget> {
    const stepMoves = (direction: LaneDirection) => this.stepMoves(direction);
    return trackContext(this.host.explainShown(), stepMoves);
  }

  // The walk that takes live lane moves now, if any does.
  private steerable(): Walk | undefined {
    const walk = this.host.walk();
    if (walk === undefined || walk.run.phase.kind !== "walking") {
      return undefined;
    }
    if (!gameplayAllowed(this.host.runPause()) || this.host.replaying()) {
      return undefined;
    }
    return walk;
  }

  // Lane moves wait for the next simulation step, where they are logged.
  private act(action: GestureAction): boolean {
    if (this.steerable() === undefined) {
      return false;
    }
    this.pending = [...this.pending, { direction: action.direction, kind: "lane" }];
    return true;
  }

  // Whether a lane move that way, after the ones queued, would move the pack's target lane.
  private stepMoves(direction: LaneDirection): boolean {
    const walk = this.steerable();
    if (walk === undefined) {
      return false;
    }
    const queued = leadWalk(gameData, LANE_COUNT, 0, this.pending, walk);
    const stepped = steerWalk(gameData, LANE_COUNT, direction, queued);
    return stepped.road.control.target !== queued.road.control.target;
  }
}

// A tap on a debuff bar does nothing, and a press on anything that explains itself opens its
// explanation once still for holdSeconds within swipeStartDistance, the drag's first
// step, or on a tap within it for what opens on a tap (opensOnTap).
function trackContext(
  shown: ExplainShown,
  stepMoves: (direction: LaneDirection) => boolean,
): TrackContext<ExplainTarget> {
  const swipeStartDistance = read(gameData.tuning, "pixels", "swipeStartDistance");
  return {
    config: { laneCount: LANE_COUNT, swipeStartDistance },
    explainAt: (point) => explainTargetAt(LAYOUT, shown, point),
    hold: holdRule(gameData.tuning, swipeStartDistance),
    layout: LAYOUT,
    opensOnTap,
    quietTaps: debuffBarRects(LAYOUT.topBar, shown.debuffs.length),
    stepMoves,
  };
}

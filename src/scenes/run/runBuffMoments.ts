import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";
import type { Scene } from "phaser";

import { playEffect, tagTopY } from "../../assets/phaser/index.ts";
import type { DogId } from "../../data/ids.ts";
import { CHARM } from "../../data/index.ts";
import {
  type BuffPop,
  FLY_HEART,
  heartPopFrame,
  type ReachLine,
  type RoadMarks,
  stackOverPop,
} from "../../hud/index.ts";
import { BUFF_POP, charmByWalkerRect, charmOverRect } from "../../layout/index.ts";
import { PALETTE, pixelLinePoints } from "../../ui/index.ts";
import { fillRect } from "../../ui/phaser/index.ts";
import { floatValue, popCharm } from "../buffCharm.ts";
import { FEEDBACK_ART } from "../feedbackArt.ts";
import { floatChipHeight, type HeartPopPlace, wholeForgivenRow } from "../packFeedback.ts";
import { dogTop } from "../pullSignals.ts";
import type { ItemViews } from "./itemViews.ts";
import type { PackView } from "./packView.ts";
import { BUFF_GLINT_EVENT } from "./runMomentEvents.ts";
import { DEPTH, LAYOUT, overPack } from "./stage.ts";

interface BuffMomentDeps {
  items: Pick<ItemViews, "point">;
  pack: Pick<PackView, "dogPoint" | "walkerSprite">;
  still: () => boolean;
}

interface BuffAnchors {
  heartPops: Map<DogId, HeartPopPlace>;
  head?: Point | undefined;
  point: Point | undefined;
}

// The heart pops' top opaque row, fx-heart-gain's and fx-heart-loss's pop tags alike.
export function popInkTop(scene: Scene): number {
  const { heartGain, heartLoss } = FEEDBACK_ART;
  return Math.min(...[heartGain, heartLoss].map(({ key, pop }) => tagTopY(scene, key, pop)));
}

// Each reach's dotted line, its well glinting, and each buff's pop.
export function markRoad(
  scene: Scene,
  deps: BuffMomentDeps,
  anchors: BuffAnchors,
  { pops, reaches }: RoadMarks,
): void {
  for (const reach of reaches) {
    reachLine(scene, deps, anchors.point, reach);
    scene.events.emit(BUFF_GLINT_EVENT, reach.glint);
  }
  popBuffs(scene, deps, anchors, pops);
}

// Each buff's pop: its well glinting, its charm, lit, a chip of the value it made over the
// charm, if any, and a forgiven bump's heart turning from loss to gain as its charm shows
// beside the walker.
export function popBuffs(
  scene: Scene,
  deps: BuffMomentDeps,
  anchors: BuffAnchors,
  pops: readonly BuffPop[],
): void {
  const still = deps.still();
  for (const pop of pops) {
    const rect = popRect(deps, anchors, pop);
    if (rect === undefined) {
      continue;
    }
    const at = { x: rect.x - pop.index * (CHARM.size + CHARM.gap), y: rect.y };
    const shownAtMs = pop.forgiven === null ? 0 : BUFF_POP.switchMs;
    const show = () => {
      popCharm(scene, { depth: DEPTH.fx, shownAtMs, still }, pop.item, at);
      scene.events.emit(BUFF_GLINT_EVENT, pop.item);
      if (pop.chip !== null) {
        const anchor = { centreX: at.x + CHARM.size / 2, lineBottom: at.y - BUFF_POP.gap };
        floatValue(scene, { depth: DEPTH.fx + 1, shownAtMs, still }, anchor, pop.chip);
      }
    };
    if (pop.forgiven === null) {
      show();
    } else {
      forgivenHeart(scene, deps, anchors, pop.forgiven);
      scene.time.delayedCall(shownAtMs, show);
    }
  }
}

// The charm's place: beside the walker's head, over its dog, over its item, or over the pack.
function popRect(deps: BuffMomentDeps, anchors: BuffAnchors, pop: BuffPop): Rect | undefined {
  const overPackRect = () => {
    if (anchors.point === undefined) {
      return undefined;
    }
    const over = overPack(anchors.point);
    return charmOverRect(over.x, over.y);
  };
  switch (pop.at.kind) {
    case "walker":
      return charmByWalkerRect(dogTop(deps.pack.walkerSprite()));
    case "dog": {
      const under = anchors.heartPops.get(pop.at.dog);
      if (under !== undefined) {
        const { size } = CHARM;
        const { bottom } = stackOverPop(under, size);
        const x = Math.round(under.frame.x + FLY_HEART.frame / 2 - size / 2);
        return { height: size, width: size, x, y: bottom - size };
      }
      const top = deps.pack.dogPoint(pop.at.dog);
      return top === undefined ? overPackRect() : charmOverRect(top.x, top.y);
    }
    case "item": {
      const point = deps.items.point(pop.at.item);
      return point === null ? overPackRect() : charmOverRect(point.x, point.y);
    }
    case "pack":
      return overPackRect();
    default:
      return pop.at satisfies never;
  }
}

// Long reach's 1px amber dotted line from its dog, or the pack, to the item it grabbed.
function reachLine(
  scene: Scene,
  deps: BuffMomentDeps,
  pack: Point | undefined,
  reach: ReachLine,
): void {
  const from = reach.dog === null ? pack : deps.pack.dogPoint(reach.dog);
  const to = deps.items.point(reach.item);
  if (from === undefined || to === null) {
    return;
  }
  const g = scene.add.graphics().setDepth(DEPTH.fx);
  const points = pixelLinePoints(
    Math.round(from.x),
    Math.round(from.y),
    Math.round(to.x),
    Math.round(to.y),
  );
  points.forEach(([x, y], i) => {
    if (i % 2 === 0) {
      fillRect(g, PALETTE.amber, { height: 1, width: 1, x, y });
    }
  });
  scene.time.delayedCall(BUFF_POP.reachMs, () => g.destroy());
}

// A forgiven bump's heart over its dog: the loss pop (the HUD plays it for a loss forgiven in
// part), turning to the gain pop at switchMs, moved down when its forgiven label stacked over
// it would rise past the walk view's top (stackOverPop).
function forgivenHeart(
  scene: Scene,
  deps: BuffMomentDeps,
  anchors: BuffAnchors,
  forgiven: NonNullable<BuffPop["forgiven"]>,
): void {
  const top = (forgiven.whole ? anchors.head : undefined) ?? deps.pack.dogPoint(forgiven.dog);
  if (top === undefined) {
    return;
  }
  const inkTop = popInkTop(scene);
  const height = floatChipHeight(scene);
  const row =
    anchors.head !== undefined && forgiven.whole ? wholeForgivenRow(scene, top) : undefined;
  const { frame } =
    row ?? stackOverPop({ frame: heartPopFrame(top), inkTop }, height, LAYOUT.walkView.y);
  anchors.heartPops.set(forgiven.dog, row ?? { frame, inkTop });
  const half = FLY_HEART.frame / 2;
  const centre = { x: frame.x + half, y: frame.y + half };
  const pop = (art: { key: string; pop: string }) =>
    playEffect(scene, art.key, art.pop, centre, DEPTH.fx);
  const loss = forgiven.whole ? pop(FEEDBACK_ART.heartLoss) : undefined;
  scene.time.delayedCall(BUFF_POP.switchMs, () => {
    loss?.destroy();
    pop(FEEDBACK_ART.heartGain);
  });
}

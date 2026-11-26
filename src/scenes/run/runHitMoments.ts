import type { Point, Rect } from "@andornaut/game-kit/runtime/rect";
import type { Scene } from "phaser";

import { minorLook } from "../../content/index.ts";
import type { DogId, EncounterId } from "../../data/ids.ts";
import { gameData } from "../../data/index.ts";
import {
  bumpFlash,
  type BumpSource,
  DOG_REACTIONS,
  dogReaction,
  hitEffects,
  obstacleMotion,
  splashEffect,
  whiteFlash,
} from "../../layout/index.ts";
import { hitWord, read } from "../../rules/index.ts";
import type { EncounterCard, MinorBump, WalkStep } from "../../runner/index.ts";
import { PALETTE } from "../../ui/index.ts";
import { hitLabelOf, hitLook, playEdgeFlash, playHitMoment } from "../hitMoment.ts";
import { flashWhite, moveObstacle, playHitEffects, shakeRoad } from "./hitFx.ts";
import type { ItemViews } from "./itemViews.ts";
import type { PackView } from "./packView.ts";
import { BUMP_FLASH_EVENT } from "./runMomentEvents.ts";
import { DEPTH, LAYOUT } from "./stage.ts";

interface HitMomentDeps {
  items: Pick<ItemViews, "struckBody">;
  pack: Pick<PackView, "dogFeet" | "dogPoint" | "dogsReact" | "sprites" | "stumble">;
  still: () => boolean;
}

// How long the step's hit stop holds the road, or a plain obstacle's stop while it has none.
function stopMs(step: WalkStep): number {
  const seconds = step.walk.road.hitStop?.seconds;
  return 1000 * (seconds ?? read(gameData.tuning, "seconds", "minorHitStopSeconds"));
}

// Where a hit's moment and label play: a little over the pack's point, for the step's hit stop.
function hitPlace(step: WalkStep, pack: Point): { centre: Point; seconds: number } {
  return { centre: { x: pack.x, y: pack.y - 20 }, seconds: step.walk.road.hitStop?.seconds ?? 0 };
}

// A hit's edge flash runs down the road and the backdrop band beside it.
function hitField(): Rect {
  const { backdrop, roadView } = LAYOUT;
  return { ...roadView, height: roadView.y + roadView.height - backdrop.y, y: backdrop.y };
}

// The hit moment over the pack, framed by the road and the backdrop band beside it, labelled
// with the encounter's hit label over its burst.
export function playHit(
  scene: Scene,
  deps: Pick<HitMomentDeps, "pack" | "still">,
  hit: EncounterCard,
  step: WalkStep,
  pack: Point,
): void {
  playHitMoment(scene, {
    caught: deps.pack.sprites(hit.affected),
    ...hitPlace(step, pack),
    depth: DEPTH.popup,
    encounter: hit.encounter,
    field: hitField(),
    kind: gameData.encounters[hit.encounter].kind,
    label: hitLabelOf(gameData.encounters[hit.encounter]),
    still: deps.still(),
    word: hitWord(gameData.encounters[hit.encounter]),
  });
}

// A plain or moving hit's cues: its bump and debris over the struck dog, the dog reacting
// and flashing white, the struck obstacle's motion, and the bump's flash.
export function playBumpHit(
  scene: Scene,
  deps: HitMomentDeps,
  context: { ground: boolean },
  dog: DogId,
  item: MinorBump["item"],
  step: WalkStep,
): void {
  const still = deps.still();
  const hit = {
    kind: item.mover === undefined ? "plain" : "moving",
    obstacle: item.kind,
  } as const;
  const top = context.ground ? deps.pack.dogFeet(dog) : deps.pack.dogPoint(dog);
  if (top !== undefined) {
    const moment = {
      depth: context.ground ? DEPTH.sprite - 0.5 : DEPTH.fx,
      holdMs: stopMs(step),
    };
    playHitEffects(scene, moment, hitEffects(still, { ...hit, top }));
  }
  for (const sprite of deps.pack.sprites([dog])) {
    flashWhite(scene, sprite, whiteFlash(still));
  }
  deps.pack.dogsReact([dog], dogReaction(still, "hit"));
  const body = deps.items.struckBody(item.id);
  if (body !== undefined) {
    moveObstacle(scene, body, obstacleMotion(still, hit));
  }
  flashBump(scene, deps, { kind: "minor", look: minorLook(gameData, item.kind, item.skin) });
}

// A contact obstacle's cues: a splash at the touching dog's feet, its edge flash, the bump's
// flash, and the walker stumbling as every dog reacts and shakes off.
export function playContactHit(
  scene: Scene,
  deps: Pick<HitMomentDeps, "pack" | "still">,
  dog: DogId,
  encounter: EncounterId,
  step: WalkStep,
): void {
  const still = deps.still();
  const { kind } = gameData.encounters[encounter];
  const feet = deps.pack.dogFeet(dog);
  if (feet !== undefined) {
    const moment = { depth: DEPTH.sprite - 0.5, holdMs: stopMs(step) };
    playHitEffects(scene, moment, [splashEffect(still, feet)]);
  }
  const { flash } = hitLook(kind, encounter);
  if (flash !== null) {
    const moment = { depth: DEPTH.popup, field: hitField(), still };
    playEdgeFlash(scene, moment, flash);
  }
  flashBump(scene, deps, { encounter, kind: "encounter" });
  deps.pack.stumble(still, DOG_REACTIONS.splash);
}

// A bump's border round the screen, flashed by the HUD in the bump's colour, and the road's
// nudge unless motion is reduced.
export function flashBump(
  scene: Scene,
  deps: Pick<HitMomentDeps, "still">,
  source: BumpSource,
): void {
  const { colour, nudge } = bumpFlash(deps.still(), source);
  scene.events.emit(BUMP_FLASH_EVENT, PALETTE[colour]);
  if (nudge) {
    shakeRoad(scene);
  }
}

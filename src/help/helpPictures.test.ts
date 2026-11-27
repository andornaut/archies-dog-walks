import { itemAt } from "@andornaut/game-kit/runtime/arrays";
import { animationKey } from "@andornaut/game-kit/runtime/art/aseprite";
import { describe, expect, it } from "vitest";

import { dogSpriteKey } from "../assets/spriteKeys.ts";
import { gameData } from "../data/index.ts";
import { SCREEN_CONFIG } from "../data/screen.ts";
import type { HelpPictureId } from "../data/types.ts";
import { screenYAt } from "../layout/projection.ts";
import { ROAD_CAMERA, SCREEN_LAYOUT } from "../layout/screen.ts";
import { cardRowIn } from "../presentation/cardLayout.ts";
import { currentZoneId, forkPaths } from "../rules/route.ts";
import { pullPose } from "../runner/walk/pulls.ts";
import { walkProjection } from "../runner/walkGeometry.ts";
import { packDogs } from "../state/pack.ts";
import { cardHeader } from "../ui/cardRow.ts";
import { HELP_LAYOUT } from "./helpLayout.ts";
import {
  dragGlide,
  type DragLoop,
  dragMomentAt,
  HELP_SCENES,
  helpPicture,
  packStillFrames,
  type PictureStrip,
  stillDragMoment,
  TOUCH_DRAG,
} from "./helpPictures.ts";

const SCREEN = SCREEN_LAYOUT;
const PROJECTION = walkProjection(ROAD_CAMERA, SCREEN.road);
const IDS = gameData.help.map((page) => page.art);
const shows = (strips: readonly PictureStrip[], row: number) =>
  strips.some((strip) => row >= strip.screenY && row < strip.screenY + strip.height);

describe("helpPicture", () => {
  // Every picture fills its frame with strips of the screen that show the walker's feet, every
  // road item's feet, and a card's cards whole, under the walk bar and without the header band.
  it("frames every picture from strips of the screen showing what it is about", () => {
    for (const id of IDS) {
      const { strips } = helpPicture(gameData, id);
      expect(
        strips.reduce((sum, strip) => sum + strip.height, 0),
        id,
      ).toBe(HELP_LAYOUT.illustration.height);
      for (const strip of strips) {
        expect(strip.screenY).toBeGreaterThanOrEqual(SCREEN.topBar.y + SCREEN.topBar.height);
        expect(strip.screenY + strip.height).toBeLessThanOrEqual(SCREEN_CONFIG.height);
      }
    }
    const roads: HelpPictureId[] = ["lanes", "owners", "pickups", "pulls"];
    const unseen = roads.flatMap((id) => {
      const { strips, walk } = helpPicture(gameData, id);
      const rows = walk.road.items.map((item) =>
        Math.round(screenYAt(PROJECTION, PROJECTION.footY - (item.y + item.height))),
      );
      return [PROJECTION.footY, ...rows]
        .filter((row) => !shows(strips, row))
        .map((row) => `${id} ${row}`);
    });
    const cards: HelpPictureId[] = ["cards", "zones"];
    const uncut = cards.flatMap((id) => {
      const { card, strips } = helpPicture(gameData, id);
      const count = card?.options.length ?? 0;
      const rects = cardRowIn(SCREEN.walkView, count, count);
      const { subtitleTop, titleTop } = cardHeader(false, rects);
      const rows = rects.flatMap((rect) => [rect.y, rect.y + rect.height - 1]);
      return [
        ...rows.filter((row) => !shows(strips, row)).map((row) => `${id} ${row}`),
        ...[titleTop, subtitleTop]
          .filter((row) => shows(strips, row))
          .map((row) => `${id} header ${row}`),
      ];
    });
    expect([...unseen, ...uncut]).toEqual([]);
  });

  it("shows every option of the encounter's card as one the walk can afford", () => {
    const { encounter } = HELP_SCENES.cards;
    const { card } = helpPicture(gameData, "cards");
    const { resolution } = gameData.encounters[encounter];
    const names = "options" in resolution ? resolution.options.map(({ name }) => name) : [];
    expect(card?.options.map((option) => option.label)).toEqual(names);
    expect(card?.options.every((option) => option.availability.enabled)).toBe(true);
  });

  it("shows each owner's hearts by size and anchors the lead dog's heart loss to its head", () => {
    const { fired, lost } = HELP_SCENES.owners;
    const { changes, collisionLead, walk } = helpPicture(gameData, "owners");
    const [lead] = packDogs(walk.run);
    expect(collisionLead).toBe(lead);
    const hearts = walk.run.pack.map((slot) => (slot.status === "walking" ? slot.hearts : null));
    const expected = walk.run.pack.map(({ dog }) => {
      if (dog === fired) {
        return null;
      }
      const max = gameData.tuning.hearts.maxBySize[gameData.dogs[dog].size];
      return dog === lead ? max - lost : max;
    });
    expect(hearts).toEqual(expected);
    expect(changes).toEqual([
      expect.objectContaining({
        causes: [{ amount: -lost, kind: "bump" }],
        dog: lead,
        kind: "hearts",
      }),
    ]);
  });

  it.each([["pickups"]] satisfies [HelpPictureId][])(
    "walks %s in a zone that is neither the walk's first nor its last",
    (id) => {
      const { firstZone, lastZone } = gameData.world;
      const zone = currentZoneId(gameData, helpPicture(gameData, id).walk.run);
      expect([firstZone, lastZone]).not.toContain(zone);
    },
  );

  // A minor obstacle or card obstacle on a picture's road, or its card's encounter, is one its
  // neighbourhood brings.
  it.each(IDS)("shows on %s only obstacles its neighbourhood brings", (id) => {
    const { card, walk } = helpPicture(gameData, id);
    const zoneId = currentZoneId(gameData, walk.run);
    const zone = gameData.world.zones.find((candidate) => candidate.id === zoneId);
    const weights: Readonly<Record<string, number>> = {
      ...zone?.weights.minorObstacles,
      ...zone?.weights.obstacles,
    };
    const encounter = card?.source.kind === "encounter" ? [card.source.encounter] : [];
    const kinds = [...walk.road.items.map((item) => item.kind), ...encounter];
    expect(kinds.filter((kind) => weights[kind] === 0)).toEqual([]);
  });

  it("shows the fork after the first neighbourhood, its paths easiest first", () => {
    const { card, walk } = helpPicture(gameData, "zones");
    const paths = forkPaths(gameData, () => 0, walk.run.route);
    expect(card?.options.map((option) => option.path?.zone)).toEqual(paths);
  });
});

describe("dragMomentAt", () => {
  const loop = helpPicture(gameData, "lanes").drag as DragLoop;
  const { fromLane, toLane } = loop;
  const { dragPx } = TOUCH_DRAG;
  // A swipe of even frames, frame ms apart, its drag frames followed by two more.
  const frame = 100;
  const frameMs = Array.from({ length: dragPx.from + dragPx.px.length + 2 }, () => frame);
  const swipe = frameMs.length * frame;
  const swipeStart = itemAt(dragPx.px, 2);
  const glide = dragGlide(frameMs, swipeStart);
  const at = (ms: number) => dragMomentAt(frameMs, swipeStart, loop, ms / 1000);
  const nudge = 1;

  it("glides the pack from the frame whose drag reaches the first lane step", () => {
    expect(glide.start).toBe((dragPx.from + 2) * frame);
    expect(glide.end - glide.start).toBe(HELP_SCENES.lanes.glideFrames * frame);
  });

  // Each moment: ms into the loop, then the swipe's tag and frame, and the pack's lane (or
  // "moving").
  it.each([
    ["the swipe right's first frame", nudge, "right", 0, fromLane],
    ["the swipe right before its glide", glide.start - nudge, "right", dragPx.from + 1, fromLane],
    ["the swipe right's glide", glide.start + nudge, "right", dragPx.from + 2, "moving"],
    ["the swipe right after its glide", glide.end + nudge, "right", dragPx.from + 5, toLane],
    ["the swipe right's last frame", swipe - nudge, "right", frameMs.length - 1, toLane],
    ["the swipe left's first frame", swipe + nudge, "left", 0, toLane],
    ["the swipe left's glide", swipe + glide.start + nudge, "left", dragPx.from + 2, "moving"],
    ["the swipe left's last frame", 2 * swipe - nudge, "left", frameMs.length - 1, fromLane],
    ["the swipe right again", 2 * swipe + nudge, "right", 0, fromLane],
  ] as const)("shows %s", (_name, ms, tag, index, lane) => {
    const moment = at(ms);
    expect(moment.touch).toEqual({ index, tag });
    expect(moment.motion.kind === "still" ? moment.motion.lane : "moving").toBe(lane);
  });

  it("holds the still swipe with the pack in its new lane", () => {
    const still = stillDragMoment(loop);
    expect(still.touch).toEqual({ index: 0, tag: "still" });
    expect(still.motion).toEqual({ kind: "still", lane: toLane });
  });
});

describe("packStillFrames", () => {
  // Art's frames: a walking figure on its walk's first stride, a straining dog at the peak of
  // its tell's lean, and a halted pack on its idle's first frame.
  const CHOSEN: Readonly<Record<string, number>> = { idle: 0, tell: 1, walk: 0 };
  const shown = (id: HelpPictureId) => {
    const picture = helpPicture(gameData, id);
    const { run } = picture.walk;
    const walkerKey = gameData.walkers[run.walker].spriteKey;
    const pose = picture.halted ? "idle" : "walk";
    const figures = [
      { key: walkerKey, tag: pose },
      ...packDogs(run).map((dog) => ({
        key: dogSpriteKey(gameData, dog),
        tag: pullPose(gameData, run, picture.pulls, dog)?.tag ?? pose,
      })),
    ];
    return { figures, frames: packStillFrames(gameData, walkerKey, picture) };
  };

  it.each(IDS)("holds each pack figure of the %s picture on its chosen frame", (id) => {
    const { figures, frames } = shown(id);
    for (const { key, tag } of figures) {
      expect(frames[animationKey(key, tag)], `${key}:${tag}`).toBe(CHOSEN[tag]);
    }
  });

  it("covers every tag a picture's pack shows", () => {
    const tags = new Set(IDS.flatMap((id) => shown(id).figures.map(({ tag }) => tag)));
    expect([...tags].sort()).toEqual(Object.keys(CHOSEN).sort());
  });
});

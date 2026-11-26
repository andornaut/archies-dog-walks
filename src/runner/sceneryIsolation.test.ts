import { STEP_SECONDS } from "@andornaut/game-kit/runtime/clock/fixedStep";
import { randomStream } from "@andornaut/game-kit/runtime/random";
import { beforeAll, describe, expect, it } from "vitest";

import { gameData } from "../data/index.ts";
import { LANE_COUNT } from "../data/screen.ts";
import { distanceAtY } from "../layout/projection.ts";
import { ROAD_CAMERA, SCREEN_LAYOUT } from "../layout/screen.ts";
import { startAmbient, stepAmbient } from "../road/ambient.ts";
import { newRoadsidePlaces, placeRoadside, ROADSIDE } from "../road/roadsideProps.ts";
import { type KeptScenery, struckBy, struckNow } from "../road/struckScenery.ts";
import { newRun } from "../rules/newRun.ts";
import { currentZone, currentZoneId, zoneAt } from "../rules/route.ts";
import { screenRoadGeometry } from "./screenGeometry.ts";
import {
  chooseCard,
  runStreams,
  type Session,
  type SessionEvent,
  startSession,
  stepSession,
} from "./session.ts";
import { startRoad } from "./walk.ts";
import { walkProjection } from "./walkGeometry.ts";
import { zoneLength } from "./walkMotion.ts";

const STEPS = 60 * 90;
const LAYOUT = SCREEN_LAYOUT;
const PROJECTION = walkProjection(ROAD_CAMERA, LAYOUT.road);
const STAGE = { band: LAYOUT.backdrop, projection: PROJECTION };

// A scenery layer stepped beside the walk as the run scene steps it, with the step's events,
// returning how many of its sprites are out.
type Layer = (session: Session, events: readonly SessionEvent[]) => number;

const LAYERS: Readonly<Record<string, (seed: number) => Layer>> = {
  // The ambient movers, from the stream the scene gives them.
  ambient: (seed) => {
    const state = startAmbient();
    const deps = { drawable: () => true, random: randomStream(seed, "ambient"), stage: STAGE };
    return (session) => {
      const zone = currentZoneId(gameData, session.walk.run);
      const frame = {
        movers: gameData.ambient[zone],
        now: session.timeMs / 1000,
        travelled: session.distanceBeforeZone + session.walk.run.zoneDistance,
        zone,
      };
      stepAmbient(deps, frame, state);
      return state.slots.filter((slot) => slot.active).length;
    };
  },
  // The roadside props, from a table that stands a tree every slot along every zone, so the
  // layer places props however sparse the shipped table is.
  roadside: () => {
    const out = newRoadsidePlaces();
    const tree = { across: 270, dz: 0, key: "roadside-tree-maple" };
    const side = { gapStart: 0, gapStride: 1, lotStart: 0, lotStride: 1 };
    const zone = {
      gaps: [[tree]],
      lots: [[tree]],
      shadowColour: "3e8948",
      sides: { left: { ...side, offset: 0 }, right: { ...side, offset: 1 } },
      slot: 140,
    };
    const table = {
      ...ROADSIDE,
      zones: Object.fromEntries(gameData.world.zones.map(({ art }) => [art, zone])),
    };
    const stage = {
      frameWidth: () => 0,
      projection: PROJECTION,
      reach: distanceAtY(PROJECTION, LAYOUT.junction.y),
      table,
      width: LAYOUT.roadView.width,
    };
    return (session) => {
      const { route, zoneIndex } = session.walk.run;
      return placeRoadside(
        stage,
        {
          current: currentZone(gameData, session.walk.run).art,
          currentStart: session.distanceBeforeZone,
          previous: zoneIndex === 0 ? null : zoneAt(gameData, route, zoneIndex - 1).art,
          previousStart: session.distanceBeforeZone - zoneLength(gameData),
          scroll: session.distanceBeforeZone + session.walk.run.zoneDistance,
        },
        out,
      );
    };
  },
  // The obstacles hits took out of play, kept as scenery until they scroll off.
  struck: () => {
    let kept: KeptScenery[] = [];
    return (session, events) => {
      const { run } = session.walk;
      const { roadBottom } = screenRoadGeometry(run);
      const struck = events.flatMap((event) =>
        event.kind === "walked" ? struckBy(event.step) : [],
      );
      kept = [...kept, ...struck].filter((item) => struckNow(roadBottom, run, item) !== null);
      return kept.length;
    };
  },
};

// A walk of STEPS steps with no lane moves, taking each card's first enabled option.
function walk(
  seed: number,
  observe?: (session: Session, events: readonly SessionEvent[]) => void,
): { events: SessionEvent[]; session: Session } {
  const streams = runStreams(seed);
  const run = newRun(gameData, 3, { dogs: ["kilo", "lady"], gear: null, walker: "casey" });
  let session = startSession(gameData, streams, screenRoadGeometry, {
    road: startRoad(LANE_COUNT),
    run,
  });
  const events: SessionEvent[] = [];
  for (let step = 0; step < STEPS && session.walk.run.phase.kind !== "ended"; step++) {
    const card = session.card;
    const next =
      card === null
        ? stepSession(gameData, streams, screenRoadGeometry, STEP_SECONDS, [], session)
        : chooseCard(
            gameData,
            streams,
            screenRoadGeometry,
            card.options.find((option) => option.availability.enabled)?.index ?? "skip",
            session,
          );
    session = next.session;
    events.push(...next.events);
    observe?.(session, next.events);
  }
  return { events, session };
}

describe("scenery layers", { timeout: 30_000 }, () => {
  const seed = 1;
  const layers = Object.entries(LAYERS).map(([name, create]) => ({
    name,
    out: 0,
    step: create(seed),
  }));
  const struck = new Set<number>();
  let back = 0;
  let layered: ReturnType<typeof walk>;

  beforeAll(() => {
    layered = walk(seed, (session, events) => {
      for (const layer of layers) {
        layer.out += layer.step(session, events);
      }
      for (const event of events) {
        if (event.kind === "walked") {
          struckBy(event.step).forEach(({ item }) => struck.add(item.id));
        }
      }
      back += session.walk.road.items.filter(({ id }) => struck.has(id)).length;
    });
  });

  it("keeps the seeded walk and events unchanged with each scenery layer active", () => {
    for (const { name, out } of layers) {
      expect(out, name).toBeGreaterThan(0);
    }
    expect(layered).toEqual(walk(seed));
  });

  it("never puts an obstacle a hit took out of play back on the road", () => {
    expect(struck.size).toBeGreaterThan(0);
    expect(back).toBe(0);
  });
});

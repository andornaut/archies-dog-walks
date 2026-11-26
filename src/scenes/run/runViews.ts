import type { Scene } from "phaser";

import { gameData } from "../../data/index.ts";
import { currentZone, currentZoneId, previousZone, previousZoneId } from "../../rules/index.ts";
import type { Session, Walk } from "../../runner/index.ts";
import type { Loadout } from "../../state/index.ts";
import { colourFromHex } from "../../ui/index.ts";
import { walkerSpriteKey } from "../profileStore.ts";
import { AmbientView } from "./ambientView.ts";
import { BackdropView } from "./backdropView.ts";
import { DistractionView } from "./distractionView.ts";
import { ItemViews } from "./itemViews.ts";
import { LightsView } from "./lightsView.ts";
import { PackView } from "./packView.ts";
import { RoadsideView } from "./roadsideView.ts";
import { type RoadArt, RoadView } from "./roadView.ts";
import { showHint } from "./runMoments.ts";
import type { RunRandom } from "./runStart.ts";
import type { ShadowPool } from "./shadowPool.ts";
import { LAYOUT } from "./stage.ts";

// Create the layers that the walk draws over the backdrop, in scene creation order.
export function createRunViews(
  scene: Scene,
  { random, roadArt }: { readonly random: RunRandom; readonly roadArt: RoadArt },
  loadout: Loadout,
) {
  const backdrop = new BackdropView(scene);
  const ambient = new AmbientView(scene, random.ambient);
  const road = new RoadView(scene, roadArt, LAYOUT.rasterView);
  const roadside = new RoadsideView(scene);
  const lights = new LightsView(scene);
  const distractions = new DistractionView(scene, random.distractions);
  const pack = new PackView(scene, loadout.dogs, walkerSpriteKey(scene, loadout.walker));
  const items = new ItemViews(scene, (event) => showHint(scene, event));
  return { ambient, backdrop, distractions, items, lights, pack, road, roadside };
}

export type RunViews = ReturnType<typeof createRunViews>;

// Retire the replaced neighbourhood's views; a jump may keep both the route index and ID.
export function clearRunZoneViews(
  views: Pick<RunViews, "ambient" | "distractions" | "items">,
): void {
  views.ambient.clear();
  views.distractions.clear();
  views.items.clear();
}

export function drawRunViews(
  views: RunViews & { readonly shadows: ShadowPool },
  {
    ambientMs,
    distanceBeforeZone,
    held,
    pulls,
    still,
  }: Pick<Session, "distanceBeforeZone" | "pulls"> & {
    readonly ambientMs: number;
    readonly held: boolean;
    readonly still: boolean;
  },
  walk: Walk,
): void {
  const zone = currentZone(gameData, walk.run);
  views.backdrop.draw(zone);
  const zoneId = currentZoneId(gameData, walk.run);
  views.ambient.draw(gameData.ambient[zoneId], zoneId, {
    halted: held,
    now: ambientMs / 1000,
    still,
    travelled: distanceBeforeZone + walk.run.zoneDistance,
  });
  views.road.draw(walk, zone, distanceBeforeZone);
  const previous = previousZone(gameData, walk.run);
  views.roadside.draw(
    zone.art,
    previous?.art ?? null,
    distanceBeforeZone,
    distanceBeforeZone + walk.run.zoneDistance,
    { ms: ambientMs, still },
  );
  const shadow = views.shadows.frame(colourFromHex(zone.roadShadowColour));
  views.items.draw(walk, held, still, shadow);
  views.distractions.draw(walk, views.items.vergeItems(walk), { halted: held, still });
  views.pack.draw(walk, {
    halted: held,
    itemPoint: (id) => views.items.point(id),
    pulls,
    shadow,
    still,
  });
  views.shadows.hideUnused();
  // Last, so the lights follow every sprite where this frame has drawn it.
  views.lights.draw(
    zoneId,
    previousZoneId(gameData, walk.run),
    distanceBeforeZone,
    distanceBeforeZone + walk.run.zoneDistance,
    views.roadside.lightCarriers(),
  );
}

import type { Rect } from "@andornaut/game-kit/rect";
import type { GameObjects, Scene } from "phaser";

import { PALETTE } from "../ui/palette";
import { fillRect } from "../ui/phaser/draw";

export type SelectionRing = "frame" | "shop" | "tile";
interface OrbitSegment {
  colour: "cream" | "white";
  rect: Rect;
}

// The band follows the actual drawn perimeter, clockwise from its top-left inset corner.
export function selectionOrbitSegments(
  rect: Rect,
  kind: SelectionRing,
  timeMs: number,
): OrbitSegment[] {
  const { height, width } = rect;
  if (width < 4 || height < 4) {
    return [];
  }
  const stroke = kind === "shop" ? 3 : 2;
  const across = width - 3;
  const down = height - 3;
  const perimeter = 2 * (across + down);
  const length = Math.max(32, Math.min(80, Math.round(0.22 * perimeter)));
  const head = ((((timeMs % 2400) + 2400) % 2400) / 2400) * perimeter;
  const rows: OrbitSegment[] = [];
  for (let y = 1; y < height - 1; y++) {
    let run: OrbitSegment | undefined;
    for (let x = 1; x < width - 1; x++) {
      if (y > stroke && y < height - stroke - 1 && x > stroke && x < width - stroke - 1) {
        run = undefined;
        x = width - stroke - 2;
        continue;
      }
      const distance = Math.min(x, y, width - 1 - x, height - 1 - y);
      let colour: OrbitSegment["colour"] | undefined;
      const cut = kind === "frame" && (x === 1 || x === width - 2) && (y === 1 || y === height - 2);
      if (distance <= stroke && !cut) {
        const at =
          y <= stroke
            ? x - 1
            : x >= width - stroke - 1
              ? across + y - 1
              : y >= height - stroke - 1
                ? across + down + width - 2 - x
                : 2 * across + down + height - 2 - y;
        const behind = (head - at + perimeter) % perimeter;
        if (behind < length) {
          colour = behind < length / 2 && (kind !== "shop" || distance === 2) ? "white" : "cream";
        }
      }
      if (
        colour !== undefined &&
        run?.colour === colour &&
        run.rect.x + run.rect.width === rect.x + x
      ) {
        run.rect.width++;
      } else {
        run =
          colour === undefined
            ? undefined
            : { colour, rect: { height: 1, width: 1, x: rect.x + x, y: rect.y + y } };
        if (run !== undefined) {
          rows.push(run);
        }
      }
    }
  }
  const segments: OrbitSegment[] = [];
  const previous = new Map<string, OrbitSegment>();
  for (const row of rows) {
    const key = `${row.colour}:${row.rect.x}:${row.rect.width}`;
    const above = previous.get(key);
    if (above !== undefined && above.rect.y + above.rect.height === row.rect.y) {
      above.rect.height++;
    } else {
      segments.push(row);
      previous.set(key, row);
    }
  }
  return segments;
}

interface OrbitEntry {
  graphics: GameObjects.Graphics;
  kind: SelectionRing;
  rect: Rect;
}
interface OrbitOwner {
  entries: Set<OrbitEntry>;
  stop: () => void;
  update: () => void;
}
const owners = new WeakMap<Scene, OrbitOwner>();

// All moving selection borders in a scene share one update listener and elapsed scene time.
export function addSelectionOrbit(
  scene: Scene,
  parent: GameObjects.Container,
  rect: Rect,
  kind: SelectionRing,
  reducedMotion: boolean,
): void {
  if (reducedMotion) {
    return;
  }
  let owner = owners.get(scene);
  const draw = ({ graphics, kind, rect }: OrbitEntry) => {
    graphics.clear();
    for (const segment of selectionOrbitSegments(rect, kind, scene.time.now)) {
      fillRect(graphics, PALETTE[segment.colour], segment.rect);
    }
  };
  if (owner === undefined) {
    const entries = new Set<OrbitEntry>();
    const update = () => entries.forEach(draw);
    const stop = () => {
      [...entries].forEach(({ graphics }) => graphics.destroy());
    };
    owner = { entries, stop, update };
    owners.set(scene, owner);
    scene.events.on("update", update);
    scene.events.once("shutdown", stop);
  }
  const graphics = scene.add.graphics();
  parent.add(graphics);
  const entry = { graphics, kind, rect };
  owner.entries.add(entry);
  const current = owner;
  graphics.once("destroy", () => {
    current.entries.delete(entry);
    if (current.entries.size === 0) {
      scene.events.off("update", current.update);
      scene.events.off("shutdown", current.stop);
      owners.delete(scene);
    }
  });
  draw(entry);
}

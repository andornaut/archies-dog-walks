import { itemAt } from "@andornaut/game-kit/runtime/arrays";
import { containsPoint, type Rect } from "@andornaut/game-kit/runtime/rect";

import type { DogId, GearId, WalkerId } from "../../data/ids.ts";
import { gameData } from "../../data/index.ts";
import {
  gearByPrice,
  HOME_LAYOUT,
  homeBarButtons,
  type Purchase,
  rosterRows,
  tileFace,
} from "../../home/index.ts";
import { walkerOrder } from "../../rules/index.ts";
import { gridRects, rectIndexAt } from "../../ui/index.ts";

const SLOT_SIGN = HOME_LAYOUT.slotSign;
const POCKET = HOME_LAYOUT.pocket;
const WALKER_TILES = HOME_LAYOUT.walkerTiles;
const WALKER_ORIGIN = HOME_LAYOUT.walkerOrigin;
const DOG_TILES = HOME_LAYOUT.dogTiles;
const DOG_TILE_INSET = HOME_LAYOUT.dogTileInset;
const DOG_ORIGIN = HOME_LAYOUT.dogOrigin;
const START_BUTTON: Rect = HOME_LAYOUT.startButton;

export function walkerIds(): WalkerId[] {
  return walkerOrder(gameData);
}
export function gearIds(): GearId[] {
  return gearByPrice(gameData);
}
export type DetailTarget =
  | Extract<Purchase, { kind: "dogSlot" }>
  | {
      dog: DogId;
      kind: "dog";
    }
  | {
      gear: GearId;
      kind: "gear";
    }
  | {
      kind: "walker";
      walker: WalkerId;
    };
export type Target =
  | {
      dog: DogId;
      kind: "dog";
    }
  | {
      gear: GearId;
      kind: "gear";
    }
  | {
      kind: "bubble";
    }
  | {
      kind: "exit";
    }
  | {
      kind: "help";
    }
  | {
      kind: "logbook";
    }
  | {
      kind: "menu";
    }
  | {
      kind: "mute";
    }
  | {
      kind: "petShop";
    }
  | {
      kind: "settings";
    }
  | {
      kind: "slotSign";
    }
  | {
      kind: "start";
    }
  | {
      kind: "walker";
      walker: WalkerId;
    };
// One key per tappable thing, for its feedback timers.
export function targetId(target: Target): string {
  switch (target.kind) {
    case "dog":
      return `dog:${target.dog}`;
    case "gear":
      return `gear:${target.gear}`;
    case "walker":
      return `walker:${target.walker}`;
    default:
      return target.kind;
  }
}
// The roster as the grid lays it out, row by row (rosterRows): tiles, taps and keyboard focus
// all read this one order.
export function rosterOrder(): DogId[] {
  return rosterRows(gameData).flat();
}
export function dogTiles(): Rect[] {
  return gridRects(DOG_TILES, rosterOrder().length, DOG_ORIGIN);
}
// A dog tile as drawn, inside its hit area.
export function dogFace(hit: Rect): Rect {
  return tileFace(DOG_TILE_INSET, hit);
}
// The Pocket section's cells, cheapest first (gearByPrice); each draws its tile inset inside.
export function gearSlots(): Rect[] {
  return gridRects(POCKET.cells, gearIds().length, POCKET.origin);
}
export function pocketTile(cell: Rect): Rect {
  return tileFace(POCKET.tileInset, cell);
}
export function walkerTiles(): Rect[] {
  return gridRects(WALKER_TILES, walkerIds().length, WALKER_ORIGIN);
}
// A walker tile as drawn, inside its hit area.
export function walkerFace(hit: Rect): Rect {
  return tileFace(HOME_LAYOUT.walkerTileInset, hit);
}
// Keyboard rows follow the visible controls in reading order.
export function focusRows(shown: { sign: boolean }): Target[][] {
  const top: Target[] = [
    ...(shown.sign ? [{ kind: "slotSign" } as const] : []),
    { kind: "petShop" },
  ];
  const rows: Target[][] = [top, walkerIds().map((walker) => ({ kind: "walker", walker }))];
  const dogs = rosterOrder().map((dog): Target => ({ dog, kind: "dog" }));
  for (let i = 0; i < dogs.length; i += DOG_TILES.columns) {
    rows.push(dogs.slice(i, i + DOG_TILES.columns));
  }
  rows.push(
    gearIds().map((gear) => ({ gear, kind: "gear" })),
    [{ kind: "start" }],
  );
  return rows;
}

export function homeTargetAt(
  state: {
    readonly bubbleHits: readonly Rect[];
    readonly exit: boolean;
    readonly naming: () => boolean;
    readonly signShown: () => boolean;
  },
  x: number,
  y: number,
): Target | undefined {
  const tile = rectIndexAt(dogTiles(), x, y);
  if (tile !== undefined) {
    return { dog: itemAt(rosterOrder(), tile), kind: "dog" };
  }
  const slot = rectIndexAt(gearSlots(), x, y);
  if (slot !== undefined) {
    return { gear: itemAt(gearIds(), slot), kind: "gear" };
  }
  const walker = rectIndexAt(walkerTiles(), x, y);
  if (walker !== undefined) {
    return { kind: "walker", walker: itemAt(walkerIds(), walker) };
  }
  const bar = homeBarButtons(state.exit).map(([kind, { hit }]): [Rect, Target] => [hit, { kind }]);
  const fixed: readonly [Rect, Target][] = [[START_BUTTON, { kind: "start" }], ...bar];
  if (state.signShown() && containsPoint(SLOT_SIGN.hit, x, y)) {
    return { kind: "slotSign" };
  }
  const control = fixed.find(([rect]) => containsPoint(rect, x, y))?.[1];
  if (control !== undefined) {
    return control;
  }
  // Under the top bar, and over the Pet shop, the bubble and the walker at the gate take taps
  // only on a visit with walkers to name, with a walker picked to name them.
  if (state.naming() && state.bubbleHits.some((hit) => containsPoint(hit, x, y))) {
    return { kind: "bubble" };
  }
  return containsPoint(HOME_LAYOUT.petShop.hit, x, y) ? { kind: "petShop" } : undefined;
}

export function nativeTarget(id: string): Target | undefined {
  const targets: Target[] = [
    ...rosterOrder().map((dog): Target => ({ dog, kind: "dog" })),
    ...gearIds().map((gear): Target => ({ gear, kind: "gear" })),
    ...walkerIds().map((walker): Target => ({ kind: "walker", walker })),
    { kind: "bubble" },
    { kind: "start" },
    { kind: "slotSign" },
  ];
  return targets.find((target) => targetId(target) === id);
}

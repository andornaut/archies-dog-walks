import type { Rect } from "@andornaut/game-kit/runtime/rect";

// Half-open alpha bounds of the authored Start pictures. Portrait bounds include every
// Neutral and Happy frame so selecting a different expression does not shift the face.
export const START_PICKER_INK: Readonly<
  Record<string, readonly [left: number, top: number, right: number, bottom: number]>
> = {
  "face-dog-archie": [3, 1, 30, 32],
  "face-dog-buddy": [4, 0, 29, 28],
  "face-dog-ginger": [1, 1, 31, 31],
  "face-dog-kilo": [3, 0, 30, 32],
  "face-dog-lady": [1, 4, 31, 32],
  "face-dog-penny": [1, 0, 31, 32],
  "face-dog-pepe": [1, 2, 31, 32],
  "face-dog-reggie": [2, 0, 30, 31],
  "face-dog-sequoia": [0, 0, 32, 32],
  "face-walker-ada": [3, 3, 29, 32],
  "face-walker-casey": [5, 2, 27, 32],
  "face-walker-mr-b": [5, 4, 27, 32],
  "face-walker-trista": [5, 3, 27, 32],
  "icon-hud-effect-perk-keen-eye": [0, 0, 24, 24],
  "icon-hud-effect-perk-long-reach": [1, 0, 23, 23],
  "icon-hud-effect-perk-quick-recovery": [0, 1, 24, 23],
  "icon-hud-effect-perk-second-chance": [1, 1, 23, 22],
  "item-fanny-pack": [0, 8, 32, 28],
  "item-hall-pass": [2, 0, 30, 30],
  "item-lucky-collar": [4, 5, 28, 28],
  "item-running-shoes": [2, 9, 30, 25],
  "item-whistle": [3, 6, 31, 29],
};

// Place the full native frame so its ink is centred in the approved region.
export function pickerPicture(inside: Rect, key: string, x: number, y: number, size: number) {
  const [left, top, right, bottom] = START_PICKER_INK[key] ?? [0, 0, size, size];
  return {
    x: x + inside.x + Math.round((inside.width - left - right) / 2),
    y: y + inside.y + Math.round((inside.height - top - bottom) / 2),
  };
}

export const START_PICKER_MARK = { x: -8, y: -6 } as const;

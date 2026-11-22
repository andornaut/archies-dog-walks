import { splitDepthKey } from "./depthSteps.ts";
import { LOADING_ART } from "./spriteKeys.ts";

// Pages in load order: the loading screen's art first, so it shows while the rest loads.
export const ATLAS_GROUPS = ["boot", "ui", "run", "road"] as const;
export type AtlasGroup = (typeof ATLAS_GROUPS)[number];
// A key's grouping decides whether it trims. The page grouping also accounts for filtering.
type KeyGroup = Exclude<AtlasGroup, "road"> | "home";

// The groups whose pages draw with linear filtering. A page's filter covers every frame on it,
// so the road art drawn between its depth steps packs on pages of its own.
const LINEAR_GROUPS: ReadonlySet<AtlasGroup> = new Set(["road"]);

const LOADING_KEYS: ReadonlySet<string> = new Set(Object.values(LOADING_ART));
const GROUP_PREFIXES: readonly (readonly [KeyGroup, readonly string[]])[] = [
  ["ui", ["badge-", "face-", "font-", "icon-", "item-", "logo", "portrait-", "screen-", "ui-"]],
];

// Road art the home screen and its menus draw too: each dog, owner and walker at full size
// (not their depth steps), the coin, and the effects of a tap, a dog's hop and a celebration.
const HOME_PREFIXES = ["dog-", "owner-", "walker-"];
const HOME_KEYS: ReadonlySet<string> = new Set([
  "fx-confetti",
  "fx-dust",
  "fx-new-best",
  "fx-tap",
  "tip",
]);

const isHomeArt = (key: string): boolean =>
  HOME_KEYS.has(key) ||
  (HOME_PREFIXES.some((prefix) => key.startsWith(prefix)) && splitDepthKey(key).base === key);

// boot is the loading screen; ui the home screen, menus, HUD, icons and fonts; home the road art
// the home screen draws too; run the choice cards and everything else on the road.
export function atlasGroupOf(key: string): KeyGroup {
  if (LOADING_KEYS.has(key)) {
    return "boot";
  }
  if (isHomeArt(key)) {
    return "home";
  }
  const match = GROUP_PREFIXES.find(([, prefixes]) =>
    prefixes.some((prefix) => key.startsWith(prefix)),
  );
  return match?.[0] ?? "run";
}

// The sprites among keys that have a depth step variant: the road sprites drawn through their
// depth steps.
export function steppedBases(keys: Iterable<string>): Set<string> {
  const bases = new Set<string>();
  for (const key of keys) {
    const { base } = splitDepthKey(key);
    if (base !== key) {
      bases.add(base);
    }
  }
  return bases;
}

// Home art shares the nearest-filtered run pages. The road art drawn between its depth steps
// (each depth step variant and the full size of a sprite with one) has linear filtering and its
// own pages. The home screen draws the pack at 1x, so it stays nearest-filtered.
export function pageGroupOf(stepped: ReadonlySet<string>, key: string): AtlasGroup {
  const group = atlasGroupOf(key);
  if (group === "home") {
    return "run";
  }
  return group === "run" && stepped.has(splitDepthKey(key).base) ? "road" : group;
}

// Whether a key's texture draws with linear filtering, given steppedBases of the keys loaded.
// At 1x on a whole pixel, as Phaser places unscaled sprites, linear filtering samples each
// texel's centre and draws the same pixels as nearest.
export function filtersLinear(stepped: ReadonlySet<string>, key: string): boolean {
  return LINEAR_GROUPS.has(pageGroupOf(stepped, key));
}

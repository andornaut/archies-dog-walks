// The cheats, free of Phaser and the DOM: the next walk's choices, the Start screen's grants and
// this walk's actions, as pure changes. What they change is saved like normal play.
import { assertNever } from "@andornaut/game-kit/runtime/assertNever";
import { keysOf } from "@andornaut/game-kit/runtime/records";
import { pixels } from "@andornaut/game-kit/runtime/units";

import type { DebuffId, GearId, UpgradeId, ZoneId } from "../data/ids.ts";
import type { GameData } from "../data/index.ts";
import { applyEffects, firstZoneId, ownerMaxHearts, type RouteData } from "../rules/index.ts";
import { type Walk, zoneLength } from "../runner/index.ts";
import { MAX_RUN_DOGS, type SaveDocument } from "../save/schema.ts";
import { mapPack, type PackSlot, type RunState } from "../state/index.ts";
import { addCents, type Cents, cents, clampHearts } from "../units.ts";
import { MAX_SEED, type RunSetup, runSetupLink } from "./runSetup.ts";

// sessionStorage: an input log, as encodeInputLog writes it, for the next run to play back.
// The run that reads it should remove it, so a reload plays normally.
export const DEV_REPLAY_KEY = "archies-dog-walks.dev-replay";
// sessionStorage: the last finished run's input log, as encodeInputLog writes it. RunScene
// writes it at run end.
export const DEV_LAST_LOG_KEY = "archies-dog-walks.dev-last-log";

// The walk's movement speed under the speed cheat.
export type Speed = "fast" | "normal" | "slow";

// The speed choices, in the modal's order, with the walk's time scale at each.
export const SPEEDS: readonly { readonly id: Speed; readonly scale: number }[] = [
  { id: "slow", scale: 0.5 },
  { id: "normal", scale: 1 },
  { id: "fast", scale: 3 },
];

// What a walk plays by: invincible owners lose no hearts, and the speed scales its time.
export interface WalkCheats {
  readonly invincible: boolean;
  readonly speed: Speed;
}

export const WALK_CHEATS_OFF: WalkCheats = { invincible: false, speed: "normal" };

export function timeScaleOf(cheats: WalkCheats): number {
  return SPEEDS.find(({ id }) => id === cheats.speed)?.scale ?? 1;
}

// The run as the cheats leave it: invincible owners lose no hearts. A run already set as the
// cheats say is returned as it is.
export function withCheats(cheats: WalkCheats, run: RunState): RunState {
  const { invincible } = cheats;
  return (run.invincible ?? false) === invincible ? run : { ...run, invincible };
}

// The next walk's choices: the cheats it plays by, the neighbourhood it starts in (null for the
// first), its seed (null for a random one) and its Pocket item (undefined for the one picked on
// the Start screen, null for none).
export interface NextWalk extends WalkCheats {
  readonly pocket: GearId | null | undefined;
  readonly seed: number | null;
  readonly start: ZoneId | null;
}

export const NEXT_WALK_OFF: NextWalk = {
  ...WALK_CHEATS_OFF,
  pocket: undefined,
  seed: null,
  start: null,
};

// The neighbourhoods a walk can start in: the first, then the rest in world order.
export function startZones(data: RouteData): ZoneId[] {
  const first = firstZoneId(data);
  return [first, ...data.world.zones.map(({ id }) => id as ZoneId).filter((id) => id !== first)];
}

// The choice after current in choices, round to the first.
export function nextChoice<T>(choices: readonly T[], current: T): T {
  return choices[(choices.indexOf(current) + 1) % choices.length] as T;
}

// A seed typed in its field: a whole number in range, or empty for a random one; undefined for
// anything else, which leaves the seed as it was.
export function seedFrom(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed === "") {
    return null;
  }
  const seed = /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
  return seed <= MAX_SEED ? seed : undefined;
}

// The Pocket choices: the one picked on the Start screen, none, then every gear item.
export function pocketChoices(data: Pick<GameData, "shopGear">): (GearId | null | undefined)[] {
  return [undefined, null, ...keysOf(data.shopGear)];
}

// The setup the next walk starts from: base, with the next walk's seed, Pocket item and start,
// and Invincible owners when either turns it on. The first neighbourhood is walked first; any
// other second, after the first, as if picked at the first fork.
export function nextWalkSetup(data: RouteData, next: NextWalk, base: RunSetup): RunSetup {
  const first = firstZoneId(data);
  const start =
    next.start === null || next.start === first
      ? {}
      : { route: [first, next.start], zone: 2 as const };
  return {
    ...base,
    invincible: base.invincible || next.invincible,
    ...(next.pocket === undefined ? {} : { gear: next.pocket }),
    ...(next.seed === null ? {} : { seed: next.seed }),
    ...start,
  };
}

// The link Copy run link copies: the next walk as set up over base, at pageUrl.
export function nextWalkLink(
  data: RouteData,
  pageUrl: string,
  next: NextWalk,
  base: RunSetup,
): string {
  return runSetupLink(pageUrl, nextWalkSetup(data, next, base));
}

// What the Start screen's grants add: the bank's amounts, in the modal's order.
export const BANK_GRANTS: readonly Cents[] = [cents(10_000), cents(100_000), cents(1_000_000)];

// What this walk's Add adds to its earnings.
export const WALK_GRANT: Cents = cents(10_000);

export type OwnGrant = "all" | "dogSlots" | "dogs" | "gear" | "walkers";

type GrantData = Pick<GameData, "dogSlots" | "dogs" | "shopGear" | "walkers">;

export function addToBank(amount: Cents, save: SaveDocument): SaveDocument {
  return { ...save, bankCents: addCents(save.bankCents, amount) };
}

// What is already owned, in its order, then the rest of ids.
function withAll<Id extends string>(all: readonly Id[], owned: readonly Id[]): Id[] {
  return [...owned, ...all.filter((id) => !owned.includes(id))];
}

// Every walker, dog, dog slot or gear item a walk can use, or all four.
export function grantOwned(data: GrantData, grant: OwnGrant, save: SaveDocument): SaveDocument {
  const { owned } = save;
  const all = grant === "all";
  return {
    ...save,
    owned: {
      dogSlots:
        all || grant === "dogSlots"
          ? data.dogSlots.slice(0, MAX_RUN_DOGS).map((_, i) => i + 1)
          : owned.dogSlots,
      dogs: all || grant === "dogs" ? withAll(keysOf(data.dogs), owned.dogs) : owned.dogs,
      gear: all || grant === "gear" ? withAll(keysOf(data.shopGear), owned.gear) : owned.gear,
      walkers:
        all || grant === "walkers" ? withAll(keysOf(data.walkers), owned.walkers) : owned.walkers,
    },
  };
}

type WalkData = Pick<
  GameData,
  "debuffs" | "dogs" | "encounters" | "shopGear" | "tuning" | "upgrades" | "walkers"
>;

// This walk's earnings grow by amount, kept by an early end too.
export function addToWalk(amount: Cents, run: RunState): RunState {
  return {
    ...run,
    money: addCents(run.money, amount),
    zoneEndMoney: addCents(run.zoneEndMoney, amount),
  };
}

// Every walking owner at their max hearts.
export function refillHearts(data: Pick<GameData, "dogs" | "tuning">, run: RunState): RunState {
  const full = (slot: PackSlot): PackSlot => {
    if (slot.status !== "walking") {
      return slot;
    }
    const max = ownerMaxHearts(data, run, slot.dog);
    return { ...slot, hearts: clampHearts(max, max) };
  };
  return { ...run, pack: mapPack(full, run.pack) };
}

// The upgrades this walk has not picked yet, in draw order.
export function upgradesLeft(
  data: Pick<GameData, "upgradeDrawOrder">,
  run: Pick<RunState, "upgradesPicked">,
): UpgradeId[] {
  return data.upgradeDrawOrder.filter((id) => !run.upgradesPicked.includes(id));
}

// The upgrade added to this walk as a fork's path adds it, unless already picked.
export function grantUpgrade(data: WalkData, upgrade: UpgradeId, run: RunState): RunState {
  if (run.upgradesPicked.includes(upgrade)) {
    return run;
  }
  const granted = applyEffects(
    data,
    { affected: [], source: { kind: "upgrade", upgrade } },
    data.upgrades[upgrade].effects,
    run,
  );
  return { ...granted, upgradesPicked: [...granted.upgradesPicked, upgrade] };
}

// The debuff applied to the pack, as contact with what carries it applies it.
export function applyDebuff(data: WalkData, debuff: DebuffId, run: RunState): RunState {
  return applyEffects(
    data,
    { affected: [], source: { kind: "walker", walker: run.walker } },
    [{ debuff, kind: "debuff" }],
    run,
  );
}

// Whether the walk can finish its neighbourhood now: walking, with no card or hit stop.
export function canFinishZone(walk: Walk): boolean {
  return walk.run.phase.kind === "walking" && walk.road.hitStop === null;
}

// The neighbourhood walked to its end: the road cleared and the distance at the zone's length,
// so the next step ends it as walked, at its fork or the walk's end.
export function finishZone(data: Pick<GameData, "tuning">, walk: Walk): Walk {
  if (!canFinishZone(walk)) {
    return walk;
  }
  return {
    road: { ...walk.road, herrings: [], items: [], pending: [] },
    run: { ...walk.run, zoneDistance: pixels(zoneLength(data)) },
  };
}

// This walk's cheats.
export type WalkCheat =
  | { readonly debuff: DebuffId; readonly kind: "debuff" }
  | { readonly kind: "addMoney" }
  | { readonly kind: "finishZone" }
  | { readonly kind: "refillHearts" }
  | { readonly kind: "upgrade"; readonly upgrade: UpgradeId }
  | { readonly kind: "upgrades" };

// The run as one of This walk's cheats leaves it. Finish this neighbourhood changes the road
// too (finishZone), so here it leaves the run as it is.
export function walkCheat(
  data: WalkData & Pick<GameData, "upgradeDrawOrder">,
  cheat: WalkCheat,
  run: RunState,
): RunState {
  switch (cheat.kind) {
    case "addMoney":
      return addToWalk(WALK_GRANT, run);
    case "debuff":
      return applyDebuff(data, cheat.debuff, run);
    case "finishZone":
      return run;
    case "refillHearts":
      return refillHearts(data, run);
    case "upgrade":
      return grantUpgrade(data, cheat.upgrade, run);
    case "upgrades":
      return upgradesLeft(data, run).reduce((granted, id) => grantUpgrade(data, id, granted), run);
    default:
      return assertNever(cheat);
  }
}

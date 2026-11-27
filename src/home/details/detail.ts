import { fillLine } from "@andornaut/game-kit/runtime/lines";

import { HOME_TEXT_FIELDS } from "../../content/index.ts";
import type { DogId, GearId, WalkerId } from "../../data/ids.ts";
import type { GameData } from "../../data/index.ts";
import { dollarText } from "../../presentation/index.ts";
import {
  capitalize,
  dodgeInText,
  effectText,
  laneSpeedText,
  SIZE_AGILITY,
  SIZE_NAMES,
  sizeHearts,
} from "../../rules/index.ts";
import type { Owned } from "../../save/index.ts";
import type { Cents } from "../../units.ts";
import { type HomeLoadout, isAffordable, type Purchase, purchasePrice } from "../home.ts";
import { walkerDetailLines, walkerLockedLine } from "../walkers.ts";

type DetailData = Pick<
  GameData,
  | "debuffs"
  | "dogSlots"
  | "dogs"
  | "encounters"
  | "homeText"
  | "shopGear"
  | "tuning"
  | "walkerPerks"
  | "walkers"
  | "world"
>;

// What a held dog, walker or gear tile's detail card says, owned or not: a title, a line under
// it, rows of text, and a status row (the price while for sale, owned or equipped, or the goal).
// locked is true while the item costs more than the bank holds, or the walker is not owned. A
// dog's card has its owner: the dog, for their photo, and their name and role.
export interface DetailCard {
  readonly lines: readonly string[];
  readonly locked: boolean;
  readonly owner?: { readonly dog: DogId; readonly name: string; readonly role: string };
  readonly status: string;
  readonly subtitle: string;
  readonly title: string;
}

// What a detail card shows in its well: a dog's or walker's portrait, or a gear item's,
// effect's or debuff's icon.
export interface DetailPicture {
  // Drawn centred in the well at 1x while key has no texture, such as a walker's face before
  // its portrait is drawn.
  readonly fallback?: string;
  readonly key: string;
  // Drawn at this whole-number scale: 1 for a 64x64 portrait, 2 for a 32x32 icon, 4 for a
  // 16x16 icon.
  readonly scale: number;
}

const FIELDS = HOME_TEXT_FIELDS.detail;

// Whether the card shows it locked: for sale, and not affordable now.
function isLocked(data: DetailData, owned: Owned, bank: Cents, purchase: Purchase): boolean {
  return (
    purchasePrice(data, owned, purchase) !== null && !isAffordable(data, owned, bank, purchase)
  );
}

// What buying it would take, or null when it is already owned.
function priceLine(data: DetailData, owned: Owned, purchase: Purchase): string | null {
  const cost = purchasePrice(data, owned, purchase);
  if (cost === null) {
    return null;
  }
  return fillLine(FIELDS, data.homeText.detail, "priceBuy", { price: dollarText(cost) });
}

// A dog's size rows: a large dog's lane-change slowdown, a small dog's dodge and lane-change
// speed-up, and none for a medium dog.
function sizeRows(data: DetailData, dog: DogId): readonly string[] {
  const text = data.homeText.detail;
  const { size } = data.dogs[dog];
  switch (size) {
    case "large":
      return [
        fillLine(FIELDS, text, "dogLarge", {
          speed: laneSpeedText(data.tuning, SIZE_AGILITY.large),
        }),
      ];
    case "medium":
      return [];
    case "small":
      return [
        fillLine(FIELDS, text, "dogSmall", {
          dodgeIn: dodgeInText(data.tuning, "smallDodgeChance"),
        }),
        fillLine(FIELDS, text, "dogSmallSpeed", {
          speed: laneSpeedText(data.tuning, SIZE_AGILITY.small),
        }),
      ];
    default:
      return size satisfies never;
  }
}

// A dog's breed, its size and hearts, its size rows, and its owner's photo, name and role.
export function dogDetail(data: DetailData, owned: Owned, bank: Cents, dog: DogId): DetailCard {
  const { breed, name, owner, size } = data.dogs[dog];
  const purchase: Purchase = { dog, kind: "dog" };
  const text = data.homeText.detail;
  return {
    lines: [
      fillLine(FIELDS, text, "dogKind", {
        hearts: String(sizeHearts(data.tuning, data.dogs[dog])),
        size: capitalize(SIZE_NAMES[size]),
      }),
      ...sizeRows(data, dog),
    ],
    locked: isLocked(data, owned, bank, purchase),
    owner: {
      dog,
      name: owner.name,
      role: fillLine(FIELDS, text, "ownerRole", { role: owner.role }),
    },
    status: priceLine(data, owned, purchase) ?? text.dogStatus,
    subtitle: breed,
    title: name,
  };
}

// A gear item's effect, and whether it is owned or equipped.
export function gearDetail(
  data: DetailData,
  owned: Owned,
  bank: Cents,
  loadout: Pick<HomeLoadout, "gear">,
  gear: GearId,
): DetailCard {
  const item = data.shopGear[gear];
  const purchase: Purchase = { gear, kind: "gear" };
  const text = data.homeText.detail;
  const status = loadout.gear === gear ? text.gearEquipped : text.gearOwned;
  return {
    lines: [`${capitalize(effectText(data, item.effects))}.`],
    locked: isLocked(data, owned, bank, purchase),
    status: priceLine(data, owned, purchase) ?? status,
    subtitle: text.gearSubtitle,
    title: item.name,
  };
}

// A walker's agility and perk lines. An owned walker's status says so; one not owned is
// locked, and its status says how many dogs a walk must finish with to unlock it.
export function walkerDetail(
  data: DetailData,
  owned: Pick<Owned, "walkers">,
  walker: WalkerId,
): DetailCard {
  const { name } = data.walkers[walker];
  const text = data.homeText;
  const has = owned.walkers.includes(walker);
  return {
    lines: walkerDetailLines(data, walker),
    locked: !has,
    status: has ? text.detail.walkerStatus : walkerLockedLine(data, walker),
    subtitle: text.detail.walkerSubtitle,
    title: name,
  };
}

// Flowing description or compact identity text. Owner and status retain their own blocks.
export interface DetailPart {
  readonly text: string;
  readonly tone: "line" | "subtitle";
}

// Compact dog identity and descriptions share the column right of the portrait.
// Owner and status remain separate blocks below the taller top group.
export function detailParts(
  kind: "dog" | "dogSlot" | "gear" | "walker",
  card: DetailCard,
): { description: DetailPart[]; identity: DetailPart[] } {
  const lines = card.lines.map((text) => ({ text, tone: "line" }) as const);
  const breed = kind === "dog" ? [{ text: card.subtitle, tone: "subtitle" } as const] : [];
  const identity = kind === "dog" ? lines.slice(0, 1) : [];
  const description = kind === "dog" ? lines.slice(1) : lines;
  return {
    description,
    identity: [...breed, ...identity],
  };
}

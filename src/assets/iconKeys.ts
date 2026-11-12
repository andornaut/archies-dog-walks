import type { DebuffId, GearId, UpgradeId, WalkerPerkId } from "../data/types.ts";
import { kebabCase } from "./spriteKeys.ts";

// The 16x16 icon of a debuff, on its bar.
export function debuffIconKey(debuff: DebuffId): string {
  return `icon-${kebabCase(debuff)}`;
}

// The 16x16 icon in a dog's pull bubble while it strains toward a squirrel.
export const SQUIRREL_ICON_KEY = "icon-trait-chaser";

// The 16x16 icon of an upgrade, in its effect well.
export function upgradeIconKey(upgrade: UpgradeId): string {
  return `icon-upgrade-${kebabCase(upgrade)}`;
}

// The 16x16 icon of a gear item, in its effect well and on the start screen's gear badge.
export function gearSmallIconKey(gear: GearId): string {
  return `icon-gear-${kebabCase(gear)}`;
}

// The 16x16 icon of a walker's perk.
export function perkIconKey(perk: WalkerPerkId): string {
  return `icon-perk-${kebabCase(perk)}`;
}

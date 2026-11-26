import type { DebuffId, GearId, UpgradeId, WalkerPerkId } from "../data/ids.ts";
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

// Native HUD art is authored separately from the 16px and 20px world and card roles.
export function hudGearIconKey(gear: GearId): string {
  return `icon-hud-effect-gear-${kebabCase(gear)}`;
}

export function hudPerkIconKey(perk: WalkerPerkId): string {
  return `icon-hud-effect-perk-${kebabCase(perk)}`;
}

export function hudUpgradeIconKey(upgrade: UpgradeId): string {
  return `icon-hud-effect-upgrade-${kebabCase(upgrade)}`;
}

import type { DebuffId } from "../data/types.ts";
import { kebabCase } from "./spriteKeys.ts";

// The 16x16 icon of a debuff, on its bar.
export function debuffIconKey(debuff: DebuffId): string {
  return `icon-${kebabCase(debuff)}`;
}

// The 16x16 icon in a dog's pull bubble while it strains toward a squirrel.
export const SQUIRREL_ICON_KEY = "icon-trait-chaser";

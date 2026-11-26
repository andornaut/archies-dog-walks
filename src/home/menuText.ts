import type { FieldTable } from "@andornaut/game-kit/runtime/lines";

// The {name}s each menu text line may use, by group; a line left out uses none. A line is
// filled with fillLine(MENU_TEXT_FIELDS.<group>, gameData.menuText.<group>, key, fields).
export const MENU_TEXT_FIELDS = {
  celebration: { titleMany: ["count"] },
  cheats: { add: ["cash"], applyDebuff: ["debuff"], grantUpgrade: ["upgrade"] },
  common: { closeTitled: ["title"] },
  end: { firedYou: ["owner"] },
  help: { pageCount: ["n", "total"] },
  pause: { note: ["cash", "kept"], noteAll: ["cash"] },
  settings: { volume: ["percent"] },
  stats: {
    badgeLine: ["line"],
    badgeProgress: ["have", "need"],
    earnedCount: ["earned", "total"],
    timesFiredBy: ["count", "owner"],
  },
} as const satisfies FieldTable;

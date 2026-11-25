import type { GameData } from "../data/types.ts";
import { MODAL, modalActionWidth, modalFamilyWidth } from "./modal/layout.ts";
import type { PanelMeasure } from "./modal/types.ts";

// Digit bindings stay fixed while the primary action occupies the bottom visual position.
export const PAUSE_MENU_KEY_ORDER = ["resume", "help", "settings", "headHome", "cheats"] as const;
export type PauseMenuItem = (typeof PAUSE_MENU_KEY_ORDER)[number];
export const PAUSE_MENU_ITEMS = [
  "cheats",
  ...PAUSE_MENU_KEY_ORDER.filter((item) => item !== "resume" && item !== "cheats"),
  "resume",
] as const;

export type MenuContext = "cheats" | "end" | "help" | "home" | "page" | "settings";
export type MenuItem = "cheats" | "close" | "headHome" | "help" | "logbook" | "settings";

// Only the navigation applicable to the screen joins its primary Close action: the other entries
// in label order, then Back to title where it applies, then Close. Leaving is the top bar's Exit,
// never a Menu entry.
export function menuItems(context: MenuContext): readonly MenuItem[] {
  switch (context) {
    case "home":
      return ["cheats", "help", "logbook", "settings", "close"];
    case "page":
      return ["cheats", "help", "logbook", "settings", "headHome", "close"];
    case "cheats":
      return ["help", "settings", "headHome", "close"];
    case "help":
      return ["cheats", "settings", "headHome", "close"];
    case "settings":
      return ["cheats", "help", "headHome", "close"];
    case "end":
      return ["cheats", "settings", "headHome", "close"];
    default:
      return context satisfies never;
  }
}

export function menuItemLabel(
  data: Pick<GameData, "homeText" | "menuText">,
  item: MenuItem,
): string {
  switch (item) {
    case "cheats":
      return data.menuText.cheats.open;
    case "close":
      return data.menuText.common.close;
    case "headHome":
      return data.menuText.end.headHome;
    case "help":
      return data.menuText.pause.help;
    case "logbook":
      return data.menuText.stats.title;
    case "settings":
      return data.menuText.pause.settings;
    default:
      return item satisfies never;
  }
}

// Navigation menus use Medium; full-size actions must fit and explanatory text wraps.
export function navigationMenuWidth(
  data: Pick<GameData, "homeText" | "menuText">,
  measure: Pick<PanelMeasure, "inkWidth">,
  available: number,
): number {
  const width = modalFamilyWidth(available, "medium");
  const labels = [
    ...menuItems("page").map((item) => menuItemLabel(data, item)),
    ...PAUSE_MENU_ITEMS.map((item) => pauseMenuItemLabel(data, item)),
  ];
  if (
    labels.some(
      (label) => modalActionWidth(measure.inkWidth("title", label)) > width - 2 * MODAL.pad,
    )
  ) {
    throw new RangeError("Navigation action exceeds its selected fixed-font width");
  }
  return width;
}

export function pauseMenuItemLabel(data: Pick<GameData, "menuText">, item: PauseMenuItem): string {
  return item === "cheats"
    ? data.menuText.cheats.open
    : item === "headHome"
      ? data.menuText.end.headHome
      : data.menuText.pause[item];
}

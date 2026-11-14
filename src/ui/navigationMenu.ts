import type { GameData } from "../data/types.ts";
import { MODAL, modalActionWidth, modalPanelWidth, modalTitleWidth } from "./modal/layout.ts";
import type { PanelMeasure } from "./modal/types.ts";

// Digit bindings stay fixed while the primary action occupies the bottom visual position.
export const PAUSE_MENU_KEY_ORDER = ["resume", "help", "settings", "headHome"] as const;
export type PauseMenuItem = (typeof PAUSE_MENU_KEY_ORDER)[number];
export const PAUSE_MENU_ITEMS = [
  ...PAUSE_MENU_KEY_ORDER.filter((item) => item !== "resume"),
  "resume",
] as const;

export type MenuContext = "end" | "help" | "home";
export type MenuItem = "close" | "headHome" | "help" | "logbook" | "quit" | "settings";

// Only the navigation applicable to the screen joins its primary Close action.
export function menuItems(context: MenuContext, exit: boolean): readonly MenuItem[] {
  switch (context) {
    case "home":
      return ["help", "logbook", "settings", ...(exit ? ["quit" as const] : []), "close"];
    case "help":
      return ["settings", "close"];
    case "end":
      return ["settings", "headHome", "close"];
    default:
      return context satisfies never;
  }
}

export function menuItemLabel(
  data: Pick<GameData, "homeText" | "menuText">,
  item: MenuItem,
): string {
  switch (item) {
    case "close":
      return data.menuText.common.close;
    case "headHome":
      return data.menuText.end.headHome;
    case "help":
      return data.menuText.pause.help;
    case "logbook":
      return data.menuText.stats.title;
    case "quit":
      return data.homeText.quit.quit;
    case "settings":
      return data.menuText.pause.settings;
    default:
      return item satisfies never;
  }
}

// Navigation menus share the width required by either menu's full-size titles and actions.
// Explanatory text wraps inside that width instead of changing the navigation chrome.
export function navigationMenuWidth(
  data: Pick<GameData, "homeText" | "menuText">,
  measure: Pick<PanelMeasure, "inkWidth">,
  available: number,
): number {
  const titles = [data.menuText.menu.title, data.menuText.pause.title];
  const labels = [
    ...menuItems("home", true).map((item) => menuItemLabel(data, item)),
    ...PAUSE_MENU_ITEMS.map((item) => data.menuText.pause[item]),
  ];
  return modalPanelWidth(
    available,
    Math.max(
      ...titles.map((title) => modalTitleWidth(measure.inkWidth("title", title))),
      ...labels.map((label) => modalActionWidth(measure.inkWidth("title", label)) + 2 * MODAL.pad),
    ),
  );
}

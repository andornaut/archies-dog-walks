import { CELEBRATION_STYLE } from "./celebrationStyle.ts";
import { UI_STYLE } from "./uiStyle.ts";

// The HTML interface's whole stylesheet, which uiStylePlugin (src/tools/uiStylePlugin.ts) serves
// as a CSS module, so the page links it as a file from its own origin.
export const UI_STYLESHEET = UI_STYLE + CELEBRATION_STYLE;

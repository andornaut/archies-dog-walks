import { nineSlice } from "./uiStyle.ts";

// The celebrations' styles in the HTML interface: the earnings plate's ui-panel and the
// greeting's ui-quip, and the dotted rule under the greeting. They take no presses, which go
// through to the canvas, as there.
export const CELEBRATION_STYLE = `
.adw-plate-frame,.adw-quip-frame,.adw-rule{position:absolute;box-sizing:border-box;pointer-events:none}
.adw-plate-frame{${nineSlice("ui-panel", "ui-panel")};background-color:var(--adw-cream)}
.adw-quip-frame{${nineSlice("ui-quip", "ui-quip")};background-color:var(--adw-cream)}
/* An art pixel of tan every --adw-step device pixels. */
.adw-rule{background:linear-gradient(90deg,var(--adw-tan) 0 var(--adw-slice-1),transparent var(--adw-slice-1))
  0 0/var(--adw-step) 100% repeat-x}
`;

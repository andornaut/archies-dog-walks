// The settings card's own rules in the HTML interface's stylesheet (uiStyle.ts): its rows, each
// a control that shows focus and press as its face's fill, as a Pet shop row does (cyan focused,
// green with ink text pressed, Highlight in forced colours); its separators; and the install
// row's secondary button face. Settings' and Cheats' switch rows are Game Kit form rows (kit
// buttons, whose own focus fill the face replaces) and Settings' volume rows Game Kit sliders,
// which fill only on focus and show a held knob pressed.
export const SETTINGS_STYLE = `
.adw-row{position:absolute;box-sizing:border-box;pointer-events:auto;outline:none;cursor:pointer;
  touch-action:pan-y;-webkit-tap-highlight-color:transparent}
.adw-settings-rows,.adw-scroll-viewport{overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;
  pointer-events:auto;
  touch-action:pan-y;scrollbar-width:thin}
.adw-row:focus-visible{z-index:1}
.adw-row.ui-form-row{background-color:transparent!important}
.adw-row:focus-visible>.adw-row-face{background-color:var(--adw-cyan)!important}
.adw-row:not([role=slider],[aria-disabled="true"],.adw-standard-button)[data-ui-pressed]>.adw-row-face{
  background-color:var(--adw-green)!important}
.adw-row:not([role=slider],[aria-disabled="true"],.adw-standard-button)[data-ui-pressed] .adw-text{
  color:var(--adw-ink)!important}
.adw-row.ui-form-row:is(:focus-visible,[data-ui-pressed])>[aria-hidden="true"]{opacity:1}
.adw-row[data-ui-pressed] .ui-slider-thumb{background-position:var(--adw-pressed-frame)!important}
@media (forced-colors:active){
  .adw-row:not(.adw-standard-button):is(:focus-visible,[data-ui-pressed]:not([role=slider])),
  .adw-row:not(.adw-standard-button):is(:focus-visible,[data-ui-pressed]:not([role=slider])) *{
    forced-color-adjust:none}
  .adw-row:not(.adw-standard-button):is(:focus-visible,[data-ui-pressed]:not([role=slider]))
    >.adw-row-face{
    background-color:Highlight!important}
  .adw-row:not(.adw-standard-button):is(:focus-visible,[data-ui-pressed]:not([role=slider])) .adw-text{
    color:HighlightText!important}
}
.adw-separator{background:var(--adw-tan)}
`;

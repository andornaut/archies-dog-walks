// The settings card's own rules in the HTML interface's stylesheet (uiStyle.ts): its rows, each
// a control that shows focus and press as its face's fill, as a Pet shop row does (cyan focused,
// green with ink text pressed, Highlight in forced colours); and every content separator's colour
// (tan, CanvasText in forced colours). Settings' and Cheats' rows are Game Kit form rows (kit
// buttons, whose own focus fill the face replaces) in kit lists that place them: switch rows,
// Settings' volume rows, kit sliders, which fill only on focus, and its Install row, a one-action
// row whose secondary button face the list places. The kit's icon slot, value stack and lane
// paint over the row's face.
export const SETTINGS_STYLE = `
.adw-row{position:relative;box-sizing:border-box;pointer-events:auto;outline:none;cursor:pointer;
  touch-action:pan-y;-webkit-tap-highlight-color:transparent}
.adw-form-rows>.adw-row.ui-standard-button{position:relative}
.adw-row>:is(.ui-form-row-icon,.ui-form-row-value){position:relative}
.adw-row>.adw-row-face{width:100%;height:100%}
.adw-form-rows>.adw-row>.adw-standard-button-face{position:relative;inset:auto}
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
@media (forced-colors:active){
  .adw-separator{forced-color-adjust:none;background-color:CanvasText!important}
}
`;

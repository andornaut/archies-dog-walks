// The settings card's own rules in the HTML interface's stylesheet (uiStyle.ts): its rows, each
// a control that shows cyan focus and press, as a Pet shop row does (Highlight in forced colours),
// from Game Kit's theme state slots set
// once on .adw-row and once in forced colours; and every content separator's colour
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
.adw-row{--ui-colour-button-focus-face:var(--adw-cyan);--ui-colour-button-pressed-face:var(--adw-cyan);
  --ui-colour-button-pressed-text:var(--adw-ink)}
@media (forced-colors:active){
  .adw-row{--ui-colour-button-focus-face:Highlight;--ui-colour-button-focus-text:HighlightText;
    --ui-colour-button-pressed-face:Highlight;--ui-colour-button-pressed-text:HighlightText}
  .adw-row:not(.adw-standard-button):is(:focus-visible,[data-ui-pressed]:not([role=slider])),
  .adw-row:not(.adw-standard-button):is(:focus-visible,[data-ui-pressed]:not([role=slider])) *{
    forced-color-adjust:none}
  .adw-row:not(.adw-standard-button):focus-visible .adw-text{color:var(--ui-colour-button-focus-text)!important}
}
.adw-row:focus-visible>.adw-row-face{background-color:var(--ui-colour-button-focus-face)!important}
.adw-row:not([role=slider],[aria-disabled="true"],.adw-standard-button)[data-ui-pressed]>.adw-row-face{
  background-color:var(--ui-colour-button-pressed-face)!important}
.adw-row:not([role=slider],[aria-disabled="true"],.adw-standard-button)[data-ui-pressed] .adw-text{
  color:var(--ui-colour-button-pressed-text)!important}
.adw-row.ui-form-row:is(:focus-visible,[data-ui-pressed])>[aria-hidden="true"]{opacity:1}
.adw-separator{background:var(--adw-tan)}
@media (forced-colors:active){
  .adw-separator{forced-color-adjust:none;background-color:CanvasText!important}
}
`;

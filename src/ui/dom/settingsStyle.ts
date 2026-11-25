// The settings card's own rules in the HTML interface's stylesheet (uiStyle.ts): its rows, each
// a control that shows focus and press as its face's fill, as a Pet shop row does (cyan focused,
// green with ink text pressed, Highlight in forced colours); its separators; and the install
// row's secondary button face. Cheats' switch row is the same kind of row as a kit button.
export const SETTINGS_STYLE = `
.adw-row{position:absolute;box-sizing:border-box;pointer-events:auto;outline:none;cursor:pointer;
  touch-action:pan-y;-webkit-tap-highlight-color:transparent}
.adw-settings-rows,.adw-scroll-viewport{overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;
  pointer-events:auto;
  touch-action:pan-y;scrollbar-width:thin}
.adw-row:focus-visible{z-index:1}
.adw-row:focus-visible>.adw-row-face{background-color:var(--adw-cyan)!important}
.adw-row[data-ui-pressed]>.adw-row-face,
.adw-row.ui-standard-button:not(.adw-standard-button,[aria-disabled="true"])[data-ui-pressed]>.ui-button-face{
  background-color:var(--adw-green)!important}
.adw-row:not(.ui-standard-button)[data-ui-pressed] .adw-text,
.adw-row.ui-standard-button:not(.adw-standard-button,[aria-disabled="true"])[data-ui-pressed] .adw-text{
  color:var(--adw-ink)!important}
.adw-row.ui-standard-button:not(.adw-standard-button):is(:focus-visible,[data-ui-pressed])
  >.ui-button-face>[aria-hidden="true"]{
  opacity:1}
@media (forced-colors:active){
  .adw-row:not(.adw-standard-button):is(:focus-visible,[data-ui-pressed]),
  .adw-row:not(.adw-standard-button):is(:focus-visible,[data-ui-pressed]) *{forced-color-adjust:none}
  .adw-row:not(.adw-standard-button):is(:focus-visible,[data-ui-pressed])>:is(.adw-row-face,.ui-button-face){
    background-color:Highlight!important}
  .adw-row:not(.adw-standard-button):is(:focus-visible,[data-ui-pressed]) .adw-text{
    color:HighlightText!important}
}
.adw-separator{background:var(--adw-tan)}
.adw-face.adw-secondary:not(.adw-standard-button-face){border-image-source:var(--adw-ui-button-secondary)}
`;

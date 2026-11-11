// The settings card's own rules in the HTML interface's stylesheet (uiStyle.ts): its rows, each
// a control whose keyboard ring is the canvas's, cyan, 3 art pixels outside the row and 2 wide;
// its separators; and the install row's secondary button face.
export const SETTINGS_STYLE = `
.adw-row{position:absolute;box-sizing:border-box;pointer-events:auto;outline:none;cursor:pointer;
  touch-action:none;-webkit-tap-highlight-color:transparent}
.adw-row:focus-visible{z-index:1}
.adw-row:focus-visible::after{content:"";position:absolute;inset:calc(-1 * var(--adw-slice-3));
  border:var(--adw-slice-2) solid var(--adw-cyan);pointer-events:none}
.adw-separator{background:var(--adw-tan)}
.adw-face.adw-secondary{border-image-source:var(--adw-ui-button-secondary)}
`;

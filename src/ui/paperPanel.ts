import type { PALETTE } from "./palette.ts";

type Colour = keyof typeof PALETTE;

// art: the modal paper the DOM fallback screens draw without the game's art: the crash screen's
// panel and Loading failed's. A cream face in a 1px ink border, a white bevel row under its top, a
// tan lip along its bottom and an ink shadow off its bottom right, in CSS pixels. public/tokens.css
// carries it to the site's stylesheets as --paper-*.
export const PAPER_PANEL = {
  bevel: 1,
  border: 1,
  colours: {
    bevel: "white",
    border: "ink",
    fill: "cream",
    lip: "tan",
    shadow: "ink",
    text: "plum",
  } satisfies Record<string, Colour>,
  lip: 4,
  shadow: 4,
} as const;

// art: the website's card chrome, round its highlights and the install steps dialog: a cream face
// in an ink line with a plum line inside it, a tan lip inside its bottom and right, and corners
// cut a pixel, in CSS pixels. public/tokens.css carries it as --card-*.
export const CARD_PANEL = {
  colours: {
    fill: "cream",
    inner: "plum",
    line: "ink",
    lip: "tan",
    text: "plum",
  } satisfies Record<string, Colour>,
  corner: 1,
  inner: 1,
  line: 1,
  lip: 3,
} as const;

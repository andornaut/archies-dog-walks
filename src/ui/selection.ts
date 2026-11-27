// How a native selection tile or row shows its interaction state: normal is cream,
// selected cyan, disabled flat grey. Colours are the scenes' PALETTE names.
import { AFFORD_OUTSET, BUTTON_LIP_PX, SELECT_OUTSET } from "../data/index.ts";
import type { ButtonState, ItemLook, TileState } from "./interaction.ts";

// Every colour a disabled, short or locked item draws in, the neutral greys among them:
// - affordBox: the box behind the portrait or icon of an item the player can buy now, its art
//   in colour on a disabled tile.
// - box: the box behind a portrait or icon in grey art.
// - copyDarker: a disabled tile's grey copy of its art moves each colour to the colour of
//   NEUTRAL_RAMP nearest its brightness, as a disabled card's does, then this many steps
//   down the ramp. 0 keeps a dark portrait readable on its box.
// - edge: the line round a disabled face drawn in code and round a short or goal plate.
// - face: a disabled tile's face drawn in code.
// - plateFace: a short or goal plate's face.
// - plateText, shortPrice: the text on a goal plate or a disabled card's cost plaque, and a
//   short price on its plate.
// - text: a disabled tile's label.
export const GREYED = {
  affordBox: "neutralLightGrey",
  box: "neutralSlate",
  copyDarker: 0,
  edge: "neutralSlate",
  face: "neutralGrey",
  plateFace: "neutralLightGrey",
  plateText: "ink",
  shortPrice: "darkRed",
  text: "neutralDarkSlate",
} as const;

const SELECTION_COLOUR = "cyan";

interface SelectLook {
  face: "cream" | typeof GREYED.face | typeof SELECTION_COLOUR;
  state: TileState;
  text: typeof GREYED.text | "plum";
}

// Text on each face: plum on cream and cyan; a disabled label holds the
// 3:1 its exemption needs.
const LOOKS: Readonly<Record<TileState, Omit<SelectLook, "state">>> = {
  disabled: { face: GREYED.face, text: GREYED.text },
  normal: { face: "cream", text: "plum" },
  selected: { face: SELECTION_COLOUR, text: "plum" },
};

// A button's look: its interaction state, or secondary, the cream button a card's own
// controls wear in place of normal, with ui-button's secondary tags.
type ButtonLook = ButtonState | "secondary";

// How a standard button colours each look (gameButton.css): its face, the bevel row under its
// top edge and the lip under a raised face, and the label, then the face and label while
// pressed. A pressed or disabled face is flat, sunk into the lip, with no bevel or lip: pressed is
// forest with a white label on every role; disabled is grey with a dark slate label.
export const BUTTON_COLOURS = {
  disabled: {
    bevel: null,
    face: GREYED.face,
    label: GREYED.text,
    lip: null,
    pressedFace: GREYED.face,
    pressedLabel: GREYED.text,
  },
  normal: {
    bevel: "white",
    face: "cream",
    label: "plum",
    lip: "tan",
    pressedFace: "forest",
    pressedLabel: "white",
  },
  primary: {
    bevel: "yellow",
    face: "green",
    label: "ink",
    lip: "forest",
    pressedFace: "forest",
    pressedLabel: "white",
  },
  secondary: {
    bevel: "white",
    face: "cream",
    label: "plum",
    lip: "tan",
    pressedFace: "forest",
    pressedLabel: "white",
  },
} as const satisfies Record<
  ButtonLook,
  {
    bevel: string | null;
    face: string;
    label: string;
    lip: string | null;
    pressedFace: string;
    pressedLabel: string;
  }
>;

// The rows of ui-button's lip under a raised face, the bottom of its rect.
export { BUTTON_LIP_PX };

// The plate a price or goal sits on: buy while the bank covers the price, short while it
// does not, goal for an item a goal unlocks or one that needs another bought first.
export type PlateKind = "buy" | "goal" | "short";

// A plate's 1px line, its face, the face's top (lit) and bottom (shade) rows where they
// differ from it, and its text.
export const PLATE_LOOKS = {
  buy: { edge: "ink", face: "green", lit: "yellow", shade: "forest", text: "ink" },
  goal: {
    edge: GREYED.edge,
    face: GREYED.plateFace,
    lit: null,
    shade: null,
    text: GREYED.plateText,
  },
  short: {
    edge: GREYED.edge,
    face: GREYED.plateFace,
    lit: null,
    shade: null,
    text: GREYED.shortPrice,
  },
} as const satisfies Record<
  PlateKind,
  { edge: string; face: string; lit: string | null; shade: string | null; text: string }
>;

// An open Pet shop tab's lift shadow reaches this far past its face, and a focused shop item
// scrolled into view keeps this margin.
export { SELECT_OUTSET };

// ui-afford sits this far outside an affordable item on each side.
export { AFFORD_OUTSET };

export function selectLook(state: TileState): SelectLook {
  return { ...LOOKS[state], state };
}

// The box behind an item's portrait or icon.
export type PictureBox =
  typeof GREYED.affordBox | typeof SELECTION_COLOUR | typeof GREYED.box | "tan";

// A picture's box, from its art and state: grey art sits on the grey box; art in full colour
// on the tan box an owned item has, the cyan one while picked, or, on a disabled tile
// (an item the player can buy now), the light grey one.
export function pictureBox(look: Pick<ItemLook, "art" | "state">): PictureBox {
  if (look.art === "grey") {
    return GREYED.box;
  }
  switch (look.state) {
    case "disabled":
      return GREYED.affordBox;
    case "selected":
      return SELECTION_COLOUR;
    default:
      return "tan";
  }
}

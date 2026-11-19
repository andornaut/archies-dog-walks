import { remapCardGrey } from "../../assets/cardArt.ts";
import { DOM_CHOICE_CARD_ART, DOM_DIM_ART_KEYS, type DomCopySuffix } from "../../assets/domArt.ts";
import { dimForModal } from "../../ui/dimArt.ts";
import { greyForDisabledTile, greysOnTile } from "../../ui/disabledArt.ts";
import { NEUTRAL_RAMP } from "../../ui/palette.ts";

// The remapped copies of its art the HTML interface can draw, each a copy of a DOM sheet with
// the same rects (src/tools/atlas/domSheets.ts): the disabled tiles' grey copies, remapped as the
// atlas packs them (greyForDisabledTile), the disabled choice cards' neutral grey, and the
// retained dimmed copies, remapped as the canvas dims the view under a modal (dimForModal).

// A kind of copy: what it is called, the keys it may copy, the suffix its sheet and a copy's key
// add (DOM_COPY_SUFFIXES), and its remap of a PNG's RGBA pixels in place.
export interface ArtCopy {
  readonly accepts: (key: string) => boolean;
  readonly name: string;
  readonly refusal: string;
  readonly remap: (pixels: Uint8ClampedArray) => void;
  readonly suffix: DomCopySuffix;
}

export const DISABLED_COPY: ArtCopy = {
  accepts: greysOnTile,
  name: "grey copy",
  refusal: "is no tile picture a disabled tile greys",
  remap: greyForDisabledTile,
  suffix: "-disabled",
};

// Retained generated copies keep their declared asset keys until their build contract retires.
// CLEANUP (added 2026-11-15): Remove dim-copy transforms after Art retires their manifest/build keys.
export const DIM_COPY: ArtCopy = {
  accepts: (key) => DOM_DIM_ART_KEYS.has(key),
  name: "dimmed copy",
  refusal: "is no covered native art",
  remap: dimForModal,
  suffix: "-dim",
};

export const DISABLED_DIM_COPY: ArtCopy = {
  ...DISABLED_COPY,
  accepts: (key) => greysOnTile(key) && DOM_DIM_ART_KEYS.has(key),
  name: "dimmed disabled tile copy",
  remap(pixels) {
    greyForDisabledTile(pixels);
    dimForModal(pixels);
  },
  suffix: "-disabled-dim",
};

export const CARD_GREY_COPY: ArtCopy = {
  accepts: (key) => DOM_CHOICE_CARD_ART.grey.has(key),
  name: "neutral card copy",
  refusal: "is no disabled choice card art",
  remap: (pixels) => remapCardGrey(NEUTRAL_RAMP, pixels),
  suffix: "-grey",
};

export const CARD_GREY_DIM_COPY: ArtCopy = {
  ...CARD_GREY_COPY,
  name: "dimmed neutral card copy",
  remap(pixels) {
    remapCardGrey(NEUTRAL_RAMP, pixels);
    dimForModal(pixels);
  },
  suffix: "-grey-dim",
};

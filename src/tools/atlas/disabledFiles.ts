import { DOM_CHOICE_CARD_ART, type DomCopySuffix, remapCardGrey } from "../../assets/index.ts";
import { greyForDisabledTile, greysOnTile, NEUTRAL_RAMP } from "../../ui/index.ts";

// The remapped copies of its art the HTML interface can draw, each a copy of a DOM sheet with
// the same rects (src/tools/atlas/domSheets.ts): the disabled tiles' grey copies, remapped as the
// atlas packs them (greyForDisabledTile), and the disabled choice cards' neutral grey.

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

export const CARD_GREY_COPY: ArtCopy = {
  accepts: (key) => DOM_CHOICE_CARD_ART.grey.has(key),
  name: "neutral card copy",
  refusal: "is no disabled choice card art",
  remap: (pixels) => remapCardGrey(NEUTRAL_RAMP, pixels),
  suffix: "-grey",
};

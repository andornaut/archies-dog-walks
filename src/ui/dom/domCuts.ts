import { cutFrame } from "@andornaut/game-kit/runtime/web/ui/dom/sheetFrames";

import { domArtPath } from "../../assets/domArt.ts";
import type { DomArtSource } from "./artElements.ts";
import type { DomSheetJson } from "./sheetFrames.ts";

// Art cut from its DOM sheet into files of its own, as blob: URLs, for CSS that draws whole files:
// the stylesheet's art (DOM_STYLE_ART) and a fill CSS repeats. Each cut lasts for the page; a
// failed one is cut again on the next request.

const images = new Map<string, Promise<HTMLImageElement>>();
const cuts = new Map<string, Promise<string>>();

// The image at url, decoded once per page; a failed decode is tried again next time.
function decodedImage(doc: Document, url: string): Promise<HTMLImageElement> {
  let image = images.get(url);
  if (image === undefined) {
    const element = doc.createElement("img");
    element.src = url;
    image = Promise.resolve()
      .then(() => element.decode())
      .then(() => element);
    image.catch(() => images.delete(url));
    images.set(url, image);
  }
  return image;
}

// The URL of a key's sheet's JSON, without the fragment that names the key.
const sheetJsonUrl = (source: DomArtSource, kind: "image" | "sheet", key: string) =>
  source.artUrl(domArtPath(kind, key, "json")).replace(/#.*$/, "");

// A key's whole image as its own file showed it, cut from its sheet: an image, or a sprite
// sheet's every frame.
export function cutDomArt(
  doc: Document,
  source: DomArtSource,
  kind: "image" | "sheet",
  key: string,
): Promise<string> {
  const url = source.artUrl(domArtPath(kind, key, "png"));
  const id = `${url}#${key}`;
  let cut = cuts.get(id);
  if (cut === undefined) {
    cut = Promise.all([
      source.loadSheet(sheetJsonUrl(source, kind, key)),
      decodedImage(doc, url),
    ]).then(([json, image]) => {
      const rect = (json as DomSheetJson).keys[key]?.rect;
      if (rect === undefined) {
        throw new Error(`The DOM sheet has no ${key}`);
      }
      const [x, y, width, height] = rect;
      return cutFrame(doc, image, { height, width, x, y });
    });
    cut.catch(() => cuts.delete(id));
    cuts.set(id, cut);
  }
  return cut;
}

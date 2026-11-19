import {
  type ButtonSkin,
  buttonSkinProperty,
} from "@andornaut/game-kit/runtime/web/ui/dom/buttonSkin";
import { cutFrame } from "@andornaut/game-kit/runtime/web/ui/dom/sheetFrames";

import { domArtPath } from "../../assets/domArt.ts";
import type { DomArtSource } from "./artElements.ts";
import { type DomSheetJson, sheetFrame } from "./sheetFrames.ts";

// Art cut from its DOM sheet into files of its own, as blob: URLs, for CSS that draws whole files:
// the stylesheet's art (DOM_STYLE_ART), a fill CSS repeats, and the button skin's frames. Each
// cut lasts for the page; a failed one is cut again on the next request.

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

// The skin's frames by property, each tag's first frame of each sheet cut from the sheet the
// sheet's key is packed on. Rejects on any failed load or cut, having revoked the frames cut.
async function skinFrames(
  doc: Document,
  source: DomArtSource,
  skin: { readonly sheets: readonly string[]; readonly tags: readonly string[] },
): Promise<ReadonlyMap<string, string>> {
  const sheets = await Promise.allSettled(
    skin.sheets.map(async (key) => {
      const [json, image] = await Promise.all([
        source.loadSheet(source.artUrl(domArtPath("sheet", key, "json"))),
        decodedImage(doc, source.artUrl(domArtPath("sheet", key, "png"))),
      ]);
      return Promise.allSettled(
        skin.tags.map(async (tag) => {
          const { height, width, x, y } = sheetFrame(json, tag);
          const url = await cutFrame(doc, image, { height, width, x, y });
          return [buttonSkinProperty(key, tag), url] as const;
        }),
      );
    }),
  );
  const frames = sheets.flatMap((sheet) =>
    sheet.status === "fulfilled"
      ? sheet.value.flatMap((cut) => (cut.status === "fulfilled" ? [cut.value] : []))
      : [],
  );
  if (frames.length < skin.sheets.length * skin.tags.length) {
    frames.forEach(([, url]) => URL.revokeObjectURL(url));
    throw new Error("Unable to cut every button skin frame");
  }
  return new Map(frames);
}

// The button skin of skin's sheets, cut from their DOM sheet: ready rejects where a frame failed,
// and the skin then applies none. Requests start at once, so the game creates one skin during
// boot and applies it to every root; a new skin requests everything again.
export function createSheetButtonSkin(
  doc: Document,
  source: DomArtSource,
  skin: { readonly sheets: readonly string[]; readonly tags: readonly string[] },
): ButtonSkin & { readonly ready: Promise<void> } {
  const cut = skinFrames(doc, source, skin);
  const frames = cut.catch(() => new Map<string, string>());
  return {
    async apply(root) {
      const applied = await frames;
      for (const [property, url] of applied) {
        root.style.setProperty(property, `url("${url}")`);
      }
      return [...applied.values()];
    },
    frames,
    ready: cut.then(() => undefined),
  };
}

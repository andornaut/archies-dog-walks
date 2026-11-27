import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";

import { SCREEN_CONFIG, ZONE_BANNER } from "../../data/index.ts";
import { deviceX, deviceY, gridTransform, PALETTE } from "../index.ts";
import { type DomArtSource, imageArt } from "./artElements.ts";
import { createTextLine, type DomTextLine, placeBackedText } from "./pixelLine.ts";
import { followModalUnderlay } from "./rampDim.ts";
import type { UiLayer } from "./uiLayer.ts";

interface BannerPose {
  readonly active: boolean;
  readonly alpha: number;
  readonly x: number;
  readonly y: number;
}

// The banner's art key; each line's ink is centred on its face's rows: the glyph body, without
// the display font's drop shadow.
const KEY = "ui-zone-banner";
const { headingFace: HEADING_FACE, nameFace: NAME_FACE, plate: PLATE } = ZONE_BANNER;

// A passive view follows the scene's existing tween. It takes no input and never owns time.
export function mountRoadBanner(
  layer: UiLayer,
  source: DomArtSource,
  view: {
    readonly heading: string;
    readonly name: string;
    readonly nameFont: {
      readonly bitmap: BitmapFont;
      readonly font: "display" | "title";
      readonly scale: number;
    };
    readonly pose: () => BannerPose;
    readonly shown: (ready: boolean) => void;
    readonly title: BitmapFont;
  },
): { destroy(): void; update(): void } {
  const doc = layer.element.ownerDocument;
  const root = doc.createElement("div");
  root.className = "adw-dialog adw-passive";
  const plate = imageArt(doc, source, KEY);
  plate.element.setAttribute("aria-hidden", "true");
  const line = (font: "display" | "title", text: string, scale: number): DomTextLine => ({
    capTop: 0,
    centre: "ink",
    centreX: 0,
    colour: font === "display" ? PALETTE.yellow : PALETTE.plum,
    font,
    projection: "layout",
    scale,
    text,
  });
  const lines = [
    {
      bitmap: view.title,
      face: HEADING_FACE,
      line: line("title", view.heading, HEADING_FACE.scale),
    },
    {
      bitmap: view.nameFont.bitmap,
      face: NAME_FACE,
      line: line(view.nameFont.font, view.name, view.nameFont.scale),
    },
  ].map((item) => ({ ...item, element: createTextLine(doc, item.line) }));
  for (const { element } of lines) {
    element.setAttribute("aria-hidden", "true");
  }
  const status = doc.createElement("span");
  status.className = "visually-hidden";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.setAttribute("aria-atomic", "true");
  root.append(plate.element, ...lines.map(({ element }) => element), status);
  // New zones stay under existing HUD and modal layers, not above their shade.
  layer.element.insertBefore(root, layer.element.firstElementChild);
  let disposed = false;
  let decoded = false;
  let announced = false;
  const update = () => {
    if (disposed) {
      return;
    }
    const pose = view.pose();
    const ready = decoded && layer.ready() && pose.active;
    root.hidden = !ready;
    view.shown(ready);
    const accepts = layer.input.accepts();
    if (announced && !accepts) {
      // A covered announcement stays silent when its unchanged visual is uncovered.
      status.setAttribute("aria-hidden", "true");
    } else if (ready && accepts && !announced) {
      status.textContent = `${view.heading}. ${view.name}`;
      announced = true;
    }
    const scale = layer.scale();
    Object.assign(root.style, {
      height: `${deviceY(scale, SCREEN_CONFIG.height)}px`,
      opacity: String(pose.alpha),
      transform: gridTransform(scale),
      width: `${deviceX(scale, SCREEN_CONFIG.width)}px`,
    });
    plate.place(scale, { x: 0, y: 0 }, { ...PLATE, projection: "frame", x: pose.x, y: pose.y });
    for (const { bitmap, element, face, line } of lines) {
      placeBackedText(
        bitmap,
        scale,
        { x: 0, y: 0 },
        { height: face.height, width: PLATE.width, x: pose.x, y: pose.y + face.y },
        [{ element, line }],
      );
    }
  };
  const offScale = layer.onScale(update);
  const offReady = layer.onReady(update);
  const offUnderlay = followModalUnderlay(layer.input, root);
  const offInput = layer.input.subscribe(update);
  const reveal = layer.reveal(plate.ready, root);
  void reveal.revealed.then((success) => {
    if (!disposed) {
      decoded = success;
      update();
    }
  });
  update();
  return {
    destroy() {
      if (disposed) {
        return;
      }
      disposed = true;
      reveal.cancel();
      offInput();
      offUnderlay();
      offReady();
      offScale();
      root.remove();
    },
    update,
  };
}

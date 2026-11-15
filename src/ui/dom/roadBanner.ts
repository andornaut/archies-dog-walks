import type { BitmapFont } from "@andornaut/game-kit/text/bitmapFont";

import { SCREEN_CONFIG } from "../../data/screen.ts";
import { deviceX, deviceY, frameRect, gridTransform } from "../domScale.ts";
import { PALETTE } from "../palette.ts";
import { createTextLine, type DomTextLine, placeText, setBox } from "./pixelLine.ts";
import type { UiLayer } from "./uiLayer.ts";

interface BannerPose {
  readonly active: boolean;
  readonly alpha: number;
  readonly x: number;
  readonly y: number;
}

// A passive view follows the scene's existing tween. It takes no input and never owns time.
export function mountRoadBanner(
  layer: UiLayer,
  view: {
    readonly heading: string;
    readonly image: string;
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
  const plate = doc.createElement("span");
  plate.setAttribute("aria-hidden", "true");
  Object.assign(plate.style, {
    backgroundImage: `url("${view.image}")`,
    backgroundSize: "100% 100%",
    imageRendering: "pixelated",
    position: "absolute",
  });
  const line = (
    font: "display" | "title",
    text: string,
    capTop: number,
    scale: number,
  ): DomTextLine => ({
    capTop,
    centre: "advance",
    centreX: 124,
    colour: font === "display" ? PALETTE.yellow : PALETTE.plum,
    font,
    scale,
    text,
  });
  const lines = [
    { bitmap: view.title, line: line("title", view.heading, 11, 1) },
    {
      bitmap: view.nameFont.bitmap,
      line: line(view.nameFont.font, view.name, 27, view.nameFont.scale),
    },
  ].map((item) => ({ ...item, element: createTextLine(doc, item.line) }));
  for (const { element } of lines) {
    element.setAttribute("aria-hidden", "true");
  }
  const status = doc.createElement("span");
  status.className = "adw-spoken";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.setAttribute("aria-atomic", "true");
  root.append(plate, ...lines.map(({ element }) => element), status);
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
    root.setAttribute("aria-hidden", String(!accepts));
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
    setBox(plate, frameRect(scale, { height: 48, width: 248, x: pose.x, y: pose.y }));
    for (const { bitmap, element, line } of lines) {
      placeText(bitmap, scale, { x: 0, y: 0 }, element, {
        ...line,
        capTop: pose.y + line.capTop,
        centreX: pose.x + line.centreX,
      });
    }
  };
  const offScale = layer.onScale(update);
  const offReady = layer.onReady(update);
  const offInput = layer.input.subscribe(update);
  const reveal = layer.reveal([view.image], root);
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
      offReady();
      offScale();
      root.remove();
    },
    update,
  };
}

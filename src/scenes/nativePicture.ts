import type { Reveal } from "@andornaut/game-kit/runtime/web/ui/dom/imageReady";

import { SCREEN_CONFIG } from "../data/index.ts";
import { stripViewports } from "../help/index.ts";
import type { UiLayer } from "../ui/dom/index.ts";
import type { DomScale } from "../ui/index.ts";
import type { ScenePicture } from "./scenePicture.ts";

export interface NativePicture {
  readonly layers: readonly UiLayer[];
  dispose(): void;
}

// Each strip paints the same native HUD through a clipped, passive logical viewport.
export function createNativePicture(
  layer: UiLayer,
  picture: ScenePicture,
  projection: "crop" | "fit-width" = "crop",
): NativePicture {
  const doc = layer.element.ownerDocument;
  const clips = stripViewports(picture.frame, picture.strips).flatMap((viewport, index) => {
    const strip = picture.strips[index];
    if (strip === undefined) {
      return [];
    }
    const clip = doc.createElement("div");
    clip.className = "adw-clip";
    clip.inert = true;
    clip.setAttribute("aria-hidden", "true");
    Object.assign(clip.style, { overflow: "hidden", pointerEvents: "none", position: "absolute" });
    const content = doc.createElement("div");
    content.className = "adw-lines";
    content.style.pointerEvents = "none";
    clip.append(content);
    layer.element.append(clip);
    let alive = true;
    let current: DomScale;
    const scales = new Set<(scale: DomScale) => void>();
    const ready = new Set<() => void>();
    const reveals = new Set<Reveal>();
    const place = (scale: DomScale) => {
      if (!alive) {
        return;
      }
      const { unit } = scale;
      const fitted = projection === "fit-width";
      const contentUnit = fitted ? (unit * viewport.width) / SCREEN_CONFIG.width : unit;
      const left = fitted ? 0 : -picture.screenX * unit;
      const top = (viewport.height * (unit - contentUnit)) / 2 - strip.screenY * contentUnit;
      current = {
        ...scale,
        origin: {
          x: scale.origin.x + (fitted ? viewport.x : viewport.x - picture.screenX) * unit,
          y:
            scale.origin.y +
            (fitted ? viewport.y * unit + top : (viewport.y - strip.screenY) * unit),
        },
        unit: contentUnit,
      };
      Object.assign(clip.style, {
        height: `${viewport.height * unit}px`,
        left: `${viewport.x * unit}px`,
        top: `${viewport.y * unit}px`,
        width: `${viewport.width * unit}px`,
      });
      Object.assign(content.style, {
        height: `${SCREEN_CONFIG.height * contentUnit}px`,
        left: `${left}px`,
        top: `${top}px`,
        width: `${SCREEN_CONFIG.width * contentUnit}px`,
      });
      for (const listener of scales) {
        listener(current);
      }
    };
    place(layer.scale());
    const context: UiLayer = {
      ...layer,
      dispose: () => {
        if (!alive) {
          return;
        }
        alive = false;
        for (const reveal of reveals) {
          reveal.cancel();
        }
        reveals.clear();
        scales.clear();
        ready.clear();
        clip.remove();
      },
      element: content,
      onReady: (listener) => {
        if (alive) {
          ready.add(listener);
        }
        return () => ready.delete(listener);
      },
      onScale: (listener) => {
        if (alive) {
          scales.add(listener);
        }
        return () => scales.delete(listener);
      },
      press: { canvasAllowed: () => false, claim: () => undefined },
      ready: () => alive && layer.ready(),
      reveal: (urls, element) => {
        if (!content.contains(element)) {
          throw new Error("Native picture art must be revealed inside its own strip.");
        }
        if (!alive) {
          return { cancel: () => undefined, revealed: Promise.resolve(false) };
        }
        const reveal = layer.reveal(urls, element);
        reveals.add(reveal);
        void reveal.revealed.then(() => reveals.delete(reveal));
        return reveal;
      },
      scale: () => current,
      update: () => {
        if (alive) {
          layer.update();
        }
      },
    };
    return [{ context, place, ready }];
  });
  const stopScale = layer.onScale((scale) => {
    for (const clip of clips) {
      clip.place(scale);
    }
  });
  const stopReady = layer.onReady(() => {
    for (const clip of clips) {
      for (const listener of clip.ready) {
        listener();
      }
    }
  });
  let alive = true;
  return {
    dispose: () => {
      if (alive) {
        alive = false;
        stopScale();
        stopReady();
        clips.forEach(({ context }) => context.dispose());
      }
    },
    layers: clips.map(({ context }) => context),
  };
}

import type { Scene } from "phaser";

import { uiLayer } from "../ui/dom/index.ts";
import { trackNativeSceneInput } from "./overlay.ts";

// Pending native overlays block page routes until their scene-owned view can mount.
export function mountNativeOverlay(scene: Scene, mount: () => boolean): void {
  let disposed = false;
  let mounted = false;
  const stopInput = trackNativeSceneInput(scene, {
    accepts: () => false,
    capture: () => () => false,
  });
  const layer = uiLayer();
  let stopReady = () => {};
  const stop = () => {
    disposed = true;
    stopReady();
    stopInput();
  };
  const attempt = () => {
    if (disposed || mounted || layer?.ready() !== true) {
      return;
    }
    mounted = mount();
    if (mounted) {
      stopReady();
      stopInput();
    }
  };
  scene.events.once("shutdown", stop);
  stopReady = layer?.onReady(attempt) ?? (() => {});
  attempt();
}

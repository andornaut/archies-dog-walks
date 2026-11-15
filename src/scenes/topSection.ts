import { type Scene, Scenes } from "phaser";

import { artUrl } from "../assets/artFiles.ts";
import {
  createNativeTopSection,
  type NativeTopSection,
  type NativeTopSectionConfig,
} from "../ui/dom/nativeTopSection.ts";
import { loadSheet } from "../ui/dom/sheetFrames.ts";
import { uiLayer } from "../ui/dom/uiLayer.ts";
import { pixelBitmapFont } from "../ui/phaser/pixelText.ts";

const nativeSections = new WeakMap<Scene, NativeTopSection>();

// The shared native section owns chrome and native presses; the scene owns action admission.
export function addNativeTopSection(
  scene: Scene,
  config: NativeTopSectionConfig,
): NativeTopSection | undefined {
  nativeSections.get(scene)?.dispose();
  const layer = uiLayer();
  const title = pixelBitmapFont(scene, "title");
  if (layer === undefined || title === undefined) {
    return undefined;
  }
  const view = createNativeTopSection(layer, { artUrl, loadSheet }, title, config);
  const release = () => view.buttons.forEach((button) => button.setPressed(false));
  const section: NativeTopSection = {
    ...view,
    dispose() {
      if (nativeSections.get(scene) !== section) {
        return;
      }
      nativeSections.delete(scene);
      scene.events.off(Scenes.Events.PAUSE, release);
      scene.events.off(Scenes.Events.SHUTDOWN, section.dispose);
      view.dispose();
    },
  };
  nativeSections.set(scene, section);
  scene.events.on(Scenes.Events.PAUSE, release);
  scene.events.once(Scenes.Events.SHUTDOWN, section.dispose);
  return section;
}

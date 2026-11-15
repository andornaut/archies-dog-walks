import { type Scene, Scenes } from "phaser";

import { artUrl } from "../assets/artFiles.ts";
import {
  createNativeTopSection,
  type NativeTopSection,
  type NativeTopSectionConfig,
} from "../ui/dom/nativeTopSection.ts";
import { loadSheet } from "../ui/dom/sheetFrames.ts";
import { type UiLayer, uiLayer } from "../ui/dom/uiLayer.ts";
import { pixelBitmapFont } from "../ui/phaser/pixelText.ts";

interface SectionOwner {
  asleep: boolean;
  disposed: boolean;
  inert: boolean;
  layer: UiLayer;
  ready: boolean;
  section: NativeTopSection;
  shown: boolean;
  view: NativeTopSection;
}
const nativeSections = new WeakMap<Scene, SectionOwner>();
const sectionStacks = new WeakMap<UiLayer, SectionOwner[]>();

// Barless overlays retain the current owner. A later screen bar displaces it until disposal.
function syncSections(stack: readonly SectionOwner[]): void {
  const owner = stack.findLast((entry) => !entry.disposed && !entry.asleep && entry.shown);
  for (const entry of stack) {
    const active = entry === owner && entry.ready;
    entry.view.setShown(active);
    entry.view.setInert(!active || entry.inert);
    if (!active) {
      entry.view.buttons.forEach((button) => button.setPressed(false));
    }
  }
}

// The scene owns actions; one shared stack owns visibility across retained scene roots.
export function addNativeTopSection(
  scene: Scene,
  config: NativeTopSectionConfig,
): NativeTopSection | undefined {
  const previous = nativeSections.get(scene);
  const layer = uiLayer();
  const title = pixelBitmapFont(scene, "title");
  if (layer === undefined || title === undefined) {
    return undefined;
  }
  const stack = sectionStacks.get(layer) ?? [];
  sectionStacks.set(layer, stack);
  const index = previous?.layer === layer ? stack.indexOf(previous) : -1;
  const shown = previous?.shown ?? true;
  const inert = previous?.inert ?? false;
  const asleep = previous?.asleep ?? false;
  previous?.section.dispose();
  const view = createNativeTopSection(layer, { artUrl, loadSheet }, title, config);
  const release = () => view.buttons.forEach((button) => button.setPressed(false));
  const sleep = () => {
    entry.asleep = true;
    release();
    syncSections(stack);
  };
  const wake = () => {
    entry.asleep = false;
    syncSections(stack);
  };
  const section: NativeTopSection = {
    ...view,
    dispose() {
      if (entry.disposed) {
        return;
      }
      entry.disposed = true;
      if (nativeSections.get(scene) === entry) {
        nativeSections.delete(scene);
      }
      const at = stack.indexOf(entry);
      if (at !== -1) {
        stack.splice(at, 1);
      }
      scene.events.off(Scenes.Events.PAUSE, release);
      scene.events.off(Scenes.Events.SLEEP, sleep);
      scene.events.off(Scenes.Events.WAKE, wake);
      scene.events.off(Scenes.Events.SHUTDOWN, section.dispose);
      view.dispose();
      syncSections(stack);
    },
    setInert(value) {
      entry.inert = value;
      syncSections(stack);
    },
    setShown(value) {
      entry.shown = value;
      syncSections(stack);
    },
  };
  const entry: SectionOwner = {
    asleep,
    disposed: false,
    inert,
    layer,
    ready: false,
    section,
    shown,
    view,
  };
  stack.splice(index === -1 ? stack.length : index, 0, entry);
  nativeSections.set(scene, entry);
  scene.events.on(Scenes.Events.PAUSE, release);
  scene.events.on(Scenes.Events.SLEEP, sleep);
  scene.events.on(Scenes.Events.WAKE, wake);
  scene.events.once(Scenes.Events.SHUTDOWN, section.dispose);
  syncSections(stack);
  void view.revealed.then((ready) => {
    if (!entry.disposed) {
      entry.ready = ready;
      syncSections(stack);
    }
  });
  return section;
}

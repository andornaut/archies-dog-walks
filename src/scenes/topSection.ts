import { type Scene, Scenes } from "phaser";

import { artUrl } from "../assets/artFiles.ts";
import {
  createNativeTopSection,
  type NativeTopSection,
  type NativeTopSectionConfig,
} from "../ui/dom/nativeTopSection.ts";
import { followModalUnderlay } from "../ui/dom/rampDim.ts";
import { loadSheet } from "../ui/dom/sheetFrames.ts";
import { type UiLayer, uiLayer } from "../ui/dom/uiLayer.ts";
import { pixelBitmapFont } from "../ui/phaser/pixelText.ts";
import type { TopSectionButton } from "../ui/topSection.ts";

interface SectionOwner {
  asleep: boolean;
  covered: () => boolean;
  disposed: boolean;
  inert: boolean;
  layer: UiLayer;
  ready: boolean;
  // Roots of the owner's own that draw its bar's marks over the bar (joinTopSection).
  roots: readonly HTMLElement[];
  section: NativeTopSection;
  shown: boolean;
  view: NativeTopSection;
}
const nativeSections = new WeakMap<Scene, SectionOwner>();
const sectionStacks = new WeakMap<UiLayer, SectionOwner[]>();

function selectedSection(stack: readonly SectionOwner[]): SectionOwner | undefined {
  return stack.findLast((entry) => !entry.disposed && !entry.asleep && entry.shown);
}

// The selected bar remains the source of control visibility for retained overlays.
export function nativeTopSectionButtons(scene: Scene): readonly TopSectionButton[] {
  const layer = nativeSections.get(scene)?.layer ?? uiLayer();
  const owner = layer === undefined ? undefined : selectedSection(sectionStacks.get(layer) ?? []);
  return owner?.ready === true ? [...owner.view.buttons.keys()] : [];
}

// The bar on screen: the selected owner's root and the roots joined to it, which a page over its
// screen (help) leaves in view.
export function shownTopSectionRoots(scene: Scene): readonly HTMLElement[] {
  const layer = nativeSections.get(scene)?.layer ?? uiLayer();
  const owner = layer === undefined ? undefined : selectedSection(sectionStacks.get(layer) ?? []);
  return owner === undefined ? [] : [owner.view.element, ...owner.roots];
}

// Joins roots that draw scene's bar's own marks over the bar, such as the walk bar's effect
// icons, to scene's top section, so they show wherever the bar shows (shownTopSectionRoots).
export function joinTopSection(scene: Scene, roots: readonly HTMLElement[]): void {
  const owner = nativeSections.get(scene);
  if (owner !== undefined) {
    owner.roots = [...owner.roots, ...roots];
  }
}

// Barless overlays retain the current owner. A later screen bar displaces it until disposal.
function syncSections(stack: readonly SectionOwner[]): void {
  const owner = selectedSection(stack);
  for (const entry of stack) {
    const active = entry === owner && entry.ready;
    entry.view.setShown(active);
    const covered = entry.covered();
    entry.view.setInert(!active || entry.inert || covered);
    if (!active || covered) {
      entry.view.buttons.forEach((button) => button.setPressed(false));
    }
  }
}

// The scene owns actions; one shared stack owns visibility across retained scene roots. The
// whole bar, its Sound, Pause and Menu buttons included, stays painted and laid out under a
// modal, uniformly dimmed and inert.
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
  const covering = layer.input;
  const stopUnderlay = followModalUnderlay(covering, view.element);
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
      stopUnderlay();
      stopCovering();
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
    covered: () => !covering.accepts(),
    disposed: false,
    inert,
    layer,
    ready: false,
    roots: previous?.roots ?? [],
    section,
    shown,
    view,
  };
  stack.splice(index === -1 ? stack.length : index, 0, entry);
  const stopCovering = covering.subscribe(() => syncSections(stack));
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

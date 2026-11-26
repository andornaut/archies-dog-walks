import type { Scene } from "phaser";

import { domArtUrl } from "../assets/files/index.ts";
import { gameData } from "../data/index.ts";
import {
  createHudCards,
  createHudMoments,
  projectHudCards,
  projectHudMoments,
  projectHudTopSections,
} from "../hud/dom/index.ts";
import { pillKind } from "../presentation/index.ts";
import {
  createNativeTopSection,
  loadSheet,
  type NativeTopSectionConfig,
  type UiLayer,
} from "../ui/dom/index.ts";
import { displayBitmapFont, pixelBitmapFont } from "../ui/phaser/index.ts";
import { pillColours } from "./effectNameColours.ts";
import { createNativePicture } from "./nativePicture.ts";
import type { ScenePicture } from "./scenePicture.ts";
import { addNativeTopSection } from "./topSection.ts";

interface HudPicture {
  readonly stillFrames?: Readonly<Record<string, number>>;
  readonly view: ScenePicture;
}

// A Help picture mirrors the live HUD into passive clips without taking ownership of the live bar.
// The body comes first so its moments keep their stacking below the bar.
export function createHudSceneProjection(
  scene: Scene,
  layer: UiLayer,
  picture: HudPicture | undefined,
) {
  const body = pixelBitmapFont(scene, "body");
  const title = pixelBitmapFont(scene, "title");
  const display = displayBitmapFont(scene);
  if (body === undefined || title === undefined || display === undefined) {
    throw new Error("The native HUD requires its prepared UI context");
  }

  const source = { artUrl: domArtUrl, loadSheet };
  const fonts = { body, display, title };
  const colours = (index: number) => {
    const kind = pillKind(index);
    return kind === undefined ? undefined : pillColours(kind);
  };
  const hasArt = (key: string) => scene.textures.exists(key);
  const clips = picture === undefined ? undefined : createNativePicture(layer, picture.view);
  const layers = clips?.layers ?? [layer];
  const moments = () =>
    layers.map((target) => createHudMoments(target, source, fonts, hasArt, colours));
  const painters = moments();
  const cards = layers.map((target) => createHudCards(target, source, fonts, gameData));
  const painter = projectHudMoments(painters, picture?.stillFrames);
  const roots = painters.map(({ element }) => element);

  return {
    mountTopSection(config: NativeTopSectionConfig) {
      const section =
        clips === undefined
          ? addNativeTopSection(scene, config)
          : projectHudTopSections(
              layers.map((target) => createNativeTopSection(target, source, title, config)),
            );
      const iconPainters = moments();
      const icons = projectHudMoments(iconPainters, picture?.stillFrames);
      const barPainters = moments();
      const bar = projectHudMoments(barPainters, picture?.stillFrames);
      return {
        bar,
        barRoots: barPainters.map(({ element }) => element),
        cards: projectHudCards(barPainters, cards),
        disposePainters() {
          painter.dispose();
          icons.dispose();
          bar.dispose();
          clips?.dispose();
        },
        iconRoots: iconPainters.map(({ element }) => element),
        icons,
        section,
      };
    },
    painter,
    roots,
  };
}

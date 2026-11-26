import type { Scene } from "phaser";

import { domArtUrl } from "../assets/files/index.ts";
import { SETTINGS_ART_KEYS } from "../home/index.ts";
import { type DomSettings, type DomSettingsInput, showSettings } from "../hud/dom/settings.ts";
import { loadSheet } from "../ui/dom/sheetFrames.ts";
import { followScene, htmlPanelInput, htmlPanelPlace } from "./questionPanel.ts";

// The native settings view uses the same model, gesture controller and scene lifecycle.
export function addHtmlSettings(
  scene: Scene,
  input: Omit<DomSettingsInput, "artUrl" | "closeLabel" | "fonts" | "loadSheet" | "toGame">,
): DomSettings | undefined {
  const place = htmlPanelPlace(scene);
  if (place === undefined || !SETTINGS_ART_KEYS.every((key) => scene.textures.exists(key))) {
    return undefined;
  }
  const settings = showSettings(place.layer, {
    ...htmlPanelInput(place),
    ...input,
    artUrl: domArtUrl,
    loadSheet,
  });
  return followScene(scene, settings);
}

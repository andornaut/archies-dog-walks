import type { Scene } from "phaser";

import { artUrl } from "../assets/artFiles.ts";
import { SETTINGS_ART_KEYS } from "../home/settingsView.ts";
import { type DomSettings, type DomSettingsInput, showSettings } from "../hud/dom/settings.ts";
import { loadSheet } from "../ui/dom/sheetFrames.ts";
import { followScene, htmlPanelInput, htmlPanelPlace } from "./questionPanel.ts";

// The settings card in the HTML layer, laid out as the canvas draws it (settingsView), following
// its scene, or undefined where the canvas must draw it: the page's switch is off, the fonts
// are not ready, or art the card draws is missing, which the canvas stands in for.
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
    artUrl,
    loadSheet,
  });
  return followScene(scene, settings);
}

import { type Scene, Scenes } from "phaser";

import { domArtUrl } from "../../assets/files/index.ts";
import type { AssetManifest } from "../../assets/index.ts";
import { hudArtResources } from "../../hud/dom/index.ts";
import { uiLayer } from "../../ui/dom/index.ts";
import type { RequiredUiController } from "./requiredUi.ts";

export const HOME_UI_KEYS: ReadonlySet<string> = new Set([
  "icon-menu",
  "icon-sound",
  "ui-icon-button-normal",
  "ui-icon-button-pressed",
]);
export const HUD_UI_KEYS: ReadonlySet<string> = new Set([
  ...HOME_UI_KEYS,
  "icon-pause",
  "ui-dog-card",
  "ui-heart",
  "ui-home-cash-well-left",
  "ui-home-cash-well-mid",
  "ui-home-cash-well-right",
]);

export function requireBootNativeUi(
  scene: Scene,
  {
    manifest,
    native,
  }: {
    readonly manifest: AssetManifest;
    readonly native: Pick<RequiredUiController, "wait"> | undefined;
  },
  keys: ReadonlySet<string>,
  ready: () => void,
): void {
  const layer = uiLayer();
  if (layer === undefined || native === undefined) {
    return;
  }
  const assets = [
    ...manifest.images
      .filter(({ key }) => keys.has(key))
      .map(({ key }) => ({ key, kind: "image" as const })),
    ...manifest.sprites
      .filter(({ key }) => keys.has(key))
      .map(({ key }) => ({ key, kind: "sheet" as const })),
  ];
  const present = new Set(assets.map(({ key }) => key));
  const missing = [...keys].filter((key) => !present.has(key));
  if (missing.length > 0) {
    throw new Error(`Required native UI art is absent from the manifest: ${missing.join(", ")}`);
  }
  layer.requireAssets(hudArtResources({ artUrl: domArtUrl }, assets));
  const stop = native.wait(ready);
  scene.events.once(Scenes.Events.SHUTDOWN, stop);
}

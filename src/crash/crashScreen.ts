// The page's crash screen (the kit's web/crash/dom/crashScreen), in the game's words and
// palette, with the message, stack and build label under dev=1. It writes nothing to the save,
// whose in-memory state may be corrupt; the walk's last checkpoint is already saved, and the next
// launch resumes or banks it. A checkpoint the walk writes after the crash, as the page hides,
// keeps no resume point (stopResuming in src/main.ts), so that launch banks it.
// src/crash/install.ts imports this module before any other game module.
import "@andornaut/game-kit/runtime/web/crash/dom/crash.css";
import "./crash.css";

import { installCrashScreen } from "@andornaut/game-kit/runtime/web/crash/dom/crashScreen";
import artFiles from "virtual:art-files";

import palette from "../../shared/palette.json" with { type: "json" };
import { artFileUrl } from "../assets/artUrl.ts";
import { BUILD_LABEL } from "../buildLabel.ts";
import { MENU_TEXT } from "../data/menuText.ts";
import { pageSearch } from "../dev/devTools.ts";
import { devInSearch } from "../dev/runSetup.ts";
import { pageDeviceSettings } from "../save/settings.ts";
import { mountMuteControl } from "../ui/dom/muteControl.ts";

const colour = (name: keyof typeof palette) => `#${palette[name].hex}`;

// The local paper theme uses the same palette as canvas cards, without loading the renderer.
for (const [name, value] of [
  ["paper", colour("cream")],
  ["paper-lip", colour("tan")],
  ["paper-text", colour("plum")],
] as const) {
  document.documentElement.style.setProperty(`--crash-${name}`, value);
}

// Archie's upset portrait is a static decorative CSS crop, loaded without Phaser or the canvas.
const sadDogUrl = artFileUrl(import.meta.env.BASE_URL, artFiles, "sprites/face-dog-archie.png");
document.documentElement.style.setProperty(
  "--crash-pose-image",
  `url(${JSON.stringify(sadDogUrl)})`,
);

// Reload uses the same green primary face and forest lip as canvas actions.
export const CRASH_SCREEN = installCrashScreen(window, {
  buildLabel: BUILD_LABEL,
  colours: {
    background: colour("ink"),
    buttonFace: colour("green"),
    buttonLip: colour("forest"),
    ink: colour("ink"),
    text: colour("cream"),
  },
  dev: devInSearch(pageSearch()),
  words: MENU_TEXT.crash,
});

// The crash dialog owns the control so the existing inert barrier still blocks the game.
// Observe only its insertion; the renderer and profile do not participate in this endpoint.
export function observeCrashMute(doc: Document): () => void {
  if (!doc.body || typeof MutationObserver === "undefined") {
    return () => undefined;
  }
  let remove: (() => void) | undefined;
  const observer = new MutationObserver(() => {
    const dialog = doc.body.querySelector<HTMLElement>(".crash");
    if (dialog !== null) {
      observer.disconnect();
      try {
        remove = mountMuteControl(pageDeviceSettings(), dialog);
      } catch (error) {
        console.warn("The crash sound control could not open.", error);
      }
    }
  });
  observer.observe(doc.body, { childList: true });
  return () => {
    observer.disconnect();
    remove?.();
  };
}

observeCrashMute(document);

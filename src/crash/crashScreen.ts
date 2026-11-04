// The page's crash screen (the kit's web/crash/dom/crashScreen), in the game's words and
// palette, with the message, stack and build label under dev=1. It writes nothing to the save,
// whose in-memory state may be corrupt; the walk's last checkpoint is already saved, and the next
// launch resumes or banks it. A checkpoint the walk writes after the crash, as the page hides,
// keeps no resume point (stopResuming in src/main.ts), so that launch banks it.
// src/crash/install.ts imports this module before any other game module.
import "@andornaut/game-kit/web/crash/dom/crash.css";
import "./crash.css";

import { installCrashScreen } from "@andornaut/game-kit/web/crash/dom/crashScreen";
import artFiles from "virtual:art-files";

import palette from "../../shared/palette.json";
import { artFileUrl } from "../assets/artUrl";
import { BUILD_LABEL } from "../buildLabel";
import { MENU_TEXT } from "../data/menuText";
import { pageSearch } from "../dev/devTools";
import { devInSearch } from "../dev/runSetup";

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

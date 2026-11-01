// What vite.config.ts's plugins take from the repository's code, in one module so the kit's
// gameViteConfig loads it through a single Vite module runner, which resolves @andornaut/game-kit
// as the app does.
export { securityHeadersPlugin } from "../headers/securityHeadersPlugin";
export { phaserBuildPlugin } from "../platform/build/vite/phaserBuildPlugin.ts";
export { hashedIconsPlugin } from "../platform/pwa/vite/hashedIconsPlugin.ts";
export { HASHED_ICONS } from "../pwa/icons";
export { precachePlugin } from "../pwa/precachePlugin";
export { atlasPlugin } from "./atlas/atlasPlugin";
export { generatedFilesPlugin } from "./generatedFilesPlugin";
export { PHASER_BUILD } from "./phaserBuild";

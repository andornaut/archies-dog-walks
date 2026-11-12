// What vite.config.ts's plugins take from the repository's code, in one module so the kit's
// gameViteConfig loads it through a single Vite module runner, which resolves @andornaut/game-kit
// as the app does.
export { inlineStyleCheckPlugin } from "../headers/inlineStyleCheckPlugin.ts";
export { securityHeadersPlugin } from "../headers/securityHeadersPlugin.ts";
export { HASHED_ICONS } from "../pwa/icons.ts";
export { precachePlugin } from "../pwa/precachePlugin.ts";
export { webManifestPlugin } from "../pwa/webManifestPlugin.ts";
export { atlasPlugin } from "./atlas/atlasPlugin.ts";
export { generatedFilesPlugin } from "./generatedFilesPlugin.ts";
export { PHASER_BUILD } from "./phaserBuild.ts";
export { uiStylePlugin } from "./uiStylePlugin.ts";
export { phaserBuildPlugin } from "@andornaut/game-kit/web/build/vite/phaserBuildPlugin";
export { hashedIconsPlugin } from "@andornaut/game-kit/web/pwa/vite/hashedIconsPlugin";

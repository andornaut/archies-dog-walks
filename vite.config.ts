import { gameViteConfig } from "@andornaut/game-kit/web/build/vite/gameConfig";

import { PREVIEW_HOST } from "./src/tools/previewHost.ts";
import type * as ConfigModules from "./src/tools/viteConfigModules.ts";

// The parent Vite and Vitest config loads the plugins below from
// src/tools/viteConfigModules.ts through native package resolution in its module runner.
export default gameViteConfig<typeof ConfigModules>({
  // The Phaser chunk alone is about 1.06 MB minified, so the 500 kB default always warns.
  // Set just above it so that growth in Phaser or game code still warns.
  chunkSizeWarningLimit: 1100,
  configModules: "src/tools/viteConfigModules.ts",
  // The home page at /, the game at /play/ and Tuning at /tuning/.
  pages: {
    main: "pages/index.html",
    play: "pages/play/index.html",
    tuning: "pages/tuning/index.html",
  },
  // atlasPlugin writes public/art/manifest.json from the art files, packs the art's images and
  // sprites into atlas pages, and writes every art file the game loads under /assets/art/ with a
  // content hash in its name, mapped from its path under /art/ in the game's code.
  // generatedFilesPlugin, on the dev server only, rewrites public/art/manifest.json and
  // shared/export/ as the art and src/ change. npm run build writes shared/export/ first.
  // phaserBuildPlugin, in a build only, bundles Phaser from its source without the namespaces the
  // game does not use and without the Canvas renderer (PHASER_BUILD in src/tools/phaserBuild.ts).
  // hashedIconsPlugin writes each icon under a content-hashed name in /assets/ and points the
  // built pages and /manifest.webmanifest there (HASHED_ICONS in src/pwa/icons.ts).
  // webManifestPlugin fills the manifest's description from the data, in dev and in the manifest
  // hashedIconsPlugin writes, before precachePlugin reads it.
  // precachePlugin writes /sw.js, the service worker that precaches the game for offline play,
  // reading the map of hashed art atlasPlugin writes.
  // securityHeadersPlugin writes /_headers, the response headers with each page's CSP.
  // inlineStyleCheckPlugin fails the build for a style element or attribute that CSP would block
  // in a built script or page.
  // uiStylePlugin serves the HTML interface's stylesheet as the CSS module virtual:adw-ui.css, so
  // the build links it as a file the CSP's style-src 'self' allows.
  plugins: (modules, repoPath) => {
    const atlas = modules.atlasPlugin();
    return [
      atlas,
      modules.generatedFilesPlugin({ repoRoot: repoPath(".") }),
      modules.phaserBuildPlugin(modules.PHASER_BUILD),
      modules.hashedIconsPlugin({ icons: modules.HASHED_ICONS }),
      modules.webManifestPlugin(),
      modules.precachePlugin({
        getArtFiles: atlas.api.artFiles,
        pageHtmlFile: "play/index.html",
        serviceWorkerSource: repoPath("src/pwa/serviceWorker.ts"),
      }),
      modules.securityHeadersPlugin(),
      modules.inlineStyleCheckPlugin(),
      modules.uiStylePlugin({ source: repoPath("src/ui/dom/uiStylesheet.ts") }),
    ];
  },
  previewHost: PREVIEW_HOST,
  repoRoot: import.meta.dirname,
  // Whole-walk tests run several seconds alone and several times that on a loaded host or a
  // CI runner, so the default 5 s is too tight; the slowest blocks set their own, longer limit.
  testTimeout: 30_000,
}).then((config) => ({
  ...config,
  test: {
    ...config.test,
    // Library suites belong to their own repositories; this consumer owns its src tests.
    include: ["src/**/*.test.ts"],
    server: { deps: { inline: ["@andornaut/game-kit"] } },
  },
}));

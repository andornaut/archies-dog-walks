import { relative } from "node:path/posix";

import { contentHash } from "@andornaut/game-kit/build/contentHash";
import { type Plugin, runnerImport } from "vite";

import { DOM_BUTTON_SKIN, domArtPath } from "../assets/domArt.ts";

type StylesheetModule = typeof import("../ui/dom/uiStylesheet.ts");

// The CSS module the game imports for the HTML interface's stylesheet.
export const UI_STYLESHEET_ID = "virtual:adw-ui.css";
// Ends in .css, so Vite's CSS pipeline takes it: a build bundles it into the importing chunk's CSS
// file, which the page links from its own origin as the CSP's style-src 'self' allows.
export const BUTTON_SKIN_ID = "virtual:adw-button-skin";
const SKIN_ID = `\0${BUTTON_SKIN_ID}`;
const DEV_SKIN_PATH = "/art/button-skin-manifest.json";

const RESOLVED_ID = `\0${UI_STYLESHEET_ID}`;
// The hooks' filters, matching those ids alone, so the bundler calls them for no other module.
const ID_FILTER = /^virtual:adw-(?:ui\.css|button-skin)$/;
const RESOLVED_ID_FILTER = /^\0virtual:adw-(?:ui\.css|button-skin)$/;

interface UiStylePluginOptions {
  // The module whose UI_STYLESHEET is the stylesheet's text (src/ui/dom/uiStylesheet.ts), as an
  // absolute path.
  source: string;
  getArtFiles?: () => ReadonlyMap<string, string>;
}

// The emitted manifest is beside assets/art, so its hashed references survive any build base.
export function buttonSkinManifest(files: ReadonlyMap<string, string>): string {
  const resolve = (key: string, ext: "json" | "png") => {
    const path = domArtPath("sheet", key, ext);
    const hashed = files.get(path);
    if (hashed === undefined) {
      throw new Error(`Button skin art was not emitted: ${path}`);
    }
    return relative("assets", hashed);
  };
  return JSON.stringify({
    sprites: DOM_BUTTON_SKIN.sheets.map((key) => ({
      json: resolve(key, "json"),
      key,
      png: resolve(key, "png"),
    })),
  });
}

// Serves UI_STYLESHEET_ID: the source module's UI_STYLESHEET, evaluated afresh on each load in a
// runner of its own, which keeps every module it evaluates. On the dev server, an edit to a file
// that load read (the styles, SLICES, the palette) reloads the stylesheet.
export function uiStylePlugin({ getArtFiles, source }: UiStylePluginOptions): Plugin {
  let build = false;
  let base = "/";
  let sources = new Set<string>();
  return {
    configResolved(config) {
      build = config.command === "build";
      base = config.base;
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        if (request.url?.split("?")[0] !== `${base.replace(/\/$/, "")}${DEV_SKIN_PATH}`) {
          next();
          return;
        }
        response.setHeader("Content-Type", "application/json");
        response.end(
          JSON.stringify({
            sprites: DOM_BUTTON_SKIN.sheets.map((key) => ({
              json: domArtPath("sheet", key, "json"),
              key,
              png: domArtPath("sheet", key, "png"),
            })),
          }),
        );
      });
      server.watcher.on("all", (_event, file) => {
        if (!sources.has(file)) {
          return;
        }
        for (const environment of Object.values(server.environments)) {
          const module = environment.moduleGraph.getModuleById(RESOLVED_ID);
          if (module !== undefined) {
            void environment.reloadModule(module);
          }
        }
      });
    },
    load: {
      filter: { id: RESOLVED_ID_FILTER },
      async handler(id) {
        if (id === SKIN_ID) {
          if (!build) {
            return `export default ${JSON.stringify(`${base.replace(/\/$/, "")}${DEV_SKIN_PATH}`)}`;
          }
          if (getArtFiles === undefined) {
            throw new Error("Button skin build requires this build's art map");
          }
          const source = buttonSkinManifest(getArtFiles());
          const reference = this.emitFile({
            fileName: `assets/button-skin-${contentHash(new TextEncoder().encode(source))}.json`,
            source,
            type: "asset",
          });
          return `export default import.meta.ROLLUP_FILE_URL_${reference}`;
        }
        const { dependencies, module } = await runnerImport<StylesheetModule>(source, {
          configFile: false,
        });
        sources = new Set(dependencies);
        // Watched, on the dev server and in a watching build.
        for (const file of dependencies) {
          this.addWatchFile(file);
        }
        return module.UI_STYLESHEET;
      },
    },
    name: "archies-dog-walks-ui-style",
    resolveId: {
      filter: { id: ID_FILTER },
      handler: (id) => (id === BUTTON_SKIN_ID ? SKIN_ID : RESOLVED_ID),
    },
  };
}

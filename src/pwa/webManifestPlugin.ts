import { readFile } from "node:fs/promises";

import type { Plugin } from "vite";

import { gameData } from "../data/index.ts";
import type { GameData } from "../data/types.ts";

const WEB_MANIFEST = "manifest.webmanifest";
const DESCRIPTION = '"%INSTALL_DESCRIPTION%"';

// The web app manifest (public/manifest.webmanifest) with menuText.settings.installDescription in
// place of its "%INSTALL_DESCRIPTION%" string.
export function webManifestJson(data: Pick<GameData, "menuText">, json: string): string {
  if (!json.includes(DESCRIPTION)) {
    throw new Error(`${WEB_MANIFEST} has no ${DESCRIPTION} description`);
  }
  return json.replace(DESCRIPTION, JSON.stringify(data.menuText.settings.installDescription));
}

// Renders the manifest's description in dev and in the build output. In a build it runs after the
// kit's hashedIconsPlugin writes the manifest and before precachePlugin reads it, so vite.config.ts
// lists it between them.
export function webManifestPlugin(): Plugin {
  return {
    configureServer(server) {
      server.middlewares.use(`/${WEB_MANIFEST}`, (_request, response, next) => {
        readFile(`${server.config.publicDir}/${WEB_MANIFEST}`, "utf8").then((json) => {
          response.setHeader("Content-Type", "application/manifest+json");
          response.end(webManifestJson(gameData, json));
        }, next);
      });
    },
    enforce: "post",
    generateBundle(_options, bundle) {
      const file = bundle[WEB_MANIFEST];
      if (file?.type !== "asset") {
        this.error(`${WEB_MANIFEST} is not in the build output`);
      }
      const { source } = file;
      file.source = webManifestJson(
        gameData,
        typeof source === "string" ? source : new TextDecoder().decode(source),
      );
    },
    name: "archies-dog-walks-web-manifest",
  };
}

import { readFile } from "node:fs/promises";

import type { RgbaImage } from "@andornaut/art-kit/rgbaImage";
import type { Plugin, ViteDevServer } from "vite";

import type { ArtFileMap } from "../../assets/artUrl.ts";
import { DOM_ART_KEYS, DOM_DIM_ART_KEYS, DOM_DISABLED_ART_KEYS } from "../../assets/domArt.ts";
import { parseManifest } from "../../assets/manifest.ts";
import { ART_DIR, ART_MANIFEST, artManifestText, generateArtManifest } from "../artManifest.ts";
import { limitConcurrency } from "../concurrency.ts";
import { nodeArtFiles, OPEN_FILE_LIMIT, writeIfChanged } from "../files.ts";
import { buildAtlases, WEBP_PAGES } from "./atlasBuild.ts";
import { artCopyFile, DIM_COPY, DISABLED_COPY } from "./disabledFiles.ts";
import { ART_FILES_MODULE, hashGameArt } from "./hashedArt.ts";

// Vite's prefix for a module id that names no file.
const RESOLVED_ART_FILES_MODULE = `\0${ART_FILES_MODULE}`;

interface AtlasPluginApi {
  // The build's ArtFileMap, once buildStart has run.
  artFiles(): ArtFileMap;
}

// Writes /art/manifest.json from the files under public/art/ first, so the build copies and
// packs what is on disk. Then packs every image and sprite frame it lists into a few atlas
// pages, lossless WebPs, with an atlas manifest mapping each key and frame to its page and rect. Every file the
// game loads (both manifests, the pages, the fonts, the sounds and any key the atlas leaves
// out) goes to the build output under a content-hashed name (src/tools/atlas/hashedArt.ts),
// and the game reads the names from the ART_FILES_MODULE map, as do the disabled tiles' grey
// copies and the celebration's dimmed copies the HTML interface draws (artCopyFiles). The dev
// server's map is empty.
// The files under public/art/ are also copied as they are, for the dev server, the art gallery
// and the site's pages.
export function atlasPlugin(): Plugin & { api: AtlasPluginApi } {
  let artFiles: ArtFileMap = new Map();
  return {
    api: { artFiles: () => artFiles },
    async buildStart() {
      const { config, logger } = this.environment;
      if (config.command !== "build") {
        return;
      }
      const artDir = `${config.publicDir}/${ART_DIR}`;
      // The atlas build and hashGameArt read every art file in parallel.
      const readArt = limitConcurrency(OPEN_FILE_LIMIT, async (path: string) =>
        this.fs.readFile(`${artDir}/${path}`),
      );
      const decoded = new Map<string, RgbaImage>();
      const art = await generateArtManifest(nodeArtFiles(artDir), decoded);
      if (await writeIfChanged(`${artDir}/${ART_MANIFEST}`, artManifestText(art))) {
        this.info(`wrote ${ART_DIR}/${ART_MANIFEST} from the files on disk`);
      }
      const atlas = await buildAtlases(readArt, { decoded, manifest: art, pages: WEBP_PAGES });
      for (const warning of atlas.warnings) {
        this.warn(`atlas: ${warning}, so it loads from its own files`);
      }
      for (const { bytes, file, group, height, width } of atlas.manifest.pages) {
        logger.info(
          `atlas: ${file} ${width}x${height}, ${(bytes / 1024).toFixed(1)} kB (${group})`,
        );
      }
      const hashed = await hashGameArt(
        readArt,
        { art: DOM_ART_KEYS, dim: DOM_DIM_ART_KEYS, disabled: DOM_DISABLED_ART_KEYS },
        art,
        atlas,
      );
      for (const { fileName, source } of hashed) {
        this.emitFile({ fileName, source, type: "asset" });
      }
      artFiles = new Map(hashed.map(({ fileName, path }) => [path, fileName]));
    },
    // The dev server serves each grey and dimmed copy the HTML interface draws
    // (DOM_DISABLED_ART_KEYS, DOM_DIM_ART_KEYS) at its path under /art/, made from the files on
    // disk as a build makes it.
    configureServer(server: ViteDevServer) {
      const artDir = `${server.config.publicDir}/${ART_DIR}`;
      const prefix = `${server.config.base}${ART_DIR}/`;
      const keys = new Map(
        (
          [
            [DISABLED_COPY, DOM_DISABLED_ART_KEYS],
            [DIM_COPY, DOM_DIM_ART_KEYS],
          ] as const
        ).flatMap(([copy, copied]) =>
          [...copied].flatMap((key) =>
            (["image", "sheet"] as const).map((kind) => [copy.path(kind, key), { copy, key }]),
          ),
        ),
      );
      const readArt = async (path: string) => new Uint8Array(await readFile(`${artDir}/${path}`));
      server.middlewares.use((request, response, next) => {
        const url = request.url?.split("?")[0] ?? "";
        const made = url.startsWith(prefix) ? keys.get(url.slice(prefix.length)) : undefined;
        if (made === undefined) {
          next();
          return;
        }
        void (async () => {
          const text = new TextDecoder().decode(await readArt(ART_MANIFEST));
          const manifest = parseManifest(JSON.parse(text));
          const { source } = await artCopyFile(readArt, manifest, made.copy, made.key);
          response.setHeader("Content-Type", "image/png");
          response.end(source);
        })().catch(next);
      });
    },
    load(id) {
      return id === RESOLVED_ART_FILES_MODULE
        ? `export default new Map(${JSON.stringify([...artFiles])});`
        : undefined;
    },
    name: "archies-dog-walks-atlas",
    resolveId(id) {
      return id === ART_FILES_MODULE ? RESOLVED_ART_FILES_MODULE : undefined;
    },
  };
}

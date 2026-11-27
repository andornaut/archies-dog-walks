import { readFile } from "node:fs/promises";

import type { RgbaImage } from "@andornaut/art-kit/build/rgbaImage";
import { contentHash } from "@andornaut/game-kit/build/contentHash";
import type { Plugin, ViteDevServer } from "vite";

import {
  type ArtFileMap,
  artFileUrl,
  DOM_CHOICE_CARD_ART,
  DOM_DISABLED_ART_KEYS,
  DOM_SHEET_DIR,
  DOM_SHEET_KEYS,
  DOM_SHEETS,
  type DomSheet,
  domSheetImagePath,
  domSheetJsonPath,
  parseManifest,
} from "../assets/index.ts";
import type { DomSheetJson } from "../ui/dom/index.ts";
import { ART_DIR, ART_MANIFEST, artManifestText, generateArtManifest } from "./artManifest.ts";
import { buildAtlases, buildDomSheet, checkDomCopies, WEBP_PAGES } from "./atlas/index.ts";
import { limitConcurrency } from "./concurrency.ts";
import { nodeArtFiles, OPEN_FILE_LIMIT, writeIfChanged } from "./files.ts";
import {
  ART_FILES_JSON,
  ART_FILES_MODULE,
  artCopies,
  artFilesJson,
  type DomArtKeys,
  hashGameArt,
} from "./hashedArt.ts";
import { type SiteArt, siteHtml } from "./siteArt.ts";

// Vite's prefix for a module id that names no file.
const RESOLVED_ART_FILES_MODULE = `\0${ART_FILES_MODULE}`;

// The HTML interface's art, by its DOM sheet, and the copies of it it draws.
const DOM_KEYS: DomArtKeys = {
  disabled: DOM_DISABLED_ART_KEYS,
  grey: DOM_CHOICE_CARD_ART.grey,
  sheets: DOM_SHEET_KEYS,
};

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  json: "application/json",
  webp: "image/webp",
};

interface AtlasPluginApi {
  // The build's ArtFileMap, once buildStart has run.
  artFiles(): ArtFileMap;
}

// Writes /art/manifest.json from the files under public/art/ first, so the build packs and
// hashes what is on disk. Then packs every image and sprite frame it lists into a few atlas
// pages, lossless WebPs, with an atlas manifest mapping each key and frame to its page and rect,
// and the HTML interface's art into its DOM sheets with their copies (src/tools/atlas/
// domSheets.ts). Every file the game loads (both manifests, the pages, the DOM sheets, the
// fonts, the sounds and any key the atlas leaves out) goes to the build output under a
// content-hashed name (src/tools/hashedArt.ts), and the game reads the names from the
// ART_FILES_MODULE map. The dev server's map is empty. The map is also written as
// /art/art-files.json (ART_FILES_JSON), where the art gallery reads it; the dev server serves
// it empty. Of the files under public/art/, a build copies only the pages and the files the
// site's pages name (publicFilesPlugin).
export function atlasPlugin(): Plugin & { api: AtlasPluginApi } {
  let artFiles: ArtFileMap = new Map();
  let siteArt: SiteArt | undefined;
  let siteStylesheet: ((css: string) => string) | undefined;
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
      for (const { file, group, height, width } of atlas.manifest.pages) {
        const kB = (atlas.files.get(file)?.length ?? 0) / 1024;
        logger.info(`atlas: ${file} ${width}x${height}, ${kB.toFixed(1)} kB (${group})`);
      }
      const hashed = await hashGameArt(readArt, DOM_KEYS, art, atlas, decoded);
      for (const { path, source } of hashed.filter(({ path }) =>
        path.startsWith(`${DOM_SHEET_DIR}/`),
      )) {
        logger.info(`dom sheet: ${path}, ${(source.length / 1024).toFixed(1)} kB`);
      }
      for (const { fileName, source } of hashed) {
        this.emitFile({ fileName, source, type: "asset" });
      }
      artFiles = new Map(hashed.map(({ fileName, path }) => [path, fileName]));
      siteStylesheet = (source) => {
        const fileName = `assets/site-art-${contentHash(new TextEncoder().encode(source))}.css`;
        this.emitFile({ fileName, source, type: "asset" });
        return `${config.base}${fileName}`;
      };
      const sources = new Map(hashed.map(({ path, source }) => [path, source]));
      siteArt = (key) => {
        const sheet = DOM_SHEET_KEYS.get(key);
        if (sheet === undefined) {
          throw new Error(`site art: no DOM sheet for ${key}`);
        }
        const source = sources.get(domSheetJsonPath(sheet));
        if (source === undefined) {
          throw new Error(`site art: no metadata for ${key}`);
        }
        return {
          json: JSON.parse(new TextDecoder().decode(source)) as DomSheetJson,
          url: artFileUrl(config.base, artFiles, domSheetImagePath(sheet)),
        };
      };
      this.emitFile({
        fileName: `${ART_DIR}/${ART_FILES_JSON}`,
        source: artFilesJson(config.base, artFiles),
        type: "asset",
      });
    },
    // The dev server serves each DOM sheet's files at their paths under /art/, packed from the
    // files on disk as a build packs them, each sheet once until a file under public/art/
    // changes, and ART_FILES_JSON empty.
    configureServer(server: ViteDevServer) {
      const artDir = `${server.config.publicDir}/${ART_DIR}`;
      const prefix = `${server.config.base}${ART_DIR}/`;
      const sheetPrefix = `${prefix}${DOM_SHEET_DIR}/`;
      const keys = { copies: artCopies(DOM_KEYS), sheets: DOM_SHEET_KEYS };
      checkDomCopies(keys);
      const readArt = async (path: string) => new Uint8Array(await readFile(`${artDir}/${path}`));
      const built = new Map<DomSheet, Promise<Map<string, Uint8Array>>>();
      server.watcher.on("all", (_event, file) => {
        if (file.startsWith(`${artDir}/`)) {
          built.clear();
        }
      });
      // A file's sheet: the longest sheet name its name is or starts a copy's name with.
      const sheetOf = (name: string) =>
        [...DOM_SHEETS]
          .sort((a, b) => b.length - a.length)
          .find((sheet) => name === sheet || name.startsWith(`${sheet}-`));
      const filesOf = (sheet: DomSheet) => {
        let files = built.get(sheet);
        if (files === undefined) {
          files = readArt(ART_MANIFEST).then((bytes) =>
            buildDomSheet(
              readArt,
              parseManifest(JSON.parse(new TextDecoder().decode(bytes))),
              keys,
              sheet,
            ),
          );
          files.catch(() => built.delete(sheet));
          built.set(sheet, files);
        }
        return files;
      };
      server.middlewares.use((request, response, next) => {
        const url = request.url?.split("?")[0] ?? "";
        if (url === `${prefix}${ART_FILES_JSON}`) {
          response.setHeader("Content-Type", "application/json");
          response.end("{}");
          return;
        }
        const name = url.startsWith(sheetPrefix) ? url.slice(sheetPrefix.length) : "";
        const match = /^([a-z-]+)\.(json|webp)$/.exec(name);
        const sheet = match === null ? undefined : sheetOf(match[1]!);
        if (match === null || sheet === undefined) {
          next();
          return;
        }
        void filesOf(sheet)
          .then((files) => {
            const source = files.get(`${DOM_SHEET_DIR}/${name}`);
            if (source === undefined) {
              next();
              return;
            }
            response.setHeader("Content-Type", CONTENT_TYPES[match[2]!]!);
            response.setHeader("Cache-Control", "no-store");
            response.end(source);
          })
          .catch(next);
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
    transformIndexHtml: {
      handler(html) {
        return siteArt === undefined || siteStylesheet === undefined
          ? html
          : siteHtml(siteArt, siteStylesheet, html);
      },
      order: "post",
    },
  };
}

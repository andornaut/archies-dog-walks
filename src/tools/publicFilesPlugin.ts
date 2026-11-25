import { copyFile, mkdir, readdir, readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";

import type { Plugin } from "vite";

import { ART_DIR } from "./artManifest.ts";
import { limitConcurrency } from "./concurrency.ts";
import { OPEN_FILE_LIMIT } from "./files.ts";

// The public folder of art exports, which a build also writes, content-hashed, under /assets/art/
// (src/tools/hashedArt.ts).
const ART_FOLDER = `${ART_DIR}/`;

// A file under /art/ named by URL: an HTML src or href attribute's value, or a CSS url().
const ART_URL = /(?:\b(?:href|src)\s*=\s*["']?|\burl\(\s*["']?)\/art\/([^"'()\s?#<>]+)/giu;

// Pages and stylesheets, the files whose URLs a build reads.
const LINKING_FILE = /\.(?:css|html)$/u;

// The paths under the public directory of the files under /art/ that texts name by URL.
export function linkedArtFiles(texts: Iterable<string>): Set<string> {
  const paths = new Set<string>();
  for (const text of texts) {
    for (const [, path] of text.matchAll(ART_URL)) {
      paths.add(`${ART_FOLDER}${path}`);
    }
  }
  return paths;
}

// The public files a build copies, of files (each by its path under the public directory): every
// file outside art/, and under it each page and each file in linked, less any file the build
// output writes itself (output), which wins as it does over Vite's own copy. Throws for a linked
// file that files lack.
export function publicCopies(
  linked: ReadonlySet<string>,
  output: ReadonlySet<string>,
  files: readonly string[],
): string[] {
  const held = new Set(files);
  const missing = [...linked].filter((path) => !held.has(path)).sort();
  if (missing.length > 0) {
    const urls = missing.map((path) => `/${path}`).join(", ");
    throw new Error(`a page names ${urls}, which the public directory does not hold`);
  }
  return files.filter(
    (path) =>
      !output.has(path) &&
      (!path.startsWith(ART_FOLDER) || path.endsWith(".html") || linked.has(path)),
  );
}

// Every file under dir, by its path relative to dir, sorted.
async function filesUnder(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath, entry.name)).split("\\").join("/"))
    .sort();
}

// In a build, copies the public directory into the output in place of Vite's copy, leaving out
// the art exports no page or stylesheet names by URL (publicCopies): the game loads its art
// hashed under /assets/art/, and the art gallery reads it there through /art/art-files.json
// (src/tools/atlasPlugin.ts). The URLs are read from the built pages and stylesheets and
// the public ones, and a URL whose file the public directory lacks fails the build.
export function publicFilesPlugin(): Plugin {
  return {
    apply: "build",
    config: () => ({ build: { copyPublicDir: false } }),
    name: "archies-dog-walks-public-files",
    async writeBundle({ dir }, bundle) {
      const { publicDir } = this.environment.config;
      if (dir === undefined) {
        this.error("public files: the build has no output directory");
      }
      const files = await filesUnder(publicDir);
      const read = limitConcurrency(OPEN_FILE_LIMIT, async (path: string) =>
        readFile(join(publicDir, path), "utf8"),
      );
      const decoder = new TextDecoder();
      const built = Object.values(bundle).flatMap((file) =>
        file.type === "asset" && LINKING_FILE.test(file.fileName)
          ? [typeof file.source === "string" ? file.source : decoder.decode(file.source)]
          : [],
      );
      const own = await Promise.all(
        files.filter((path) => LINKING_FILE.test(path) && !(path in bundle)).map(read),
      );
      let copies: string[] = [];
      try {
        copies = publicCopies(
          linkedArtFiles([...built, ...own]),
          new Set(Object.keys(bundle)),
          files,
        );
      } catch (error) {
        this.error(`public files: ${(error as Error).message}`);
      }
      const copy = limitConcurrency(OPEN_FILE_LIMIT, async (path: string) => {
        await mkdir(dirname(join(dir, path)), { recursive: true });
        await copyFile(join(publicDir, path), join(dir, path));
      });
      await Promise.all(copies.map(copy));
    },
  };
}

import { mkdtemp, readFile, rmdir, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { subsetWoff2 } from "@andornaut/art-kit/build/woff2";
import { normalizePath, type Plugin, type ViteDevServer } from "vite";

export const CRASH_BODY_FONT = "adw-crash-body.woff2";

// The crash screen's body font as a WOFF2 subset of source to the characters of strings, in place
// of CRASH_BODY_FONT in CSS. subsetWoff2 throws a RangeError naming each character of strings the
// font lacks, which fails the build or the dev server's CSS request. Vite's asset loader owns URL
// hashing, CSS rewriting and offline bundle discovery. The temporary WOFF2 is shared by build and
// dev, without changing the authored font, its name records (its OFL notice among them) or axes.
export function crashFontPlugin(strings: Iterable<string>, source: string): Plugin {
  const files = new Map<string, string>();
  const encodes = new Set<Promise<string>>();
  let encoded: Promise<string> | undefined;
  let server: ViteDevServer | undefined;
  const encode = async () => {
    const font = await subsetWoff2(
      { label: "The crash screen's font", strings },
      await readFile(source),
    );
    const directory = await mkdtemp(join(tmpdir(), "adw-crash-font-"));
    const path = join(directory, "Tiny5.woff2");
    files.set(path, directory);
    server?.config.server.fs.allow.push(directory);
    await writeFile(path, font);
    return path;
  };
  return {
    async closeBundle() {
      await Promise.allSettled(encodes);
      await Promise.all(
        [...files].map(async ([path, directory]) => {
          await unlink(path).catch((error: NodeJS.ErrnoException) => {
            if (error.code !== "ENOENT") {
              throw error;
            }
          });
          await rmdir(directory);
        }),
      );
      files.clear();
      encodes.clear();
    },
    configureServer(devServer) {
      server = devServer;
    },
    enforce: "pre",
    name: "adw-crash-font",
    transform: {
      filter: { id: /\.css(?:\?|$)/ },
      async handler(code) {
        if (!code.includes(CRASH_BODY_FONT)) {
          return null;
        }
        this.addWatchFile(source);
        encoded ??= encode();
        encodes.add(encoded);
        return code.replaceAll(CRASH_BODY_FONT, normalizePath(await encoded));
      },
    },
    watchChange(path) {
      if (path === source) {
        encoded = undefined;
      }
    },
  };
}

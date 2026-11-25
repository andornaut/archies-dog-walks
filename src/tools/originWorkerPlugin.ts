import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { build, type Plugin } from "vite";

// Builds the Cloudflare Worker (src/pwa/originWorker.ts) into .worker/ once the site and game
// output is written. Wrangler deploys it from there, and .assetsignore keeps it out of the
// public files.
export function originWorkerPlugin(workerEntry: string): Plugin {
  let output: string;
  return {
    apply: "build",
    async closeBundle() {
      await build({
        build: {
          emptyOutDir: false,
          lib: { entry: workerEntry, fileName: () => "index.mjs", formats: ["es"] },
          outDir: join(output, ".worker"),
        },
        configFile: false,
        logLevel: "warn",
        publicDir: false,
      });
      await writeFile(join(output, ".assetsignore"), ".worker/\n");
    },
    configResolved(config) {
      output = resolve(config.root, config.build.outDir);
    },
    name: "archies-dog-walks-origin-worker",
  };
}

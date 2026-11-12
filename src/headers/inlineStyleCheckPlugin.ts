import type { Plugin } from "vite";

import { buildInlineStyleProblems, PHASER_INLINE_STYLES } from "./inlineStyle.ts";

// Fails the build for an inline style the pages' CSP would block in a built script or page
// (buildInlineStyleProblems in inlineStyle.ts), less Phaser's, which the game never reaches.
export function inlineStyleCheckPlugin(): Plugin {
  return {
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const files = Object.values(bundle).map((file) => ({
        fileName: file.fileName,
        text:
          file.type === "chunk"
            ? file.code
            : typeof file.source === "string"
              ? file.source
              : new TextDecoder().decode(file.source),
      }));
      const problems = buildInlineStyleProblems(PHASER_INLINE_STYLES, files);
      if (problems.length > 0) {
        this.error(`inline styles the CSP blocks:\n${problems.join("\n")}`);
      }
    },
    name: "archies-dog-walks-inline-style-check",
  };
}

import {
  bundleDependencies,
  type BundleFile,
  rootRelativeUrls,
} from "@andornaut/game-kit/build/precacheList";

// The build's update groups, by URL: each listed file's group, named for what it holds so that
// an unchanged group keeps its archive across releases and an installed game reuses it. Files
// that change together share a group; Phaser, each atlas and each music track change apart from
// the game code. The kit splits each group's sound alternatives into one group per format. A
// listed file no rule names fails the build, so a new kind of file gets a group on purpose.
const GROUPS: readonly (readonly [RegExp, string])[] = [
  [/^\/(?:play\/|manifest\.webmanifest|controls\.css|tokens\.css)$/, "page"],
  [/^\/assets\/icons\/[^/]+\.png$/, "icons"],
  [/^\/assets\/phaser-[^/]+\.js$/, "phaser"],
  [/^\/assets\/[^/]+\.(?:css|js)$/, "code"],
  [/^\/assets\/[^/]+\.(?:ttf|woff2)$/, "page-fonts"],
  [/^\/assets\/art\/manifest-[^/]+\.json$/, "art-manifest"],
  [/^\/assets\/art\/atlas\/([a-z]+)-\d+-[^/]+\.webp$/, "atlas-$1"],
  [/^\/assets\/art\/dom\/[^/]+\.(?:json|webp)$/, "dom-sheets"],
  [/^\/assets\/art\/fonts\/[^/]+\.(?:fnt|woff)$/, "art-fonts"],
  [/^\/assets\/art\/sounds\/sfx-[^/]+\.(?:m4a|ogg)$/, "sound-effects"],
  [/^\/assets\/art\/sounds\/(music-[a-z-]+)-[\w-]{8}\.(?:m4a|ogg)$/, "$1"],
];

export function updateGroup(url: string): string {
  for (const [pattern, name] of GROUPS) {
    const match = pattern.exec(url);
    if (match !== null) {
      return match[0].replace(pattern, name);
    }
  }
  throw new Error(`no update group for ${url}`);
}

type OutputFile =
  | (BundleFile & { type: "chunk"; code: string; imports: readonly string[]; isEntry: boolean })
  | (BundleFile & { type: "asset"; source: string | Uint8Array });

// Root-relative url(...) references in a stylesheet.
const CSS_URL = /url\(\s*(["']?)(\/[^"')\s]+)\1\s*\)/g;

// The build output files only the installed game requests, which the kit serves from the group
// archives alone: the code only the game's dynamic import reaches, and the art under
// /assets/art/ that no built page or stylesheet names. Everything else a page loads directly
// stays a file: each page, the static imports of every entry, and the art the site's pages and
// stylesheets name (the nav bar's and the home page's DOM sheet images).
export function gameOnlyFiles(bundle: Readonly<Record<string, OutputFile>>): Set<string> {
  const decoder = new TextDecoder();
  const linked = new Set<string>();
  const entries: string[] = [];
  const staticBundle: Record<string, BundleFile> = {};
  for (const [fileName, file] of Object.entries(bundle)) {
    if (file.type === "chunk") {
      staticBundle[fileName] = {
        imports: file.imports,
        type: file.type,
        ...(file.viteMetadata === undefined ? {} : { viteMetadata: file.viteMetadata }),
      };
      if (file.isEntry) {
        entries.push(fileName);
      }
      continue;
    }
    staticBundle[fileName] = { type: file.type };
    const text = typeof file.source === "string" ? file.source : decoder.decode(file.source);
    if (fileName.endsWith(".html")) {
      entries.push(fileName);
      for (const url of rootRelativeUrls(text)) {
        linked.add(url.slice(1));
      }
    } else if (fileName.endsWith(".css")) {
      for (const [, , url] of text.matchAll(CSS_URL)) {
        linked.add(url!.slice(1));
      }
    }
  }
  const roots = [...entries, ...linked];
  const direct = new Set(bundleDependencies(staticBundle, roots));
  const lazy = bundleDependencies(bundle, roots).filter((fileName) => !direct.has(fileName));
  const art = Object.keys(bundle).filter(
    (fileName) => fileName.startsWith("assets/art/") && !direct.has(fileName),
  );
  return new Set([...lazy, ...art].map((fileName) => `/${fileName}`));
}

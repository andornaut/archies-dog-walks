// The security headers the build writes to dist/_headers, which Cloudflare serves with every
// static asset. securityHeadersPlugin adds the hashes of each page's inline <script> and
// <style> blocks to its rule's policy, so this module names only the sources a page loads.
import type { Directives, HeaderList, PageRule } from "@andornaut/game-kit/build/securityHeaders";
import { BUILD_POINTER_URL } from "@andornaut/game-kit/runtime/web/pwa/buildContract";

// Where the build writes its content-hashed files, as a _headers path pattern.
export const HASHED_ASSET_PATH = "/assets/*";

// The kit's build manifests (buildManifestUrl), as a _headers path pattern.
export const BUILD_MANIFEST_PATH = "/.game-kit/manifest-*";

// On every response. No Cache-Control: every file but FILE_RULES' hashed build output, build
// manifests and build pointer keeps the platform default (max-age=0, must-revalidate), so the
// browser sees a new /sw.js on the next launch.
export const COMMON_RULE = {
  comment:
    "Every response. The game requests fullscreen and a screen wake lock; the clipboard (Cheats " +
    "page) keeps its default of self.",
  headers: [
    ["X-Content-Type-Options", "nosniff"],
    ["Referrer-Policy", "strict-origin-when-cross-origin"],
    [
      "Permissions-Policy",
      "fullscreen=(self), screen-wake-lock=(self), camera=(), microphone=(), geolocation=(), " +
        "payment=(), usb=()",
    ],
  ] satisfies HeaderList,
  path: "/*",
} as const;

// Headers for files rather than pages. Cloudflare sets a header a rule names, replacing its own.
export const FILE_RULES = [
  {
    comment: "Playable HTML revalidates and must not be transformed by an intermediary.",
    headers: [
      ["Cache-Control", "public, max-age=0, must-revalidate, no-transform"],
    ] satisfies HeaderList,
    path: "/play/*",
  },
  {
    comment:
      "Bitmap font descriptors, which are XML: the game's hashed copies. " +
      "Cloudflare types files by extension and serves an unknown one untyped, which it does " +
      "not compress.",
    headers: [["Content-Type", "text/xml; charset=utf-8"]] satisfies HeaderList,
    path: "/*.fnt",
  },
  {
    comment:
      "Content-hashed build output: a changed file gets a new name, so a cached copy never " +
      "needs revalidating.",
    headers: [["Cache-Control", "public, max-age=31536000, immutable"]] satisfies HeaderList,
    path: HASHED_ASSET_PATH,
  },
  {
    comment:
      "The build pointer, which every launch and resume reads to find the deployed build: no " +
      "CDN or browser cache may keep it.",
    headers: [["Cache-Control", "no-store"]] satisfies HeaderList,
    path: BUILD_POINTER_URL,
  },
  {
    comment: "Build manifests: a version names one manifest's content.",
    headers: [["Cache-Control", "public, max-age=31536000, immutable"]] satisfies HeaderList,
    path: BUILD_MANIFEST_PATH,
  },
] as const;

// Every page's policy before its rule's sources and hashes are added. Phaser loads images
// through blob: URLs and its default textures as data: URIs. Analytics sources belong only to
// website pages; the playable game allows no external scripts or reporting endpoints.
export const BASE_DIRECTIVES: Directives = {
  "base-uri": ["'self'"],
  "connect-src": ["'self'"],
  "default-src": ["'self'"],
  "font-src": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
  "img-src": ["'self'", "data:", "blob:"],
  "manifest-src": ["'self'"],
  "media-src": ["'self'", "blob:"],
  "object-src": ["'none'"],
  "script-src": ["'self'"],
  "style-src": ["'self'"],
  "worker-src": ["'self'"],
};

const WEBSITE_ANALYTICS: Directives = {
  "connect-src": ["https://cloudflareinsights.com"],
  "script-src": ["https://static.cloudflareinsights.com"],
};

const GOOGLE_FONTS: Directives = {
  "font-src": ["https://fonts.gstatic.com"],
  "style-src": ["https://fonts.googleapis.com"],
};

// Each built or public HTML page must match exactly one of these, or the build fails: two
// matching policies would join into one header and the browser would enforce both.
export const PAGE_RULES: readonly PageRule[] = [
  { comment: "The home page.", directives: { ...GOOGLE_FONTS, ...WEBSITE_ANALYTICS }, path: "/" },
  { comment: "The game.", directives: {}, path: "/play/*" },
];

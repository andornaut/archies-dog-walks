import type { CachePolicy } from "@andornaut/game-kit/web/pwa/cachePolicy";

// The game's caching rules (the kit's pwa/cachePolicy), which the service worker and the precache
// build share. Content-hashed build output, the hashed art included, is under /assets/ and served
// cache-first, as sounds are; the page and every other precached file, such as the web app
// manifest, are network-first, so a deploy shows on the next load.
export const CACHE_POLICY: CachePolicy = {
  cacheNamePrefix: "dog-walker-",
  hashedAssetPrefix: "/assets/",
};

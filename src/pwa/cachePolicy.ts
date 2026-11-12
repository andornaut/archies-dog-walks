import type { CachePolicy } from "@andornaut/game-kit/web/pwa/cachePolicy";

// The game's caching rules (the kit's pwa/cachePolicy), which the service worker and the precache
// build share. Content-hashed build output, the hashed art included, is under /assets/. A page a
// version controls loads every precached file, the page included, from that version's cache; a
// deploy reaches it as a newer version, installed in the background and offered once stored.
export const CACHE_POLICY: CachePolicy = {
  cacheNamePrefix: "dog-walker-",
  hashedAssetPrefix: "/assets/",
};

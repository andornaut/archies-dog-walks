import type { CachePolicy } from "@andornaut/game-kit/runtime/web/pwa/cachePolicy";

// The game's caching rules (the kit's pwa/cachePolicy), which the router worker, the page's
// installer and the build share. Content-hashed build output, the hashed art included, is under
// /assets/. Every cache and record the kit writes for the game starts with cacheNamePrefix.
export const CACHE_POLICY: CachePolicy = {
  cacheNamePrefix: "dog-walker-",
  hashedAssetPrefix: "/assets/",
};

// The router worker, registered with scope "/" by the game's launch and by the home page.
export const SERVICE_WORKER_URL = "/sw.js";

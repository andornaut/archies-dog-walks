# Browser and website infrastructure

This parent-owned tree contains browser lifecycle, crash presentation, build configuration, HTTP headers, offline installation, DOM progress, local storage adapters and page input/orientation integration. Game rules, geometry, rendering and engine input mechanisms remain in `@andornaut/game-kit`.

The initial TypeScript and CSS implementation derives from GameKit source revision `b32a50769801273a56d66a13c3ef8756f247b215`. These files and `src/tools/atlas/shared/` retain the [MIT licence](../../LICENSE-MIT). The game artwork and other game content keep their own licence.

Browser adapters depend on the package's pure game contracts through public imports. They do not require the library to import parent application code. `save/storage.ts` adapts browser storage to `SaveStorage`; the pure contract and in-memory adapter remain in the package. `view/phaser/followFrameTurn.ts` owns the browser viewport lifecycle around Phaser, while coordinate geometry remains in the package.

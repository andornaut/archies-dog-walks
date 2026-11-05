# Art

The game's pixel art, effects and sound, drawn by script.

| Doc                                | What it holds                                                       |
| ---------------------------------- | ------------------------------------------------------------------- |
| [`controls.md`](controls.md)       | Control tokens, roles, states, input and approved exceptions        |
| [`inventory.md`](inventory.md)     | Every asset: key, type, size, tags                                  |
| [`layout.md`](layout.md)           | Coordinates, spacing, alignment, groups and layout exceptions       |
| [`style-guide.md`](style-guide.md) | The rules: layout, palette, contrast, proportions, animation, sound |

## Scope

- `art/`: the generators in `art/tools/`, the source fonts in `art/fonts/` and these docs.
- `public/art/`: the exported sprites, images, fonts and sounds, `manifest.extra.json` and the `/art/` gallery. Mocks for decisions are shown in the chat, not committed. `manifest.json` beside them is derived from the files and committed (`npm run art:manifest`); the game build rewrites it before packing the atlases.
- Also drawn here: the site's icons, `public/og-image.png` and the art on the home page.

## Method

The sources are the generators in `art/tools/`, TypeScript modules that Node 24 runs directly; the exports are their outputs. They use the art-kit Node package and its `skia-canvas` peer, pinned in `package-lock.json` and installed by `npm ci`. Drawing, raster operations, sprite sheet export (`@andornaut/art-kit/spriteSheet`, which writes each sheet PNG and its JSON in Aseprite's json-hash format), preview composition and font mechanisms delegate to art-kit, and sox and ffmpeg render the sounds. House palettes, glyph policy, depth geometry and output paths remain local.

Builds and previews run in the local image `archie-check:node24.21.0-sox-ffmpeg`: `node:24.21.0` with `sox` and `ffmpeg` from the Debian bookworm snapshot `20261103T000000Z`. Its recipe, with the build command, is [`docker/archie-check.Dockerfile`](../docker/archie-check.Dockerfile). Gates use upstream `node:24.21.0`.

- `art/tools/<set>.ts` draws every asset except the home page's canvas grabs (`public/art/site/home-road.png` and `home-start.png`). Run `node art/tools/<set>.ts build` (or `preview OUT.png`) from the repository root. Each tool with commands parses them with `pixel.ts`'s `run`: `--help` or `-h` prints the tool's usage to stdout, and an unknown command prints it to stderr and exits 1. Shared drawing tools are in `pixel.ts` (whose build writes `shared/palette.json`), for pictures composed from exported art in `scene.ts`, and for redrawing a sprite at a depth step in `mini.ts`. `sounds.ts` reads each walk loop's score from `music_<art id with underscores>.ts`. `home_grabs.ts` retakes the two grabs from the built game (its header comment names each grab's scene, seed, save and frame); retake them after any change they show:
  1. Build `dist/` in `node:24.21.0` with `--network none`: copy `node_modules/` in from the dependency volume (see the `build.ts --check` command below), run `npm run build`, and `docker cp` the built checkout (with `node_modules/`) out.
  2. Serve it as `adw-preview` (the container name in the export's `devHarness.previewHost`, whose source is `src/tools/previewHost.ts`, and which the tool's default URL reads) on the `playwright-mcp` network, the built checkout mounted read-only: `node node_modules/vite/bin/vite.js preview --host 0.0.0.0 --port 4173 --strictPort --configLoader runner`.
  3. In `mcr.microsoft.com/playwright/mcp:v0.0.83` with `--entrypoint node`, on the same network and mount, run `node art/tools/home_grabs.ts /tmp/grabs` from the checkout, `docker cp` the two PNGs into `public/art/site/`, and stop both containers. The tool imports Playwright from the image (`PLAYWRIGHT_MODULE`), since the repository does not depend on it. It fails on a grab that is not 360×560 or not opaque, and lists the colours outside the house palette (see Consistency checks).

- A sprite set's `preview OUT.png` (every set built on `pixel.ts`'s `main` or `preview`) writes one contact sheet per distinct ground colour, named `OUT-<hex>.png` after the ground (`OUT-8b9bb4.png` on Cabbagetown's grey), with one row per sprite and every frame in tag order. `hood_parks.ts preview DIR` writes `DIR/road-<hex>.png` and `DIR/hits-<hex>.png` the same way. The other tools' previews write the single `OUT.png` their usage describes.
- A build writes the set's exports to `public/art/` (`sprites/<key>.png` and `.json`, `images/<key>.png`, `fonts/<key>.png` and `.fnt`, `sounds/<key>.ogg` and `.m4a`). Each tool's header comment names its folders. Exceptions:
  - `appicons.ts` writes the app icons and the favicons `favicon-32.png` and `favicon-16.png` in `public/icons/`, drawn from Archie's exported portrait and his face in `dogs.ts`; `share.ts` writes `public/og-image.png`.
  - `hood_parks.ts preview` and `sounds.ts preview` take an output folder, not a PNG, and `sounds.ts build` also writes the loop flags in `public/art/manifest.extra.json`.
  - Extra commands: `backdrops.ts camera`, `backdrops.ts verges` (with `--write`, to `shared/verges.json`), `depths.ts compare DIR`, `hood_city.ts cards OUT.png` and `sounds OUT_DIR`, `hood_markets.ts cards OUT.png` and `sounds OUT_DIR`, `hood_parks.ts sounds OUT_DIR`, `minis.ts compare OUT.png`, `pixel.ts palette` (with `--write`, to `shared/palette.json`), `roadside.ts table` (with `--write`, to `shared/roadside.json`), `screens.ts shop-preview OUT.png` and `sounds.ts one KEY OUT_DIR`.
- Builds read earlier exports. `node art/tools/build.ts [--check] [SET...]` (also `npm run art:build -- [--check] [SET...]`, run inside the check image like the command below) holds the build order (`SETS`) and the exports each set reads (`NEEDS`), and runs every set's build in that order on art-kit's build runner (`@andornaut/art-kit/build`), stopping at the first failure. It first fails if a module in `art/tools/` is neither a set nor listed in `NOT_SETS`, a set has no module, or `SETS` declares a set before one it needs. Named sets rebuild those sets and every set that reads their exports; an unknown set exits 2. `--check` fails on any file under `art/`, which no build writes, or the paths the builds write (`public/art/`, `public/icons/`, `public/og-image.png`, `shared/palette.json`, `shared/roadside.json` and `shared/verges.json`) that differed from the git index or was untracked before the rebuild, or that the rebuild changed, removed or added, and lists the paths, so on a clean clone it proves the committed art reproduces. Run it offline in the check image from any checkout or worktree, in two steps. First, an online container installs the lockfile's dependencies into a named Docker volume of Art's own (never the gate's), mounted at `/tmp` so the container's user can write it; repeat this after `package-lock.json` changes:

  ```sh
  docker volume create art-npm-deps
  docker run --rm --cpus 4 --memory 16g \
    --user 19001:19001 --group-add "$(stat -c %g .)" -e HOME=/tmp \
    --mount type=bind,src="$PWD/package.json",dst=/src/package.json,readonly \
    --mount type=bind,src="$PWD/package-lock.json",dst=/src/package-lock.json,readonly \
    --mount type=volume,src=art-npm-deps,dst=/tmp \
    node:24.21.0 \
    sh -c 'mkdir -p /tmp/deps && cp /src/package.json /src/package-lock.json /tmp/deps/ \
      && cd /tmp/deps && npm ci --ignore-scripts --cache /tmp/npm-cache \
      && rm -rf /tmp/npm-cache'
  ```

  Then the check runs with `--network none`. It mounts the checkout and the repository's common git directory read-only at their own paths and the volume read-only, clones the checked-out commit inside the container and copies `node_modules/` in from the volume:

  ```sh
  common="$(git rev-parse --path-format=absolute --git-common-dir)"
  docker run --rm --network none --cpus 4 --memory 16g \
    --user 19001:19001 --group-add "$(stat -c %g .)" -e HOME=/tmp -e SRC="$PWD" \
    --mount type=bind,src="$PWD",dst="$PWD",readonly \
    --mount type=bind,src="$common",dst="$common",readonly \
    --mount type=volume,src=art-npm-deps,dst=/deps,readonly \
    archie-check:node24.21.0-sox-ffmpeg \
    sh -c 'git config --global safe.directory "*" \
      && git clone -q "$SRC" /tmp/work \
      && cd /tmp/work && cp -a /deps/deps/node_modules node_modules \
      && node art/tools/build.ts --check'
  ```

  To keep a rebuild, drop `--rm` and `--check` and copy the trees out with `docker cp`.

- `art/tools/contact_sheet.ts` is a nonproduction preview of exported sprites: `node art/tools/contact_sheet.ts OUT.png KEY...` from the repository root. It reads `public/art/sprites/<key>.png` and `.json`, with the `pixel.ts` preview's background, scale and gap, and sizes every cell from the largest frame. It writes one sheet per zone road colour from `shared/export/game-data.json`, named as a set's preview sheets are (`OUT-<hex>.png`).
- A build overwrites its exports: change the tool, not the exports.
- Each tool's header comment holds its assets' sizes, tags, timings and placement coordinates.
- Game data and layout come from the game's export in `shared/export/`, never from `src/`. Only `pixel.ts` reads it: `GAME` (`game-data.json`) and `LAYOUT` (`layout.json`), typed for every field an art tool reads, and a missing field fails naming it. From them it derives the zones' road colours (`ZONE_ROAD_COLOURS`, in the order the preview grounds and `ui-zone-pips` keep), and `scene.ts` the zones and the pack's hands and collars; the other tools import `GAME`, `LAYOUT` or those. `pixel.ts` also reads the depth steps from `shared/depth-steps.json`. `screens.ts` places the Pet shop at the layout's `scenes.home.petShop` and fails if its frame or board differs from `ui-pet-shop`'s. The screen size (`screen`, read by `screens.ts` and `home_grabs.ts`), the top bar (`regions.topBar`), the walk bar's cash well (`walkBar.parts.cash.well`) and its effect well size (`walkBar.parts.effects.size`, all three read by `ui.ts`) come from the layout too. Every other size and position is a constant in its tool (`roadside.ts`'s sidewalk edge, for one), so a layout change in the game needs the matching change in the tool.
- Depth variants are redrawn at each step, not downscaled (style guide, Depth scaling).
- Regenerate the manifest (`npm run art:manifest`) before committing new or renamed exports. The manifest, the data export, the depth steps, the depth preview and the art checks are described under Assets in [`src/README.md`](../src/README.md).

### Naming

- The kebab-case manifest key is the export's file name: `public/art/sprites/<key>.png` and `.json`, `public/art/images/<key>.png` or `public/art/fonts/<key>.png` and `.fnt`.
- A key starts with its kind's prefix, as in `inventory.md` (`dog-`, `fx-`, `ui-`); road objects, moving hazards and `logo` use a plain name.
- A depth variant appends its step (`dog-kilo@50`).
- Zone keys use the zone's art id, the neighbourhood's name in kebab case: `high-park`, `cabbagetown`, `kensington-market`, `the-beaches`, `distillery-district`, `yonge-street` (easiest to hardest).

### Consistency checks

- Every export uses only the 64-colour house palette (plus the neutral greys in disabled and locked UI and seven picker-only colours, as the style guide's palette section says), with alpha 0 or 255, at the frame size in `inventory.md`. The home page's canvas grabs, `public/art/site/home-road.png` and `home-start.png`, are exempt from the palette, since the game's canvas blends translucent layers and has UI colours of its own; they must still be 360×560 and opaque.
- Check proportion, outline and contrast on every zone's road colour in the script's `preview` and the `/art/` gallery, and road objects in a projected 360×560 view (`npm run art:depth-preview -- <key> [zone]`).
- Run `npm run check:art` and `npm run art:manifest -- --check` before committing.
- `npm run art:unused` lists the manifest keys that no source file, game data, shared table or page names. It matches names, not calls, so it misses a key that only an id-keyed family would build: check `fx-hit-`, `sfx-hit-` and `card-` keys against the encounters' ids and options.

# Art

The game's pixel art, effects and sound, drawn by script.

| Doc                                | What it holds                                                       |
| ---------------------------------- | ------------------------------------------------------------------- |
| [`controls.md`](controls.md)       | Control tokens, roles, states, input and approved exceptions        |
| [`inventory.md`](inventory.md)     | Every asset: key, type, size, tags                                  |
| [`layout.md`](layout.md)           | Coordinates, spacing, alignment, groups and layout exceptions       |
| [`style-guide.md`](style-guide.md) | The rules: layout, palette, contrast, proportions, animation, sound |

## Scope

- `art/`: the generators in `art/tools/`, the Aseprite sources they write, the source fonts in `art/fonts/` and these docs.
- `public/art/`: the exported sprites, images, fonts and sounds, `manifest.extra.json` and the `/art/` gallery. Mocks for decisions are shown in the chat, not committed. The game build generates `manifest.json` beside them.
- Also drawn here: the site's icons, `public/og-image.png` and the art on the home page.

## Method

The generators are TypeScript modules in `art/tools/`, which Node 24 runs directly. They use the art-kit Node package and its `skia-canvas` peer, pinned in `package-lock.json` and installed by `npm ci`. Drawing, raster operations, export, preview composition and font mechanisms delegate to art-kit. Aseprite writes the sources and sheets, and sox and ffmpeg render the sounds. House palettes, glyph policy, depth geometry and output paths remain local.

Builds and previews run in the local image `archie-check:node24.21.0-aseprite1.2.30`: `node:24.21.0` with Aseprite 1.2.30 installed from the licensed `Aseprite_1.2.30-1_amd64.deb` in `../game-dev/var/vendor/aseprite`, outside the repository and passed as the `aseprite-deb` build context (with `libgl1`, `libxcursor1` and `libxfixes3`), and `sox` and `ffmpeg` from the Debian bookworm snapshot `20261103T000000Z`. Its recipe, with the build command, is [`docker/archie-check.Dockerfile`](../docker/archie-check.Dockerfile). Gates use upstream `node:24.21.0`.

- `art/tools/<set>.ts` draws every asset except the home page's canvas grabs (`public/art/site/home-road.png` and `home-start.png`). Run `node art/tools/<set>.ts build` (or `preview OUT.png`) from the repository root. Each tool with commands parses them with `pixel.ts`'s `run`: `--help` or `-h` prints the tool's usage to stdout, and an unknown command prints it to stderr and exits 1. Shared drawing tools are in `pixel.ts` (whose only command is `palette`), for pictures composed from exported art in `scene.ts`, and for redrawing a sprite at a depth step in `mini.ts`. `sounds.ts` reads each walk loop's score from `music_<art id with underscores>.ts`. `home_grabs.ts` retakes the two grabs from the built game (its header comment names each grab's scene, seed, save and frame); retake them after any change they show:
  1. Build `dist/` in `node:24.21.0` with `--network none`: `npm ci --offline` from an in-container copy of `.claude/bus/npm-cache`, then `npm run build`, and `docker cp` the built checkout (with `node_modules/`) out.
  2. Serve it as `adw-preview` (the container name `previewHost` in `vite.config.ts` gives, which the tool's default URL reads) on the `playwright-mcp` network, the built checkout mounted read-only: `node node_modules/vite/bin/vite.js preview --host 0.0.0.0 --port 4173 --strictPort --configLoader runner`.
  3. In `mcr.microsoft.com/playwright/mcp:v0.0.83` with `--entrypoint node`, on the same network and mount, run `node art/tools/home_grabs.ts /tmp/grabs` from the checkout, `docker cp` the two PNGs into `public/art/site/`, and stop both containers. The tool imports Playwright from the image (`PLAYWRIGHT_MODULE`), since the repository does not depend on it. It fails on a grab that is not 360×560 or not opaque, and lists the colours outside the house palette (see Consistency checks).

- A sprite set's `preview OUT.png` (every set built on `pixel.ts`'s `main` or `preview`) writes one contact sheet per distinct ground colour, named `OUT-<hex>.png` after the ground (`OUT-8b9bb4.png` on Cabbagetown's grey), with one row per sprite and every frame in tag order. `hood_parks.ts preview DIR` writes `DIR/road-<hex>.png` and `DIR/hits-<hex>.png` the same way. The other tools' previews write the single `OUT.png` their usage describes.
- A build writes the set's Aseprite sources under `art/` and exports them to `public/art/` (`sprites/<key>.png` and `.json`, `images/<key>.png`, `fonts/<key>.png` and `.fnt`, `sounds/<key>.ogg` and `.m4a`). Each tool's header comment names its folders. Exceptions:
  - `appicons.ts` writes `art/appicon.aseprite`, `art/favicon-32.aseprite` and `art/favicon-16.aseprite`, the app icons in `public/icons/` and the favicons `public/art/favicon.png` and `favicon-16.png`, drawn from Archie's exported portrait and his face in `dogs.ts`; `share.ts` writes `art/share/share-card.aseprite` and `public/og-image.png`.
  - `fonts.ts` and `sounds.ts` write no sources. `hood_parks.ts preview` and `sounds.ts preview` take an output folder, not a PNG, and `sounds.ts build` also writes the loop flags in `public/art/manifest.extra.json`.
  - Extra commands: `backdrops.ts camera`, `backdrops.ts verges` (with `--write`, to `shared/verges.json`), `depths.ts compare DIR`, `hood_city.ts cards OUT.png` and `sounds OUT_DIR`, `hood_markets.ts cards OUT.png` and `sounds OUT_DIR`, `hood_parks.ts sounds OUT_DIR`, `minis.ts compare OUT.png`, `pixel.ts palette` (to `shared/palette.json`), `roadside.ts table` (with `--write`, to `shared/roadside.json`), `screens.ts shop-preview OUT.png` and `sounds.ts one KEY OUT_DIR`.
- Builds read earlier exports. `node art/tools/build.ts [--check] [SET...]` holds the build order (`SETS`) and the exports each set reads (`NEEDS`), runs every set's build in that order and stops at the first failure. Named sets rebuild those sets and every set that reads their exports. `--check` then fails on any changed or untracked file under the paths the builds write (`art/`, `public/art/`, `public/icons/`, `public/og-image.png` and `shared/`) and lists the paths, so on a clean clone it proves the committed art reproduces. Run it offline in the check image from any checkout or worktree. The command mounts the checkout and the repository's common git directory read-only at their own paths, clones the checked-out commit inside the container and installs from the main checkout's npm cache:

  ```sh
  common="$(git rev-parse --path-format=absolute --git-common-dir)"
  docker run --rm --network none --cpus 4 --memory 16g \
    --user 19001:19001 --group-add "$(stat -c %g .)" -e HOME=/tmp -e SRC="$PWD" \
    --mount type=bind,src="$PWD",dst="$PWD",readonly \
    --mount type=bind,src="$common",dst="$common",readonly \
    --mount type=bind,src="$(dirname "$common")/.claude/bus/npm-cache",dst=/npm-cache,readonly \
    archie-check:node24.21.0-aseprite1.2.30 \
    sh -c 'git config --global safe.directory "*" \
      && git clone -q "$SRC" /tmp/work \
      && cp -r /npm-cache /tmp/npm-cache \
      && cd /tmp/work && npm ci --offline --cache /tmp/npm-cache \
      && node art/tools/build.ts --check'
  ```

  To keep a rebuild, drop `--rm` and `--check` and copy the trees out with `docker cp`.

- `art/tools/contact_sheet.ts` is a nonproduction preview of exported sprites: `node art/tools/contact_sheet.ts OUT.png KEY...` from the repository root. It reads `public/art/sprites/<key>.png` and `.json`, with the `pixel.ts` preview's background, scale and gap, and sizes every cell from the largest frame. It writes one sheet per zone road colour from `shared/export/game-data.json`, named as a set's preview sheets are (`OUT-<hex>.png`).
- A build overwrites the `.aseprite` files: change the tool, not the sources.
- Each tool's header comment holds its assets' sizes, tags, timings and placement coordinates.
- Game data and layout come from the game's export in `shared/export/`, never from `src/`. Only `scene.ts` (`game-data.json` and `layout.json`) and `contact_sheet.ts` (the zones' road colours) read it; `backdrops.ts`, `cards.ts`, `screens.ts`, and `share.ts` take the zones, the layout and the pack's hands and collars from `scene.ts`. `pixel.ts` reads the depth steps from `shared/depth-steps.json`. Every other tool holds its sizes and positions as constants (`ui.ts`'s top bar buttons, `screens.ts`'s Pet shop at 234,54, `roadside.ts`'s sidewalk edge), so a layout change in the game needs the matching change in the tool.
- Depth variants are redrawn at each step, not downscaled (style guide, Depth scaling).
- Regenerate the manifest (`npm run art:manifest`) before committing new or renamed exports. The manifest, the data export, the depth steps, the depth preview and the art checks are described under Assets in [`src/README.md`](../src/README.md).

### Naming

- The kebab-case manifest key is the file name: `art/<set>/<key>.aseprite` exports to `public/art/sprites/<key>.png` and `.json`, `public/art/images/<key>.png` or `public/art/fonts/<key>.png` and `.fnt`.
- A key starts with its kind's prefix, as in `inventory.md` (`dog-`, `fx-`, `ui-`); road objects, moving hazards and `logo` use a plain name.
- A depth variant appends its step (`dog-kilo@50`).
- Zone keys use the zone's art id, the neighbourhood's name in kebab case: `high-park`, `cabbagetown`, `kensington-market`, `the-beaches`, `distillery-district`, `yonge-street` (easiest to hardest).

### Consistency checks

- Every export uses only the 64-colour house palette (plus the neutral greys in disabled and locked UI and seven picker-only colours, as the style guide's palette section says), with alpha 0 or 255, at the frame size in `inventory.md`. The home page's canvas grabs, `public/art/site/home-road.png` and `home-start.png`, are exempt from the palette, since the game's canvas blends translucent layers and has UI colours of its own; they must still be 360×560 and opaque.
- Check proportion, outline and contrast on every zone's road colour in the script's `preview` and the `/art/` gallery, and road objects in a projected 360×560 view (`npm run art:depth-preview -- <key> [zone]`).
- Run `npm run check:art` and `npm run art:manifest -- --check` before committing.
- `npm run art:unused` lists the manifest keys that no source file, game data, shared table or page names. It matches names, not calls, so it misses a key that only an id-keyed family would build: check `fx-hit-`, `sfx-hit-` and `card-` keys against the encounters' ids and options.

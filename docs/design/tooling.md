# Tooling

`make check` is the project gate. Make runs the lint, test and build recipes in `tests/container/check` inside isolated non-root containers started by `tests/container/run`, admitted only below one-minute host load 20, capped at four CPUs and bounded memory, and rejected if the source snapshot changes. The npm scripts alias the same recipes. Node comes from `.nvmrc`, and every kit is pinned to its latest published release. CI runs Lint, Test and Build plus the AI attributions scan, and a docs-only push runs only Lint and the scan. The delivery-kit runner departs hourly at :10 Toronto time, holds a departure while the load is at or above its departure limit, gates local `main` in the gate image pinned by ID, pushes, waits for CI and deploys `dist/`. The shared updater verifies each staged build in a separate cache. It offers newly staged builds during the session and applies a carried verified stage before gameplay on the next cold launch. The playable game carries no analytics, and `docs/` is never served.

Reference: [Developing](../../README.md#developing), [Deploying](../../README.md#deploying), [Platform and delivery](../../src/README.md#platform-and-delivery), [Tests and simulator](../../src/README.md#tests-and-simulator), [Save data](../../src/README.md#save-data), [Dev tools](../../src/README.md#dev-tools).

## Work items

| ID       | Title                                                                        | Link                               |
| -------- | ---------------------------------------------------------------------------- | ---------------------------------- |
| adw-0073 | Apply the improvements review fixes                                          | [adw-0073.md](../work/adw-0073.md) |
| adw-0074 | Run the TypeScript tools on plain Node                                       | [adw-0074.md](../work/adw-0074.md) |
| adw-0075 | Remove husky and lint-staged                                                 | [adw-0075.md](../work/adw-0075.md) |
| adw-0076 | Rename the Worker, package and storage keys to archies-dog-walks             | [adw-0076.md](../work/adw-0076.md) |
| adw-0078 | Check that no Aseprite files are committed                                   | [adw-0078.md](../work/adw-0078.md) |
| adw-0079 | Adopt game-kit achievements with a save reset                                | [adw-0079.md](../work/adw-0079.md) |
| adw-0081 | Check for an update each time the start screen appears                       | [adw-0081.md](../work/adw-0081.md) |
| adw-0086 | Adopt the canonical pre-commit hook and CI lint                              | [adw-0086.md](../work/adw-0086.md) |
| adw-0087 | Run the checks through project-owned Make container gates                    | [adw-0087.md](../work/adw-0087.md) |
| adw-0092 | Hold departures from a host load of 30                                       | [adw-0092.md](../work/adw-0092.md) |
| adw-0097 | Run on Node 24.22.2 everywhere                                               | [adw-0097.md](../work/adw-0097.md) |
| adw-0098 | Store the save under dotted keys, one per device setting                     | [adw-0098.md](../work/adw-0098.md) |
| adw-0099 | Force the update a newer save requires                                       | [adw-0099.md](../work/adw-0099.md) |
| adw-0100 | Allow the Cloudflare analytics beacon in the page policy                     | [adw-0100.md](../work/adw-0100.md) |
| adw-0105 | Keep a dismissed update offer hidden until restart                           | [adw-0105.md](../work/adw-0105.md) |
| adw-0108 | Offer the update on every arrival home                                       | [adw-0108.md](../work/adw-0108.md) |
| adw-0110 | Stage each update in a complete cache before it activates                    | [adw-0110.md](../work/adw-0110.md) |
| adw-0111 | Build the check image with an explicit file limit                            | [adw-0111.md](../work/adw-0111.md) |
| adw-0112 | Adopt delivery-kit 4                                                         | [adw-0112.md](../work/adw-0112.md) |
| adw-0114 | Adopt art-kit 0.23                                                           | [adw-0114.md](../work/adw-0114.md) |
| adw-0119 | Give each tunable one source                                                 | [adw-0119.md](../work/adw-0119.md) |
| adw-0120 | Show loading after Update now                                                | [adw-0120.md](../work/adw-0120.md) |
| adw-0121 | Split source along responsibility boundaries                                 | [adw-0121.md](../work/adw-0121.md) |
| adw-0132 | Adopt the latest kits and their namespaces                                   | [adw-0132.md](../work/adw-0132.md) |
| adw-0137 | Retry a failed offline install                                               | [adw-0137.md](../work/adw-0137.md) |
| adw-0149 | Keep analytics out of the playable game                                      | [adw-0149.md](../work/adw-0149.md) |
| adw-0153 | Migrate to delivery-kit 4.6                                                  | [adw-0153.md](../work/adw-0153.md) |
| adw-0161 | Run only attribution and lint checks for docs-only changes                   | [adw-0161.md](../work/adw-0161.md) |
| adw-0162 | Adopt design and work files                                                  | [adw-0162.md](../work/adw-0162.md) |
| adw-0163 | Prune the test suite toward a lower runtime                                  | [adw-0163.md](../work/adw-0163.md) |
| adw-0164 | Emit the crash font as WOFF2                                                 | [adw-0164.md](../work/adw-0164.md) |
| adw-0168 | Install the complete build before play and prompt updates at the next launch | [adw-0168.md](../work/adw-0168.md) |
| adw-0170 | Keep the art gallery's copies out of the build                               | [adw-0170.md](../work/adw-0170.md) |
| adw-0171 | Subset the crash screen font                                                 | [adw-0171.md](../work/adw-0171.md) |
| adw-0175 | Move the dev cheats into a Cheats modal opened from Settings                 | [adw-0175.md](../work/adw-0175.md) |
| adw-0176 | Point the site pages at the hashed art copies                                | [adw-0176.md](../work/adw-0176.md) |
| adw-0177 | Set Invincible owners from the run URL and move the Art grabs to it          | [adw-0177.md](../work/adw-0177.md) |
| adw-0181 | Reduce shipped art size and file count                                       | [adw-0181.md](../work/adw-0181.md) |
| adw-0185 | Qualify Delivery Kit 7.1.0                                                   | [adw-0185.md](../work/adw-0185.md) |
| adw-0187 | Cap Archie verification containers at 4 GiB                                  | [adw-0187.md](../work/adw-0187.md) |
| adw-0188 | Restore the delivery gate image                                              | [adw-0188.md](../work/adw-0188.md) |
| adw-0189 | Fix the art gallery font specimens and console error                         | [adw-0189.md](../work/adw-0189.md) |
| adw-0198 | Request an ordinary update check on returning to Start                       | [adw-0198.md](../work/adw-0198.md) |
| adw-0206 | Adopt the Game Kit update and startup retry fixes                            | [adw-0206.md](../work/adw-0206.md) |
| adw-0208 | Adopt Game Kit 0.61.0                                                        | [adw-0208.md](../work/adw-0208.md) |
| adw-0209 | Close obsolete update offers with Game Kit 0.62.1                            | [adw-0209.md](../work/adw-0209.md) |
| adw-0211 | Adopt Delivery Kit 8.0.0                                                     | [adw-0211.md](../work/adw-0211.md) |
| adw-0214 | Adopt Game Kit 0.63.0                                                        | [adw-0214.md](../work/adw-0214.md) |
| adw-0215 | Adopt Art Kit 0.33.0                                                         | [adw-0215.md](../work/adw-0215.md) |
| adw-0216 | Adopt Delivery Kit 8.1.0                                                     | [adw-0216.md](../work/adw-0216.md) |
| adw-0219 | Remove the retired delivery report project field                             | [adw-0219.md](../work/adw-0219.md) |
| adw-0221 | Adopt Game Kit 0.64.0                                                        | [adw-0221.md](../work/adw-0221.md) |
| adw-0222 | Adopt Game Kit 0.64.1                                                        | [adw-0222.md](../work/adw-0222.md) |
| adw-0230 | Adopt Game Kit 0.65.0                                                        | [adw-0230.md](../work/adw-0230.md) |
| adw-0231 | Check for updates when a walk starts                                         | [adw-0231.md](../work/adw-0231.md) |
| adw-0232 | Correct documentation drift                                                  | [adw-0232.md](../work/adw-0232.md) |
| adw-0236 | Adopt Delivery Kit 8.1.1                                                     | [adw-0236.md](../work/adw-0236.md) |
| adw-0241 | Pack the published game assets into reusable groups                          | [adw-0241.md](../work/adw-0241.md) |
| adw-0243 | Ship the game assets as prebuilt group archives                              | [adw-0243.md](../work/adw-0243.md) |
| adw-0244 | Select a walk's new neighbourhood in Cheats the moment it is pressed         | [adw-0244.md](../work/adw-0244.md) |
| adw-0245 | Let cheats change the save like normal play                                  | [adw-0245.md](../work/adw-0245.md) |
| adw-0250 | Name the chosen neighbourhood after a live Cheats switch                     | [adw-0250.md](../work/adw-0250.md) |
| adw-0254 | Bring the procedural systems in line with the cross-game procedural policy   | [adw-0254.md](../work/adw-0254.md) |
| adw-0258 | Audit the source structure and propose layered, encapsulated modules         | [adw-0258.md](../work/adw-0258.md) |
| adw-0259 | Layer the source with downward imports and one public entry per area         | [adw-0259.md](../work/adw-0259.md) |
| adw-0266 | Add Dependabot coverage for the gate Dockerfile                              | [adw-0266.md](../work/adw-0266.md) |

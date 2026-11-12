# Archie's Dog Walks

[![Test](https://github.com/andornaut/archies-dog-walks/actions/workflows/test.yml/badge.svg)](https://github.com/andornaut/archies-dog-walks/actions/workflows/test.yml)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

Archie's Dog Walks is a cozy pixel-art lane runner where you walk a pack of dogs through the neighbourhood, and every bump in the road counts: a plain bump costs an owner's heart, and a card obstacle turns into a choice. Built with [Phaser](https://phaser.io/) and TypeScript, and served as static files from [Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/).

The deployment target is <https://archie.tristamittermayer.com/play/>, with Tuning at [`/tuning/`](https://archie.tristamittermayer.com/tuning/) and the art gallery at [`/art/`](https://archie.tristamittermayer.com/art/). The custom domain is configured in [`wrangler.jsonc`](wrangler.jsonc).

## Docs

The folder READMEs describe the current design and implementation:

- [art/](art/README.md): art rules, assets and pipeline
- [gameplay/](gameplay/README.md): the game design, tuning and playtesting
- [src/](src/README.md): stack, architecture and save data

## Developing

The project gate is `make check`. Make uses the shared launcher in `tests/container/run`, the pinned image recipe in `tests/container/Dockerfile`, and the project commands in `tests/container/check`.

| Command                                              | Does                                                                                                   |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `make build`                                         | Export data, build `dist/`, verify deterministic art, then replace the ignored host `dist/` output     |
| `make check`                                         | Run lint, test and build in isolated snapshots, without exporting generated files                      |
| `make exec COMMAND='npm run format'`                 | Run an explicit writable checkout command; its marker blocks snapshot checks until execution is closed |
| `make lint`                                          | TypeScript, ShellCheck, Prettier, ESLint and Markdownlint                                              |
| `make test`                                          | Run the game tests with four workers by default                                                        |
| `make test TEST_ARGS='src/home/modalLayout.test.ts'` | Run a focused selection                                                                                |

The launcher admits each image build and check only below host load 20. It accounts for four CPUs and bounded memory, fingerprints the source snapshot, and rejects a result if source changes. `BUILD_OUTPUTS` and `TEST_OUTPUTS` declare ignored generated paths to export; aggregate `make check` exports none. `COMMAND` is an explicit command, not a source file or test selector.

Native npm aliases call the project recipes directly in the current environment. This preserves use inside an existing delivery container and forwards `npm test -- <arguments>` unchanged. `npm run check` remains TypeScript-only, `npm run lint` runs ShellCheck 0.11.0 (on `PATH`; both check images supply it) and the three linters, and `npm run build` exports data before Vite. Make adds TypeScript to its lint category and deterministic art validation to its build category. The package has no host `prebuild` lifecycle hook.

Development and art utilities retain their npm commands:

| Command                                     | Does                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| `npm run art:depth-preview -- <key> [zone]` | Draw road sprites into `out/depth-preview/<key>/`                          |
| `npm run art:manifest -- --check`           | Check the art manifest                                                     |
| `npm run art:unused`                        | List unused art keys                                                       |
| `npm run check:art`                         | Run the art tests                                                          |
| `npm run dev`                               | Start the Vite dev server                                                  |
| `npm run export:data -- --check`            | Check generated data exports                                               |
| `npm run format`                            | Apply Prettier and ESLint fixes                                            |
| `npm run planner:acceptance -- <out-dir>`   | Run the approved planner acceptance batch ([src/README.md](src/README.md)) |
| `npm run preview`                           | Build, then serve through Wrangler                                         |
| `npm run simulate -- --help`                | Describe simulator options                                                 |
| `npm run test:game-kit`                     | Run the game-owned game-kit consumer checks                                |

The site's pages are in `pages/`, each at its URL's path (`pages/play/index.html` is `/play/`), and Vite bundles the TypeScript they load. `public/` is copied into the build unchanged: the art, the nav bar, the icons, and the art gallery, `public/art/index.html`. `shared/` holds the files art's tools and the game both read. The game imports shared helpers through `@andornaut/game-kit/<path>`, installed from the [game-kit release](https://github.com/andornaut/game-kit/releases) pinned in `package.json`. The installed package records its source revision in `SOURCE_COMMIT`.

Art build tools are TypeScript modules in `art/tools/`, which Node runs directly on the [art-kit release](https://github.com/andornaut/art-kit/releases) pinned in `package.json`, for example
`node art/tools/glyphs.ts build`.

WORKAROUND: Parent-scoped development overrides pin Markdownlint `0.42.1` for [re2js security fixes](https://github.com/advisories/GHSA-gg6h-894w-4m9c), [KaTeX](https://github.com/advisories/GHSA-238p-pmpm-9mq7) `0.19.1` and [minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249) `11.0.3`. ESLint loads the cycle and extensions rules and the resolver through exported plugin subpaths because the full plugin imports an unused rule requiring the removed minimatch `makeRe` API ([eslint-plugin-import-x#569](https://github.com/un-ts/eslint-plugin-import-x/issues/569)). Keep cycle detection and required import extensions enabled. Remove each override when its parent range supports the patched version; restore the full plugin import when it supports minimatch 11.

CI runs `make lint`, `make test` and `make build`, plus the AI attributions scan.

## Deploying

- [Cloudflare dashboard](https://dash.cloudflare.com/?to=/:account/workers/services/view/archies-dog-walks)

Delivery runs on the [delivery-kit](https://github.com/andornaut/delivery-kit) release pinned in `package.json`, configured by [`delivery-kit.json`](delivery-kit.json). Its runner departs hourly at :10, Toronto time. While the one-minute host load is at or above `resources.loadLimit`, it re-checks the load every minute and departs once it falls below, for up to 15 minutes; after that it skips the slot and keeps `main` for the next one. A departure gates the local `main` HEAD in an isolated container of the gate image (`npm ci`, then type checking, lint, tests, the build and the art check, capped at four CPUs and four test workers), pushes that exact commit to `main` as a fast-forward with the regular account's Git authentication, and watches the commit's required GitHub CI checks. There is no queue or batch: a `main` with nothing new does not depart. The runner's state is kept by game-dev, outside this repository.

The gate image is the `tools` stage of `tests/container/Dockerfile`: Node at the version in `.nvmrc`, ShellCheck 0.11.0, and SoX and ffmpeg at exact versions from a pinned Debian snapshot, so the sound builds reproduce byte for byte. Make's check image is the final stage, built on it with the locked dependencies. After a change to the `tools` stage, rebuild the gate image on the delivery host from the repository root:

```sh
node_version=$(sed 's/^v//' .nvmrc)
tests/container/admit build-image
docker build --resource cpu-period=100000 --resource cpu-quota=400000 --resource memory=4g \
  --build-arg NODE_VERSION="${node_version}" \
  --target tools --tag "archie-check:node${node_version}-sox-ffmpeg" \
  --file tests/container/Dockerfile tests/container
```

When CI passes, the runner deploys the gated `dist/` through the Wrangler locked in that commit and existing account login, without rebuilding. The gate sets `WORKERS_CI_COMMIT_SHA` for the build label. A push whose every changed path matches `deploy.skipPattern` (Markdown, `art/` and `gameplay/`) skips deployment; exported assets under `public/art/` deploy. A red gate leaves `main` unpushed and that commit is never gated again; red CI is fixed forward with a new commit. A failed deployment keeps its gated build for a later departure. Cloudflare Workers Builds is disconnected, so the runner is the only deploy path, and nothing is pushed or deployed manually. The target account and Worker are pinned in `wrangler.jsonc`.

## Licence

Everything here (code, art, sound, music and writing) is licensed [CC BY-NC-SA 4.0](./LICENSE): share and remix it with credit to andornaut and a link to this project, for non-commercial use, under the same licence. The game's names and logos are not licensed, so a remix must use its own name. The separately installed game-kit helpers are licensed [MIT](https://github.com/andornaut/game-kit/blob/main/LICENSE).

The separately installed art-kit helpers are licensed [MIT](https://github.com/andornaut/art-kit/blob/main/LICENSE).

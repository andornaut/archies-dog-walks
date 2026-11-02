# Archie's Dog Walks

[![Test](https://github.com/andornaut/dog-walker-game/actions/workflows/test.yml/badge.svg)](https://github.com/andornaut/dog-walker-game/actions/workflows/test.yml)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

Archie's Dog Walks is a cozy pixel-art lane runner where you walk a pack of dogs through the neighbourhood, and every bump in the road counts: a plain bump costs an owner's heart, and a card obstacle turns into a choice. Built with [Phaser](https://phaser.io/) and TypeScript, and served as static files from [Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/).

The deployment target is <https://archie.tristamittermayer.com/play/>, with Tuning at [`/tuning/`](https://archie.tristamittermayer.com/tuning/) and the art gallery at [`/art/`](https://archie.tristamittermayer.com/art/). The custom domain is configured in [`wrangler.jsonc`](wrangler.jsonc).

## Docs

The folder READMEs describe the current design and implementation:

- [art/](art/README.md): art rules, assets and pipeline
- [gameplay/](gameplay/README.md): the game design, tuning and playtesting
- [src/](src/README.md): stack, architecture and save data

## Developing

Use Node 24.21.0 (`.nvmrc`) and Python 3.12 or newer. Run `npm ci` and `npm run install:python` to install the project-local art environment and Ruff, then:

| Command                                     | Does                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------- |
| `npm run art:depth-preview -- <key> [zone]` | Draw a road sprite at a sweep of distances into `out/depth-preview/<key>/` |
| `npm run art:manifest [-- --check]`         | Write `public/art/manifest.json` from the art files, or fail if it differs |
| `npm run art:unused`                        | List manifest keys no source file, game data, shared table or page names   |
| `npm run build`                             | Build to `dist/`                                                           |
| `npm run check`                             | Type check with tsc                                                        |
| `npm run check:art`                         | Run only the art tests                                                     |
| `npm run clean`                             | Remove the build and Wrangler state                                        |
| `npm run dev`                               | Dev server                                                                 |
| `npm run export:data [-- --check]`          | Write `shared/export/` from the game's modules, or fail if it differs      |
| `npm run format`                            | Rewrite files with Prettier and apply ESLint fixes                         |
| `npm run lint`                              | Prettier, ESLint, markdownlint and Ruff                                    |
| `npm run preview`                           | Build, then serve it through `wrangler dev`                                |
| `npm run simulate -- --help`                | Simulate runs ([src/README.md](src/README.md), Simulator)                  |
| `npm test`                                  | Run the unit tests                                                         |

The site's pages are in `pages/`, each at its URL's path (`pages/play/index.html` is `/play/`), and Vite bundles the TypeScript they load. `public/` is copied into the build unchanged: the art, the nav bar, the icons, and the art gallery, `public/art/index.html`. `shared/` holds the files art's tools and the game both read. The game imports shared helpers through `@andornaut/game-kit/<path>`, installed from the versioned [game-kit release](https://github.com/andornaut/game-kit/releases/tag/v0.4.0) pinned in `package-lock.json`. The installed package records its source revision in `SOURCE_COMMIT`.

Art generators use the installed `art-kit` and Pillow dependencies from `requirements-art.txt` in `.venv-art`. Run entrypoints with `.venv-art/bin/python -I`, for example
`.venv-art/bin/python -I art/tools/glyphs.py build`.

The isolated check image supplies both runtimes without installing system packages:

```bash
docker build --tag game-check:node24.21.0-python3.12 - \
  < scripts/check.Dockerfile
```

WORKAROUND: Parent-scoped development overrides pin [KaTeX](https://github.com/advisories/GHSA-238p-pmpm-9mq7) `0.18.2`, [minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249) `11.0.3` and [re2js](https://github.com/advisories/GHSA-gg6h-894w-4m9c) `2.8.7`. ESLint loads the cycle rule and resolver through exported plugin subpaths because the full plugin imports an unused rule requiring the removed minimatch `makeRe` API. Keep cycle detection enabled. Remove each override when its parent range supports the patched version; restore the full plugin import when it supports minimatch 11.

CI runs check, lint, test and build, and the AI attributions scan.

## Deploying

- [Cloudflare dashboard](https://dash.cloudflare.com/?to=/:account/workers/services/view/dog-walker-game)

Deployments run through a scheduled local bus hourly at :00, in Toronto time. Each departure combines ready work into one batch, installs its locked dependencies and runs type checking, lint, tests and the build in isolated containers, capped at four CPUs and four test workers. A batch starts only while the 1-minute host load is below 24. Full validation runs at departure, not separately for each branch.

With `DEPLOY_MODE=wrangler`, the bus supplies the exact commit as `WORKERS_CI_COMMIT_SHA` for the build label, pushes the gated batch to `main` using the regular account's Git authentication, and deploys the same built `dist/` through the project's installed Wrangler and existing account login. It does not rebuild for deployment. GitHub CI starts from that push and the bus monitors its checks in the background. Automatic Cloudflare Workers Builds deployment is disconnected; deployments are not run manually. Delivery is complete when GitHub CI and any required deployment have succeeded for the pushed commit.

Deployment scope is the complete batch diff. A batch changing only Markdown, `art/` source files or `gameplay/` documentation skips deployment; exported assets under `public/art/` deploy. A failed gate blocks the push. A failed deployment retains its gated artifacts for a later scheduled retry without another build, test run or push. The target account and Worker are pinned in `wrangler.jsonc`.

## Licence

Everything here (code, art, sound, music and writing) is licensed [CC BY-NC-SA 4.0](./LICENSE): share and remix it with credit to andornaut and a link to this project, for non-commercial use, under the same licence. The game's names and logos are not licensed, so a remix must use its own name. The separately installed game-kit helpers are licensed [MIT](https://github.com/andornaut/game-kit/blob/057e6c1809cd6ea7485868bfe5fa4014e1ef3b78/LICENSE).

The parent browser/build helpers in `src/platform/` and atlas encoding/packing helpers in `src/tools/atlas/shared/` retain the [MIT licence](./LICENSE-MIT).

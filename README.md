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

Run commands in a Node 24.21.0 container (`.nvmrc`) with the checkout mounted read-only and copied inside, without the agent worktrees and `node_modules`:

```sh
docker run -it --name adw-dev --cpus 4 \
  --user 19001:19001 --group-add "$(stat -c %g .)" -e HOME=/tmp \
  --mount type=bind,src="$PWD",dst=/src,readonly \
  -p 5173:5173 -p 8787:8787 \
  node:24.21.0 \
  sh -c 'mkdir /tmp/work && cd /tmp/work \
    && tar -C /src --exclude=./.claude --exclude=./.worktrees --exclude=./node_modules -cf - . | tar -xf - \
    && npm ci && npm test'
docker cp adw-dev:/tmp/work/out/. ./out
docker rm adw-dev
```

Replace `npm test` with any command in the table. The container is named and kept after it exits so `docker cp` can copy outputs out (here `out/`); remove it with `docker rm` before the next run. Serve the dev server with `npm run dev -- --host 0.0.0.0` (<http://localhost:5173/play/>) and the preview with `npm run preview -- --ip 0.0.0.0` (<http://localhost:8787/play/>). Mount host paths only with `--mount`, never `-v`, which creates a missing source as root.

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
| `npm run lint`                              | Prettier, ESLint and markdownlint                                          |
| `npm run planner:acceptance -- <out-dir>`   | Run the planner acceptance batch ([src/README.md](src/README.md))          |
| `npm run preview`                           | Build, then serve it through `wrangler dev`                                |
| `npm run simulate -- --help`                | Simulate runs ([src/README.md](src/README.md), Simulator)                  |
| `npm test`                                  | Run the unit tests                                                         |
| `npm run test:game-kit`                     | Run the game tests game-kit's release proof runs                           |

The site's pages are in `pages/`, each at its URL's path (`pages/play/index.html` is `/play/`), and Vite bundles the TypeScript they load. `public/` is copied into the build unchanged: the art, the nav bar, the icons, and the art gallery, `public/art/index.html`. `shared/` holds the files art's tools and the game both read. The game imports shared helpers through `@andornaut/game-kit/<path>`, installed from the [game-kit release](https://github.com/andornaut/game-kit/releases) pinned in `package.json`. The installed package records its source revision in `SOURCE_COMMIT`.

Art build tools are TypeScript modules in `art/tools/`, which Node runs directly on the [art-kit release](https://github.com/andornaut/art-kit/releases) pinned in `package.json`, for example
`node art/tools/glyphs.ts build`.

WORKAROUND: Parent-scoped development overrides pin [KaTeX](https://github.com/advisories/GHSA-238p-pmpm-9mq7) `0.18.2`, [minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249) `11.0.3` and [re2js](https://github.com/advisories/GHSA-gg6h-894w-4m9c) `2.8.7`. ESLint loads the cycle and extensions rules and the resolver through exported plugin subpaths because the full plugin imports an unused rule requiring the removed minimatch `makeRe` API ([eslint-plugin-import-x#569](https://github.com/un-ts/eslint-plugin-import-x/issues/569)). Keep cycle detection and required import extensions enabled. Remove each override when its parent range supports the patched version; restore the full plugin import when it supports minimatch 11.

CI runs check, lint, test and build, and the AI attributions scan.

## Deploying

- [Cloudflare dashboard](https://dash.cloudflare.com/?to=/:account/workers/services/view/archies-dog-walks)

Delivery runs on the [delivery-kit](https://github.com/andornaut/delivery-kit) release pinned in `package.json`, configured by [`delivery-kit.json`](delivery-kit.json). Its runner departs hourly at :00, Toronto time, and holds a departure while the one-minute host load is at or above `resources.loadLimit`. A departure gates the local `main` HEAD in an isolated container (`npm ci`, then type checking, lint, tests and the build, capped at four CPUs and four test workers), pushes that exact commit to `main` as a fast-forward with the regular account's Git authentication, and watches the commit's required GitHub CI checks. There is no queue or batch: a `main` with nothing new does not depart. The runner's state is kept by game-dev, outside this repository.

When CI passes, the runner deploys the gated `dist/` through the Wrangler locked in that commit and existing account login, without rebuilding. The gate sets `WORKERS_CI_COMMIT_SHA` for the build label. A push whose every changed path matches `deploy.skipPattern` (Markdown, `art/` and `gameplay/`) skips deployment; exported assets under `public/art/` deploy. A red gate leaves `main` unpushed and that commit is never gated again; red CI is fixed forward with a new commit. A failed deployment keeps its gated build for a later departure. Cloudflare Workers Builds is disconnected, so the runner is the only deploy path, and nothing is pushed or deployed manually. The target account and Worker are pinned in `wrangler.jsonc`.

## Licence

Everything here (code, art, sound, music and writing) is licensed [CC BY-NC-SA 4.0](./LICENSE): share and remix it with credit to andornaut and a link to this project, for non-commercial use, under the same licence. The game's names and logos are not licensed, so a remix must use its own name. The separately installed game-kit helpers are licensed [MIT](https://github.com/andornaut/game-kit/blob/main/LICENSE).

The separately installed art-kit helpers are licensed [MIT](https://github.com/andornaut/art-kit/blob/main/LICENSE).

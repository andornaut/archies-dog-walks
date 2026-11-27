# Archie's Dog Walks

[![Test](https://github.com/andornaut/archies-dog-walks/actions/workflows/test.yml/badge.svg)](https://github.com/andornaut/archies-dog-walks/actions/workflows/test.yml)
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

Archie's Dog Walks is a cozy pixel-art lane runner where you walk a pack of dogs through the neighbourhood, and every bump in the road counts: a plain bump costs an owner's heart, and a card obstacle turns into a choice. Built with [Phaser](https://phaser.io/) and TypeScript, and served as static files from [Cloudflare Workers](https://developers.cloudflare.com/workers/static-assets/).

Play at <https://archie.tristamittermayer.com/play/>. The custom domain is configured in [`wrangler.jsonc`](wrangler.jsonc).

## Documentation

[Project documentation](docs/README.md) links the design, work records, art and implementation guides.

## Developing

Run `npm run dev` for local development and `make check` for the isolated project gate. See [development commands and tooling](docs/guides/development.md).

## Deploying

The existing delivery-kit runner gates and deploys checked source. See [delivery and deployment](docs/reference/delivery.md).

## Licence

Everything here (code, art, sound, music and writing) is licensed [CC BY-NC-SA 4.0](./LICENSE): share and remix it with credit to andornaut and a link to this project, for non-commercial use, under the same licence. The game's names and logos are not licensed, so a remix must use its own name. The separately installed game-kit helpers are licensed [MIT](https://github.com/andornaut/game-kit/blob/main/LICENSE).

The separately installed art-kit helpers are licensed [MIT](https://github.com/andornaut/art-kit/blob/main/LICENSE).

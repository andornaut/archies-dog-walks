import { SKIP_CARD_ART } from "../assets/cardArt.ts";
import {
  backdropKey,
  cardFrameTag,
  cardZoneKey,
  dogCardTag,
  dogFaceKey,
  dogPortraitKey,
  dogSpriteKey,
  encounterSpriteKey,
  gearIconKey,
  kebabCase,
  minorObstacleSpriteKey,
  ownerCardFaceKey,
  ownerFaceKey,
  roadStartKey,
  roadTileKey,
  zoneIconKey,
} from "../assets/spriteKeys.ts";
import type {
  CardOption,
  CardSource,
  DogId,
  EncounterId,
  GameData,
  GearId,
  MinorObstacleId,
  ObstacleEncounterId,
  UpgradeId,
  WalkerId,
} from "../data/types.ts";
import { DEV_CHEATS_KEY, DEV_SAVE_EDITS_KEY } from "../dev/devPanelModel.ts";
import { sizeHearts } from "../rules/dogs.ts";
import { effectText } from "../rules/effectText.ts";
import { faceMood } from "../rules/treats.ts";
import { weightedZones } from "../rules/zones.ts";
import { minorLook, obstacleSkins } from "../runner/obstacleLooks.ts";
import { SAVE_KEYS } from "../save/storage.ts";
import { PREVIEW_HOST } from "./previewHost.ts";

// The game data art's tools read, as shared/export/game-data.json. Every entry spreads its
// data module's fields as they are, so a field added to the data shows up here unchanged,
// then adds what the game derives from it: art keys, card text and per-dog figures.

function entries<Id extends string, T>(record: Readonly<Record<Id, T>>): [Id, T][] {
  return Object.entries(record) as [Id, T][];
}

// The upgrades in the forks' draw order.
function upgradeEntries(
  data: Pick<GameData, "upgradeDrawOrder" | "upgrades">,
): [UpgradeId, GameData["upgrades"][UpgradeId]][] {
  return data.upgradeDrawOrder.map((id) => [id, data.upgrades[id]]);
}

// An option's id is its art key less the card's prefix: card-lost-wallet-keep is "keep".
function optionId(sourceId: string, art: string): string | null {
  const prefix = `card-${kebabCase(sourceId)}-`;
  return art.startsWith(prefix) ? art.slice(prefix.length) : null;
}

interface CardFace {
  readonly art: string;
  readonly frame: string;
  readonly id: string | null;
  readonly index: number | null;
  readonly name: string;
  readonly source: { readonly id: string | null; readonly kind: string };
  readonly text: string;
  readonly title: string;
}

function optionFaces(
  data: GameData,
  frame: string,
  options: readonly CardOption[],
  source: { id: string; kind: string },
  title: string,
): CardFace[] {
  return options.map((option, index) => ({
    art: option.art,
    frame,
    id: optionId(source.id, option.art),
    index,
    name: option.name,
    source,
    text: effectText(data, option.effects),
    title,
  }));
}

// Every card face the game can show, one per option: encounter options in data order, each
// zone's fork path card, each upgrade a path can carry, then Skip.
function cardFaces(data: GameData): CardFace[] {
  const encounterCards = entries<EncounterId, GameData["encounters"][EncounterId]>(
    data.encounters,
  ).flatMap(([id, encounter]) => {
    if (encounter.resolution.kind !== "card") {
      return [];
    }
    const source: CardSource = { affected: [], encounter: id, kind: "encounter" };
    return optionFaces(
      data,
      cardFrameTag(source),
      encounter.resolution.options,
      { id, kind: "encounter" },
      encounter.name,
    );
  });
  // Every zone's path card, as a fork shows it, before its upgrade.
  const pathCards = data.world.zones.map((zone): CardFace => ({
    art: cardZoneKey(zone),
    frame: "route",
    id: zone.id,
    index: null,
    name: zone.name,
    source: { id: zone.id, kind: "fork" },
    text: zone.difficultyName,
    title: data.runText.card.forkTitle,
  }));
  const upgradeCards = upgradeEntries(data).map(([id, upgrade]): CardFace => ({
    art: upgrade.art,
    frame: "route",
    id,
    index: null,
    name: upgrade.name,
    source: { id, kind: "upgrade" },
    text: effectText(data, upgrade.effects),
    title: data.runText.card.forkTitle,
  }));
  const skip: CardFace = {
    art: SKIP_CARD_ART,
    frame: "encounter",
    id: "skip",
    index: null,
    name: data.runText.card.skip,
    source: { id: null, kind: "skip" },
    text: data.runText.card.skipEffect,
    title: "",
  };
  return [...encounterCards, ...pathCards, ...upgradeCards, skip];
}

export function gameDataExport(data: GameData) {
  const { zones, ...world } = data.world;
  const { tuning } = data;
  return {
    cards: cardFaces(data),
    debuffs: entries(data.debuffs).map(([id, debuff]) => ({ id, ...debuff })),
    // What a browser harness that drives the game needs: the preview server's container name,
    // the storage keys the dev panel and the save use, and the text it waits for.
    devHarness: {
      previewHost: PREVIEW_HOST,
      storageKeys: {
        devCheats: DEV_CHEATS_KEY,
        devSaveEdits: DEV_SAVE_EDITS_KEY,
        save: SAVE_KEYS.save,
      },
      text: { pull: data.runText.strip.pull },
    },
    dogs: entries<DogId, GameData["dogs"][DogId]>(data.dogs).map(([id, dog]) => {
      const hearts = sizeHearts(tuning, dog);
      return {
        id,
        ...dog,
        // Before the pack-size bonus and modifiers: what a dog's size brings to a walk.
        figures: {
          maxHearts: hearts,
          startHearts: hearts,
          startMood: faceMood(data, hearts, hearts),
        },
        keys: {
          dogCardTag: dogCardTag(data, id),
          face: dogFaceKey(data, id),
          ownerCardFace: ownerCardFaceKey(data, id),
          ownerFace: ownerFaceKey(data, id),
          portrait: dogPortraitKey(data, id),
          sprite: dogSpriteKey(data, id),
        },
      };
    }),
    encounters: entries<EncounterId, GameData["encounters"][EncounterId]>(data.encounters).map(
      ([id, encounter]) => ({
        id,
        ...encounter,
        spriteKey: encounterSpriteKey(id),
        // An obstacle's zones, from the weights.
        ...(encounter.kind === "obstacle"
          ? { zones: weightedZones(data.world, "obstacles", id as ObstacleEncounterId) }
          : {}),
      }),
    ),
    gear: entries<GearId, GameData["shopGear"][GearId]>(data.shopGear).map(([id, gear]) => ({
      id,
      ...gear,
      iconKey: gearIconKey(id),
    })),
    help: data.help,
    minorObstacles: entries<MinorObstacleId, GameData["minorObstacles"][MinorObstacleId]>(
      data.minorObstacles,
    ).map(([id, obstacle]) =>
      "skins" in obstacle
        ? {
            id,
            ...obstacle,
            skins: Object.fromEntries(
              obstacleSkins(data, id).map((skin) => [
                skin,
                { ...obstacle.skins[skin], spriteKey: minorObstacleSpriteKey(skin) },
              ]),
            ),
          }
        : {
            id,
            ...obstacle,
            spriteKey: minorObstacleSpriteKey(minorLook(data, id)),
            zones: weightedZones(data.world, "minorObstacles", id),
          },
    ),
    movementAssignments: data.movementAssignments,
    movementProfiles: data.movementProfiles,
    tuning,
    upgrades: upgradeEntries(data).map(([id, upgrade]) => ({ id, ...upgrade })),
    walkers: entries<WalkerId, GameData["walkers"][WalkerId]>(data.walkers).map(([id, walker]) => ({
      id,
      ...walker,
    })),
    world,
    zones: zones.map((zone) => ({
      ...zone,
      keys: {
        backdrop: backdropKey(zone),
        card: cardZoneKey(zone),
        icon: zoneIconKey(zone),
        road: roadTileKey(zone),
        roadStart: roadStartKey(zone),
      },
    })),
  };
}

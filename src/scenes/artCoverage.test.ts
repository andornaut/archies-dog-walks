import { animationKey } from "@andornaut/game-kit/art/aseprite";
import { keysOf } from "@andornaut/game-kit/records";
import type { Scene } from "phaser";
import * as v from "valibot";
import { describe, expect, it } from "vitest";

import shippedManifest from "../../public/art/manifest.json" with { type: "json" };
import { animationSpecs } from "../assets/asepriteAnimations.ts";
import { splitDepthKey, stepSize } from "../assets/depthSteps.ts";
import { debuffIconKey, SQUIRREL_ICON_KEY } from "../assets/iconKeys.ts";
import { parseManifest } from "../assets/manifest.ts";
import {
  AMBIENT_VARIANTS,
  CARD_FRAME_KEY,
  cardFrameTag,
  depthVariantKey,
  DIFFICULTY_KEY,
  dogCardTag,
  dogFaceKey,
  dogPortraitKey,
  dogSpriteKey,
  encounterSpriteKey,
  gearDropSpriteKey,
  minorObstacleSpriteKey,
  MOVER_SPRITE_KEYS,
  moverBodyTag,
  MOVING_TAGS,
  ownerCardFaceKey,
  ownerFaceKey,
  prizeMoverTag,
  PULL_ART,
  SKUNK_CLOUD_KEY,
  STANDING_TAGS,
  ZONE_CELEBRATION_ART,
  ZONE_PIPS_KEY,
} from "../assets/spriteKeys.ts";
import { musicKey } from "../audio/music.ts";
import { hitCue, SOUND_KEYS, soundKeyFor, soundKeysOf } from "../audio/sound.ts";
import { gameData } from "../data/index.ts";
import type { CardSource, EncounterId, ZoneId } from "../data/types.ts";
import { TOUCH_DRAG } from "../help/helpPictures.ts";
import { badgeWall } from "../home/badgesView.ts";
import { HOME_LAYOUT } from "../home/homeLayout.ts";
import { effectIconKey, type EffectItem, walkBarIconKey } from "../hud/effectIcons.ts";
import { type PipState, pipTag } from "../hud/hudView.ts";
import { MESSAGE_ICONS } from "../hud/messageStrip.ts";
import { cardOwnerMood } from "../hud/moments.ts";
import { DOG_REACTIONS, HIT_ART } from "../layout/hitEffects.ts";
import { SCALE_STEPS } from "../layout/projection.ts";
import { cardFor } from "../rules/choices.ts";
import { hitLabel } from "../rules/encounters.ts";
import { faceMood } from "../rules/treats.ts";
import { minorLooks } from "../runner/obstacleLooks.ts";
import type { PullPose } from "../runner/pulls.ts";
import { testState } from "../testing/runState.ts";
import { clampHearts } from "../units.ts";
import { FEEDBACK_ART } from "./feedbackArt.ts";
import { hitBurstKey, hitLook } from "./hitMoment.ts";
import { DETAIL_WELL_KEY } from "./homePanels.ts";
import { BADGE_KEYS, SHOP_ART } from "./itemArt.ts";
import { TIP_SPARKLE } from "./run/tipSparkle.ts";

const manifest = parseManifest(shippedManifest);
const images = new Set(manifest.images.map(({ key }) => key));
const sprites = new Map(manifest.sprites.map((entry) => [entry.key, entry]));
const hasSprite = (key: string) => sprites.has(key);
const sheets = import.meta.glob<unknown>("../../public/art/sprites/*.json", {
  eager: true,
  import: "default",
});

function sheetOf(key: string): unknown {
  const entry = sprites.get(key);
  return entry === undefined ? undefined : sheets[`../../public/art/${entry.json}`];
}

// Each wanted tag the sprite lacks as key:tag, or the bare key when there is no such sprite.
function missingTags(key: string, tags: readonly string[]): string[] {
  const sheet = sheetOf(key);
  if (sheet === undefined) {
    return [key];
  }
  const have = new Set(animationSpecs(key, sheet).map((spec) => spec.key));
  return tags.filter((tag) => !have.has(animationKey(key, tag))).map((tag) => `${key}:${tag}`);
}

// Every tag the sprite plays.
function tagsOf(key: string): string[] {
  const sheet = sheetOf(key);
  return sheet === undefined
    ? []
    : animationSpecs(key, sheet).map((spec) => spec.key.slice(key.length + 1));
}

function missingImages(keys: readonly string[]): string[] {
  return keys.filter((key) => !images.has(key));
}

// The keys of a record typed over a union, so a new member is a compile error until listed.
function members<K extends string>(record: Readonly<Record<K, true>>): K[] {
  return keysOf(record);
}

const DEBUFFS = keysOf(gameData.debuffs);
const DOGS = keysOf(gameData.dogs);
const ENCOUNTERS = keysOf(gameData.encounters);
const MINOR_OBSTACLES = keysOf(gameData.minorObstacles);
const PULL_TAGS = members<PullPose["tag"]>({ pull: true, tell: true });
// Every depth step below full size.
const SMALLER_STEPS = SCALE_STEPS.filter((step) => step < 1);
// The steps below 1 at which any of keys has a variant. Art adds a step to a whole family of
// sprites at once, so each of them must then have it.
function variantSteps(keys: readonly string[]): number[] {
  return SCALE_STEPS.filter(
    (step) => step < 1 && keys.some((key) => sprites.has(depthVariantKey(key, step) ?? "")),
  );
}

// Every mood a face can show, at every max up to well past any size's and each hearts up to it.
const MOODS = [
  ...new Set(
    Array.from({ length: 21 }, (_, max) =>
      Array.from({ length: max + 1 }, (__, hearts) => faceMood(gameData, max, hearts)),
    ).flat(),
  ),
];

// Every mood an owner's face on a dog card can show: a walking dog's at every max up to well
// past any size's and each hearts up to it, and a fired dog's.
const CARD_OWNER_MOODS = [
  ...new Set(
    Array.from({ length: 21 }, (_, max) => [
      ...Array.from({ length: max + 1 }, (__, hearts) =>
        cardOwnerMood(gameData, max, {
          dog: "kilo",
          hearts: clampHearts(max, hearts),
          status: "walking",
        }),
      ),
      cardOwnerMood(gameData, max, { dog: "kilo", status: "fired", zoneIndex: 0 }),
    ]).flat(),
  ),
];

// A scene that has loaded exactly the shipped art.
const loadedScene = {
  textures: { exists: (key: string) => images.has(key) || sprites.has(key) },
} as unknown as Scene;

// A named check and the art it finds missing, which must be none. A check may also assert that
// what it walks is not empty.
type Check = readonly [string, () => readonly string[]];
const expectNone = (_: string, missing: () => readonly string[]) => {
  expect(missing()).toEqual([]);
};

describe("dog and walker art", () => {
  it.each<Check>([
    [
      "names a road sprite with every pose, pull and hit tag for every dog",
      () => {
        const reactions = Object.values(DOG_REACTIONS).flat();
        const tags = [...new Set(["idle", "walk", ...reactions, ...PULL_TAGS])];
        return DOGS.flatMap((dog) => missingTags(dogSpriteKey(gameData, dog), tags));
      },
    ],
    [
      "names a hand-drawn depth variant for every dog at every depth step",
      () =>
        DOGS.flatMap((dog) =>
          SMALLER_STEPS.map((step) => depthVariantKey(dogSpriteKey(gameData, dog), step) ?? ""),
        ).filter((variant) => !sprites.has(variant)),
    ],
    [
      "names a face with every mood for every dog, and its owner's with fired too",
      () => {
        expect(MOODS).toEqual(expect.arrayContaining(["happy", "neutral", "upset"]));
        return DOGS.flatMap((dog) => [
          ...missingTags(dogFaceKey(gameData, dog), MOODS),
          ...missingTags(ownerFaceKey(gameData, dog), [...MOODS, "fired"]),
        ]);
      },
    ],
    [
      "names an owner's card face with every mood the card shows for every dog",
      () => {
        expect(CARD_OWNER_MOODS).toEqual(expect.arrayContaining([...MOODS, "fired", "worried"]));
        return DOGS.flatMap((dog) =>
          missingTags(ownerCardFaceKey(gameData, dog), CARD_OWNER_MOODS),
        );
      },
    ],
    [
      "names a dog card for every dog, the empty card and the heart-loss flash",
      () =>
        missingTags("ui-dog-card", [
          ...DOGS.map((dog) => dogCardTag(gameData, dog)),
          dogCardTag(gameData, null),
          "heart-loss",
        ]),
    ],
    [
      "names a road sprite and a picker face with their tags for every walker",
      () =>
        Object.values(gameData.walkers).flatMap(({ portraitKey, spriteKey }) => [
          ...missingTags(spriteKey, ["idle", "walk", "stumble"]),
          ...missingTags(portraitKey, ["happy", "neutral"]),
        ]),
    ],
    [
      "has the zone celebration's cheer for every walker, its burst, tail and confetti colours",
      () => {
        const { burst, confettiBit, confettiBitTags, tailUp, walkerTags } = ZONE_CELEBRATION_ART;
        return [
          ...Object.values(gameData.walkers).flatMap(({ spriteKey }) =>
            missingTags(spriteKey, walkerTags),
          ),
          ...missingImages([burst, tailUp]),
          ...missingTags(confettiBit, confettiBitTags),
        ];
      },
    ],
  ])("%s", expectNone);
});

describe("image art", () => {
  it("names a portrait, message icon, badge, well, effect icon and section fill for each use", () => {
    const lists: [string, () => string[]][] = [
      ["a portrait for every dog", () => DOGS.map((dog) => dogPortraitKey(gameData, dog))],
      ["an icon for every message strip line", () => Object.values(MESSAGE_ICONS)],
      ["an icon for every badge", () => Object.values(BADGE_KEYS)],
      ["a detail card well", () => [DETAIL_WELL_KEY]],
      [
        "an effect icon for every upgrade, gear item and walker perk",
        () => [
          ...keysOf(gameData.upgrades).map((upgrade) =>
            effectIconKey({ kind: "upgrade", upgrade }),
          ),
          ...keysOf(gameData.shopGear).map((gear) => effectIconKey({ gear, kind: "gear" })),
          ...keysOf(gameData.walkerPerks).map((perk) => effectIconKey({ kind: "perk", perk })),
        ],
      ],
      [
        "a 20x20 walk bar icon for every perk, gear item and upgrade",
        () =>
          [
            ...keysOf(gameData.walkerPerks).map((perk): EffectItem => ({
              kind: "perk",
              perk,
            })),
            ...keysOf(gameData.shopGear).map((gear): EffectItem => ({
              gear,
              kind: "gear",
            })),
            ...keysOf(gameData.upgrades).map((upgrade): EffectItem => ({
              kind: "upgrade",
              upgrade,
            })),
          ].map(walkBarIconKey),
      ],
      ["every section's solid fill", () => Object.values(HOME_LAYOUT.sectionFillKeys)],
    ];
    expect(lists.flatMap(([, keys]) => missingImages(keys()))).toEqual([]);
  });
});

describe("screen and card art", () => {
  it.each<Check>([
    [
      "names the Pet shop's faces and the door invitation the Start screen plays",
      () => missingTags(SHOP_ART.petShop, ["door-wave", "normal", "pressed"]),
    ],
    [
      "names the Pet shop board's faces",
      () => missingTags(SHOP_ART.petShopBoard, ["normal", "pressed"]),
    ],
    [
      "names the dog slot sign's faces",
      () => missingTags(HOME_LAYOUT.slotSign.key, ["normal", "pressed"]),
    ],
    [
      "tags ui-touch-drag with swipes as long as each other, past every drag frame, and a still",
      () => {
        const { dragPx, key, tags } = TOUCH_DRAG;
        const specs = animationSpecs(key, sheetOf(key));
        const durations = (tag: string) =>
          specs
            .find((spec) => spec.key === animationKey(key, tag))
            ?.frames.map(({ duration }) => duration) ?? [];
        expect(durations(tags.left)).toEqual(durations(tags.right));
        expect(durations(tags.right).length).toBeGreaterThan(dragPx.from + dragPx.px.length);
        return missingTags(key, Object.values(tags));
      },
    ],
    ["names a debuff bar icon for every debuff", () => missingImages(DEBUFFS.map(debuffIconKey))],
    [
      "names a badge with earned and locked for every achievement",
      () => {
        const badges = badgeWall(gameData, []);
        expect(badges).toHaveLength(Object.keys(gameData.achievements).length);
        return badges.flatMap(({ art }) => missingTags(art, ["earned", "locked"]));
      },
    ],
    [
      "tags ui-zone-pips with every route pip, for every zone",
      () => {
        const states: readonly PipState[] = ["current", "done", "todo"];
        const tags = gameData.world.zones.flatMap((zone) =>
          states.map((state) => pipTag(gameData, { state, zone: zone.id as ZoneId })),
        );
        const drawn = gameData.world.zones.flatMap(({ art }) => [art, `${art}-done`]);
        expect(tags).toEqual(expect.arrayContaining(["todo", ...drawn]));
        return missingTags(ZONE_PIPS_KEY, [...new Set(tags)]);
      },
    ],
    [
      "tags ui-difficulty with every zone's paws, and ui-fires, an option's firing marker",
      () => {
        const tags = gameData.world.zones.map(({ difficulty }) => String(difficulty));
        return [
          ...missingTags(DIFFICULTY_KEY, ["1", "2", "3", "4", "5", ...tags]),
          ...missingTags("ui-fires", ["static", "pulse"]),
        ];
      },
    ],
    [
      "tags both card frames with the frame of every card source",
      () => {
        const sources: CardSource[] = [
          ...ENCOUNTERS.map((encounter): CardSource => ({
            affected: [],
            encounter,
            kind: "encounter",
          })),
          { kind: "fork", paths: ["highPark"], upgrades: ["bellyRubs"] },
        ];
        const tags = [...new Set(sources.map((source) => cardFrameTag(source)))];
        expect(tags).toHaveLength(2);
        return [CARD_FRAME_KEY, "card-frame-large"].flatMap((key) => missingTags(key, tags));
      },
    ],
    [
      "names a card preview for every zone, as a fork's path card shows it",
      () => {
        const zones = gameData.world.zones.map(({ id }) => id as ZoneId);
        const arts = [zones.slice(0, 3), zones.slice(3)].flatMap((paths) =>
          cardFor(gameData, testState({ kilo: 4 }), {
            kind: "fork",
            paths,
            upgrades: paths.map(() => "bellyRubs"),
          }).options.map(({ art }) => art),
        );
        expect(arts).toHaveLength(zones.length);
        return missingImages(arts);
      },
    ],
    [
      "tags the pull bubble and fail effect, and names the blocked mark and squirrel icon",
      () => [
        ...missingTags(PULL_ART.bubble, ["idle", "show"]),
        ...[PULL_ART.pullBlocked].filter((key) => !sprites.has(key)),
        ...missingImages([SQUIRREL_ICON_KEY]),
        ...missingTags(PULL_ART.pullFail, ["play"]),
      ],
    ],
    [
      "names the heart pops and the card's heart loss with their tags",
      () => {
        const { cardLoss, heartGain, heartLoss } = FEEDBACK_ART;
        return [
          ...missingTags(cardLoss.key, [cardLoss.tag]),
          ...[heartGain, heartLoss].flatMap((heart) =>
            missingTags(heart.key, [heart.pop, heart.fly]),
          ),
        ];
      },
    ],
    ["tags the walker's tip sparkle", () => missingTags(TIP_SPARKLE.key, [TIP_SPARKLE.tag])],
  ])("%s", expectNone);
});

describe("hit art", () => {
  const hits = ENCOUNTERS.filter((id) => hitLabel(gameData.encounters[id]) !== null);
  const lookOf = (id: EncounterId) => hitLook(gameData.encounters[id].kind, id);
  const effects = [
    HIT_ART.bump,
    HIT_ART.bumpBig,
    HIT_ART.splash,
    ...Object.values(HIT_ART.debris),
    ...Object.values(HIT_ART.debuffs),
  ];
  const framesOf = (key: string) =>
    animationSpecs(key, sheetOf(key)).find((spec) => spec.key === animationKey(key, HIT_ART.tag))
      ?.frames.length ?? 0;

  it.each<Check>([
    [
      "names a burst with play, its plate's tag and any edge flash or its fallback for every hit moment",
      () => {
        expect(hits).toEqual(expect.arrayContaining(["otherDog", "skunk"]));
        return [
          ...hits.flatMap((id) => {
            const look = lookOf(id);
            return [
              ...missingTags(look.burst, ["play"]),
              ...missingTags("ui-hit-label", [look.plate]),
              ...(look.flash === null ? [] : missingTags(look.flash, ["play"])),
            ];
          }),
          // fx-bump stands in for a hit moment without its own burst; none goes without.
          ...missingTags("fx-bump", ["play"]),
          ...hits.filter((id) => hitBurstKey(loadedScene, lookOf(id)) === "fx-bump"),
        ];
      },
    ],
    [
      "flashes the edges for every obstacle, and for no lucky find",
      () =>
        hits.filter(
          (id) => (lookOf(id).flash !== null) !== (gameData.encounters[id].kind === "obstacle"),
        ),
    ],
    [
      "plays every hit effect's tag",
      () => effects.flatMap(({ key }) => missingTags(key, [HIT_ART.tag])),
    ],
    [
      "holds a peak frame inside its effect's tag for reduced motion",
      () =>
        [HIT_ART.bump, HIT_ART.bumpBig, HIT_ART.splash, ...Object.values(HIT_ART.debuffs)]
          .filter(({ key, peak }) => peak >= framesOf(key))
          .map(({ key }) => key),
    ],
  ])("%s", expectNone);

  it("sets the splash's ground row inside its frame, as tall as the art", () => {
    const { groundRow, height, key } = HIT_ART.splash;
    const sheet = sheetOf(key) as { frames: Record<string, { sourceSize: { h: number } }> };
    const heights = Object.values(sheet.frames).map(({ sourceSize }) => sourceSize.h);
    expect(new Set(heights)).toEqual(new Set([height]));
    expect(groundRow).toBeLessThan(height);
  });
});

describe("road object art", () => {
  // Every obstacle or lucky find kind that some zone draws, or a lucky find any zone counts.
  const drawn = (kind: string) =>
    ((gameData.tuning.counts.luckyFindsPerZone as Readonly<Record<string, number>>)[kind] ?? 0) >
      0 ||
    gameData.world.zones.some(({ weights }) =>
      [weights.obstacles, weights.minorObstacles].some(
        (table) => ((table as Readonly<Record<string, number>>)[kind] ?? 0) > 0,
      ),
    );
  const roadKinds = [
    ...ENCOUNTERS.map((kind) => ({
      art: encounterSpriteKey(kind),
      entry: gameData.encounters[kind],
      kind,
    })),
    ...MINOR_OBSTACLES.flatMap((kind) =>
      minorLooks(gameData, kind).map((look) => ({
        art: minorObstacleSpriteKey(look),
        entry: gameData.minorObstacles[kind],
        kind,
      })),
    ),
  ];
  const isLucky = (kind: string) =>
    Object.hasOwn(gameData.encounters, kind) &&
    gameData.encounters[kind as EncounterId].kind === "lucky";
  // Each key's art at every depth step that fails ok.
  const everyStep = (keys: readonly string[], ok: (variant: string) => boolean) =>
    keys.flatMap((key) =>
      SCALE_STEPS.map((step) => depthVariantKey(key, step) ?? key).filter(
        (variant) => !ok(variant),
      ),
    );

  // Every road item's sprite, standing and as a mover, with any owner and spray cloud beside it,
  // plays a tag it has, of more than one frame where it has one: standing halted and walking,
  // and a mover moving and stopped, at every step it has.
  const unanimated = () => {
    const items = roadKinds.flatMap(({ art, entry, kind }) => {
      const arts = [art].filter(hasSprite);
      const clouds = kind === "skunk" ? [SKUNK_CLOUD_KEY] : [];
      const standing = [...arts, ...arts.map((shown) => `${shown}-owner`), ...clouds]
        .filter(hasSprite)
        .map((key) => ({ key, kind, movement: null, role: "standing" }));
      const movement = "movement" in entry ? entry.movement : undefined;
      const movers = arts.map((shown) => {
        const body = MOVER_SPRITE_KEYS[shown];
        return {
          key: body !== undefined && hasSprite(body) ? body : shown,
          kind,
          movement: movement?.kind ?? null,
          role: `a ${movement?.kind ?? ""} mover`,
        };
      });
      return movement === undefined ? standing : [...standing, ...movers];
    });
    return items.flatMap((item) =>
      [1, ...variantSteps([item.key])].flatMap((step) => {
        const variant = depthVariantKey(item.key, step) ?? item.key;
        const frames = new Map(
          animationSpecs(variant, sheetOf(variant)).map((spec) => [
            spec.key.slice(variant.length + 1),
            spec.frames.length,
          ]),
        );
        const least = Math.min(2, Math.max(...frames.values()));
        const has = (tag: string) => frames.has(tag);
        const { movement } = item;
        const played =
          movement === null
            ? { halted: STANDING_TAGS.halted.find(has), walking: STANDING_TAGS.walking.find(has) }
            : isLucky(item.kind)
              ? {
                  moving: prizeMoverTag(has, movement, true, false),
                  stopped: prizeMoverTag(has, movement, false, false),
                }
              : {
                  moving: moverBodyTag(has, movement, true),
                  stopped: moverBodyTag(has, movement, false),
                };
        return Object.entries(played).flatMap(([state, tag]) =>
          tag !== undefined && (frames.get(tag) ?? 0) >= least
            ? []
            : [`${variant} ${state}: ${tag}`],
        );
      }),
    );
  };

  it.each<Check>([
    [
      "names a road sprite for every encounter, at every depth step",
      () => everyStep(ENCOUNTERS.map(encounterSpriteKey), hasSprite),
    ],
    [
      "names a gear drop sprite with an idle tag for every gear item, at every depth step",
      () =>
        everyStep(
          keysOf(gameData.shopGear).map(gearDropSpriteKey),
          (variant) => hasSprite(variant) && tagsOf(variant).includes("idle"),
        ),
    ],
    // A moving kind some zone draws plays one of its movement's tags at each step it has.
    [
      "tags every moving road item's sprite with a tag of its movement, at every step",
      () =>
        roadKinds
          .flatMap(({ art, entry, kind }) => {
            const movement = "movement" in entry ? entry.movement : undefined;
            return !drawn(kind) || movement === undefined
              ? []
              : [{ key: MOVER_SPRITE_KEYS[art] ?? art, tags: MOVING_TAGS[movement.kind] }];
          })
          .flatMap(({ key, tags }) =>
            [1, ...variantSteps([key])].flatMap((step) => {
              const variant = depthVariantKey(key, step) ?? key;
              return tags.some((tag) => tagsOf(variant).includes(tag)) ? [] : [variant];
            }),
          ),
    ],
    ["animates every road item's sprite, standing and moving, at every step", unanimated],
    [
      "draws every zone's ambient movers and their variants, with its tag at every step",
      () =>
        Object.values(gameData.ambient)
          .flat()
          .flatMap(({ key, tag }) => {
            const variants = (AMBIENT_VARIANTS[key] ?? []).filter(hasSprite);
            return [key, ...variants].flatMap((art) =>
              [1, ...variantSteps([art])].flatMap((step) =>
                missingTags(depthVariantKey(art, step) ?? art, [tag]),
              ),
            );
          }),
    ],
  ])("%s", expectNone);
});

describe("depth variants", () => {
  const frameSize = v.object({
    frames: v.record(
      v.string(),
      v.object({ sourceSize: v.object({ h: v.number(), w: v.number() }) }),
    ),
  });

  function sizeOf(key: string): { h: number; w: number } | undefined {
    return Object.values(v.parse(frameSize, sheetOf(key)).frames)[0]?.sourceSize;
  }

  function durationsByTag(key: string): Record<string, number[]> {
    return Object.fromEntries(
      animationSpecs(key, sheetOf(key)).map((spec) => [
        spec.key.slice(key.length + 1),
        spec.frames.map(({ duration }) => duration),
      ]),
    );
  }

  it("draw each variant at its step's exact scale of the base size, with the base's tags and timing", () => {
    const variants = [...sprites.keys()].filter((key) => key.includes("@"));
    expect(variants.length).toBeGreaterThan(0);
    for (const variant of variants) {
      const { base, step } = splitDepthKey(variant);
      expect(step.scale, variant).toBeLessThan(1);
      expect(durationsByTag(variant), variant).toEqual(durationsByTag(base));
      const full = sizeOf(base);
      expect(sizeOf(variant), variant).toEqual(
        full === undefined
          ? undefined
          : { h: stepSize(full.h, step.scale), w: stepSize(full.w, step.scale) },
      );
    }
  });
});

describe("sound art", () => {
  const sounds = new Map(manifest.sounds.map((sound) => [sound.key, sound]));

  const loaded = (key: string) => sounds.has(key);

  it.each<Check>([
    [
      "plays a manifest sound for every cue",
      () => keysOf(SOUND_KEYS).filter((cue) => soundKeyFor(loaded, cue) === undefined),
    ],
    [
      "plays a looping music of its own in every zone",
      () =>
        gameData.world.zones
          .filter((zone) => sounds.get(musicKey(zone))?.loop !== true)
          .map(({ art }) => art),
    ],
    [
      "has its own hit sound for every encounter with a hit moment",
      () =>
        ENCOUNTERS.filter((id) => hitLabel(gameData.encounters[id]) !== null)
          .map((id) => soundKeysOf(hitCue(gameData.encounters[id].kind, id))[0] ?? "")
          .filter((key) => !loaded(key)),
    ],
  ])("%s", expectNone);
});

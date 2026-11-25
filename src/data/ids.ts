// The ids each data table is keyed by, and their types. Adding an entry to a table adds its id
// here in the same change; ids.test.ts fails on an id missing from either side. A list keeps its
// table's order where that order means something and is alphabetized otherwise. Ids are never
// renamed: the save keeps them.

// In authored order, which the badge wall keeps within each tier.
export const ACHIEVEMENT_IDS = [
  "roundTrip",
  "doubleLeash",
  "packLeader",
  "cleanPaws",
  "notAScratch",
  "everybodyHome",
  "dodgeBall",
  "fiveStarService",
  "payday",
  "bigPayday",
  "twentyGrand",
  "tipJar",
  "marathon",
  "legendOfTheLeash",
  "fullKennel",
  "kittedOut",
  "localFavourite",
  "wholeCity",
  "tagTeam",
  "youreFired",
  "burnedBridges",
  "closeShave",
  "eauDeSkunk",
  "mudSeason",
  "zoomies",
  "paparazzi",
  "squirrel",
  "yoink",
  "sniffTest",
  "sayCheese",
  "sugarRush",
  "cleanStreets",
  "catWhisperer",
  "bigScreen",
  "snackAttack",
  "birdBrain",
  "fenderBender",
  "trashPanda",
  "findersKeepers",
  "popularPack",
] as const;

// Each card obstacle's option ids, in the card's order, left to right. The save counts picks by
// them.
export const CARD_OPTION_IDS = {
  bigScreenPromo: ["wave", "merch", "pushThrough"],
  cheeseCrates: ["sniff", "buy", "hurryOn"],
  droppedIceCream: ["lick", "buy", "walkOnBy"],
  greenBinSpill: ["wadeThrough", "pay", "hurryPast"],
  otherDog: ["sniff", "pullAway", "keepMoving"],
  porchCat: ["stand", "treat", "splashPast"],
  skunk: ["grooming", "rinse", "ignore"],
  thief: ["letGo", "grabBack", "giveChase"],
  weddingPhotoShoot: ["pose", "walkAround", "reshoot"],
} as const;

export const DEBUFF_IDS = ["muddy", "spotlight", "stinky", "zoomies"] as const;

export const DOG_IDS = [
  "archie",
  "buddy",
  "ginger",
  "kilo",
  "lady",
  "penny",
  "pepe",
  "reggie",
  "sequoia",
] as const;

export const GEAR_IDS = [
  "fannyPack",
  "hallPass",
  "luckyCollar",
  "runningShoes",
  "whistle",
] as const;

export const HINT_IDS = [
  "card",
  "drag",
  "firedOwner",
  "fork",
  "homeButton",
  "luckyFind",
  "minorBump",
  "moverCue",
  "packBonus",
  "pothole",
  "puddle",
  "pull",
  "skunk",
  "squirrel",
  "tip",
  "treat",
] as const;

// The encounters by kind are the rule vocabulary: adding one means new rules code, not only data.
export const LUCKY_ENCOUNTER_IDS = ["friendlyNeighbour", "lostWallet"] as const;

export const MINOR_OBSTACLE_IDS = [
  "artSculpture",
  "ball",
  "barrelStack",
  "beachUmbrella",
  "bench",
  "breweryDray",
  "bunny",
  "busker",
  "car",
  "cargoBike",
  "cat",
  "cherryTrees",
  "clothingRack",
  "couple",
  "coyote",
  "crosstownBus",
  "cyclist",
  "deliveryCyclist",
  "deliveryTruck",
  "ducklings",
  "escapedCapybara",
  "fallenLog",
  "ferrets",
  "foodCartVendor",
  "frisbeeDog",
  "garbageTruck",
  "gardener",
  "goose",
  "grannyCartShopper",
  "hedge",
  "hen",
  "hopscotchKid",
  "iceCreamBike",
  "iceCreamTruck",
  "ironFence2",
  "ironFence3",
  "jogger",
  "kegDollyWorker",
  "kidOnABike",
  "leafBag",
  "lifeguardChair",
  "littleFreeLibrary",
  "mailCarrier",
  "marketStall2",
  "marketStall3",
  "newspaperBox",
  "parkRangersCart",
  "parkedCar",
  "patrolBuggy",
  "pedicab",
  "pigeons",
  "porchSteps",
  "produceCrates",
  "raccoon",
  "rollerblader",
  "rollingBarrel",
  "sandcastle",
  "scooter",
  "seagull",
  "segwayTourRider",
  "signSpinner",
  "stiltWalker",
  "streetCart",
  "streetcar",
  "streetcarPlatform",
  "stroller",
  "strollingBusker",
  "taxi",
  "tourGroup",
  "tourist",
  "touristTrain",
  "trashCan",
  "ttcBus",
  "velvetRope",
  "volleyballNet3",
  "volleyballPlayer",
] as const;

export const MOVEMENT_PROFILE_IDS = [
  "cartTurnExit",
  "ducklingTrail",
  "gardenRectangle",
  "reflectingRoll",
  "skatingArcs",
  "twoMerges",
] as const;

// The obstacle encounters; see LUCKY_ENCOUNTER_IDS.
export const OBSTACLE_ENCOUNTER_IDS = [
  "bigScreenPromo",
  "cheeseCrates",
  "droppedIceCream",
  "greenBinSpill",
  "otherDog",
  "porchCat",
  "pothole",
  "puddle",
  "skunk",
  "squirrel",
  "thief",
  "weddingPhotoShoot",
] as const;

// Each minor obstacle that comes in skins, with its skins' ids.
export const SKIN_IDS = {
  streetCart: ["flowerCart", "fruitCart", "hotDogCart", "iceCreamCart", "newspaperCart"],
} as const;

export const UPGRADE_IDS = [
  "bellyRubs",
  "bigTipper",
  "charmer",
  "goodLeash",
  "raincoats",
  "rushHour",
] as const;

export const WALKER_IDS = ["ada", "casey", "mrB", "trista"] as const;

export const WALKER_PERK_IDS = ["keenEye", "longReach", "quickRecovery", "secondChance"] as const;

// From easiest to hardest, the world's order: a fork's paths keep it, left to right.
export const ZONE_IDS = [
  "highPark",
  "cabbagetown",
  "kensingtonMarket",
  "theBeaches",
  "distilleryDistrict",
  "yongeStreet",
] as const;

export type AchievementId = (typeof ACHIEVEMENT_IDS)[number];
export type CardEncounterId = keyof typeof CARD_OPTION_IDS;
// The option ids of an encounter's card; never for an encounter that opens no card.
export type CardOptionIdOf<Id> = Id extends CardEncounterId
  ? (typeof CARD_OPTION_IDS)[Id][number]
  : never;
export type DebuffId = (typeof DEBUFF_IDS)[number];
export type DogId = (typeof DOG_IDS)[number];
export type EncounterId = LuckyEncounterId | ObstacleEncounterId;
export type GearId = (typeof GEAR_IDS)[number];
export type HintId = (typeof HINT_IDS)[number];
export type LuckyEncounterId = (typeof LUCKY_ENCOUNTER_IDS)[number];
export type MinorObstacleId = (typeof MINOR_OBSTACLE_IDS)[number];
export type MovementProfileId = (typeof MOVEMENT_PROFILE_IDS)[number];
export type ObstacleEncounterId = (typeof OBSTACLE_ENCOUNTER_IDS)[number];
export type SkinId = (typeof SKIN_IDS)[SkinnedObstacleId][number];
export type SkinnedObstacleId = keyof typeof SKIN_IDS;
export type UpgradeId = (typeof UPGRADE_IDS)[number];
export type WalkerId = (typeof WALKER_IDS)[number];
export type WalkerPerkId = (typeof WALKER_PERK_IDS)[number];
export type ZoneId = (typeof ZONE_IDS)[number];

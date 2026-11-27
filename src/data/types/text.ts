import type { InstallStepsKind } from "@andornaut/game-kit/runtime/web/pwa/installState";

import type { DebuffId, EncounterId } from "../ids.ts";
import type { AchievementTier } from "./achievement.ts";
import type { Duration, Stat, UpgradeDuration } from "./content.ts";

// The help pages' pictures of the walk screen, each drawn by the game.
export type HelpPictureId = "cards" | "lanes" | "owners" | "pickups" | "pulls" | "zones";

// One page of the "How to walk" help screen, shown in list order.
export interface HelpPage {
  // The picture the page shows.
  readonly art: HelpPictureId;
  readonly body: string;
  // One line under the framed picture.
  readonly caption: string;
  readonly title: string;
}

// The home screen's text. A {name} in a line is filled by code, and each line may use only
// the names src/home/homeText.ts lists for it.
export interface HomeText {
  // The walker's speech bubble, by what happened last. Picking a dog shows its owner's
  // parting quip instead.
  readonly bubble: {
    readonly afterFiring: string;
    readonly afterWalk: string;
    readonly firstVisit: string;
    // Said in place of afterWalk after each of the player's first few walks.
    readonly howTo: string;
    // Said once in place of howTo or afterWalk after the first finished walk, while the game
    // can be installed and is not.
    readonly install: string;
    readonly newAffordable: string;
    // After a walk that unlocked a walker, naming the {walker}.
    readonly newWalker: string;
    readonly noWalker: string;
  };
  // A purchase the bank does not cover yet: the {amount} short and the {item}'s name, a dog,
  // gear item or dog slot.
  readonly cantAfford: string;
  // A held dog or gear tile's detail card: the dog's rows, the gear card's subtitle and
  // status, the price status of anything not owned yet, and a locked dog's subtitle.
  readonly detail: {
    readonly dogKind: string;
    // A large dog's row, under its size and hearts: it slows lane changes.
    readonly dogLarge: string;
    // A small dog's rows, under its size and hearts: it dodges a bump one in {dodgeIn} times,
    // and it speeds up lane changes.
    readonly dogSmall: string;
    readonly dogSmallSpeed: string;
    readonly dogStatus: string;
    readonly gearEquipped: string;
    readonly gearOwned: string;
    readonly gearSubtitle: string;
    // A dog's owner's {role}, under their name beside their photo.
    readonly ownerRole: string;
    readonly priceBuy: string;
    readonly saveUp: string;
    // A walker's detail card's agility, as agilityPercent says it, left out for a walker at the
    // base lane-change speed, and perk with its effect.
    readonly walkerAgility: string;
    readonly walkerPerk: string;
    readonly walkerStatus: string;
    readonly walkerSubtitle: string;
  };
  // A dodge effect's text, as a gear item's detail card shows it: the {sizes} of dogs it
  // reaches, joined as a sentence lists them, and its chance as one in {dodgeIn}.
  readonly dodgeEffect: string;
  readonly dogBought: string;
  // A dog slot's name in the purchase line.
  readonly dogSlotName: string;
  // The words an effect's text is built from, wherever it shows: what each duration adds, a
  // freeCards modifier's line for one free card and for {count}, a multiplier of one half as a
  // share, a hearts change to each owner and to the lead dog's owner alone (its signed
  // {hearts}), hearts shared by the pack (their signed total {hearts}), the text of no effects
  // at all, a free Walk on by's line, and each stat's name.
  readonly effect: {
    readonly durations: { readonly [D in Duration]: string };
    readonly freeCard: string;
    readonly freeCards: string;
    readonly half: string;
    readonly heartsEach: string;
    readonly heartsLead: string;
    readonly heartsShared: string;
    readonly nothing: string;
    readonly skipOption: string;
    readonly stats: { readonly [S in Stat]: string };
  };
  // The info line for a dog or gear tile the keyboard focuses: an owned dog's, a locked dog's
  // with its price and not its name, a gear item's with its price while locked, and the parts
  // they are built from.
  readonly focus: {
    readonly dogLocked: string;
    readonly dogOwned: string;
    readonly gear: string;
    readonly gearLocked: string;
    readonly kind: string;
    readonly priceBuy: string;
    readonly priceShort: string;
  };
  // The street sign on the gate art.
  readonly gateSign: string;
  readonly gearBought: string;
  // What the walker says after a tap that changes nothing: the pack is full, or sound
  // toggled.
  readonly noticePackFull: string;
  readonly noticeSoundOff: string;
  readonly noticeSoundOn: string;
  // Said first in the walker's bubble while a later version of the game wrote the save on this
  // device and that version cannot download yet (offline, or not on the server).
  readonly noticeUpdateNeeded: string;
  // Said in the walker's bubble, after the other notices, for the session the game plays from the
  // network because this device could not install it: storage was full (noticeOnlineQuota), or
  // the browser would not register the game's service worker (noticeOnlineUnsupported).
  readonly noticeOnlineQuota: string;
  readonly noticeOnlineUnsupported: string;
  // The Dogs section's band, before a heart: the most hearts the chosen pack's size raises a
  // picked dog's owner's max by.
  readonly packBonus: string;
  readonly packCount: string;
  // The Pocket section's heading, and its band's note while nothing is pocketed.
  readonly pocket: {
    readonly note: string;
    readonly title: string;
  };
  // What back asks on the home screen with nothing open, with its two answers: keepPlaying
  // closes the question, and quit leaves the game.
  readonly quit: {
    readonly keepPlaying: string;
    readonly quit: string;
    readonly title: string;
  };
  // The Walker and Dogs section headings, and what the Walker band asks for with nothing
  // picked.
  readonly sectionDogs: string;
  readonly sectionWalker: string;
  readonly sectionWalkerPrompt: string;
  // The words that join names in a sentence, as "Jason, Rosa and Kim": between joins all but
  // the last two, and beforeLast the last two. The card's firing warning uses them too.
  readonly sentenceList: {
    readonly beforeLast: string;
    readonly between: string;
  };
  // The Pet shop page: its title, its tabs, the headings over its lists and their notes, the
  // line every dog slot row shows, and the word on an owned row.
  readonly shop: {
    // A purchase's Buy and Cancel buttons.
    readonly confirmBuy: string;
    readonly confirmCancel: string;
    readonly dogs: string;
    readonly owned: string;
    // The note right of each list's heading: {owned} of the list's {max} purchases.
    readonly ownedCount: string;
    readonly slotLine: string;
    readonly slots: string;
    readonly tabs: { readonly dogs: string; readonly gear: string };
    readonly title: string;
  };
  readonly slotBought: string;
  // The dog slot sign's line over the cheapest slot's price, beside the Pet shop.
  readonly slotSign: string;
  // Start walk's label while the walk waits for its art to load.
  readonly startLoading: string;
  readonly startWalk: string;
  // Said first in the walker's bubble while the browser keeps no save.
  readonly unsaved: string;
  // The plate under the top bar while a newer version of the game waits: its title, and its
  // button, which reloads into that version.
  readonly update: {
    readonly button: string;
    readonly failure: string;
    readonly title: string;
  };
  // What the bubble says for an owned walker picked or focused: its agility and perk, or its
  // perk alone in walkerInfoBase for a walker at the base lane-change speed.
  readonly walkerInfo: string;
  readonly walkerInfoBase: string;
  // What a locked walker's hold card and a tap on its tile say: the goal that unlocks it, the
  // {count} of dogs a walk must finish with, or walkerLockedOne for a count of 1.
  readonly walkerLocked: string;
  readonly walkerLockedOne: string;
}

// What a perk, gear item or upgrade did to a card option, by the effect that did it, as its
// charm under the card says it: a debuffSeconds cut, a forgivenHearts loss, a freeCards cost and
// a skipOption Skip.
export type CharmEffect = "debuffSeconds" | "forgivenHearts" | "freeCards" | "skipOption";

// The walk's own text. card is the choice cards': the titles and subtitles a card's data does not
// name, the Skip card, and the cost plaque's words. fired is the firing plate's word, homeQuestion
// is what the pause menu's and a fork card's End walk ask, with its two answers, and
// lowHearts is the chip over a dog card down to its last heart, naming its owner. A {name} in a
// line is filled by code, and each line may use only the names src/hud/runText.ts lists for it.
// firedBy names an owner who fires you, and card.fires flags an option that would fire owners.
export interface RunText {
  readonly card: {
    // Under the item's name on a card option's charm, or null for its name alone.
    readonly charmEffect: {
      readonly [E in CharmEffect]: E extends "forgivenHearts" ? string | null : string;
    };
    readonly fires: string;
    readonly forkSubtitle: string;
    readonly forkTitle: string;
    // A plaque whose cost a modifier, such as Charmer, waived; and the plaque of the Skip a
    // modifier, such as Hall pass, offers.
    readonly free: string;
    // In an option's text, in place of a dog's heart loss Second chance would forgive; it may
    // name the loss as {hearts}.
    readonly heartForgiven: string;
    readonly heartsEach: string;
    // A money option's plaque, with its price.
    readonly need: string;
    // A fork's path card's effect where the path carries no upgrade, on its face and when held.
    readonly noUpgrade: string;
    readonly pickOne: string;
    readonly skip: string;
    // The Skip card's effect on its face, and in its body when held.
    readonly skipEffect: string;
    readonly skipHeld: string;
    // A fork's path card plaque, by how long its upgrade lasts.
    readonly upgradeDuration: { readonly [D in UpgradeDuration]: string };
  };
  // What a breakdown names a base cause by (a bump or a treat), and atMax for a meter held at
  // its max. A change's floating label shows its amount alone.
  readonly causes: {
    readonly atMax: string;
    readonly bump: string;
    readonly treat: string;
  };
  // The comic words drawn in font-comic (A to Z, ! ? - and space): bark in place of a dog's
  // bark, dodge over a dog that dodged a hit.
  readonly comicWords: { readonly bark: string; readonly dodge: string };
  // Over a dog that dodged a hit, with reduced motion or while fx-dodge is missing.
  readonly dodge: string;
  // A dog card slot the player owns with no dog in it.
  readonly empty: string;
  // The walk's lines on the detail card a still press held on the walk HUD opens, which shows a
  // dog card and a gear or walker-perk icon as the home screen's Details do. debuffStatus: a
  // debuff bar's status, under its stake (its {seconds} the seconds it has left). dogHearts: a
  // dog card's status, its owner's hearts now and their max. upgradeStatus: an upgrade icon's
  // status, under its effect.
  readonly explain: {
    readonly debuffStatus: string;
    readonly dogHearts: string;
    // A held dog card's row for each source of its owner's extra max hearts: {name} is the
    // gear's name, such as Lucky collar's, or smallPack for the lead dog's pack-size bonus.
    readonly extraHearts: string;
    // A found gear item's status, under its effect.
    readonly foundStatus: string;
    readonly smallPack: string;
    readonly upgradeStatus: string;
  };
  readonly fired: string;
  readonly firedBy: string;
  // Over a dog whose owner's heart loss Second chance forgave.
  readonly forgiven: string;
  // A gear drop's name wherever a change or a held card names what made it: {gear} is the
  // item's name.
  readonly foundGear: string;
  // lose is what the current zone has earned, its cash and the pay the dogs still walking would
  // earn, given up, and zonesLeft the zones after this one, shown when any are.
  readonly homeQuestion: {
    readonly headHome: string;
    readonly keepWalking: string;
    readonly lose: string;
    readonly title: string;
    readonly zonesLeft: string;
  };
  // The front dog's card tag while ui-lead-tag is missing.
  readonly lead: string;
  readonly lowHearts: string;
  // A debuff's length in seconds on a road chip, such as the "4s" Quick recovery leaves.
  readonly seconds: string;
  // The road chip over a buff's charm when it waived a card option's cost, as Charmer does.
  readonly waivedCost: string;
  // The zone celebration as a walker joins, the first time a walk finishes the zone that
  // unlocks them: its headline (a big title of about 14 characters over a subtitle of about
  // 28), their agility over their perk under their greeting (no agility line for a walker at
  // the base lane-change speed), and the button.
  readonly newWalker: {
    readonly agility: string;
    readonly button: string;
    readonly perk: string;
    readonly subtitle: string;
    readonly title: string;
  };
  // The message strip's lines: achievement names a badge earned on the way, debuffStart and
  // debuffEnd announce each debuff (debuffStart's {seconds} and {hearts} filled as a debuff's
  // stake is), and the rest say what just happened on the road.
  readonly strip: {
    readonly achievement: string;
    // A plain bump that also cost cash, as Spotlight makes it; its label shows the amount.
    readonly cashHit: string;
    readonly debuffEnd: { readonly [D in DebuffId]: string };
    readonly debuffStart: { readonly [D in DebuffId]: string };
    readonly dodge: string;
    // At a walk's start, for gear that changes it from the start, such as Running shoes: the
    // gear's name and short line.
    readonly effectStart: string;
    readonly fired: string;
    readonly fullPackHome: string;
    // A gear drop grabbed on the road: {gear} is the item's name. gearSwapped when it replaces
    // the item found before it, {old}.
    readonly gearFound: string;
    readonly gearSwapped: string;
    // At a walk's start, for each large dog in the pack, which slows lane changes; smallDog for
    // each small dog, which speeds them up.
    readonly largeDog: string;
    // The friendly neighbour's line: {hearts} is the total the neighbour shares; each owner's
    // heart pop shows their own gain.
    readonly luckyNeighbour: string;
    readonly luckyWallet: string;
    readonly plainHit: string;
    readonly pull: string;
    readonly secondChance: string;
    readonly smallDog: string;
    readonly spareTreatSaved: string;
    readonly spareTreatUsed: string;
    readonly treat: string;
    // A treat grabbed while every owner is at their max that paid cash; its label shows the
    // amount.
    readonly treatCash: string;
  };
  // The walk bar's place in the walk beside the neighbourhood's name: the zone's number, n, of
  // the walk's total.
  readonly zoneProgress: string;
  // The heading of the banner each zone opens with, over the zone's name: {world} is the
  // world's name and {n} the zone's place in the walk, from 1.
  readonly zoneBanner: string;
  // The zone celebration after any other zone but the last: its headline, as newWalker's,
  // and the zone's earnings, over its button: its fees and tips in that order, each with its
  // {amount} and left out at $0, joined by separator.
  readonly zoneDone: {
    readonly button: string;
    readonly earnings: {
      readonly fees: string;
      readonly separator: string;
      readonly tips: string;
    };
    readonly subtitle: string;
    readonly title: string;
  };
}

// The text of the menus and pages over the game: Settings, Stats, Help, the End screen, the
// pause menu, the badge celebration and the crash screen. A {name} in a line is filled by
// code, and each line may use only the names src/home/menuText.ts lists for it.
export interface MenuText {
  readonly celebration: {
    readonly button: string;
    readonly titleMany: string;
    readonly titleOne: string;
  };
  // The Cheats page (docs/design/gameplay/cheats.md). A {cash},
  // {debuff} or {upgrade} is filled in by the game.
  readonly cheats: {
    readonly add: string;
    readonly applyDebuff: string;
    readonly copyRunLink: string;
    readonly finishZone: string;
    readonly grantAllUpgrades: string;
    readonly grantUpgrade: string;
    // The groups' headings, in the modal's order.
    readonly groups: {
      readonly money: string;
      readonly other: string;
      readonly startScreen: string;
      readonly thisWalk: string;
      readonly unlocks: string;
    };
    readonly invincible: string;
    // Copy run link's label once its link is copied.
    readonly linkCopied: string;
    // The Menu and Pause action that opens the modal.
    readonly open: string;
    readonly ownDogSlots: string;
    readonly ownDogs: string;
    readonly ownGear: string;
    readonly pocket: string;
    readonly pocketNone: string;
    readonly pocketPicked: string;
    readonly refillHearts: string;
    // Reset save's confirmation.
    readonly reset: {
      readonly cancel: string;
      readonly confirm: string;
      readonly note: string;
      readonly title: string;
    };
    readonly resetSave: string;
    readonly seed: string;
    readonly seedRandom: string;
    readonly speed: string;
    readonly speeds: { readonly fast: string; readonly normal: string; readonly slow: string };
    readonly startAt: string;
    readonly title: string;
    readonly unlockWalkers: string;
  };
  // Words every panel shares: its close control's accessible name, and the name with the panel's
  // title where another of its buttons is also named close.
  readonly common: {
    readonly close: string;
    readonly closeTitled: string;
  };
  // The crash screen, drawn in HTML over the page when the game stops on an error.
  readonly crash: {
    readonly body: string;
    readonly reload: string;
    readonly title: string;
  };
  readonly end: {
    // The breakdown's lines, by what the money came from.
    readonly earnings: {
      readonly cardCosts: string;
      // The cash carried and lost when every owner fired you, left out of the total.
      readonly cashLost: string;
      readonly fees: string;
      readonly fullPack: string;
      readonly luckyFinds: string;
      readonly start: string;
      readonly tips: string;
    };
    readonly firedYou: string;
    readonly headHome: string;
    readonly newBest: string;
    // The title, by how the walk ended.
    readonly titles: {
      readonly finished: string;
      readonly noDogs: string;
      readonly wentHome: string;
    };
    readonly total: string;
    readonly zonesWalked: string;
  };
  // Help's heading, and its paging buttons: Next reads gotIt on the last page. The pager's
  // count, read and not shown, is pageCount.
  readonly help: {
    readonly gotIt: string;
    readonly heading: string;
    readonly next: string;
    readonly pageCount: string;
    readonly previous: string;
  };
  readonly menu: { readonly title: string };
  // The leave button of the Help, Logbook and Pet shop pages.
  readonly pageBack: string;
  readonly pause: {
    readonly action: string;
    readonly headHome: string;
    readonly help: string;
    // What End walk keeps of the cash: note when it keeps less than all of it, else noteAll.
    readonly note: string;
    readonly noteAll: string;
    readonly resume: string;
    readonly settings: string;
    readonly title: string;
  };
  readonly settings: {
    readonly effects: string;
    readonly fpsCounter: string;
    // A display control's state words below its switch; behaviour controls use on and off.
    readonly hidden: string;
    // The Install action, shown while installation is available.
    readonly install: string;
    // The web app manifest's description, which a browser's install prompt may show.
    readonly installDescription: string;
    // The card the row opens when the browser holds no install prompt: each InstallStepsKind's
    // title and steps.
    readonly installSteps: Readonly<
      Record<InstallStepsKind, { readonly steps: string; readonly title: string }>
    >;
    readonly motion: string;
    readonly motionNote: string;
    readonly music: string;
    // A volume slider's value while sound is off; volume is its value while sound is on.
    readonly muted: string;
    readonly off: string;
    readonly on: string;
    readonly shown: string;
    readonly sound: string;
    readonly soundNote: string;
    readonly title: string;
    readonly volume: string;
  };
  readonly stats: {
    readonly badgeDifficulty: Readonly<Record<AchievementTier, string>>;
    readonly badgeEarned: string;
    readonly badgeLine: string;
    readonly badgeLocked: string;
    // A locked badge's progress across walks, under its goal on the wall.
    readonly badgeProgress: string;
    readonly dogColumns: {
      readonly fired: string;
      readonly walks: string;
      readonly zones: string;
    };
    readonly earnedCount: string;
    // Walks by how they ended.
    readonly outcomes: {
      readonly finished: string;
      readonly noDogs: string;
      readonly wentHome: string;
    };
    // The overall rows; bestRunDogs labels the first of the best walk's dogs, one per row,
    // and bestRunZones its neighbourhoods finished.
    readonly overall: {
      readonly bestRun: string;
      readonly bestRunDogs: string;
      readonly bestRunZones: string;
      readonly bestZone: string;
      readonly dogsWalked: string;
      readonly lifetime: string;
      readonly runsPlayed: string;
      readonly timesFired: string;
    };
    readonly sections: {
      readonly overall: string;
      readonly runs: string;
    };
    readonly tabs: {
      readonly badges: string;
      readonly dogs: string;
      readonly runs: string;
    };
    // Times fired once an owner has fired you, naming the owner who did it most.
    readonly timesFiredBy: string;
    readonly title: string;
  };
}

// What makes an owner speak: a choice that raised or lowered their hearts, firing you, or
// the player picking their dog on the home screen.
export type QuipMoment = "fired" | "happier" | "parting" | "upset";
// Two or more lines per moment, one drawn at random.
export type Quips = Readonly<Record<QuipMoment, readonly [string, string, ...string[]]>>;

// What a first-time hint waits for: an encounter, a debuff, or another event happening for
// the first time (moverCue: a mover's arrow cue showing on the road; packBonus: a walk
// starting with a pack-size bonus for its lead dog's owner).
export type HintTrigger =
  | { readonly encounter: EncounterId; readonly kind: "encounter" }
  | {
      readonly kind:
        | "card"
        | "drag"
        | "firedOwner"
        | "fork"
        | "homeButton"
        | "luckyFind"
        | "minorBump"
        | "moverCue"
        | "packBonus"
        | "pull"
        | "pullLanded"
        | "tip"
        | "treat";
    };

// A one-line hint shown the first time its trigger happens.
export interface Hint {
  readonly text: string;
  readonly trigger: HintTrigger;
}

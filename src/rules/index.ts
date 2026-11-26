// The public entry of src/rules/: modules outside it import only this file.
export {
  achievementConditionText,
  type AchievementData,
  achievementLabel,
  conditionTarget,
  countBump,
  countLandedBump,
  countTally,
  isMoneyCondition,
  isMoneyGoal,
  lastHeartOwnersOf,
  picksOf,
  type RunCounters,
  runCountersOf,
  type RunFacts,
  thresholdWholes,
} from "./achievements.ts";
export {
  amountText,
  type Change,
  changeAmount,
  gearSourceName,
  type HeartChange,
  heartsForgiven,
  modifierCauses,
  type MoneyChange,
  negatedCauses,
} from "./causes.ts";
export {
  applyInstantEncounter,
  applyMinorContact,
  type CardData,
  cardFor,
  type CardView,
  type Choice,
  type ChoiceData,
  type ChoiceOutcome,
  chooseOption,
  firesText,
  forkCard,
  hasPlaque,
  MAX_CARD_OPTIONS,
  offerFork,
  openCard,
  type OptionView,
  outcomeChanges,
  type QuipCue,
  quipLine,
} from "./choices.ts";
export {
  maxHearts,
  ownerMaxHearts,
  packPlace,
  packSizeBonus,
  packSizeRaise,
  placeInPack,
  SIZE_AGILITY,
  sizeHearts,
} from "./dogs.ts";
export { debuffLasting, expireAtZoneEnd, tickDebuffs, upgradeDuration } from "./durations.ts";
export { applyEffects, changeHearts } from "./effects.ts";
export {
  agilityPercent,
  capitalize,
  debuffFields,
  debuffText,
  dodgeInText,
  effectClause,
  effectText,
  formatDollars,
  gearShort,
  laneSpeedText,
  perkEffect,
  SIZE_NAMES,
  upgradeLine,
} from "./effectText.ts";
export { affectedDogs, hitLabel, hitWord, opensCard } from "./encounters.ts";
export { drawGearDrops, grabGear } from "./gearDrops.ts";
export { hintFor, hintJumpsQueue, hintText } from "./hints.ts";
export {
  changeModified,
  type ModifiedSubject,
  type ModifiedValue,
  modifiedValue,
  modifierCause,
  modifierCausesOf,
} from "./modified.ts";
export { modifiedStat, modifiersOf } from "./modifiers.ts";
export { newRun } from "./newRun.ts";
export {
  currentZone,
  currentZoneId,
  defaultRoute,
  firstZoneId,
  forkPaths,
  middleZoneId,
  previousZone,
  previousZoneId,
  type RouteData,
  walkLength,
  zoneById,
} from "./route.ts";
export {
  bumpCash,
  bumpParts,
  endReasonOf,
  fireOwnersAtZero,
  fullPackBonus,
  payZone,
  tipValue,
  walkEarnings,
} from "./run.ts";
export { cheapestDogSlot, price, startingDogSlots, unlockPrice } from "./shop.ts";
export { spareTreatGiver, spareTreatSource, spendSpareTreat } from "./spareTreats.ts";
export { reachModified, standingModified, type StandingRun } from "./standing.ts";
export { type FaceMood, faceMood, grabTreat, type TreatGrabbed } from "./treats.ts";
export { read, readTable } from "./units.ts";
export {
  newWalkers,
  packAgility,
  slowestDebuffedAgility,
  slowestPackAgility,
  walkerGoal,
  walkerOrder,
} from "./walkers.ts";
export { weightedZones, zoneScrollSpeed, zoneStats } from "./zones.ts";

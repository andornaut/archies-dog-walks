// The public entry of src/presentation/: modules outside it import only this file.
export {
  boxStyle,
  CARD_LAYOUT,
  cardEffectArea,
  cardEffectBox,
  cardRowIn,
  cardRows,
  FIRES_FIT,
  forkHomeRect,
  largeBodyBox,
  largeBodyStyle,
  largeCardHeight,
  largeCardRect,
  plaqueRoom,
} from "./cardLayout.ts";
export {
  dollarAmountText,
  dollarText,
  shortDollarAmountText,
  signedDollarText,
  signedShortDollarText,
} from "./currency.ts";
export {
  effectIconFallback,
  effectIconKey,
  type EffectItem,
  effectItems,
  effectItemsKey,
  effectLine,
  effectName,
  gearWell,
  hudEffectIconKey,
  maxEffects,
  spareTreatWell,
  walkBarIconKey,
  walkerEffectItems,
} from "./effectIcons.ts";
export {
  debuffNameMarks,
  type EffectNameKind,
  type NameData,
  type NameMark,
  pilled,
  pillKind,
  withNamePills,
} from "./effectNames.ts";
export { type OwnerNameLine, ownerNameWrap } from "./ownerName.ts";
export { ownerPhotoRect } from "./ownerPhoto.ts";

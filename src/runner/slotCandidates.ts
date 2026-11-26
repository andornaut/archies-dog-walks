export { compileSlotKindDomain, slotMotionSelections } from "./slotDomainCompile.ts";
export {
  describeSlotKind,
  isNativeSlotPreparation,
  nativeSlotPreparationOrderingHint,
  type PreparedSlotKind,
  prepareSlotKind,
  prepareSlotKindWithin,
  type SlotKindDescriptor,
  type SlotPreparationOrdering,
  type SlotPreparationOrderingHintResult,
  type SlotPreparationResult,
  type SlotPreparationWork,
  SlotProfileError,
} from "./slotKindPreparation.ts";
export {
  createSlotPathProjection,
  type SlotPathProjectionView,
  type SlotPathProjectionViewResult,
} from "./slotPathProjection.ts";
export { slotPlacementsAt } from "./slotPlacementsAt.ts";

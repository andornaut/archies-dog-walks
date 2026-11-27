// The public entry of src/runner/: modules outside it import only this file.
export { approachOutcomes, nextChoiceAt } from "./approach.ts";
export { canonicalJson } from "./canonicalJson.ts";
export { type Box, type LanedBox, overlaps, type ScaledBox, sweptOverlapAt } from "./collision.ts";
export { DART_VERGE_LANES, stopsOnVerge } from "./dartOutcomes.ts";
export { bobOffset, itemBobs } from "./itemCues.ts";
export { hopShapes, SIDESTEPS } from "./moverHops.ts";
export {
  cuedStep,
  drawnLanes,
  facesLeft,
  hasLeftRoad,
  hasStopped,
  inMotion,
  isMerging,
  isPausing,
  isSliding,
  laneAt,
  type MoverOnRoad,
  type MoverPath,
  moverPlace,
  type MoverStep,
  type MoverTell,
  moverTell,
  moverY,
  type StepShape,
  turnedBack,
} from "./movers.ts";
export { STEP_SHAPES } from "./moverSpecs.ts";
export { itemHeight, obstacleHitBoxes } from "./obstacleGeometry.ts";
export { moverOutcomes } from "./outcomes.ts";
export { screenRoadGeometry } from "./screenGeometry.ts";
export { nextShyChoiceAt, shyOutcomes } from "./shy.ts";
export {
  signatureAlive,
  signatureComponentProgress,
  signaturePlace,
  signatureSweeps,
} from "./signaturePaths.ts";
export { auditSlotPartialPlan, auditSlotPlan } from "./slotAudit.ts";
export { apportionSlotCounts, SLOT_ROLES, slotCountTotal } from "./slotConfig.ts";
export { quietCoverage } from "./slotCoverage.ts";
export { minimumSlotDelivery, SLOT_RUNTIME_DELIVERY_FLOOR } from "./slotDelivery.ts";
export {
  materialisePartialSlotPlan,
  materialiseSlotPlan,
  type SlotAssignment,
} from "./slotPlan.ts";
export { SLOT_LIMITS } from "./slotPlanner.ts";
export type { AdmissionReport } from "./spawnAdmission.ts";
export type { SpawnEvent, SpawnPlan } from "./spawning.ts";
export { auditSpawnPlan, type SpawnAudit } from "./spawnValidation.ts";
export {
  advanceLaneControl,
  type LaneControl,
  laneControlIn,
  pullLane,
  steerLane,
} from "./walk/laneControl.ts";
export { destinationLane, type LaneMotion, laneMotionX, stillInLane } from "./walk/laneMotion.ts";
export {
  contactWindow,
  NO_PULLS,
  type PullEvent,
  pullPose,
  type Pulls,
  type PullStep,
} from "./walk/pulls.ts";
export {
  awaitsZonePlan,
  chooseCard,
  chooseShownCard,
  forkPoint,
  headHomeSession,
  jumpToNeighbourhood,
  planZoneFromSeed,
  resumeSession,
  type RunStreams,
  runStreams,
  type Session,
  type SessionEvent,
  type SessionInput,
  type SessionStep,
  startSession,
  stepSession,
  type StreamDraws,
  unplannedStart,
  withZonePlan,
  ZonePlanningError,
  zoneStartPoint,
} from "./walk/session.ts";
export {
  type EncounterCard,
  type MinorBump,
  pickupReach,
  startRoad,
  steerWalk,
  type Walk,
  type WalkData,
  type WalkStep,
} from "./walk/step.ts";
export { type RoadGeometry, walkGeometry, walkProjection } from "./walkGeometry.ts";
export {
  blocksLane,
  footprintOf,
  isObstacleCategory,
  isPullObstacle,
  itemCategory,
  movementOf,
  opensACard,
  type WalkItem,
  type WalkItemKind,
  type WalkSpawn,
} from "./walkItems.ts";
export { laneMotionConfig, laneMoveSeconds, roadScrollSpeed, zoneLength } from "./walkMotion.ts";
export {
  type ZonePlanFailure,
  type ZonePlanObservation,
  type ZoneSlotDelivery,
  zoneSlotGuarantees,
} from "./zonePlan.ts";
export { type ZonePlanner, zonePlanner, type ZonePlanPort } from "./zonePlanner.ts";
export { answerZonePlan, type ZonePlanAnswer, type ZonePlanRequest } from "./zonePlans.ts";
export { compileZoneSlotInput } from "./zoneSlotInput.ts";

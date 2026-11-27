// The public entry of src/input/phaser/: modules outside it import only this file.
export {
  logicalInput,
  logicalPoint,
  type LogicalPointer,
  logicalPointer,
  primaryCanvasContact,
} from "./logicalPointer.ts";
export {
  bindPressAdmission,
  canvasInputBlocked,
  canvasPressAllowed,
  createCanvasPressAdmission,
} from "./pressAdmission.ts";

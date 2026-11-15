import type { PressAdmission } from "../../pressAdmission.ts";

const admissions = new WeakMap<object, PressAdmission>();

// Main binds the same instance it supplies to the native layer. This adapter only exposes its
// canvas boundary to scenes; it does not create another press owner.
export function bindPressAdmission(game: object, admission: PressAdmission): () => void {
  admissions.set(game, admission);
  return () => {
    if (admissions.get(game) === admission) {
      admissions.delete(game);
    }
  };
}

export function canvasPressAllowed(scene: { readonly game: object }): boolean {
  return admissions.get(scene.game)?.canvasAllowed() ?? true;
}

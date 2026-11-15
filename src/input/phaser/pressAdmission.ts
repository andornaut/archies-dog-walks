import type { PressAdmission } from "../../pressAdmission.ts";

const admissions = new WeakMap<object, { admission: PressAdmission; blocked: () => boolean }>();

// Main binds the same instance it supplies to the native layer. This adapter only exposes its
// canvas boundary to scenes; it does not create another press owner.
export function bindPressAdmission(
  game: object,
  admission: PressAdmission,
  blocked: () => boolean = () => false,
): () => void {
  const binding = { admission, blocked };
  admissions.set(game, binding);
  return () => {
    if (admissions.get(game) === binding) {
      admissions.delete(game);
    }
  };
}

export function canvasPressAllowed(scene: { readonly game: object }): boolean {
  const binding = admissions.get(scene.game);
  return !binding?.blocked() && (binding?.admission.canvasAllowed() ?? true);
}

export function canvasInputBlocked(scene: { readonly game: object }): boolean {
  return admissions.get(scene.game)?.blocked() ?? false;
}

export interface PressLease {
  release(): void;
}

export interface PressAdmission {
  canvasAllowed(): boolean;
  claim(): PressLease | undefined;
}

// Native controls and the canvas share first-press ownership. Phaser keeps its own canvas
// pointers; native controls hold a lease instead of creating synthetic Phaser pointers.
export function createPressAdmission(canvasHeld: () => boolean): PressAdmission {
  let native: object | undefined;
  return {
    canvasAllowed: () => native === undefined,
    claim() {
      if (native !== undefined || canvasHeld()) {
        return undefined;
      }
      const owner = {};
      native = owner;
      return {
        release() {
          if (native === owner) {
            native = undefined;
          }
        },
      };
    },
  };
}

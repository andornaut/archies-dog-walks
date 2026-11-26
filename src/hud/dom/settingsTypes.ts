import type { SettingsTarget, SettingsView, VolumeKey } from "../../home/index.ts";
import type { DomArtSource, DomQuestionPanel, DomQuestionPanelInput } from "../../ui/dom/index.ts";
import type { DomScale } from "../../ui/index.ts";

export interface DomSettingsInput
  extends Pick<DomQuestionPanelInput, "closeLabel" | "fonts" | "toGame">, DomArtSource {
  // What Back and the steps' close control do.
  readonly close: () => void;
  readonly closeSteps: () => void;
  // Told the row (by index) or Back (the rows' count) focus moves to, or null.
  readonly onFocus: (index: number | null) => void;
  // A switch or install row's activation, and the switch row a pointer holds, shown pressed
  // until it lifts (undefined).
  readonly press: {
    readonly activate: (target: SettingsTarget) => void;
    readonly hold: (target: SettingsTarget | undefined) => void;
  };
  // Whether a refusal plays without its shake.
  readonly reducedMotion: () => boolean;
  // A volume slider's step as a key, a drag or a tap sets it, and the end of that change.
  readonly slide: {
    readonly change: (key: VolumeKey, step: number) => void;
    readonly commit: (key: VolumeKey) => void;
  };
  readonly view: SettingsView;
}

export interface DomSettings extends Pick<
  DomQuestionPanel,
  "accepts" | "capture" | "destroy" | "setEnabled" | "setInert" | "setDimmed"
> {
  // Plays the game's refusal cue (refuse) on the row (by index).
  refuse(index: number, reducedMotion: boolean): void;
  setShown(shown: boolean): void;
  // Shows view as it now stands, and moves the page's focus to the scene's.
  update(view: SettingsView, focus: number | null): void;
}

// A row's element and its parts, placed from the row's view as it stands, in the kit list.
export interface RowPart {
  readonly destroy: () => void;
  readonly element: HTMLElement;
  readonly place: (scale: DomScale) => void;
  readonly ready: Promise<readonly string[]>;
  readonly refuse: (reducedMotion: boolean) => void;
}

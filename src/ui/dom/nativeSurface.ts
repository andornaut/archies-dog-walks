import type { Point } from "@andornaut/game-kit/runtime/rect";
import type { BitmapFont } from "@andornaut/game-kit/runtime/text/bitmapFont";

import type { GameData } from "../../data/index.ts";
import type { PanelText, QuestionPanelView } from "../index.ts";
import type { NativeGesture } from "./modalLifecycle.ts";
import type { DomPart } from "./parts.ts";

export type CloseLabel = Pick<GameData["menuText"]["common"], "close" | "closeTitled">;

export interface DomQuestionPanelInput {
  // Base screens opt out of modal ownership; pictures can remain modal without native buttons.
  readonly modal?: boolean;
  // Outside dismissal when there is no interactive X. An interactive X always supplies the
  // backdrop's action too. Required choices without either callback consume the tap.
  readonly backgroundCancel?: () => void;
  // The page's own controls drawn outside the panel, interactive with it.
  readonly companions?: readonly HTMLElement[];
  // What the close control does; null draws no close control, and a panel with no buttons then
  // takes no presses: every press goes through to the canvas. Then its accessible names
  // (closeName), and what each button does, in order.
  readonly close: (() => void) | null;
  readonly closeLabel: CloseLabel;
  // A footer can dismiss a native overlay that intentionally has no corner close control.
  readonly footerPress?: () => void;
  // Gives the caller its exact source control after admission and before activation.
  readonly onInvoke?: (index: number, control: HTMLElement) => void;
  // The id of the part that describes the panel, if any.
  readonly describedBy?: string;
  // Told the index (focusControl's) of the control focus moves to, or undefined for the dialog.
  readonly onFocus?: (index: number | undefined) => void;
  // The dialog's name where the canvas draws its title (view.title empty), as over a
  // celebration.
  readonly label?: string;
  readonly fonts: Readonly<Record<PanelText["font"], BitmapFont>>;
  readonly gesture?: NativeGesture;
  readonly onPaint?: () => void;
  // Whether keys 1 to n press the buttons, as on the pause menu and the questions.
  readonly numberKeys: boolean;
  readonly numberPresses?: readonly (() => void)[];
  // Drawn over the frame, under the title, and read after the title.
  readonly parts?: readonly DomPart[];
  readonly presses: readonly (() => void)[];
  // A tap on the panel's own body, away from its controls, as a detail card's dismissal.
  readonly dismiss?: () => void;
  // The page point of a press as a game point, through the page frame's turn.
  readonly toGame: (client: Point) => Point;
  readonly view: QuestionPanelView;
}

export interface DomQuestionPanel {
  readonly element: HTMLElement;
  setActionShown(index: number, shown: boolean): void;
  accepts(): boolean;
  capture(): () => boolean;
  setEnabled(enabled: boolean): void;
  // A tap burst at a game point, over the panel.
  burst(at: Point): void;
  destroy(): void;
  // Focuses the parts' controls, then the buttons, then the close control, by index, or the
  // dialog itself for undefined, as the scene's own focus moves.
  focusControl(index: number | undefined): void;
  // Plays the refusal cue (refusal.ts) on the index-th button.
  refuse(index: number, reducedMotion: boolean): void;
  // Darkens this covered panel once while preserving its original colours and assets.
  setDimmed(dimmed: boolean): void;
  // Lets the panel take no presses and no focus while another's dim covers it (a celebration
  // under the pause menu), and take them again.
  setInert(inert: boolean): void;
  // Hides the panel while a canvas page covers it (help, the settings), and shows it again.
  setShown(shown: boolean): void;
}

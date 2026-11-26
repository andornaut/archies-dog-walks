import { itemAt } from "@andornaut/game-kit/runtime/arrays";
import type { Rect } from "@andornaut/game-kit/runtime/rect";
import { fontMetrics } from "@andornaut/game-kit/runtime/text/bitmapFont";
import type { Scene } from "phaser";

import { domArtUrl } from "../../assets/files/index.ts";
import { gearIconKey, gearSmallIconKey } from "../../assets/index.ts";
import { MANIFEST_CACHE_KEY } from "../../assets/phaser/index.ts";
import { gameData, PLATE_PAD } from "../../data/index.ts";
import { createNativeHomeView } from "../../home/dom/index.ts";
import {
  type bubbleSpeech,
  gearPictureFallback,
  type HomeLoadout,
  homeSelectionViews,
  homeSpeechView,
  networkPlayNotice,
  noticeOrSpeech,
  packBonusLine,
  requiredNotice,
  type Sections,
  slotSign,
  storageNotice,
} from "../../home/index.ts";
import { downTail } from "../../hud/index.ts";
import { pillKind } from "../../presentation/index.ts";
import { networkPlayReason, requiredUpdate } from "../../pwa/index.ts";
import type { SaveDocument } from "../../save/index.ts";
import { loadSheet } from "../../ui/dom/index.ts";
import { disabledArtKey } from "../../ui/index.ts";
import { pillColours } from "../effectNameColours.ts";
import { storageState } from "../profileStore.ts";
import type { htmlPanelPlace } from "../questionPanel.ts";
import {
  dogFace,
  dogTiles,
  gearIds,
  gearSlots,
  pocketTile,
  rosterOrder,
  type Target,
  targetId,
  walkerFace,
  walkerIds,
  walkerTiles,
} from "./targets.ts";
import { gearBadgeAtGate, HERO_CROP } from "./yard.ts";

// Start walk's opacity while it waits for the rest of the art to load.
const WAITING_ALPHA = 0.6;

interface NativeHomeActions {
  readonly activate: (id: string) => void;
  readonly fallbackSpeech: () => ReturnType<typeof bubbleSpeech>;
  readonly hold: (id: string) => void;
  readonly startUnavailable: (sections: Sections) => string | undefined;
}

interface NativeHomeState {
  readonly bubbleInteractive: boolean;
  readonly focused: Target | undefined;
  readonly loadout: HomeLoadout;
  readonly reduced: boolean;
  readonly save: SaveDocument;
  readonly sections: Sections;
}

export function createStartHomeView(
  scene: Scene,
  { fonts, layer }: NonNullable<ReturnType<typeof htmlPanelPlace>>,
  { activate, fallbackSpeech, hold, startUnavailable }: NativeHomeActions,
  { bubbleInteractive, focused, loadout, reduced, save, sections }: NativeHomeState,
) {
  const selection = <Id>(
    ids: readonly Id[],
    rects: Rect[],
    face: (rect: Rect) => Rect,
    target: (id: Id) => Target,
  ) =>
    ids.map((id, index) => {
      const hit = itemAt(rects, index);
      return { feedbackId: targetId(target(id)), hit, id, rect: face(hit) };
    });
  const selections = homeSelectionViews(gameData, fontMetrics(fonts.body), reduced, {
    dogs: selection(rosterOrder(), dogTiles(), dogFace, (dog) => ({ dog, kind: "dog" })),
    gear: selection(gearIds(), gearSlots(), pocketTile, (gear) => ({ gear, kind: "gear" })),
    loadout,
    save,
    walkers: selection(walkerIds(), walkerTiles(), walkerFace, (walker) => ({
      kind: "walker",
      walker,
    })),
  });
  const notices = [
    ...requiredNotice(gameData.homeText, requiredUpdate()),
    ...storageNotice(gameData.homeText, storageState(scene)),
    ...networkPlayNotice(gameData.homeText, networkPlayReason()),
  ];
  const speech = homeSpeechView(
    gameData,
    fonts.body,
    downTail((key) => scene.textures.exists(key)),
    noticeOrSpeech(notices, fallbackSpeech()),
  );
  const sign = slotSign(gameData, save.owned, save.bankCents);
  const gear = loadout.gear;
  const smallGearKey = gear === null ? undefined : gearSmallIconKey(gear);
  const smallGear = smallGearKey !== undefined && scene.textures.exists(smallGearKey);
  const gearKey = gear === null ? undefined : smallGear ? smallGearKey : gearIconKey(gear);
  const gearRect = gearBadgeAtGate(loadout);
  const manifest = scene.cache.json.get(MANIFEST_CACHE_KEY) as
    | {
        sprites?: {
          key: string;
        }[];
      }
    | undefined;
  const sheetKeys = new Set((manifest?.sprites ?? []).map(({ key }) => key));
  const source = {
    artUrl: domArtUrl,
    disabledKey: disabledArtKey,
    hasArt: (key: string) => scene.textures.exists(key),
    imageSize: (key: string) => {
      const frame = scene.textures.getFrame(key);
      return { height: frame?.realHeight ?? 16, width: frame?.realWidth ?? 16 };
    },
    isSheet: (key: string) => sheetKeys.has(key),
    loadSheet,
  };
  const view = createNativeHomeView(
    layer.element.ownerDocument,
    source,
    fonts,
    {
      activate,
      hold,
      pillColours: (index) => {
        const kind = pillKind(index);
        return kind === undefined ? undefined : pillColours(kind);
      },
      platePadding: PLATE_PAD,
    },
    {
      bonus: packBonusLine(gameData, loadout),
      bubbleInteractive,
      focus: focused === undefined ? undefined : targetId(focused),
      gearBadge:
        gearKey === undefined || gearRect === undefined || gear === null
          ? undefined
          : {
              fallback: gearPictureFallback(gameData, {
                gear,
                scale: 0.5,
                x: gearRect.x + 1,
                y: gearRect.y + 1,
              }),
              key: gearKey,
              rect: gearRect,
              scale: smallGear ? 1 : 0.5,
            },
      sections,
      selections,
      slot: sign === null ? undefined : { crop: HERO_CROP, sign },
      speech,
      start: {
        label: gameData.homeText.startWalk,
        loading: gameData.homeText.startLoading,
        unavailable: startUnavailable(sections),
        waitingAlpha: WAITING_ALPHA,
      },
      streetSign: gameData.homeText.gateSign,
    },
  );
  return { selections, speech, view };
}

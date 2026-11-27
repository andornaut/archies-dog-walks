// The public entry of src/home/: modules outside it import only this file.
export { bankAtLastVisit, newlyAffordable } from "./afford.ts";
export { type BadgeCardView, badgeCardView, type BurstEffect, CONFETTI } from "./badgeCardView.ts";
export {
  BADGE_CHEER,
  BADGE_POP,
  badgeGoalText,
  badgeNameTops,
  type BadgeRowNames,
  badgeRowNames,
  badgeStripFaceBottom,
  badgeStripHits,
  badgeStripRows,
  type BadgeView,
  badgeWall,
  CELEBRATION_PANEL,
  celebrationTitle,
  earnedBadges,
  panelBadgeStrip,
  stripUnderClose,
} from "./badgesView.ts";
export {
  type DetailCard,
  type DetailPicture,
  dogDetail,
  gearDetail,
  walkerDetail,
} from "./details/detail.ts";
export {
  type DetailArt,
  type DetailArtSize,
  type DetailCardView,
  detailCardView,
  type DetailMeasure,
  type DetailText,
} from "./details/detailCardView.ts";
export { type GearPictureFallback, gearPictureFallback } from "./details/gearPictureView.ts";
export { END_LAYOUT, QUIP_TEXT_ROOM } from "./endLayout.ts";
export {
  type EndMeasure,
  type EndResults,
  type EndScreenView,
  endScreenView,
} from "./endScreenView.ts";
export { closingLines, earningsBreakdown, earningsKind } from "./endView.ts";
export {
  badgePopOffset,
  bobOffset,
  FEEDBACK,
  hopOffset,
  loopFrame,
  pressDip,
  settleDelay,
  shakeOffset,
} from "./feedback.ts";
export { type Focus, moveFocus } from "./focus.ts";
export {
  dogInfo,
  gearByPrice,
  gearInfo,
  type HomeLoadout,
  partingSpeech,
  type Purchase,
  rosterRows,
  tapDog,
  tapGear,
} from "./home.ts";
export {
  homeBackAction,
  homeBarAction,
  homeBarButtonAt,
  type OverlayRegion,
  overlayRegion,
} from "./homeBar.ts";
export {
  HOME_LAYOUT,
  type HomeBarButton,
  homeBarButtons,
  slotSignText,
  tileFace,
  updateModalLayout,
  updateModalText,
} from "./homeLayout.ts";
export {
  bubbleSpeech,
  bubbleTurnLine,
  type HomeAction,
  messageLine,
  networkPlayNotice,
  noticeOrSpeech,
  packBonusLine,
  requiredNotice,
  storageNotice,
  tappedBubbleTurn,
  type WalkerLine,
  walkerLineKey,
  walkerSays,
  walkersUnlockedSince,
} from "./homeLines.ts";
export { itemModal } from "./itemModal.ts";
export { type LogbookView, logbookView } from "./logbookView.ts";
export { MENU_TEXT_FIELDS } from "./menuText.ts";
export { porchOwners } from "./porch.ts";
export { plateStripView, type PricePlateView, pricePlateView } from "./pricePlateView.ts";
export { answerPurchase, type ConfirmChoice, type PendingPurchase } from "./purchaseConfirm.ts";
export {
  homecomers,
  type ReturnPhase,
  returnPhase,
  walkUpOffset,
  waveOffset,
} from "./returnHome.ts";
export { homeSections, type Sections } from "./sections.ts";
export { homeSectionViews } from "./sectionView.ts";
export {
  homeSelectionColour,
  type HomeSelectionView,
  homeSelectionViews,
} from "./selectionView.ts";
export {
  INSTALL_STEPS_FIT,
  type InstallStepsLayout,
  installStepsLayout,
  noteRoomForControl,
  SETTINGS_NOTE_STYLE,
  SETTINGS_ROW,
  SETTINGS_SLIDER,
  SETTINGS_SWITCH_GAP,
  type SettingsFonts,
  settingsFormRows,
  settingsInstallWidth,
  type SettingsLayout,
  settingsLayout,
  type SettingsRowShape,
  setVolumeSteps,
  SWITCH_ROWS,
  SWITCH_STATE_GAP,
  switchRowHeight,
  switchStateCentre,
  VOLUME_STEPS,
  type VolumeKey,
  volumeStepForKey,
  volumeSteps,
} from "./settings.ts";
export {
  SETTING_ROWS,
  SETTINGS_ART_KEYS,
  type SettingsMeasure,
  type SettingsRow,
  settingsRows,
  type SettingsRowView,
  type SettingsTarget,
  type SettingsText,
  type SettingsView,
  settingsView,
  type SwitchKey,
} from "./settingsView.ts";
export {
  dogRows,
  gearRows,
  ownedCountNote,
  SHOP_ROW_VIEWS,
  SHOP_TABS,
  shopAffordable,
  shopOpenTab,
  type ShopRow,
  shopRowId,
  shopRowLook,
  type ShopTab,
  slotRows,
} from "./shop.ts";
export {
  SHOP_LAYOUT,
  SHOP_MESSAGE_FIT,
  shopHeadingBand,
  shopListFrame,
  shopMessageLayout,
  shopNextHeading,
  shopRowsBottom,
  shopRowTextLayout,
  shopRowTextRoom,
  shopTabRects,
} from "./shopLayout.ts";
export { type PageFill, type PageTab, type ShopPageView, shopPageView } from "./shopPageView.ts";
export { shopScreenView } from "./shopScreenView.ts";
export {
  shopFocusForArrow,
  shopTabForArrow,
  type ShopTarget,
  shopTargetAt,
} from "./shopTargets.ts";
export { type ShopPlacedRow } from "./shopTextLayout.ts";
export { slotSign, slotSignPurchase } from "./slotSign.ts";
export { type HomeSpeechView, homeSpeechView } from "./speechView.ts";
export { STATS_LAYOUT, STATS_TABS, type StatsTab, statsTabRects } from "./statsLayout.ts";
export { tapWalker } from "./walkers.ts";

# Controls

The normal-form specification for controls across the application: the Phaser game, website, data browser, developer panel, crash screen and art gallery. [`gameplay/design.md`](../gameplay/design.md) is canonical for gameplay semantics and player wording. The [style guide](style-guide.md) owns the wider art direction, and the [inventory](inventory.md) owns exported asset sizes and tags.

## Scope and exceptions

All surfaces share button roles, palette, borders, raised and pressed feedback, readable disabled states and visible keyboard focus. The Phaser game draws its controls on canvas; the website and tools retain native DOM controls and responsive layouts. Selection controls, colour swatches, switches and sliders preserve their content and semantics instead of becoming ordinary action buttons.

| Control                       | Reason for exception                                            | Rules                                                                                                                                                                                  |
| ----------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Choice cards                  | Tall illustrated choices carry art, prices and consequences     | Preserve card geometry, readable text and selection feedback; tap release chooses, a hold enlarges, and outside taps never choose                                                      |
| Hold to explain               | A still hold requests details rather than activation            | Keep hold and tap-release distinct; pause the walk for its detail card and consume the dismissing tap                                                                                  |
| Home and walk top bars        | Buttons and cash/effect wells share a 360px-wide, 40px-tall bar | Home 44×44 hits at a 44px pitch (Exit's cut to 39 at the edge); walk 34×40 hits leave rows 40–43 for interactive debuff bars; 20×20 navy faces, 16×16 glyphs, 2px press; no second row |
| Joystick                      | Not applicable: this game uses lane gestures and keys           | No joystick asset, state or input contract is defined                                                                                                                                  |
| Lane steering                 | Road input is a movement gesture, not a button                  | Immediate road taps, release-classified doghouse-row taps, lane drags and the lane keys steer; top-bar taps never steer                                                                |
| Pet shop                      | The building and its board form one bespoke control             | The whole building is the hit area, with its green board and press feedback; never a compact button                                                                                    |
| Scrolling pages               | Shop, settings and logbook lists need a bounded viewport        | Keep their page/list geometry and scrolling; ordinary panels opened inside them use the modal contract                                                                                 |
| Settings switches and sliders | A small indicator is activated through its whole labelled row   | Keep the row hit area, labels, keyboard behaviour and non-colour state cues                                                                                                            |

## Design tokens

Canvas dimensions are base game pixels; the game renders at 360×560 with pixel scaling. DOM dimensions are CSS pixels, with responsive widths. Names below identify specification tokens, not code constants.

| Name                  | Value             | Unit | Purpose                   |
| --------------------- | ----------------- | ---- | ------------------------- |
| action.primary.fill   | green `#63c74d`   | RGB  | Primary face              |
| action.primary.text   | ink `#181425`     | RGB  | Primary label             |
| action.secondary.fill | cream `#ead4aa`   | RGB  | Secondary face            |
| action.secondary.text | plum `#3e2731`    | RGB  | Secondary label           |
| disabled.fill         | ngrey `#a4a4a4`   | RGB  | Disabled text-button face |
| disabled.text         | ndslate `#4a4a4a` | RGB  | Disabled label            |
| icon.surface          | navy `#262b44`    | RGB  | Icon face                 |
| selected.border       | amber `#feae34`   | RGB  | Picked-item frame         |
| selected.fill         | yellow `#fee761`  | RGB  | Picked-item face          |

Palette names and ramps come from [`shared/palette.json`](../shared/palette.json) and [`src/ui/palette.ts`](../src/ui/palette.ts). Screen button geometry is centralized by [`buttonGeometry.ts`](../src/ui/buttonGeometry.ts); modal spacing uses `MODAL` in [`modalGeometry.ts`](../src/ui/modalGeometry.ts). Caller layouts remain in [`screenLayout.ts`](../src/layout/screenLayout.ts), [`homeLayout.ts`](../src/home/homeLayout.ts), [`endLayout.ts`](../src/home/endLayout.ts) and [`closeControl.ts`](../src/ui/closeControl.ts). Verify the affected caller when changing a shared token.

## Sizing and spacing

| Name                  | Value                   | Unit    | Purpose                                              |
| --------------------- | ----------------------- | ------- | ---------------------------------------------------- |
| button.gap            | 16                      | px      | Side-by-side standard buttons                        |
| button.gap.small      | 24                      | px      | Small buttons, in any direction                      |
| button.gap.stack      | 8                       | px      | Stacked standard buttons and list rows               |
| compact.height        | 44                      | px      | Text-button target height                            |
| compact.width         | 128                     | px      | Non-modal compact text button                        |
| dom.hit               | 44×44                   | CSS px  | Minimum native button/link target                    |
| end.button.y          | 514                     | px      | Back to title top; preserves the badge panel         |
| icon.face             | 20×20                   | px      | Navy chrome face                                     |
| icon.glyph            | 16×16                   | px      | Chrome glyph                                         |
| icon.hit              | 44×44                   | px      | Non-bar icon target                                  |
| label.help.gap        | 10                      | px      | Non-modal label/help ink gap                         |
| menu.text.scale       | 2                       | scale   | Shared TEXT_SCALE menu-label role                    |
| modal.button.height   | 44                      | px      | Modal text-button height                             |
| modal.button.width    | max(44, ceil(ink + 32)) | px      | Intrinsic width, including rendered key/icon content |
| modal.close.clearance | 8                       | px      | Gap after the full close hit                         |
| modal.close.face      | 20×20                   | px      | Existing navy close face                             |
| modal.close.hit       | 44×44                   | px      | Existing close target, inside panel top/right        |
| modal.close.inset     | 6                       | px      | Visible face inset from panel top/right              |
| modal.gap.groups      | 8                       | px      | Gap between present header/body/action groups        |
| modal.gap.rows        | 4                       | px      | Gap between text rows                                |
| modal.margin          | 16                      | px      | Panel clearance inside the usable overlay region     |
| modal.min.width       | 0.5 × viewport width    | px      | Half the logical viewport; clamp to safe width       |
| modal.padding         | 16                      | px      | Content padding; close control uses its own inset    |
| press.offset          | 2                       | px      | Face, glyph and label depression                     |
| start.button          | 32,514,296,44           | x,y,w,h | Inset Start walk                                     |
| tab.face.height       | 28                      | px      | Shop and Logbook tab face; a small button            |
| topbar.home.hit       | 44×44; Exit 39×44       | px      | One pitch wide; Exit's cut at the screen edge        |
| topbar.home.pitch     | 44                      | px      | Start-screen top-bar face pitch, from x = 157        |
| topbar.home.well      | ≤ 136                   | px      | Start-screen bank well width                         |
| topbar.walk.hit       | 34×40                   | px      | Leaves rows 40–43 for interactive debuff bars        |
| wide.height           | 44                      | px      | Wide text-button height                              |
| wide.width            | 296                     | px      | Non-modal wide text button                           |

Use the wide token for a screen's main text action and the compact token for secondary or paired text actions outside content-sized modals. Content-sized modal buttons instead use the intrinsic-width contract below. Every button group follows the button gaps below. DOM controls keep responsive widths and a minimum 44px target while sharing the role colours, border/lip and 2px depression. Preserve the same text size; grow the available room, wrap where the role allows, or change wording in the text data when necessary.

**Button gaps.** Gaps are measured between neighbouring faces, in game pixels. They come from game-kit's `ui/spacing` through `BUTTON_SIZE` in [`layout.ts`](../src/data/layout.ts), so every game spaces its buttons alike. Wide, compact (128×44) and content-sized modal buttons are standard; a smaller face is a small button.

| Arrangement            | Gap | Token                  | Applies to                                                                                 |
| ---------------------- | --- | ---------------------- | ------------------------------------------------------------------------------------------ |
| Side by side, standard | 16  | `BUTTON_SIZE.gap`      | Pairs and modal action rows                                                                |
| Small, any direction   | 24  | `BUTTON_SIZE.smallGap` | Help's page dots over Previous and Next, Shop and Logbook tabs, start-screen top-bar faces |
| Stacked, standard      | 8   | `BUTTON_SIZE.stackGap` | Full-width list rows (badge wall, Pet shop, settings), stacked buttons and tile grids      |

- **Logbook rows:** the earned band stays inside its row's bounds.
- **Settings rows:** list rows, 8px apart, with each 1px separator 3 rows into its gap and 4 rows above the next row; the panel is 424px tall at y = 68.
- **Shop and Logbook tabs:** 28px-tall faces, so small buttons: 24px apart, each face narrowed so the row keeps its span.
- **Start-screen top bar:** icon faces at a 44px pitch from x = 157, 24px apart, each in a 44×44 hit (Exit's cut to 39 at the screen edge); the bank well is at most 136px wide. From $1,000,000 the bank, in `font-title`, takes the rulebook's [short form](../gameplay/design.md#home-screen-and-progression).
- **Tile grids:** the start screen's walker, dog and gear tiles are 8px apart both ways. Dog and Pocket tiles sit 1px inside their cells, so those cells are 6px apart.

Exemptions:

- **Choice cards:** 6px apart; each card is a large press target, and three must stay in view.
- **End-screen badge strip:** badges 16px apart in 48px-wide press columns; seven badges must stay in view.
- **Walk bar:** effect wells 2px apart and faces 14px apart; a 360px bar has no room for wider gaps.

**Canvas modal sizing.** Measure actual header, body and action ink at full size, including rendered key-number prefixes, icons, wells and required illustrations. The width comes from game-kit's `MODAL_CONTENT`, with `minWidthFraction: 0.5` and `padding: 16`. `modalWidth({ availableWidth, viewportWidth }, contentWidth)` takes unpadded content ink and returns `min(availableWidth, max(contentWidth + 32, viewportWidth * 0.5))`. `viewportWidth` is the full logical viewport width; `availableWidth` excludes the 16px margin on each side. On the 360px Archie viewport, the minimum is 180px, derived from 360px rather than the 328px safe width. The width floor yields to a narrower safe viewport; height remains content-driven, with no fixed minimum height. Modal buttons retain intrinsic widths rather than screen-wide/compact width floors. Wrap within the safe panel content room and remeasure. Keep full-size fonts, normally 2×, and readable complete labels.

**Modal placement.** Start the ordinary modal's top at `(560 - H) / 2`, where `H` is its measured full-size height, then use `rectAboveIn` to clamp the panel to its caller region inset by 16px. This targets the full viewport's midpoint, y = 280, not the remaining road region. Actor avoidance moves a modal horizontally only.

| Caller region                               | Safe vertical interval |
| ------------------------------------------- | ---------------------- |
| Walk overlays                               | y ≥ 56, bottom ≤ 466   |
| Home overlays                               | y ≥ 56, bottom ≤ 544   |
| Full-viewport settings, install and details | y ≥ 16, bottom ≤ 544   |

Clamping can move the final centre: a 400px-high walk modal clamps to y = 66, bottom = 466, without shrinking. Update, Quit, purchase, badge, item and grouped-detail modals follow this contract. Full-scene celebrations and results, Shop/Logbook/Help pages and illustrated choice cards keep their own geometry.

**Notice priority.** Gameplay notices stay beneath all overlay scenes and scrims. The message strip is in `HudScene` at `HUD_DEPTH.message - 1`, not in the active pause, settings or card scene, and keeps its paused age and enlarged-card hiding.

Use `modal.gap.rows` between text rows and `modal.gap.groups` between present header/body/action groups. Omit missing groups and their gaps. Each action group uses one horizontal row or one vertical column, never a mixed layout. Neighbouring buttons in a row use `button.gap` and stacked buttons `button.gap.stack`; if the complete row does not fit, stack the whole group without changing order, keyboard choices or roles. Each modal action has the 44px control height and full-size font. Its intrinsic width is `max(44, ceil(ink + 32))`: complete rendered label ink plus 16px on each side, rounded up, with a 44px minimum target. In a vertical group, every button takes the largest intrinsic width in that group.

**Shop and Logbook pages.** Both pages share `SHOP_LAYOUT` and `shopTabRects` in [`shopLayout.ts`](../src/home/shopLayout.ts). Their close hit is `(312,44,44,44)`. Tab hits begin at `y = 92`, 4px below the close hit, and their 28px-tall faces begin at `y = 100`. The Shop's two tabs and the Logbook's three span x = 16–344, their faces `button.gap.small` apart: Shop faces 152 and 152 wide, Logbook faces 93, 94 and 93. The hits meet halfway across each gap, so Shop hits are 164 and 164 wide and Logbook hits 105, 118 and 105. The scrolling list begins at `y = 137` and ends at `y = 548`. These full-screen pages keep their bespoke close geometry.

**Top-right modal close.** Ordinary modals, including update notices, place the 20×20 close face at `(x + w - 26, y + 6)` inside panel `(x,y,w,h)`. The 44×44 hit sits wholly inside the panel at `(x + w - 44, y)`. Keep the entire hit rectangle clear of title ink and interactive content. Centre the title across the whole panel, with its capital ink top at `y + 16`. With a close control, reserve 52px on both sides (44px hit plus 8px gap), so the intrinsic title width is `titleInkWidth + 104`. Without a close control, reserve 16px symmetrically. Keep `font-title` at 2× and the panel width between 180px and the 328px safe maximum on the 360px viewport. Word-wrap titles exceeding the 224px maximum title room with a close control; measure every resulting line. Each extra line adds 24px to the header, body start and panel height. A single-line title puts the first body or action row at `y + 52`. The Android title has 240px ink and wraps onto two lines; the update notice is 274px wide at `x = 43`. Body padding and viewport margin are 16px. Omit absent title or close content and its associated gap. Bespoke full-screen pages and top bars keep their own close geometry.

The full-size scrim and tap guard are separate from the content-sized visible panel. Modal palette snapshots use three hops; direct ink modal overlays and snapshot fallback use fill alpha 0.72. Hide the fallback after a successful snapshot; do not add a layer or multiply object alpha. Non-modal ambient dimming uses two hops and generic `addDim` alpha 0.6. Native DOM modals follow the same sizing principles in CSS pixels, keeping native semantics and responsive wrapping. Illustrated choice controls keep their bespoke geometry: three 112px cards with two 6px gaps occupy 348px, so adding 16px outer padding would require 380px on a 360px canvas. Never shrink or rearrange them. Bounded scrolling pages keep their viewport/list geometry; ordinary confirmations and detail panels opened inside them follow this modal contract.

Start walk has 32px side margins, 2px above and 2px below. The contiguous picker sections and Start walk form one group, directly under the divider strip above and with 2px below. Clamp Start walk's focus outset to the available 2px at the bottom. Back to title keeps `end.button.y` and its bob. Icon artwork stays centred in its target. The visible icon face and the hit target are separate rectangles.

The start-screen section outline is one plum pixel. `ui-section`'s nine-slice caps are left/right 3px, top 24px and bottom 3px. Section backing fills to a 1px inset, with solid backing and distinct neutral headings:

| Section | Backing                    | Neutral heading              | Neutral title | Neutral note |
| ------- | -------------------------- | ---------------------------- | ------------- | ------------ |
| Dogs    | pickerDogsBody `#51497c`   | pickerDogsHeader `#7166aa`   | white         | white        |
| Pocket  | pickerPocketBody `#743d58` | pickerPocketHeader `#9f567a` | white         | white        |
| Walker  | pickerWalkerBody `#0a5977` | pickerWalkerHeader `#127ca3` | white         | white        |

A section with an actual selection uses an amber header (`#feae34`) with ink title/note and `pickerSelectedBody` (`#bb7f23`) for its backing. Derive that body as `encode_sRGB(0.5 × decode_sRGB(amber))`, with nearest-byte rounding. Unselected sections keep their matching neutral header/body pairs. An empty optional Pocket stays neutral pink; selecting gear gives it the amber pair. Neutral headings share OKLCH lightness 0.55 and chroma 0.105 before nearest-byte sRGB rounding, at hues 230° (Walker), 290° (Dogs) and 350° (Pocket). Each body halves its encoded header's linear RGB before re-encoding and byte rounding. Titles and notes keep their full 2× role: white contrast is 4.73:1 on Walker, 5.02:1 on Dogs and 5.14:1 on Pocket. Dogs show their count even while empty. The empty Pocket shows its empty note, and is optional; Start walk requires a walker and at least one dog. Individual item cards keep their detailed borders and checkmarks. Ground outside them stays clean, without fabric, stitching or extra selected-dog lines.

**Section-content padding.** `HOME_LAYOUT.sectionContentPadding = 4` in [`homeLayout.ts`](../src/home/homeLayout.ts) is a minimum measured from actual card edges in neutral and complete states. Centre the card grids at x = 180 with whole-pixel rounding: the Walker card span is x = 14–346, Dogs x = 18–343 and Pocket x = 19–341, a half pixel rounding right. Inside the section fill at x = 7–353, their left/right card-edge gaps are 7/7px, 11/10px and 12/12px respectively. Checkmark and lock-badge overhang keep the separate `HOME_LAYOUT.sectionBadgeGutter = 1` non-touch gutter; do not add badge overhang to the grid origin or reserve asymmetric left padding. Preserve card, font and hit sizes. `HOME_LAYOUT.heroSectionGap = 0` puts the Walker section on row 161, directly under the divider strip on rows 158–160, and the yard art draws 6 rows higher. Home-only loading and walk-wait progress lies across the yard's foot at `HOME_LAYOUT.loadingProgress`, `(0,153,360,4)`: its top `GATE_BAR.y - HOME.loadingClear - 4`, leaving row 157 clear (`HOME.loadingClear = 1`) above the strip; hide it when idle. DOM startup, Boot and run progress use the bottom strip. Sections are 348px wide at x = 6, with no gap: Walker y = 161, height 85; Dogs y = 246, height 183; Pocket y = 429, height 83. Start walk is `(32,514,296,44)`.

**Results and earned badges.** Finished-walk, out-of-dogs and early-return summaries share a preferred panel top of `y = 126`, clamped to fit their actual measured summary and badge-strip heights above `y = 511`. Translate all summary children and the new-best ribbon together. Centre the whole badge strip vertically between the actual summary bottom and `y = 511`, keeping the 3px clearance before Back to title at `y = 514`. A 289px summary with a 100px two-row badge strip clamps the summary top to `y = 122`; a 307px development summary with a 92px strip stays at `y = 112`. Use measured heights, not a nominal panel height, and never shrink targets. This result-page placement is separate from ordinary modal and full-scene celebration geometry.

## Button roles and states

Role and state are independent. Primary is a role, pressed is a transient state, and selected belongs to selection controls. The code's `normal` button look renders as the secondary cream role.

The table records the canvas primitives. DOM controls use the same role palette and state feedback.

| Role/state         | Fill  | Label/icon                            | Border and highlight              | Geometry                         |
| ------------------ | ----- | ------------------------------------- | --------------------------------- | -------------------------------- |
| Primary/Normal     | green | ink                                   | ink outline, forest lip           | Screen token or intrinsic modal  |
| Primary/Pressed    | green | ink                                   | Same outline; face sinks into lip | Same target; `press.offset`      |
| Primary/Disabled   | ngrey | ndslate                               | ink outline; flat, no lip         | Same target; fixed pressed depth |
| Secondary/Normal   | cream | plum                                  | ink outline, tan lip              | Screen token or intrinsic modal  |
| Secondary/Pressed  | cream | plum                                  | Same outline; face sinks into lip | Same target; `press.offset`      |
| Secondary/Disabled | ngrey | ndslate                               | ink outline; flat, no lip         | Same target; fixed pressed depth |
| Icon/Normal        | navy  | cream/tan or the asset's action glyph | tan rim, brown lip                | Icon face/glyph/hit tokens       |
| Icon/Pressed       | navy  | Same glyph                            | Same rim; face sinks into lip     | Same target; `press.offset`      |

Icon buttons have no disabled state: `ui-icon-button` has no disabled tag. Text-button chrome and disabled rendering are in [`selection.ts`](../src/ui/selection.ts) and [`uiKit.ts`](../src/scenes/uiKit.ts). One primary action identifies the main next step. The update notice is modal, so it adds no second green action beside Start walk.

On the website homepage, Install is the secondary action on the left and Play is the primary action on the right. Centre Play when Install is hidden. Both use the game's button styles and sizes.

## Labels and icons

Use `font-title` for ordinary canvas buttons, modal/section headings and numbers, and `font-body` for body/help text. Display headings use the distinct roles in the typography table. Ink heights include outline and shadow where present; capital ink measures the letters themselves. [`textFit.ts`](../src/ui/textFit.ts) fixes role scales: never shrink a label to fit. DOM controls keep their own readable fonts and native labels. Keep the label/help ink gap, centre an action label on its face, and move the label with the pressed face.

The authoritative [typography table](style-guide.md#typography) defines every canvas font role, weight, logical size, visible ink and line height, including the distinct full-scene, compact metadata and baked-ribbon exceptions. Keep those sizes when applying the geometry below.

The hero title stays centred at x = 180, within 328px of measured ink width, and wraps at word boundaries at its fixed 3× scale. Reserve the two-line block from ink y = 44 to 136, with line tops at 44 and 94 and 8px of clear ink gap. The 1× subtitle starts at ink y = 146, 10px below the title block. Centre measured ink rather than font advance padding. Other title roles keep their listed sizes and layouts; a three-line hero title requires more vertical room rather than smaller text.

All player-facing strings, including names, labels, prices, goals, unavailable reasons and explanations, come from the text data in [`src/data/`](../src/data/). Follow the rulebook's [Voice](../gameplay/design.md#voice): Canadian spelling and one consistent name and label per thing. Reword the data consistently or grow the box; never shrink text or use a local shortened alias.

A chrome glyph sits at +2,+1 inside `ui-icon-button`, or +2,+3 while pressed. Settings, Exit and Home keep their shapes (style guide, Icon buttons and top bars). Content icons use their outlined art; chrome glyphs use their flat cream/tan palette. A gear item keeps its colours at every exported size.

Disabled pictures use the neutral-grey copy and nslate art box. An affordable, unowned item keeps its full-colour picture on nlgrey, with a bill and buy plate. A short item uses a padlock and short-price plate; a goal-locked walker uses the goal plate. Labels, badges and plate shapes supplement colour. A selected picture uses its deepAmber box; unselected owned pictures use tan.

Unavailable controls keep their readable price, goal or reason and their feedback. A full pack reports that it is full; a goal-locked walker shakes and explains its goal; an unowned item keeps its shop action; an incomplete Start walk keeps its missing-choice feedback. A grey face does not erase these distinctions or make every unavailable tile inert.

**Refused canvas controls.** An attempted disabled Help Previous, refused Start walk or home pick, unavailable card choice, or muted volume slider keeps its disabled chrome and its price, goal or reason. Use the shared rejection cue in [`refuseControl.ts`](../src/scenes/refuseControl.ts): 320ms total, a 3px horizontal shake and label tint alternating red/restored at 80ms intervals. Reduced motion uses a steady red label for 320ms without shaking, then restores its prior tint. Refusal does not activate the unavailable action or change its value, its explanation, the keyboard/default choices or the tap guards. Grey actionable shop rows keep their shop/detail actions. Native developer DOM controls keep their native disabled semantics and are outside this canvas cue.

## Selection controls

The game controls below are canvas controls. Checkbox-like and radio-like describe their game semantics; they are not native HTML widgets. DOM surfaces use native buttons, checkboxes, radios and sliders, including their keyboard behaviour and accessible state. A filter's selected state does not turn it into a primary action; palette swatches keep their actual colour samples.

| Control                                    | Value semantics                                                                             | States                                                                              | Drawn size                          | Label and placement                                        | Press area                              | Keyboard                                                             |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------- | --------------------------------------- | -------------------------------------------------------------------- |
| Dog tile, checkbox-like                    | Multiple owned dogs up to pack capacity; tap a picked dog to remove it; one-slot packs swap | Normal, selected, disabled; bill/lock/goal availability is separate; no mixed state | `ui-tile` nine-slice, face and name | Dog name; price where unowned                              | 105×44 grid cell                        | Arrows move focus; Enter/Space activates                             |
| Pocket tile, optional exclusive selection  | Zero or one owned item; selecting another replaces it; selecting it again clears it         | Normal, selected, disabled; no mixed state                                          | `ui-tile` with the gear icon        | Section note names the chosen item or shows the empty note | 60×44 grid cell                         | Arrows move focus; Enter/Space activates                             |
| Walker tile, clearable exclusive selection | Zero or one owned walker; a second activation clears it; empty prevents starting            | Normal, selected, disabled/goal-locked                                              | Portrait/perk tile                  | Walker name and locked goal                                | 77×44 grid cell                         | Arrows move focus; Enter/Space activates; arrows alone do not select |
| Settings switch                            | Sound and reduced motion change and save immediately                                        | On/off with knob side plus tick/cross; no mixed or generic disabled switch tag      | 32×16 `ui-switch`                   | Whole row includes title, note and matching on/off icon    | Whole measured settings row, 328px wide | Up/Down focuses row; Enter/Space toggles                             |

Walkers, dogs and Pocket items share the same pick toggle: activating a picked item again clears it. The Pocket is optional; a walker and at least one dog are required to start. Keep picked, available, for-sale, goal-locked and pack-full states plainly distinct through the picture, readable label/plate, badge and feedback. The picked state uses both a gold frame and a checkmark, so selection never relies on colour alone.

The switch's `on` tag means sound is enabled for the sound row and reduced motion is enabled for the motion row. Volume controls are sliders, not switches: drag the row, or use Left/Right, Home and End while focused; muted sliders are disabled.

Gold frame/face and `ui-check` identify picked items. The runtime selection treatment adds one continuously clockwise travelling border segment over the yellow face, gold frame, selected lift and check badge. Use `ui-tile`'s `selected-static` face as the base; generic select frames use their static gold/ink geometry. Content and checkmarks draw above the moving border. Selected tabs remain a separate static role: their `ui-select` holds its first frame, with its lift and no check badge. Keep the ground outside individual item cards clear. A pack-full tile and an unowned tile can share a grey face while retaining different actions: an unowned item can open the shop, while a full pack requires a dog to be removed first.

The active shop row has `ui-shop-focus`'s static 3px cyan band between 1px ink keylines, at a 3px outset, with the same clockwise runtime segment. Focus stays distinct from ownership and affordability, and from the row's lock, grey appearance, price and unavailable feedback.

**Clockwise border travel.** Selected tiles, generic select frames and shop focus share one runtime helper. A segment makes a 2400ms clockwise lap along the top, right, bottom and left, wrapping continuously without reversing, blinking or pulsing the face. For actual drawn width `W` and height `H`, use the inset-1px outer-band track with perimeter `P = 2 * ((W - 3) + (H - 3))`, position `(elapsedSceneMs % 2400) / 2400 * P` and segment length `clamp(round(0.22 * P), 32, 80)` pixels. The interval stays connected across corners and the loop seam. Selected rings use a 2px cream stroke inward, with the leading half white across both pixels; shop focus uses a 3px cream stroke and a 1px white middle core in its leading half. Clip to the coloured band, keeping both ink keylines, cut corners, face, footprint, outsets, padding, hit sizes and lift. Static bases contain no alternating side glints or corner marks behind the travelling segment. Reduced motion shows a strong static gold face/frame/check or static cyan focus, without travel or residual alternating motion. One shared update owner derives travel from scene time and releases its listener/graphics with the control; do not create per-position tweens, textures or nine-slices. Unrelated looping art keeps its own animation contract.

Source contracts: [`interaction.ts`](../src/ui/interaction.ts), [`home.ts`](../src/home/home.ts), [`walkers.ts`](../src/home/walkers.ts), [`sections.ts`](../src/home/sections.ts) and [`SettingsScene.ts`](../src/scenes/SettingsScene.ts).

## Interaction and accessibility

- Show press feedback at once: `fx-tap` bursts under the finger. A modal opened by the press opens immediately, and the burst finishes on top of it. Text and chrome move together, and a cancelled press does not activate its former target.
- Keep keyboard focus distinct from selection. Start-screen arrow keys move the visible focus ring; Enter or Space activates. Settings use the row focus described above. These are custom canvas handlers, not a native Tab sequence.
- Escape or P closes the current overlay/pause level; M toggles sound. Context-specific shortcuts and browser-back behaviour are in [`keyBindings.ts`](../src/input/keyBindings.ts).
- UI tap actions activate on release over the matching target. A recognized hold opens details or enlarges a card, and its release must not also toggle or choose. Do not require hover for information; preserve the bespoke steering exception above.
- Modals guard taps. A tap that dismisses a panel is consumed: it must not select, buy, steer or activate content underneath. The top bar keeps only its deliberate actions under the rulebook's panel conventions. Choice cards wait for an explicit choice; outside taps do nothing.
- In confirmations, key 1 keeps the walk going or keeps playing, as the rulebook defines; it must not become the destructive alternative. This does not turn choice-card key 1 into an automatic or default choice.
- Essential labels hold 4.5:1 contrast, or 3:1 at 2× and larger; essential icons hold 3:1. Inactive controls are exempt. State also uses text, glyphs, shape or position.
- Reduced motion preserves visible selection and readable static feedback while skipping movement. Sound is supplementary; it cannot be the sole action/state cue.
- Physical-impact jolts follow the [run-screen feedback contract](style-guide.md#run-screen). Move only the rendered road/backdrop; keep HUD, borders, viewport masks, input targets and logical coordinates fixed. Reduced motion uses one static border/tint cue without displacement or repeated flashing.

The game shell supplies an accessible game label and control instructions. Individual canvas buttons, tiles and switches do not expose native DOM roles, checked state, indeterminate state or per-control ARIA semantics. Keyboard support does not imply those capabilities are implemented.

DOM buttons keep native Tab and Enter/Space behaviour, visible focus, meaningful labels, `disabled` where unavailable and `aria-pressed` where they toggle selection. Disabled labels remain readable instead of fading the whole control.

## Asset and code contract

| Asset                   | Role/state tags                                                                                      | Contract                                                                                                                              |
| ----------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `ui-afford`             | `glint`                                                                                              | Draw 2px outside the Pet shop building only; no item tile or shop row uses it                                                         |
| `ui-button`             | `go`, `go-pressed`, `go-disabled`; `secondary`, `secondary-pressed`; `normal`, `pressed`, `disabled` | 24×24 nine-slice; 3px top/sides, 5px bottom; secondary aliases normal chrome                                                          |
| `ui-check`, `ui-select` | `ui-check` `1`, `2`, `3`, `tick`; `ui-select` `pulse` has two 180ms frames, 24×24 with 8px caps      | Runtime selected-frame travel uses the shared 2400ms helper over a static gold/ink base; tabs remain static                           |
| `ui-icon-button`        | `normal`, `pressed`                                                                                  | Icon face token; the glyph is a separate image                                                                                        |
| `ui-pet-shop`           | `normal` 0, `pressed` 1, `door-wave` 2–17                                                            | The Start screen plays `door-wave` once every 7000ms; reduced motion holds `normal` frame 0                                           |
| `ui-pet-shop-board`     | `normal` 0, `pressed` 1                                                                              | Drawn over `ui-pet-shop` at offset 3,0; bobs 1px up on alternate 600ms beats as Start walk, not while pressed or under reduced motion |
| `ui-section`            | `complete` 0, `neutral` 1, `neutral-walker` 2, `neutral-dogs` 3, `neutral-pocket` 4                  | 24×32; one still frame per tag, 1000ms; fallback `neutral` uses dog violet                                                            |
| `ui-shop-focus`         | Exported `pulse`: two 180ms frames; 32×32 nine-slice with 13px caps on every side                    | Runtime focus uses the shared 2400ms travel over a static cyan/ink base; 3px outset; reduced motion shows static focus                |
| `ui-switch`             | `on`, `off`                                                                                          | 32×16, with the knob's side and a tick or cross                                                                                       |

The `ui-section` exports and `HOME_LAYOUT.sectionLooks` use the same section tags and colours. `ui-cork`, `ui-plaid` and `ui-denim` are the solid section fills (`HOME_LAYOUT.sectionFillKeys`), with no fabric or stitch texture. The start-screen backdrop is a native skyless courtyard on the art's rows 40–163, drawn at `(0,-6)` (`HOME_LAYOUT.backdropY`) without scaling it, so its divider lands on the divider strip and the top bar covers its top 6 courtyard rows. Continuous capped masonry, a low planter and quiet paving keep the centre clear behind dialogue and the pack. On screen, the courtyard shows on rows 40–157, quiet ground occupies rows 158–159, the continuous plum divider is on row 160 and flat dbrown continues below it. The shop target `(234,48,120,108)`, street-name anchor `(320,37)`, speech bubble top `y = 40` and actor feet on row 157 (anchor 158) stay aligned with the art.

Edit generators in [`art/tools/ui.ts`](tools/ui.ts) and [`art/tools/screens.ts`](tools/screens.ts), then regenerate their owned exports. [`uiKit.ts`](../src/scenes/uiKit.ts) maps roles to art tags and supplies matching code fallbacks; `BUTTON_SIZE` in [`layout.ts`](../src/data/layout.ts) owns common sizing, gaps and press offsets, re-exported by [`buttonGeometry.ts`](../src/ui/buttonGeometry.ts). [`pauseMenu.ts`](../src/hud/pauseMenu.ts) and [`purchaseConfirmLayout.ts`](../src/home/purchaseConfirmLayout.ts) are button-layout callers. Layout, hit areas and input belong to their source owners; player wording lives in the text data. Do not bake control text into art, or add a special button shape for a single caller without an exception in the scope table.

Canvas modal spacing uses `MODAL` (`pad` and `margin` 16px, `rowGap` 4px, `gap` 8px) in [`modalGeometry.ts`](../src/ui/modalGeometry.ts), from `MODAL_SPACING` in [`layout.ts`](../src/data/layout.ts); modal action buttons take the button gaps. [`modalLayout.ts`](../src/home/modalLayout.ts) supplies pure placement, `modalActionWidth` and `modalTitleWidth`; [`modalMeasure.ts`](../src/scenes/modalMeasure.ts) measures actual glyph ink at its font role. [`closeControl.ts`](../src/ui/closeControl.ts) and [`barTitle.ts`](../src/ui/barTitle.ts) apply close/title placement. Canvas callers include [`homeLayout.ts`](../src/home/homeLayout.ts), [`homePanels.ts`](../src/scenes/homePanels.ts), [`pauseMenu.ts`](../src/hud/pauseMenu.ts), [`purchaseConfirmLayout.ts`](../src/home/purchaseConfirmLayout.ts), [`settings.ts`](../src/home/settings.ts), [`statsLayout.ts`](../src/home/statsLayout.ts) and [`CelebrationScene.ts`](../src/scenes/CelebrationScene.ts). The website's native install dialog has separate responsive sizing in [`index.html`](../pages/index.html); verify each other DOM caller on its own. Modals use the `ui-detail-card`, `ui-panel`, `ui-button` and close art.

The native DOM crash screen follows the shared game palette and button chrome, with the [style guide's crash-screen treatment](style-guide.md#ui). Its panel has 16px padding and a 360px maximum width clamped to the safe available width; the primary reload button is 296×44, clamped when needed. Centre the portrait above the heading with a 16px gap, with a 16px title/body gap. Local Tiny5 body text is 24px; the capitalized heading and button use local Silkscreen at 16px. Its static sad Archie portrait reuses frame 2 (`upset`) of `sprites/face-dog-archie.png`: a 32×32 crop displayed at 96×96 using a 288×96 CSS background at `-192px 0` with `image-rendering: pixelated`. Resolve the sheet through `artFileUrl(BASE_URL, artFiles, ...)` without a Phaser dependency. It keeps diagnostic and reload behaviour, content-security-policy restrictions and offline handling.

The [art gallery](../public/art/index.html) applies the same secondary chrome to its filters, animation tags, copy buttons and action-styled navigation links. Selected filters and tags keep a yellow face, amber inner frame and checkmark. Palette samples and chosen viewing grounds keep their actual colours. DOM styles preserve native button/link semantics and responsive layout; they do not substitute canvas event handlers.

## Review checklist

- Check the control's role, semantic state and availability separately, including its readable price, goal or unavailable reason.
- Use a geometry token from this guide or document a concrete exception; verify non-overlapping hit areas. For modals, check the measured content union, consistent padding, absent groups, close-hit clearance and viewport fit with the minimum of half the full logical viewport width clamped to the safe available width.
- Check text at its full role size, including the longest label and the disabled state; verify canonical player wording and Canadian spelling in the text data.
- Check normal, pressed, disabled, selected and keyboard-focus feedback where each is implemented; do not invent absent states. Verify gold frame plus checkmark and the shared pick-again-to-clear behaviour.
- Check tap release, hold/detail separation, consumed modal dismissals and safe continuation defaults.
- Check the same control by touch/pointer, keyboard and reduced motion; test only the changed behaviour locally, with the combined gate owned by the release process.
- Use judgement for routine art within the requested scope, with contextual review where useful; obtain explicit user approval only for controversial art changes.
- Keep generator output, code fallback, source layout and this guide in step.

## Out of scope

Native per-control accessibility semantics for canvas controls and further canvas selection states are outside this contract; adding one needs a decision first.

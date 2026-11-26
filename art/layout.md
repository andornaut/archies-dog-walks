# Layout

Geometry and alignment for Archie's Dog Walks. [Controls](controls.md) remains canonical for interaction, selection, accessibility and control states; the [style guide](style-guide.md) owns colour, typography and illustration.

Each table's Source names the implementation or committed layout export that defines the value. Token names describe the contract; they are not runtime exports.

## Coordinates and scale

Use logical game pixels for canvas layout and CSS pixels for native DOM surfaces. Rectangles are `(x,y,width,height)`, with right and bottom edges exclusive. Centre measured visible ink and actual card edges rather than font advance padding or badge overhang. Round final canvas placement to whole logical pixels.

| Token          | Value                                             | Unit   | Scope                 | Source                                 |
| -------------- | ------------------------------------------------- | ------ | --------------------- | -------------------------------------- |
| screen.logical | 360×560                                           | px     | Canvas viewport       | [screen config](../src/data/screen.ts) |
| screen.centre  | 180,280                                           | x,y px | Full logical viewport | Derived from `screen.logical`          |
| screen.fit     | Fit, top aligned, horizontally centred, pixelated | scale  | Browser canvas        | [Phaser setup](../src/main.ts)         |

Browser safe-area handling belongs to the [page shell](../src/main.css). A CSS/device pixel is not automatically one logical game pixel.

## Spacing tokens

Use 4/8/16 for the ordinary row/group/panel spacing roles, and the button gaps for neighbouring button faces. Named exceptions keep their own gaps; do not round every gap to this sequence.

| Token                             | Value                             | Unit       | Scope                                                                  | Source                                                                                  |
| --------------------------------- | --------------------------------- | ---------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| body.pitch                        | 18                                | px         | Every independently placed 2× body line                                | [stats layout](../src/home/statsLayout.ts) and [help layout](../src/help/helpLayout.ts) |
| BUTTON_SIZE.gap                   | 16                                | px         | Side-by-side standard buttons, modal actions included                  | [layout data](../src/data/layout.ts)                                                    |
| BUTTON_SIZE.smallGap              | 24                                | px         | Small buttons, in any direction                                        | [layout data](../src/data/layout.ts)                                                    |
| BUTTON_SIZE.stackGap              | 8                                 | px         | Stacked standard buttons, list rows and tile grids                     | [layout data](../src/data/layout.ts)                                                    |
| CHECK_SIZE                        | 16                                | px         | The Logbook tick, the Pet shop OWNED tick and the picker plus fallback | [layout data](../src/data/layout.ts)                                                    |
| FACE_SIZE                         | 32                                | px         | Dog and owner faces                                                    | [layout data](../src/data/layout.ts)                                                    |
| GEAR_ICON                         | 32                                | px         | The Pocket icon and the gear picture                                   | [layout data](../src/data/layout.ts)                                                    |
| HOME_LAYOUT.sectionContentPadding | 4                                 | px minimum | Measured home card-edge clearance                                      | [home layout](../src/home/homeLayout.ts)                                                |
| HOME_SCREEN.speech.rim            | left 2, right 3                   | px         | Speech bubble rim rows the text centres between                        | [layout data](../src/data/layout.ts)                                                    |
| ICON_LABEL_GAP                    | 4                                 | px         | A 16px icon's art cell to its label's first ink column                 | [layout data](../src/data/layout.ts)                                                    |
| label.value.gap                   | 8                                 | px minimum | Clear ink between a label and its value or note on one line            | [shop layout](../src/home/shopLayout.ts) and [stats layout](../src/home/statsLayout.ts) |
| LOCK_BADGE_OFFSET                 | dx -2, dy -3                      | px         | The lock badge on Dog, Walker and Pocket tiles and Pet shop rows       | [layout data](../src/data/layout.ts)                                                    |
| MODAL.gap                         | 8                                 | px         | Present groups; the gap above every modal footer                       | [modal tokens](../src/ui/modalGeometry.ts)                                              |
| MODAL.pad / MODAL.margin          | 16                                | px         | Panel content / caller's protected area                                | [modal tokens](../src/ui/modalGeometry.ts)                                              |
| MODAL.rowGap                      | 4                                 | px         | Text rows                                                              | [modal tokens](../src/ui/modalGeometry.ts)                                              |
| MOMENT_PARTS.firing.faceScale     | 2                                 | scale      | The fired owner face                                                   | [layout data](../src/data/layout.ts)                                                    |
| OWNER_CARD_FACE                   | 20                                | px         | Owner lead, inline faces and the placeholder face                      | [layout data](../src/data/layout.ts)                                                    |
| PAGE.rowTextGap                   | 8                                 | px         | A page row's art box to its text                                       | [layout data](../src/data/layout.ts)                                                    |
| PAGE.trackGap                     | 6                                 | px         | Page rows and body lines to the scrollbar track                        | [layout data](../src/data/layout.ts)                                                    |
| separator                         | 1px line, 8 clear above and below | px         | Every content separator, full content width                            | [separator](../src/ui/separator.ts)                                                     |

**Separators.** Every content separator (Settings rows, the Cheats dividers, the Cheats section divider included, and the detail card) is one 1px line across the full content width with 8 clear rows to the boxes above and below, a 17-row band. On the Settings and Cheats pages that width is x = 8–338. A section break that must read stronger needs its own named pattern, not a second spacing. Its colour is in the [style guide](style-guide.md#ui).

The [button gaps](controls.md#sizing-and-spacing) define which buttons are small, give the tile-grid rule and list the named exemptions. Omit absent groups and their gaps. Keep the full font role; wrap text or grow its measured container rather than reducing its scale. Detailed ink gaps remain in [Controls](controls.md#labels-and-icons).

## Page bounds/alignment

Choose one content rectangle for each page. Derive its outer margins, button edges and statistics label/value columns from that rectangle and its inset. Reserve scrollbar and close-control space before deriving those columns. The scrollbar's room is always reserved: rows, notes and values end at x = 338, 6 short of the track at x = 344–351, on every page whether or not a scrollbar shows, so switching tabs or a list starting to scroll never reflows a row. Section headings on the Pet shop and Logbook pages start their ink at x = 8, the rows' left edge, on every tab; their notes stay right-aligned to the rows' right edge. Do not independently offset a button or statistic to make it appear aligned.

| Token             | Value                                        | Unit           | Scope                                                                  | Source                                     |
| ----------------- | -------------------------------------------- | -------------- | ---------------------------------------------------------------------- | ------------------------------------------ |
| SHOP_LAYOUT.panel | 0,40,360,520                                 | x,y,w,h px     | Shop/Logbook page under the top bar, cream, no frame                   | [shop layout](../src/home/shopLayout.ts)   |
| SHOP_LAYOUT.row.x | 8; width 330, ending at x = 338              | px             | Page inset: heading, tab span and row left edge                        | [shop layout](../src/home/shopLayout.ts)   |
| STATS_LAYOUT.rows | Shop heading left; shop row right at x = 338 | derived bounds | Logbook label/value columns                                            | [stats layout](../src/home/statsLayout.ts) |
| SHOP_LAYOUT.list  | Top 144; height 348; bottom 492              | y px           | Shared scrolling viewport, x = 0 to the track less 2                   | [shop layout](../src/home/shopLayout.ts)   |
| page.back         | 142,500,76,48                                | x,y,w,h px     | Content-sized Back: every frameless page, 12px above the screen's foot | [help layout](../src/help/helpLayout.ts)   |

Shop, Logbook, Help, Settings and Cheats are frameless pages under the live top bar: each fills `(0,40,360,520)` edge to edge with no frame, border, margin or close control, and the content-sized Back (`page.back`) is its only leave. End's Back to title is a separate role: the results screen's main next step, a content-sized primary centred in Start walk's slot, `(100,508,160,48)`. Their content takes one 8px side inset, and a scrollbar's track sits at x = 344–351. Shop and Logbook share their page and list geometry. Use `shopListFrame` and `statsListFrame` for the content room. Settings and Cheats share the [settings page geometry](#settings-and-cheats-pages). Other full-screen pages retain their own bounds.

### Page rows

Pet shop rows, Logbook rows and the badge wall share one row pattern:

- **Columns:** the icon box starts at the content edge, the 8px page inset on an open page or 4 inside a framed row's edge (x = 12), and the text starts 8 right of the icon box, whatever the icon's size (36 framed, 32 open).
- **Vertical placement:** the icon and the text block are each centred on the row's height by visible ink. An earned band and tick move with their badge.
- **Label and value:** at least 8 clear (`label.value.gap`) between a label and the value or note on the same line; a longer label wraps instead.
- **Pitch:** every 2× body line, in Help, the Logbook, the badge wall and wrapped Pet shop descriptions, is 18 apart (`body.pitch`). A line that gains a wrap grows its row; text never shrinks.
- **Right edge:** rows, notes and values end at x = 338, with the [scrollbar room](#page-boundsalignment) reserved.

### Help page

[`HELP_LAYOUT`](../src/help/helpLayout.ts) is a frameless page `(0,40,360,520)` in dark brown under the live top bar, with an 8px side inset, separate from the ordinary modal families; its control rules are in [Controls](controls.md#sizing-and-spacing). The picture's chrome card `(8,48,344,234)` holds the well `(14,54,332,200)` round the full-size `(16,56,328,196)` picture, and the caption's capitals sit at y = 260, centred on the well. The amber 2× topic title is the page's title: its capitals sit at y = 307, centred across the screen on its visible ink, and every topic title fits the 344px content width on one line, which a test enforces. The body starts at the title's lowest ink plus the label/help gap and flows left-aligned at x = 8–337 (330px) in the body-only viewport `(0,325,360,108)`: six whole 18px-pitch lines, ending at least `MODAL.gap` above the pager row. Every current body fits whole; a longer one scrolls only that viewport, beside the track at x = 344–351.

The pager is one 48px row at y = 444: Previous, the six page dots and Next, with 8 between the dots and each button, centred in the 296px body room (x = 32–328) at `x = floor((296 - total) / 2)`. Each button is its label ink plus 2 × 16. The dots are 8×8, 4 apart (68 wide), centred down the row; their art is in the [style guide](style-guide.md#ui). The press areas of Previous and Next stop 4 short of the dots, half the gap. The row has no stacked fallback: a label that breaks the fit fails the layout test rather than clipping. With the current labels:

| Pages  | Previous          | Dots             | Next or completion action |
| ------ | ----------------- | ---------------- | ------------------------- |
| 1 to 5 | `(41,444,118,48)` | `(167,464,68,8)` | `(243,444,76,48)`         |
| 6      | `(36,444,118,48)` | `(162,464,68,8)` | `(238,444,86,48)`         |

Back is the content-sized primary `page.back`, `(142,500,76,48)`, centred below the pager.

### Settings and Cheats pages

Settings and Cheats are frameless pages `(0,40,360,520)` on Game Kit's page frame under the live top bar, separate from the ordinary modal families; their control rules are in [Controls](controls.md#sizing-and-spacing). They share one geometry:

- **Content rectangle:** x = 8–338 (330 wide), with the [scrollbar room](#page-boundsalignment) always reserved and the track at x = 344–351.
- **Title:** the page title row `(16,64,328,15)`, a 3× heading with its ink centred at x = 180 and no X.
- **Body viewport:** from 24 below the title's ink (y = 103) to 8 above the next fixed element: the version label on Settings, Back on Cheats. Only the body scrolls.
- **Separators:** the one [separator](#spacing-tokens), 1px across x = 8–338 with 8 clear above and below.
- **Back:** `page.back`, `(142,500,76,48)`.

**Settings.** Rows span x = 8–338 and keep their internal layout: the icon 6 in, at x = 14; the label column at x = 34, the 16px icon cell plus `ICON_LABEL_GAP`; the [switch](#switch-rows) 15 in from the right, at x = 291–323, its top 9 below the row's top and the label's capitals 12 below it on every switch row; the state word ink-centred on the switch's centre, x = 307; slider tracks from the label column to the right inset, with values right-aligned to x = 330. Install is its row's sole action, one [ink group](#icons-beside-labels) centred on the row. The version label is metadata above the dismissal footer: its ink centred at x = 180, its ink bottom at y = 492, 8 above Back's face, fixed.

**Cheats.** Two columns 16 apart (`BUTTON_SIZE.gap`), each 157 wide, at x = 8–165 and x = 181–338, the same in the neighbourhood grid and the Unlocks and Money columns. The Unlocks and Money headings start their ink on their columns' left edges. Labels keep full size and fit by measure: a label that does not fit its button on one line breaks onto two balanced lines inside the button's 48px height. The Invincible owners and Reset save rows take the Settings row geometry, and the switch row follows the [switch-row layout](#switch-rows). The Reset save? confirmation is an ordinary [modal](#modals) over the page. See [Cheats layout](../src/cheats/cheatsView.ts) and [scroll placement](../src/hud/dom/cheats.ts).

## Groups/columns

Treat the home pickers and Start walk as one vertical group. The three sections are contiguous; their individual cards keep their detailed chrome and hit geometry. Position the grid from the cards themselves, preserving the separate non-touch badge gutter.

| Token           | Value                      | Unit       | Scope                                        | Source                                                                           |
| --------------- | -------------------------- | ---------- | -------------------------------------------- | -------------------------------------------------------------------------------- |
| home.divider    | Strip rows 138–140         | y px       | Divider row 140, above picker group          | [home layout](../src/home/homeLayout.ts) and [style contract](style-guide.md#ui) |
| home.outer.gaps | 0 above; 4 below           | px         | Entire picker/action group                   | [home export](../shared/export/layout.json)                                      |
| home.walker     | 6,141,348,91               | x,y,w,h px | Walker section                               | [home export](../shared/export/layout.json)                                      |
| home.dogs       | 6,232,348,183              | x,y,w,h px | Dogs section                                 | [home export](../shared/export/layout.json)                                      |
| home.pocket     | 6,415,348,91               | x,y,w,h px | Pocket section                               | [home export](../shared/export/layout.json)                                      |
| home.start      | 32,508,296,48              | x,y,w,h px | Start walk, 2px below Pocket                 | [home layout](../src/home/homeLayout.ts)                                         |
| home.columns    | Walker 4; Dogs 3; Pocket 5 | columns    | Face gaps 8 on both axes, outline to outline | [home layout](../src/home/homeLayout.ts)                                         |

Walkers use 77×50 faces and Pocket uses 58×50 faces, each filling its press cell. Every grid's face gap is measured between the tiles' outlines, Dogs included. Dogs use 105×42 faces within 48px-tall press cells, inset 3px vertically; their cell widths follow the build of the 8px face gap.

Keep hero, shop, sign and actor anchors independent of picker padding. On results pages, [endResultsPlacement](../src/home/endLayout.ts) moves the summary and attached art together, bounds the panel above the button and badge clearance and centres the unchanged badge strip in the remaining band. Full-size Body 2× owner names wrap only at spaces in their measured column, and a word wider than the 42px column ends its ink at the well's right edge (x = 323), 2 rows below the bubble; when complete owner rows exceed the allocated viewport, scroll only those rows, moving each face, bubble, tail, name and quote together. Title, earnings, badges and Back to title remain fixed; no name or quote is omitted or shrunk.

## Controls/targets

Visible faces and touch targets use separate rectangles. Keep the game's 48px action/target and 20px icon-face roles; shared document structure across games does not make their control sizes interchangeable. See [Controls](controls.md#sizing-and-spacing) for sizing and [interaction rules](controls.md#interaction-and-accessibility) for semantics.

| Token               | Value                                 | Unit | Scope                                                   | Source                                         |
| ------------------- | ------------------------------------- | ---- | ------------------------------------------------------- | ---------------------------------------------- |
| BUTTON_SIZE.wide    | 296×48                                | px   | Non-modal main actions                                  | [button geometry](../src/ui/buttonGeometry.ts) |
| BUTTON_SIZE.compact | 128×48                                | px   | Non-modal secondary actions                             | [button geometry](../src/ui/buttonGeometry.ts) |
| BUTTON_SIZE.icon    | Face 20×20; glyph 16×16; target 48×48 | px   | Non-bar icon controls                                   | [button geometry](../src/ui/buttonGeometry.ts) |
| topbar.face.gap     | 24                                    | px   | Faces x = 238/282/326, y = 8; else 282/326              | [home placement](../src/home/homeLayout.ts)    |
| topbar.home.hit     | 48×48 centred on its face, rows 0–47  | px   | Sound/Menu/Exit x = 224/268/312; else 268/312           | [home placement](../src/home/homeLayout.ts)    |
| topbar.home.well    | 97 wide, at x = 5                     | px   | Home bank well                                          | [home placement](../src/home/homeLayout.ts)    |
| topbar.walk.hit     | 48×48 centred on its face, rows 0–47  | px   | Sound and Pause x = 268/312; debuff bars win rows 40–47 | [walk HUD](../src/hud/walkHud.ts)              |
| press.min           | 48×48                                 | px   | Least press area; overlaps go to the nearest centre     | [Controls](controls.md#sizing-and-spacing)     |

Neighbouring top-bar presses overlap by 4px, and each overlap goes to the nearest face centre (`pressedArea`), never to DOM stacking order. The effect-well region stays pinned at `[102,264)`.

Modal actions use their full measured label/icon width plus padding, not the non-modal compact/wide width floors. Preserve prices, goals, reasons and full-size labels in every state.

HUD effect geometry follows the [walk-bar exception](controls.md#sizing-and-spacing): 24×24 native icons in 26×26 wells, no extra gap or horizontal hold inset, y = 5 wells and y = 6 icons. Size the group from the visible count, with no empty reservations, and centre it within `[102,264)` on x = 183; six wells span 156px and start at x = 105,131,157,183,209,235, while two start at x = 157,183. The fixed cash well is `(5,4,97,29)`, with 84px of ink room at 3× scale. Centre the current dollar-sign/amount visible-ink union horizontally and vertically; the reserved maximum width is not an alignment box. Native faces, glyphs and wells share the same layout projection. Sound and Pause/Menu faces are `(282,8,20,20)` and `(326,8,20,20)`, each within a 48px target centred on it, drawn on the plum with no backing.

## Icons and labels

### Icons beside labels

- **Gap:** a 16px icon beside its label leaves `ICON_LABEL_GAP` (4) from its 16px art cell to the label's first ink column: Settings rows (whose labels share one column, x = 34), the message strip, the new-walker info line, the iOS install steps, the Settings Install button and the reach chip.
- **Vertical:** the icon centres on its label's capitals, with equal rows above and below them; an odd remainder puts the extra row below. Inside a backed chip or plate, such as the reach chip, the icon and label instead form one ink group centred on the backing's flat fill by the [backed-label rule](#backed-labels), keeping at least one clear row against the frame.
- **Icon beside an icon:** the reach icon that flies beside a treat's small heart keeps its own 2px gap; `ICON_LABEL_GAP` applies only to an icon beside a label.
- **Install:** the Settings Install button places its icon box, `ICON_LABEL_GAP` and label as one ink group (the icon contributes its cell from ink column 2, its ink filling columns 2 to 13) and centres the union of the icon and label ink on its face. The button is its row's sole action, centred in the row; its width and position follow the build.

### Backed labels

Every label on a backing (a raised button face, a plate, a band, a card margin, a picture) uses one rule. Centre the label's measured ink block on the backing's flat face in whole art pixels. Count rows on the flat fill only, excluding the outline, the lit and shade rows and the lip. An odd spare row goes under the ink. Horizontally, centre the ink with a half pixel rounding right. A label draws where it is laid out. On a pressed face the label sinks 2 rows with the face. For a raised button:

`capTop = face.y + BUTTON_FACE_EDGE.top + floor((h - top - BUTTON_LIP_PX - bottom - inkRows) / 2) - inkTop`

The Settings and Cheats state word keeps its own [switch-row](#switch-rows) placement. With the current strings, the rule gives these capital tops, offset from the backing's top, and rows clear above and below the ink:

| Family                                                                                                                                                                   | Backing (flat face)                                                               | Capitals                                        | Above / below                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------- | ------------------------------------- |
| Panel buttons (pause, home menu, Help, question panels, celebration, end screen, Settings Install, page Back, fork End walk, update notice) and the exported update text | Raised 48px face                                                                  | y + 17                                          | 15 / 16                               |
| Cheats, one line                                                                                                                                                         | Raised 48px face                                                                  | y + 17                                          | 15 / 16                               |
| Cheats, two lines (34-row block)                                                                                                                                         | Raised 48px face                                                                  | y + 5                                           | 3 / 4                                 |
| Start walk (3× capitals)                                                                                                                                                 | Raised 48px face                                                                  | y + 15                                          | 13 / 13                               |
| Page tabs                                                                                                                                                                | 28-row face with a 4-row lip                                                      | y + 7                                           | 5 / 6                                 |
| Dog card Empty                                                                                                                                                           | Inside the dashed outline: card rows 1 to 68, columns 2 to 117                    | y + 32                                          | 31 / 32                               |
| Dog card FIRED!                                                                                                                                                          | The red plate's 7×26 face on the empty photo                                      | y + 30                                          | 1 / 1                                 |
| Small choice-card band                                                                                                                                                   | Drawn margin between the frame and the picture outline: rows 2 to 14              | band.y + 3 with a descender, band.y + 4 without | 2 / 3 with a descender, 3 / 3 without |
| Large choice-card band                                                                                                                                                   | Drawn margin above the picture: rows 4 to 29                                      | band.y + 10                                     | 9 / 9                                 |
| Small plaque (capitals and `$` strings)                                                                                                                                  | Card-cost face rows 2 to 9                                                        | + 3                                             | 1 / 2                                 |
| Large plaque                                                                                                                                                             | Card-cost face at 2×, rows 4 to 19                                                | + 9                                             | 5 / 6                                 |
| Road banner heading                                                                                                                                                      | Upper half of the plate, rows 2 to 20, above the dotted rule on row 21            | y + 9                                           | 7 / 7                                 |
| Road banner name                                                                                                                                                         | Lower half, rows 22 to 44; 12 body rows (fill and ring), the drop shadow excluded | y + 28                                          | 5 / 6                                 |
| Section band heading and note                                                                                                                                            | 22-row band face; heading and note as one block                                   | Ink-centred                                     | 6 / 6                                 |
| Gear initials, Pocket                                                                                                                                                    | 32×32 picture                                                                     | picture + 13                                    | 13 / 14                               |
| Gear initials, 16×16 badge (scale 0.5)                                                                                                                                   | 16×16 picture                                                                     | picture + 5                                     | Not measured                          |

The choice-card band tokens state the drawn margin they centre in: small `{ y: 2, height: 13 }`, large `{ y: 4, height: 26 }`. A band's press fill covers the same drawn margin, so its label stays centred on the visible fill. The `$` strings on the small plaque centre their own ink, 0 above and 1 below. Each road-banner line centres in its own half of the plate.

## Modals

Every ordinary modal uses one vertical rule. Start its top at `(560 - H) / 2`, where `H` is its measured full-size height, which targets the full viewport's midpoint, y = 280, then clamp it with `rectAboveIn` to its caller's protected area. The protected top is y = 56 in every caller, the top bar's 48 press rows plus 8, so no modal covers the top bar. Horizontal actor avoidance may move it left or right without changing that vertical placement. Do not centre in the remaining safe band instead. Full-scene celebrations, results and the frameless pages are separate roles.

| Caller                                                              | Protected interval   |
| ------------------------------------------------------------------- | -------------------- |
| Home overlays and full-viewport dialogs (for example, item details) | y ≥ 56, bottom ≤ 544 |
| Walk overlays                                                       | y ≥ 56, bottom ≤ 466 |

Clamping can move the final centre: a 400px-high walk modal clamps to y = 66, bottom = 466, without shrinking. Update, Quit, purchase, badge, item and grouped-detail modals follow this rule. Install steps over Settings and Reset save? over Cheats use their home or walk caller's interval. When a modal body exceeds its available height, it scrolls while the title, X and footer stay fixed.

| Token                            | Value                                                | Unit | Scope                                                                   | Source                                                                                          |
| -------------------------------- | ---------------------------------------------------- | ---- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| modal.width                      | Large 328 or Medium 264; clamp available width       | px   | Selected ordinary family; safe-width clamp                              | [local width adapter](../src/ui/modal/layout.ts)                                                |
| modal.height                     | Measured content; no fixed floor                     | px   | Full fonts, wrapped text and present groups                             | [Control contract](controls.md#sizing-and-spacing)                                              |
| modal.close.face                 | 20×20 at right/top inset 6                           | px   | Ordinary modal X                                                        | [close geometry](../src/ui/closeControl.ts)                                                     |
| modal.close.hit                  | 48×48, wholly inside top-right corner                | px   | Ordinary modal X                                                        | [close geometry](../src/ui/closeControl.ts)                                                     |
| modal.title.reserve              | 56 each side with X; 16 without                      | px   | Whole-panel-centred heading; 48px hit plus 8px gap                      | [title sizing](../src/ui/modal/layout.ts) and [title placement](../src/ui/barTitle.ts)          |
| modal.title.top                  | 24 above actual visible ink                          | px   | 15px capitals give header 63; 18px Quit? gives 66                       | [modal tokens](../src/ui/modalGeometry.ts)                                                      |
| pauseMenu.width / homeMenu.width | 264, Medium; full-size labels measured within family | px   | One measured width family across both menus                             | [shared menu measurement](../src/ui/navigationMenu.ts)                                          |
| pauseMenu.note.inner             | 232 = 264 − 2 × 16                                   | px   | Note plate width; text wraps at 224px after 4px plate padding each side | [pause layout](../src/hud/pauseMenu.ts) and [note measurement](../src/hud/questionPanelView.ts) |
| modal.content.bottom             | 16 after final visible content                       | px   | Includes any final note                                                 | [pause layout](../src/hud/pauseMenu.ts)                                                         |

Large contains 296px of body room and Medium 232px after 16px padding on both sides. Rich details, lists and ordinary installation cards use Large; Pause/Menu, brief confirmations, optional Update and Purchase use Medium. Short details choose Medium only after their actual full-font body, heading and footer fit; otherwise use Large. Wrapping, action-row stacking and measured height derive from this room. The [control contract](controls.md#sizing-and-spacing) owns those family rules.

Detail cards place the portrait on the left and the left-aligned description on its right, with compact dog identity in the same right column. Keep equal outer insets and measure the text room from the right column's actual origin to the inside edge of the right inset. Wrap full-size text at the measured limit. Use the existing Medium and Large families to fit the complete card. Keep the owner block, status and footer below both columns in that order.

Use dedicated `MODAL_TITLE_SCALE = 3` for ordinary modal headings and the Shop, Logbook, Settings and Cheats page titles. Measure actual glyph ink with [titleRole](../src/ui/modal/titleRole.ts), keeping 24px above and below it. Capital ink is 15px and its header 63px; punctuation can increase both. Wrap at a 36px pitch and grow header/body/panel height from actual ink. Body and action labels stay at 2×. End-results badge-strip headings retain their 2× section role. Modal controls, dismissal guards and safe keyboard choices remain defined in [Controls](controls.md#sizing-and-spacing). Width measurements must include every present group and action, not only the title.

### Switch rows

Settings and Cheats switch rows share one layout. The row's leading icon or label starts 6 in from the row's left, and the 32×16 switch sits at the row's upper right, 15 in from its right edge, so the widest state word (Hidden, 62px of ink) centred under it ends on the row's right edge. The switch's top is 9 below the row's top, and the label's capitals start 12 below it on every switch row, with or without a note, so the label and the 16px icon cell share the switch's rows. The state word sits 8 below the switch, its ink centred on the switch's centre. The whole row is the target, and row heights follow their content (Cheats 48, Settings Sound 82).

## HUD/overlays

Keep gameplay notices below overlay scenes and scrims. A high object depth inside the run scene is not permission to draw above a modal. The message strip stays in the HUD with its paused lifetime and enlarged-card hiding; [messageStripView](../src/scenes/messageStripView.ts) owns its rendering.

| Token            | Value                                            | Unit       | Scope                                                                       | Source                                                                               |
| ---------------- | ------------------------------------------------ | ---------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| hud.topBar       | 0,0,360,40                                       | x,y,w,h px | Walk bar                                                                    | [screen regions](../shared/export/layout.json)                                       |
| hud.walkView     | 0,40,360,442                                     | x,y,w,h px | Content between bar and dog row                                             | [screen regions](../shared/export/layout.json)                                       |
| hud.dogRow       | 0,482,360,74                                     | x,y,w,h px | Fixed three-slot card row                                                   | [screen regions](../shared/export/layout.json)                                       |
| card.dogPhoto    | 3,15,36,36                                       | x,y,w,h px | The dog's photo frame on `ui-dog-card`                                      | [dog card parts](../src/data/layout.ts)                                              |
| card.ownerPhoto  | 45,15,36,36                                      | x,y,w,h px | The owner's photo frame on `ui-dog-card`                                    | [dog card parts](../src/data/layout.ts)                                              |
| card.ownerName   | x = 78, ink top y = 53                           | px         | Centre the one-line Body 1.75× name under the portraits                     | [dog card parts](../src/data/layout.ts)                                              |
| card.hearts      | x = 85/94/103, y = 26/35                         | px         | Two rows of up to three hearts to the right of the photos                   | [dog card parts](../src/data/layout.ts)                                              |
| hud.zonePillGap  | 4                                                | px         | Pill top below the last debuff bar or the walk bar                          | [pill layout](../src/hud/zonePill.ts)                                                |
| progress.route   | Screen bottom, full width, 4px high              | px         | Neighbourhood route progress with 2 inner fill rows                         | [HUD regions](../src/data/layout.ts) and [route progress](../src/hud/walkHud.ts)     |
| progress.loading | Physical viewport top, full width, 3 CSS px high | CSS px     | One page-lifetime loading strip, independent of DPR and page-frame rotation | [startup](../src/startup.ts) and [DOM loading strip](../src/ui/dom/domLoadingBar.ts) |

Hide the shared loading strip while idle. Startup, Boot, home, walk-loading, offline installation and required updates use the same physical-top strip; there is no Home-yard or Boot secondary gauge. The neighbourhood route-progress meter is separate. Progress state and appearance follow the [style contract](style-guide.md#ui). Actor-following effects and stationary art notices keep their own anchors; do not apply panel-centering rules to them.

## Exceptions and verification

Keep intentional geometry explicit: compact top bars, steering gestures, hold-to-explain controls, illustrated choice cards, edge-to-edge dog cards, full-scene hero titles, scrolling pages and the measured result/badge group. These exceptions do not authorize shrinking text or targets; only the debuff bars and effect wells keep press areas under 48px. Their detailed contracts remain in [Controls](controls.md#scope-and-exceptions).

Loading recovery uses a fixed CSS panel and typography with the ordinary logical action fit, under the [recovery exception](controls.md#scope-and-exceptions). Keep that role separate from the ordinary modal tables.

Before changing a layout, identify its coordinate space, page bounds, present groups, visible-ink extents, target rectangles and protected areas. Check smallest safe width, wrapped content, close-hit clearance, scrollbar reservation, visible state cues and empty groups. Compare neutral and selected card edges without counting badges as grid padding. Verify overlay ordering and unchanged dismissal behaviour.

Read the owning source and committed export together. A changed layout needs matching exports and focused checks; a documentation-only correction needs formatting and Markdown lint. Use a bounded visual check only for a concrete unresolved visual question.

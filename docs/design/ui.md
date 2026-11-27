# UI

Ordinary screens, overlays, choice cards and the walk HUD render as native DOM views on game-kit's shared UI modules; Phaser draws the road, backdrops, actors, world effects, Boot's art and Help's illustrations, and art only the native interface draws ships outside the Phaser atlas. The [Art layout guide](../../art/layout.md) owns exact UI measurements, including target sizes, compact HUD exceptions, spacing, modal families, close controls and the physical-top loading strip. Text on a backing centres on its visible ink. Required file failures show the shared error with Retry.

Under a modal the whole background, top controls included, is dimmed and inactive. Ordinary dismissible details keep their Close footer and corner X. A sole visible footer action is centred. Settings uses Back when opened from Menu or Pause and Close when opened standalone. Confirmations keep their existing action labels, such as Cancel and Buy. Primary actions sit bottommost or rightmost.

Back restores the immediate invoking view. Help and Logbook opened from Menu return to that
same Menu; pages opened from Pause leave the walk paused until Resume. Close, X, Escape and
outside dismissal leave one layer when dismissal is allowed. A tap on a bar outside the rendered
game uses the top page or modal’s Back, Close or X action. Previous only changes the page within
a view. Restore focus to the invoking control when available, and keep required choices
nondismissible.

The Sound button shows its current On or Off state under its icon. Settings uses one Install
button with its decorative install icon, and opens the browser prompt or instructions on
activation. Recovery buttons use the same action for a tap, key activation or hold. Developer
Copy keeps the crash screen open and Reload restarts it. A pressed choice highlights its title
band. Required choices retain their existing gesture and dismissal rules.

Settings and Cheats use one switch row layout. The state label sits below the switch on the
same centre. Descriptions wrap at words in the available row width, using the wider of the two
state labels to reserve space for the control stack. Ordinary action labels share a fixed
2.25× title-font role. The top bar centres visible effect wells on the screen when they fit.
A full six-well row centres in its reserved region.

Selectable controls apply the cyan fill directly, without a colour transition or movement.
A press uses the same fill as selection. Input admission, focus and refusal retain their
own roles.

Reference: [Screens and UI](../../src/README.md#screens-and-ui), [Assets](../../src/README.md#assets), [Phone](../../src/README.md#phone).

## Work items

| ID       | Title                                                                 | Link                               |
| -------- | --------------------------------------------------------------------- | ---------------------------------- |
| adw-0077 | Play the tip sparkle over the lead dog for cash gains                 | [adw-0077.md](../work/adw-0077.md) |
| adw-0091 | Draw the interface in HTML over the canvas                            | [adw-0091.md](../work/adw-0091.md) |
| adw-0093 | Space buttons by the kit's button gaps                                | [adw-0093.md](../work/adw-0093.md) |
| adw-0094 | Show loading bars only while the player waits                         | [adw-0094.md](../work/adw-0094.md) |
| adw-0096 | Serve the HTML interface's stylesheet as a CSS file                   | [adw-0096.md](../work/adw-0096.md) |
| adw-0103 | Give every press area 48 px                                           | [adw-0103.md](../work/adw-0103.md) |
| adw-0107 | Show a script focus ring only after keyboard input                    | [adw-0107.md](../work/adw-0107.md) |
| adw-0109 | Name each setting's state and effect                                  | [adw-0109.md](../work/adw-0109.md) |
| adw-0113 | Prevent text selection across the game UI                             | [adw-0113.md](../work/adw-0113.md) |
| adw-0116 | Centre a button that is alone in its row                              | [adw-0116.md](../work/adw-0116.md) |
| adw-0117 | Share one top bar layout across screens                               | [adw-0117.md](../work/adw-0117.md) |
| adw-0118 | Centre backed labels and inline pills on their visible ink            | [adw-0118.md](../work/adw-0118.md) |
| adw-0124 | Compose Pause and Menu as one navigation modal                        | [adw-0124.md](../work/adw-0124.md) |
| adw-0125 | Render the interface natively on game-kit                             | [adw-0125.md](../work/adw-0125.md) |
| adw-0127 | Show one top loading strip and Retry required files                   | [adw-0127.md](../work/adw-0127.md) |
| adw-0128 | Keep only Sound and Pause in the walk top bar                         | [adw-0128.md](../work/adw-0128.md) |
| adw-0129 | Reserve five characters for cash and keep effects static              | [adw-0129.md](../work/adw-0129.md) |
| adw-0133 | Fix the home header bands and shop sign                               | [adw-0133.md](../work/adw-0133.md) |
| adw-0134 | Enlarge modal titles and balance their padding                        | [adw-0134.md](../work/adw-0134.md) |
| adw-0135 | Add Back to title above the primary action in Pause and Menu          | [adw-0135.md](../work/adw-0135.md) |
| adw-0136 | Restore modal dimming on live screens                                 | [adw-0136.md](../work/adw-0136.md) |
| adw-0138 | Close every dismissible modal from a centred footer                   | [adw-0138.md](../work/adw-0138.md) |
| adw-0139 | Apply the shared Retry presentation                                   | [adw-0139.md](../work/adw-0139.md) |
| adw-0140 | Size modals by width family                                           | [adw-0140.md](../work/adw-0140.md) |
| adw-0141 | Use readable minimum type in signs, pills and results                 | [adw-0141.md](../work/adw-0141.md) |
| adw-0145 | Place the primary action bottom or right                              | [adw-0145.md](../work/adw-0145.md) |
| adw-0146 | Show the version above Close in Settings                              | [adw-0146.md](../work/adw-0146.md) |
| adw-0147 | Fix Settings scrolling and focus on touch                             | [adw-0147.md](../work/adw-0147.md) |
| adw-0150 | Bind each discrete control's hold to its action                       | [adw-0150.md](../work/adw-0150.md) |
| adw-0151 | Remove the labelled Close from confirmations                          | [adw-0151.md](../work/adw-0151.md) |
| adw-0152 | Remove mute from loading and Retry                                    | [adw-0152.md](../work/adw-0152.md) |
| adw-0155 | Dim and still the whole background under a modal                      | [adw-0155.md](../work/adw-0155.md) |
| adw-0157 | Leave native-only chrome out of the Phaser atlas                      | [adw-0157.md](../work/adw-0157.md) |
| adw-0160 | Size the celebrations and loading error by width family               | [adw-0160.md](../work/adw-0160.md) |
| adw-0165 | Order the Pause and Menu modal and show Exit only where it works      | [adw-0165.md](../work/adw-0165.md) |
| adw-0167 | Make Help a page and frame its pictures                               | [adw-0167.md](../work/adw-0167.md) |
| adw-0173 | Fix the Help page's dimming, body scroll and walk bar slot            | [adw-0173.md](../work/adw-0173.md) |
| adw-0174 | Draw the Pet shop message plate from its image                        | [adw-0174.md](../work/adw-0174.md) |
| adw-0178 | Keep each walk dog card's owner name whole                            | [adw-0178.md](../work/adw-0178.md) |
| adw-0179 | Show the Help and Logbook pages full screen                           | [adw-0179.md](../work/adw-0179.md) |
| adw-0182 | Fill the Start picker art wells                                       | [adw-0182.md](../work/adw-0182.md) |
| adw-0183 | Restore the invoking Menu or Pause on Back                            | [adw-0183.md](../work/adw-0183.md) |
| adw-0184 | Use game-styled keyboard focus indicators                             | [adw-0184.md](../work/adw-0184.md) |
| adw-0186 | Use shared game button construction                                   | [adw-0186.md](../work/adw-0186.md) |
| adw-0190 | Balance vertical padding in the Start picker                          | [adw-0190.md](../work/adw-0190.md) |
| adw-0191 | Tighten the gear details modal                                        | [adw-0191.md](../work/adw-0191.md) |
| adw-0192 | Use Back for Settings navigation                                      | [adw-0192.md](../work/adw-0192.md) |
| adw-0193 | Unify walker dog and gear details                                     | [adw-0193.md](../work/adw-0193.md) |
| adw-0194 | Refine selected items in the Start picker                             | [adw-0194.md](../work/adw-0194.md) |
| adw-0195 | Close details on the first press after opening by hold                | [adw-0195.md](../work/adw-0195.md) |
| adw-0196 | Fill Pet Shop picture wells and balance row padding                   | [adw-0196.md](../work/adw-0196.md) |
| adw-0197 | Align principal art and content in comparable UI rows                 | [adw-0197.md](../work/adw-0197.md) |
| adw-0200 | Align Start section headings and notes to matching insets             | [adw-0200.md](../work/adw-0200.md) |
| adw-0201 | Show Cancel and Buy only when an item can be purchased                | [adw-0201.md](../work/adw-0201.md) |
| adw-0203 | Balance Pet Shop section heading and count spacing                    | [adw-0203.md](../work/adw-0203.md) |
| adw-0205 | Keep one action-area cancellation on decision dialogs                 | [adw-0205.md](../work/adw-0205.md) |
| adw-0207 | Match visible close insets and separate purchase status               | [adw-0207.md](../work/adw-0207.md) |
| adw-0210 | Move Cheats to Menu and Pause and group its actions                   | [adw-0210.md](../work/adw-0210.md) |
| adw-0212 | Make Back and Close respond on the first press                        | [adw-0212.md](../work/adw-0212.md) |
| adw-0213 | Align Archie divider and icon ink                                     | [adw-0213.md](../work/adw-0213.md) |
| adw-0217 | Wrap detail descriptions at the available right margin                | [adw-0217.md](../work/adw-0217.md) |
| adw-0218 | Enable Reset Save only for stored player progress                     | [adw-0218.md](../work/adw-0218.md) |
| adw-0220 | Show only the price in affordable item detail cards                   | [adw-0220.md](../work/adw-0220.md) |
| adw-0223 | Move the FPS counter to Settings                                      | [adw-0223.md](../work/adw-0223.md) |
| adw-0224 | Keep wrapped details status sentences together                        | [adw-0224.md](../work/adw-0224.md) |
| adw-0225 | Keep modal X dismissal consistent with its action                     | [adw-0225.md](../work/adw-0225.md) |
| adw-0226 | Restore the transparent Slot Sign hit area                            | [adw-0226.md](../work/adw-0226.md) |
| adw-0227 | Trim the Cheats action list                                           | [adw-0227.md](../work/adw-0227.md) |
| adw-0228 | Put the FPS switch last in Settings                                   | [adw-0228.md](../work/adw-0228.md) |
| adw-0229 | Route letterbox taps to the top modal                                 | [adw-0229.md](../work/adw-0229.md) |
| adw-0233 | Keep unaffordable Pet shop items unselected                           | [adw-0233.md](../work/adw-0233.md) |
| adw-0234 | Add the FPS icon to Settings                                          | [adw-0234.md](../work/adw-0234.md) |
| adw-0235 | Remove Show tips again from Cheats                                    | [adw-0235.md](../work/adw-0235.md) |
| adw-0237 | Match the approved Cheats layout                                      | [adw-0237.md](../work/adw-0237.md) |
| adw-0238 | Route letterbox taps to the top page                                  | [adw-0238.md](../work/adw-0238.md) |
| adw-0239 | Align owner and dog portraits in the walk HUD                         | [adw-0239.md](../work/adw-0239.md) |
| adw-0240 | Finish shared Settings and recovery controls                          | [adw-0240.md](../work/adw-0240.md) |
| adw-0242 | Make Cheats available during a walk                                   | [adw-0242.md](../work/adw-0242.md) |
| adw-0246 | Keep keyboard focus on the Start screen when an overlay closes        | [adw-0246.md](../work/adw-0246.md) |
| adw-0248 | Show every control's focus and press as fills, with no outline rings  | [adw-0248.md](../work/adw-0248.md) |
| adw-0251 | Audit the interface for shared components and principled alignment    | [adw-0251.md](../work/adw-0251.md) |
| adw-0252 | Adopt the Game Kit spacing tokens with Art                            | [adw-0252.md](../work/adw-0252.md) |
| adw-0253 | Build every shared control from Game Kit components                   | [adw-0253.md](../work/adw-0253.md) |
| adw-0255 | Simplify the interface code with pixel-identical refactors            | [adw-0255.md](../work/adw-0255.md) |
| adw-0256 | Fix the crash screen and panel test defects                           | [adw-0256.md](../work/adw-0256.md) |
| adw-0257 | Unify visible label placement, rows and control looks                 | [adw-0257.md](../work/adw-0257.md) |
| adw-0260 | Centre the Start screen speech bubble's text vertically in its bubble | [adw-0260.md](../work/adw-0260.md) |
| adw-0261 | Freeze each Help picture on a fixed frame                             | [adw-0261.md](../work/adw-0261.md) |
| adw-0262 | Show Settings and Cheats as full-screen pages                         | [adw-0262.md](../work/adw-0262.md) |
| adw-0263 | Centre each switch row's state word under its switch                  | [adw-0263.md](../work/adw-0263.md) |
| adw-0274 | Improve the readability of Archie’s interface                         | [adw-0274.md](../work/adw-0274.md) |
| adw-0275 | Keep item selections steady on activation                             | [adw-0275.md](../work/adw-0275.md) |
| adw-0276 | Align collision feedback over the lead dog                            | [adw-0276.md](../work/adw-0276.md) |
| adw-0277 | Remove the repeated owner name from extra-heart details               | [adw-0277.md](../work/adw-0277.md) |
| adw-0279 | Wrap Settings help to the available row width                         | [adw-0279.md](../work/adw-0279.md) |
| adw-0280 | Centre visible effects in the top bar                                 | [adw-0280.md](../work/adw-0280.md) |
| adw-0281 | Align Cheats switches and refine action labels                        | [adw-0281.md](../work/adw-0281.md) |
| adw-0282 | Apply selection colours immediately throughout the interface          | [adw-0282.md](../work/adw-0282.md) |
| adw-0283 | Show gameplay and menu controls on the landing page                   | [adw-0283.md](../work/adw-0283.md) |
| adw-0284 | Organize the homepage around a compact shared structure               | [adw-0284.md](../work/adw-0284.md) |
| adw-0286 | Simplify the public homepage and remove Tuning and Gallery            | [adw-0286.md](../work/adw-0286.md) |
| adw-0290 | Make forgiven choice outcomes readable                                | [adw-0290.md](../work/adw-0290.md) |
| adw-0291 | Use a shared four-pixel gap in walk notices                           | [adw-0291.md](../work/adw-0291.md) |
| adw-0292 | Centre choice-card outcomes                                           | [adw-0292.md](../work/adw-0292.md) |
| adw-0293 | Match the approved Start picker cards                                 | [adw-0293.md](../work/adw-0293.md) |
| adw-0294 | Confirm platform Back on Start                                        | [adw-0294.md](../work/adw-0294.md) |
| adw-0295 | Keep the Pet Shop right-aligned in Firefox                            | [adw-0295.md](../work/adw-0295.md) |

# Cheats

The shared [Saves and cheats policy](https://github.com/andornaut/game-coordinator/blob/main/docs/game-policies.md#saves-and-cheats) applies: cheats exist only in browser tabs, never in an installed app, detected at runtime when the modal opens and again when an action runs. Settings is the only entry point; its Open Cheats button sits next to Back. The Dev panel below the game is gone.

## Cheat session

Cheats never touch the save. The first cheat used starts a cheat session; opening the modal does not.

- **During a session:** nothing is saved, earned or banked. Granted cash and unlocks, Pet shop purchases, picks, walks, banked earnings, statistics, records, badges and checkpoints all stay in the session.
- **On the Start screen:** cheats used there apply to the Start screen at once, with its Pet shop, Logbook and Settings pages, and to the walk the next Start walk begins. A session started during a walk applies to that walk.
- **Ending:** the session ends when the game returns to the Start screen from a walk (going home from the end screen, or Back to title), and when the game reloads or closes. Opening and closing a page over the Start screen does not end it. The session is never stored: when it ends, every cheat is off and the game shows the save as it was before the first cheat, its checkpoint included, so a walk closed before the session resumes as normal on the next launch.

## Modal

- **Size:** the Large width (328 px logical), clamped to the safe viewport, as tall as the viewport less its 16 px margins. The body scrolls and never pages; text stays full size.
- **Frame:** a fixed "Cheats" title with the X close control at the top, and a fixed primary Close at the bottom.
- **Order:** the cheats (This walk, Next walk, then Start screen), a divider, then the non-cheat actions, with Reset save last.
- **Controls:** toggles are On/Off rows like Settings; pickers are full-width rows; repeatable Add buttons are 128×48 px compact buttons, two to a row. Rows that do not apply where the modal opened (This walk outside a walk, Start screen during one) are disabled, not hidden, so the list never shifts.

## Cheats

### This walk

Enabled only during a walk (through Pause, then Settings); none of them starts one.

- **Add $100:** adds $100 to this walk's earnings on every press.
- **Refill hearts:** sets every owner to their maximum hearts.
- **Grant upgrade:** one row per upgrade, adding it to this walk, and Grant all upgrades.
- **Apply debuff:** one row per debuff, applying it to the pack as contact would.
- **Finish this neighbourhood:** ends the current neighbourhood as if walked, at its fork or the walk's end.

### Next walk

Set on the Start screen for the walk the next Start walk begins.

- **Start at:** the neighbourhood and route to start from.
- **Seed:** the walk's seed, with Copy run link to reproduce it.
- **Pocket item:** any Pocket item for the walk, owned or not.
- **Invincible owners:** bumps and cards cost no hearts.
- **Movement speed:** slow, normal or fast.

### Start screen

Enabled only on the Start screen.

- **Add $500, Add $5,000 and Add $50,000:** add that amount to the bank on every press.
- **Unlock all walkers.**
- **Own all dogs.**
- **Own all dog slots.**
- **Own all gear.**
- **Unlock all:** all four of the above at once.

## Other actions

These are not cheats and start no session.

- **FPS counter:** On or Off, Off by default, a device setting kept apart from the save. It shows frames per second in the bottom-right corner of the device viewport, inset from the safe area and drawn above everything, the letterbox bars included.
- **Show tips again:** clears the shown hints and whether Help has been seen, in the save.
- **Reset save:** last, after a confirmation, resets the save entirely, earned badges included. Device settings stay.

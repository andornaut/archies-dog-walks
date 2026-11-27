# Encounters

What happens on contact, what cards offer and how pickups and upgrades work. The [game-data export](../../../shared/export/game-data.json) includes generated card wording. The `$` and `♥` shorthand gives the direction and rough size of a change. More symbols mean a larger change.

## Choice cards

- Used for encounters and forks. Up to three across, art-led: an illustration plus a one-line effect; hold to enlarge for details
- **Selection** starts with no choice outline. The first directional key highlights the first displayed choice. Further directional presses move the selection. E, F, Enter or Space confirms the selected choice when available. The existing digits still activate their available choices.
- **Primary pointer and touch presses** show the same outline while a choice is pressed. These presses choose only on an eligible release, and the existing hold, cancel and first-second tap safeguards apply. This outline is specific to choice cards.
- Every card hits the whole pack. No card opens without a collision, except the [fork card](neighbourhoods.md#forks). A hit that opens a card costs nothing until you choose
- Each option's outcome is fixed and shown on the card, with hearts per dog ("−1♥ Ginger"); a card for two or three dogs reads "−1♥ each" unless Second chance would forgive one of them, when it names each dog ("♥ Ginger's safe!, −1♥ Kilo"), and its enlarged view names each dog. A perk, gear item or upgrade that changes an option shows its charm centred just under that option's card: the item's icon on the left and, beside it, the item's name over what it did to that option (Hall pass's skip "Free skip", Quick recovery "Half time", Charmer "Free"). Second chance shows its name alone. Two charms stack below the card, including the enlarged card, so the card keeps its full text box. The card row (title, cards and charms) rises to the 2/3 line of the walk view. Choices only, no minigames
- A money option shows its price on its plate, greyed out when you can't afford it, so cash never goes below $0; every card keeps at least one option that costs no money, and its plate is blank. Money options are charged once per card, whatever the pack size; heart options cost each owner, so a bigger pack has more owners who can fire you. Slower options cost money (missed tips) instead of time
- An option says what it would do before you pick: a debuff option states its stake ("Quick rinse → Stinky: tips pay nothing for 60s"), an option that would fire an owner says so ("Fires Jason"), and a heart Second chance would forgive reads as safe
- A fork's path card shows its upgrade's duration (Now, Next or All walk) where other cards show a price
- Hall pass offers "Skip (Hall pass)" (free, skipping the card) on every encounter card until it's used in that neighbourhood, in place of the card's hearts option. Charmer and Hall pass can both apply to the same card: its money options are free and the skip is offered, and the player chooses; Charmer is used up by that card whichever option is picked. Skip is a card choice and Escape never activates it.
- After a card choice, each owner whose hearts changed reacts with a quip in the message strip

## Encounters and debuffs

Nine card obstacles open a choice card: the cheese crates, the green bin spill, the other dog, the skunk and the thief, each in several neighbourhoods, and four neighbourhood cards (the wedding photo shoot also at The Beaches). No neighbourhood has two cards that bring the same debuff. An obstacle resolves the same way everywhere it appears: the same card and base choices, the same contact effect, or a regular bump. Neighbourhoods choose obstacle types and their spawn weights, never their resolution. Every card has three base choices: one costs money, one costs hearts and one applies a debuff. Each choice changes only its own category, whether it gives a benefit or imposes a cost, never combining a direct money change, heart change or debuff. A debuff's later consequences, such as Stinky's unpaid tips or Spotlight's bump charge, belong to the debuff, not to the choice that applied it. Every money option costs $20. Most hearts options cost each walking dog's owner 1♥; the porch cat's Stand your ground costs only the lead dog's owner. The tables list base choices before gear, perks and upgrades modify them (see [Choice cards](#choice-cards)); [`encounters.ts`](../../../src/data/encounters.ts) defines the choices and [`tuning.ts`](../../../src/data/tuning.ts) their cash amounts.

| Neighbourhood                    | Card                | Options                                                                  |
| -------------------------------- | ------------------- | ------------------------------------------------------------------------ |
| Cabbagetown                      | Porch cat           | Stand your ground (−1♥ lead dog), Treat bribe ($20), Splash past (Muddy) |
| The Beaches                      | Dropped ice cream   | Let them lick it (Muddy), Buy a new cone ($20), Walk on by (−1♥ each)    |
| Distillery District, The Beaches | Wedding photo shoot | Pose (Spotlight), Walk around (−1♥ each), Pay for a reshoot ($20)        |
| Yonge Street                     | Big screen promo    | Wave hello (Spotlight), Buy the merch ($20), Push through (−1♥ each)     |

The cards found in several neighbourhoods:

| Card            | Neighbourhoods             | Options                                                                          |
| --------------- | -------------------------- | -------------------------------------------------------------------------------- |
| Cheese crates   | Distillery, Kensington     | Have a sniff (Stinky), Buy the cheese ($20), Hurry on (−1♥ each)                 |
| Green bin spill | Kensington, Yonge          | Wade through (Muddy), Pay for cleanup ($20), Hurry past (−1♥ each)               |
| Other dog       | High Park, Kensington      | Let them sniff ($20 of missed tips), Pull away (Zoomies), Keep moving (−1♥ each) |
| Skunk           | Cabbagetown, High Park     | Full groom ($20), Quick rinse (Stinky), Hold your nose (−1♥ each)                |
| Thief           | Beaches, Distillery, Yonge | Let the tips go ($20), Grab it back (−1♥ each), Dogs give chase (Zoomies)        |

The thief snatches the walker's tip pouch: Let the tips go loses it, Grab it back wins it back at a cost to the owners' patience, and Dogs give chase sends the pack after it. The escaped capybara is a regular bump in High Park: it steps once or twice and costs the touching dog's owner a heart, with no card or contact effect. The busker on Yonge Street is also a regular bump. Trash cans appear only in High Park and give Stinky on contact. The wedding photo shoot is 2 lanes wide; the other neighbourhood cards are 1.

A puddle opens no card: hitting one costs no heart and makes the pack _Muddy_, with a plain obstacle's hit stop. Kensington Market, the Distillery and Yonge Street have potholes in its place: a water-filled pothole looks and sounds its own but is a puddle in every rule, Raincoats included.

Six plain obstacles bring a debuff on contact: each is a puddle in every rule but its debuff, so the hit costs no heart and keeps a plain obstacle's hit stop. The frisbee dog (Cabbagetown) and the sign spinner (Yonge Street) bring Zoomies, trash cans (High Park), the seagull (The Beaches, Yonge Street) and barrel stacks (the Distillery) Stinky, and the stilt walker (Kensington Market, the Distillery) Spotlight. No neighbourhood has two contact sources of one debuff. Raincoats block only puddles and potholes. A contact is not a bump: no dog dodges it, Spotlight takes no cash for it, and it counts toward no bump tally or badge.

Every neighbourhood has at least two contact sources and at least two card types that bring debuffs; a debuff may come from both a contact source and a card. The table lists the debuffs available from each source, not how many a walk meets: that depends on each neighbourhood's encounter-pool and plain-obstacle counts in [`world.ts`](../../../src/data/world.ts), the weights within each pool and the player's choices.

| Neighbourhood       | Contact debuffs          | Card debuffs               |
| ------------------- | ------------------------ | -------------------------- |
| High Park           | Muddy, Stinky            | Stinky, Zoomies            |
| Cabbagetown         | Muddy, Zoomies           | Muddy, Stinky              |
| Kensington Market   | Muddy, Spotlight         | Muddy, Stinky, Zoomies     |
| The Beaches         | Muddy, Stinky            | Muddy, Spotlight, Zoomies  |
| Distillery District | Muddy, Spotlight, Stinky | Spotlight, Stinky, Zoomies |
| Yonge Street        | Muddy, Stinky, Zoomies   | Muddy, Spotlight, Zoomies  |

Puddles, potholes, contact obstacles and the card choices above apply debuffs. Cabbagetown and High Park have no Spotlight; every other neighbourhood has all four. Debuffs are mild. Each lasts 60 seconds of walking (Zoomies 40), or until the neighbourhood ends, whichever comes first. Nothing on the road cures one; it runs out. Applying one the pack already has restarts its time; none stacks. Each is announced in the message strip when it starts and when it ends. While it lasts, a bar in the debuff's own colour runs the full width of the game just below the top bar, over the clouds, with the debuff's icon and name, and drains over its time; each active debuff has its own bar, stacked one under another in the order they began, up to four. Hold a bar to see what the debuff does.

- **Muddy:** the pack's lane changes take about three times as long (67% slower). Bumps cost what they always do
- **Spotlight:** a bump costs $10 of cash on top of its hearts; with less on hand it takes what's left, and at $0 nothing. Second chance may forgive the heart, never the cash. A Spotlight bump keeps a bump's hit stop and grace window and counts toward bumps, bump-free neighbourhoods and bump badges
- **Stinky:** tips still appear, but a grabbed tip pays $0 and shows a red "+$0" label
- **Zoomies:** every 0.48 to 1.12 seconds of walking, drawn afresh each time, the pack tries to drift one extra lane: the way the player is moving if a lane change they started is under way (a tap's move after release included), otherwise left or right at even odds. A completed lane change, a pull or an automatic drift never supplies the direction. If the selected direction is blocked or at the road's edge, it tries the other direction if safe; if neither direction is safe, it stays put. Steering still works. Drift time advances only while walking, so a pause or card never queues extra moves on resuming. A drift never moves the pack into an obstacle it cannot react to, the same as a pull

## Pickups

- **Tips** add to [cash](economy.md#cash).
- **Treat:** a grab item, not carried. It goes to the dog nearest where it touched (the lead dog if only the walker touched it), whose owner gets +♥ up to the max; if that owner is already at max, the treat goes to the owner below their max with the fewest hearts (ties to the dog nearer the front), and if every owner is at max, the Fanny pack keeps it when it has room; otherwise the treat pays $5 of cash, a gain like any other (see [Feedback](rules.md#feedback)), counted with the tips on the end screen but never as a tip, so Stinky and Big tipper don't change it

## Lucky finds

Good things to bump into on purpose. Each neighbourhood places 1 lost wallet and, half the time, a friendly neighbour; High Park and The Beaches add a quarter (a second wallet 1 in 4 times, a neighbour 5 in 8). Its finds spread evenly: two in its first and last thirds, three in its first, middle and last fifths. None opens a card: each bobs on the road and pays out on contact, with a short popup where it was grabbed and a quip from the owners who gained. The friendly neighbour walks about, one or two quick steps in any direction and with no cue, since a cue marks a hazard about to move, so the pack has to go and meet her; the lost wallet lies still.

- **Friendly neighbour:** pats for the pack, the hearts jackpot: 3♥ shared by the walking dogs, lead dog first (a lone dog's owner +3♥; a pair's lead dog +2♥ and the other +1♥; a trio +1♥ each), each owner capped at their max; a heart an owner can't take goes to the next owner below their max, lead dog first, and is lost only when every owner is full, so a smaller pack gains more per dog
- **Lost wallet:** +$$ found money, the money jackpot
- **Gear drop:** a gear item, about one a neighbourhood (on average 0.5, 0.8, 1.2 and 1.5 in neighbourhoods 1 to 4, two at most, never the same item twice in one), drawn among the gear not in effect, the cheaper more likely, in proportion to 1/price. Grabbing it puts it in effect for the rest of the walk on top of the Pocket item, owned or not; a later grab swaps it, and the earlier find goes back. Long reach doesn't reach it. A found item works from the moment it's grabbed: Hall pass from the current neighbourhood, the Fanny pack from the next treat it can keep, and Lucky collar raises owners' max ♥ but not their hearts (and lowers it again if swapped away, current hearts above it dropping to the max)

## Upgrade cards

Walk-only boosts on the fork paths, from a pool of 6. Each fork draws its upgrades from the walk's seed, never from how the walk went: one path of a fork with more than one, at random, carries none, and every other path carries one drawn at random from the remaining pool, none twice and at most one trade-off. Picking a path takes its upgrade, which leaves the pool for the rest of the walk; "next neighbourhood" is the one that path leads to. Effects without "now" or "next neighbourhood" last the rest of the walk.

- Belly rubs: +1♥ to every owner now, up to their max
- Big tipper: every tip is worth $1 more in the next neighbourhood (a Stinky tip still pays $0)
- Charmer: the first card in each neighbourhood has free money options (hearts and debuffs still cost, see [Choice cards](#choice-cards))
- Good leash: no dog pulls toward squirrels
- Raincoats: puddles and potholes don't make the pack Muddy: no Muddy and no hit stop. A card's Muddy still applies
- Rush hour (trade-off): twice the tips and treats and 30% more obstacles in the next neighbourhood

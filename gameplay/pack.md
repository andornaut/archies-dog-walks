# Pack

Dogs, walkers and what happens when the pack meets an obstacle.

## Dogs

A roster of 9, three in each size, each a fixed, named character with its own art and one fixed owner. You start with 1 dog slot and Archie, and can buy up to 2 more slots and the other 8 dogs. Dog prices mix sizes: each price band ($200 to $400, $600 to $800, $1,100 to $2,200) has dogs of at least two sizes, so a cheap dog can be large and a pricey one small. Walking more dogs is the main progression: more pay and a longer-lasting walk, but more owners who can fire you.

Dogs differ in play by size only:

| Size   | ♥   | Effects                                                                                                                                                                                             |
| ------ | --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Small  | 2   | Dodges 1 in 5 of the bumps that would land on it, with a "Dodge!" label; the hit costs nothing and doesn't count as a bump. Each small dog makes lane changes 10% faster; its detail card says both |
| Medium | 3   | The baseline                                                                                                                                                                                        |
| Large  | 4   | Each large dog makes lane changes 10% slower, never below 10% slower than base; its detail card says so                                                                                             |

Size shows at a glance: on the road, medium dogs are drawn 48 px, large dogs 54 px and small dogs about 38 px, in every animation, with small dogs drawn chunky so they still read; doghouse faces and portraits differ less, about 1.2× and 0.8× on faces and 1.15× and 0.9× on portraits. Hit boxes don't change.

## Walkers

Four walkers. You start with Casey; each other walker unlocks the first time you finish a walk with at least so many dogs still walking at the end (see [Neighbourhood celebration](rules.md#neighbourhood-celebration)): Mr. B 1, Ada 2 and Trista 3, so a walk finished with 3 dogs unlocks all three. Every walker walks the same road at the same speed, and a walker's effects stack with the Pocket item and upgrade cards.

**Agility** sets how fast the pack changes lanes, as a multiple of the base lane-change speed. Walkers spread from 1.0 to 1.4, Running shoes add 1.0, each small dog in the pack adds 0.1 and each large dog takes 0.1 off, never below 0.9. The slowest pack's lane move (the 0.9 floor) sets the row spacing.

Each walker has one **perk**:

- **Keen eye** (Mr. B): 50% more tips and treats appear
- **Long reach** (Trista): the lead dog grabs tips and treats one lane to either side
- **Quick recovery** (Ada): debuffs last half as long
- **Second chance** (Casey): the first ♥ lost in each neighbourhood is forgiven (one heart; never Spotlight's cash); when several owners lose one at once, it forgives the owner left with the fewest hearts, ties to the lead dog

## The pack and hits

- **Formation:** the walker is at the bottom, the dogs close ahead in the same lane on visible leashes, every dog readable. The game sets the formation by size, never the player: the biggest dog leads in front (drawn behind the side dogs) and is the lead dog, the next biggest walks on the left and the smallest on the right; ties go by roster order (alphabetical by name). Two dogs walk side by side out front, a little less far forward than a 3-dog lead, the bigger on the left as the lead dog. One dog walks centred in the lead spot. No dog's hit box reaches into the next lane, so a pack fully in a lane never touches an obstacle in the lane beside it
- **Hit boxes:** one rectangle per dog and one for the walker, each a few pixels inside its sprite; leashes can't be hit. Obstacle sprites are drawn at 48 px, and each obstacle hits as drawn: 2 px inside its opaque outline, at its depth, within its own lanes. Touching any part of an obstacle counts as one hit. Once an obstacle is below the walker's feet it can no longer hit, however many rows it spans. Passing a mover is irreversible: once below the walker's feet, it cannot move back up into the pack or hit later, even if it has never been hit
- **Who a hit lands on:** a bump lands on the dog whose rectangle touched: if only the walker's did, on the lead dog; if several dogs' did, on the one nearest the contact. Card obstacles hit the whole pack. Pickups (tips, treats and lucky finds) collect anywhere in the pack's whole outline, leashes included. Lane changes sweep the pack, so a fast move across several lanes can't skip a hazard or a pickup
- **Bumps:** running into a plain obstacle with no contact effect is a bump, and costs 1♥ from the owner of the dog it lands on. Puddles, potholes and contact obstacles cost no heart and bring their debuff instead (see [Encounters and debuffs](encounters.md#encounters-and-debuffs)); card obstacles open a card. While Spotlight lasts, a bump also costs cash. See [Cash](economy.md#cash) for other changes and settlement.
- **After a hit:** each spawned obstacle can cause at most one bump across all of its components, even if its movement reverses. The whole obstacle is out of play at once but stays on the road as scenery (a trash can rocking, a mover stopped) and scrolls off with it, touching nothing. Obstacles are ignored for a 1-second grace window, during which the walker and all dogs blink together, or remain steadily dimmed with reduced motion; pickups still count
- **Hit stop:** a hit freezes the road and the pack briefly while it plays (about 1 second for a card obstacle, before its card; about 0.3 seconds for a plain obstacle or a puddle). Input is ignored during the stop, and it doesn't count as walk time. Lucky finds don't stop the walk

## Owner happiness

- **Owner happiness (♥):** one meter per dog, shown on its doghouse card; it never relies on colour alone. The dog's size sets its max (see [Dogs](#dogs)); a smaller pack adds to its lead dog's owner's max, by the pack the walk sets out with, and a firing never moves it: setting out with 1 dog, its owner gets +2♥; with 2, the lead dog's owner gets +1♥; with 3, nobody does. No owner's max goes above 6♥, whatever adds to it. While the pack chosen earns it, the start screen's Dogs band says so. Every heart looks the same, whatever adds it: the extra hearts a bonus adds (the small-pack bonus, Lucky collar) are drawn like the rest, and holding the card names each source. Every owner starts full, and treats restore hearts up to the max. At 0 the owner fires you with a quip and the dog leaves

## Pulls

Every dog pulls toward squirrels. A squirrel is no hit and opens no card: touching one does nothing, it darts across as an animal mover, and the pull is its only cost. Since nothing has to steer around it, a squirrel blocks no lane: the road keeps no room clear for it, it may dart across where obstacles stand, and no tip, treat or lucky find lies on its path. A dog pulls the pack one lane only toward a squirrel whose cue has started (one waiting at the road's edge draws no pull yet) and that is still ahead of the pack, and one dog strains at a time, the one nearest the squirrel side to side. If the straining dog's owner fires you, the strain ends and that squirrel draws no more. The dog strains for about 1 second, with a bubble over it, an arrow and a line to the squirrel, and a taut leash; then the pack lurches one lane toward the squirrel, unless you steer away during the strain, which cancels the pull; in an edge lane, pressing toward the edge counts as steering away. The message strip announces the strain as its cue; a cancel is quiet. The pull goes toward the squirrel's side as it is when the pack lurches, so a squirrel that crosses changes it, and a squirrel in the pack's own lane keeps the dog straining with no pull until it moves out of that lane. A pull never moves the pack into an obstacle it can't react to: if a lane-blocking obstacle or mover in the target lane would reach the pack within about two lane moves and a moment to react, the dog keeps straining and pulls once the lane clears. The strain ends with no pull if the squirrel goes first: off the road past the edge beside the pack, into the pack's rows, or away with the straining dog when its owner fires you.

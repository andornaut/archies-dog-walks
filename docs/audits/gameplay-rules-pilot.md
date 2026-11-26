# Gameplay rules pilot

Audited Archie at `9e8515df5a57b3f8c99f0e939cbdb1cebe16cb77`. The audit covers the eleven
tracked gameplay Markdown files and their Git-owned references, the rules work index, and
one observable rule. The existing deployment routes remain in their existing build and page
configuration.

## Rule verification

| Rule                                                                                  | Player-visible behaviour                                                                                                             | Source and check at the audited base                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Message strip priority](../design/gameplay/rules.md#rule-for-message-strip-priority) | Badges, hints and firing messages wait to be shown during a burst. Ordinary messages can age out or be dropped at the waiting limit. | `capWaiting` and `stepMessageStrip` in [messageStrip.ts](../../src/hud/messageStrip.ts). The burst tests in [messageStrip.test.ts](../../src/hud/messageStrip.test.ts) assert dwell, expiry, queue pressure and protected message order. |

The isolated message strip test file passed all 40 tests using the unchanged implementation
and test file from the audited base.

## Work history

`adw-0070` is done and has recorded deployment evidence. Scoped status showed no pending
user decision or linked request. The audit retained its exact decision and source SHAs.
Its [full earlier record](https://github.com/andornaut/archies-dog-walks/blob/2d6053a0ff63274899ce2839420a5f0ed750e736/docs/work/adw-0070.md)
preserves the previous wording. The previous record matches the audited base. The other
historical work files keep their bodies.

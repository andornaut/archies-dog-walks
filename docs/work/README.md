# Work items

This directory records requested scope and its outcome, separate from the current rules in [Design](../design/README.md).

Each user request is one file, `docs/work/<id>.md`, approved or not. It records scope and milestones; live
progress (claims, blocks, receipts and acceptance) stays in the work protocol state root. The
[design index](../design/README.md) links each logical area. The [rules index](index/rules.md)
lives in `docs/work/index/rules.md`. Other areas keep their tables in their design summaries.
Every work item appears in exactly one table for its `design` area.

| Front matter | Content                                                                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `id`         | `adw-` and a zero-padded sequence (`adw-0001`), allocated in order on `main`. An allocated ID never changes.                       |
| `title`      | A short imperative title.                                                                                                          |
| `status`     | `proposed` (until the user approves), `approved`, `done`, `declined` (the user declined), `cancelled` or `superseded`.             |
| `approved`   | A short approval reference, such as `user, 2026-11-18`; see the backfill forms below. A proposed item records the request instead. |
| `design`     | The design area in `docs/design/`.                                                                                                 |
| `related`    | A list of related work IDs.                                                                                                        |
| `supersedes` | The ID of the item this one replaces; omitted otherwise.                                                                           |

The sections are Scope, Criteria, Decisions and Outcome. Decisions and Outcome state what was
decided or delivered, and why, in a line or two each.

- Only `main` integrates index tables and approved scope. A request commits its work-file stub
  and index row on `main` as `proposed`, which allocates the ID; approval sets `approved`.
- Workers edit only their own work file and the design prose that ships with their feature.
  Integration sets `status: done` in the landing merge commit itself, which is how status tools
  prove landing and deployment.
- A changed or reverted decision is a new work item with `supersedes`. A finished item's outcome
  is never rewritten.
- A backfilled item whose approval date comes only from handoff records reads
  `approved: user, <date> (inferred from handoff history)`. One with no traceable approval reads
  `approved: unrecorded (<role>-shipped, <date>)`, dated by its first shipping commit.
- Work files are public: no session IDs, hostnames, local home-directory paths or quoted
  conversation, only short approval references.
- Docs-only changes run only the attribution and lint checks.
- The game never serves or deploys `docs/`: the build reads `pages/` and `public/`, and
  deployment uploads only `dist/`.

## Navigation

[Documentation](../README.md) · [Design areas](../design/README.md) · [Rules index](index/rules.md) · [Project](../../README.md)

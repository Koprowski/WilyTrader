# WilyTrader Agent Instructions

This repo is the local-only Padre paper-trading overlay that can export an
execution ledger and optionally sync into Snipalot.

## Planning System: Mission Control vs GitHub

`MC` means Mission Control.

Canonical Mission Control repo:

- GitHub: `Koprowski/mission-control`
- Local Windows path: `E:\Apps\mission-control`

Mission Control/WBS is the master portfolio map across projects. It includes
active work, shaped backlog, discovery items, and high-leverage opportunities
that should compete for attention.

GitHub Issues are the canonical source of truth for repo-specific implementation
detail: PRDs, epics, bugs, reviews, acceptance criteria, and engineering
follow-ups.

## Commit Traceability

Before pushing substantive Codex-authored repo changes, make sure there is a
durable trace target:

- GitHub issue or PR for repo-specific implementation detail;
- Mission Control WBS/briefing/logbook when priority, status, scope, re-entry,
  root cause, or portfolio context changed;
- repo-local handoff note when future agents need outcome, verification, or
  gotchas;
- OpenBrain capture when the lesson should be searchable across sessions;
- explicit digest-only note when no planning or follow-up surface needs to
  change.

Canonical policy: `E:\Apps\mission-control\resources\repo-change-traceability.md`.

## Agent Behavior

- Preserve unrelated local changes in this repo and in Mission Control.
- Do not create fallback Mission Control clones. Use `E:\Apps\mission-control`
  whenever Mission Control needs to be updated.
- Keep detailed implementation work in this repo or GitHub Issues; keep Mission
  Control compact and linked to the repo artifact.

## Recent handoff notes

- **Master sync UI (local branch):** WilyTrader Desktop now bundles the master
  sync scripts from `desktop/resources/trade-sync`, exposes a Settings field
  for the master workbook path, and has a **Sync Master** button in the
  last-completed-session panel. The button runs the bundled
  `run-trade-sync.ps1` with `-CapturesRoot` and `-MasterPath` only, so it does
  not request archive backfill, then opens the configured master workbook when
  the sync succeeds.
- **Master sync meta clusters (local branch):** Desktop export and bundled
  master sync normalize missing meta names to `unknown` and assign
  `WT.yymmdd.n` cluster IDs. Known repeat metas reuse their first assigned
  cluster ID, while `unknown` rows always allocate the next daily cluster ID.
- **Master workbook/export alignment (local branch):** Desktop trade logs now
  sort trades by exit time, emit `entry_date` and `exit_date` instead of the
  old `trade_date`/`entry_time_inferred` shape, and carry workbook formulas for
  P&L %, time buckets, running counts, OHLC %, cooldown, cluster, and
  `trade_num_in_session` columns so the session workbook lines up with the
  current master workbook schema. The live WilyTrader-owned sync script at
  `E:\Apps\WilyTrader Captures\Trade Sync Scripts\finalize-master-workbook.ps1`
  was also updated to use `entry_date`, trim chart ranges to real non-error
  data rows, and adjust X-axis label intervals for chart 1 and chart 2. A live
  finalizer run against `E:\Apps\WilyTrader Captures\master trading log.xlsx`
  completed with no warnings after backing up the workbook under
  `Archive\master trading log backups`.
- **Axiom token names for Snipalot trade logs (local branch):** WilyTrader now
  tries to read Axiom chart/header text such as `Save Snuggles/USD on Pump V1`
  before falling back to a shortened mint address, and
  `mockapeCompatibleTrades` now includes `entryTimestamp`, `firstEntryAt`,
  `timeInTradeSeconds`, and `tokenAddress` so Snipalot can generate actual
  entry times from the execution ledger.
- **P&L tracker border alignment:** The floating P&L tracker now uses the same
  `1.6px solid #1f5f93` blue border and matching blue outer ring style as the
  main WilyTrader panel.
- **Version:** Extension manifest bumped to `0.3.16`.
- **Validation:** `node --check E:\Apps\wilytrader\extension\src\content.js`
  passed. The pre-existing local edit to session P&L basis in
  `extension/src/content.js` was preserved.

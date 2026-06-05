# WilyTrader Handoff

## 2026-06-05 Desktop UI Reload Update Refresh

Resolution in Desktop/extension `0.4.3`: renderer startup now forces Desktop
and extension update-status refreshes after the first status render. Electron
reload recreates the UI but keeps the main process alive, so this bypasses the
main-process `checkedAt` cache in the same way as pressing **Refresh Status**.

Validation:

- `npm --prefix desktop run typecheck`
- `npm --prefix desktop run dist:win`

## 2026-06-05 Desktop OHLC Screenshot Links

Finding: `ohlc_screenshot` links could repeat the same screenshot across
multiple trade-log rows. The selector first tried direct execution
`screenshotPath` values, but archived sessions move the folder and make those
stored absolute paths stale. Once direct lookup failed, the fallback matched by
token filename and picked the last sell screenshot, so repeated same-token rows
could point to the same final screenshot.

Resolution in Desktop/extension `0.4.2`: Desktop now re-resolves stale
screenshot paths by basename inside the current session screenshot folder,
matches screenshot files by execution ID, then uses screenshot metadata with
token and trade-window checks before falling back to token-only filename
matching. The fallback now scores screenshots by side and distance to the
trade's entry/exit time.

Validation:

- `npm --prefix desktop run typecheck`
- `npm --prefix desktop run build`
- Archived-session screenshot selector probe against
  `E:\Apps\WilyTrader Captures\Archive\20260604.2312 Trade`

## 2026-06-05 Desktop Master Template Seeding

Finding: the master workbook finalizer still applied OHLC SOL/percent formats by
fixed column ranges. That broke after the OHLC SOL columns moved to `BH:BK` and
the OHLC percent columns moved to `BL:BN`. New Desktop installs also did not
seed a master workbook into the selected captures folder, so Sync Master could
fail before the user had a correctly shaped workbook.

Resolution in Desktop/extension `0.4.1`: the finalizer now applies OHLC formats
by header pattern, the packaged trade-sync resources include
`master trading log - Template.xlsx`, and Desktop copies that template to
`<captures folder>\master trading log.xlsx` when the configured master path is
the default path and the workbook does not already exist. Existing master
workbooks are not overwritten. Desktop update checks now run automatically at
startup and every six hours, and the update UI distinguishes Desktop installer
downloads from extension reloads in Chrome.

Validation:

- PowerShell parser check passed for the repo and live finalizer scripts.
- A temp workbook finalizer run confirmed `ohlc_sol_*` cells use `0.000` and
  `ohlc_pct_*` cells use `0.0%`.
- `npm --prefix desktop run typecheck`

## 2026-06-04 Axiom Multi-Tab Target Monitoring Phase 1

Session reviewed: `E:\Apps\WilyTrader Captures\20260604.1851 Trade`.

Finding: the Fortnite/FORTNIT Pulse path queued one token key but Axiom opened
a different token page. The old Pulse auto-buy path continued with the opened
page token, and the local buy did not persist/sync to the Desktop ledger, so no
durable exit target existed for the intended Fortnite token. Separately, the
per-tab content-script model made multi-tab quote monitoring fragile because
the active tab could be FIXER while another tab's title showed FORTNIT moving.

Resolution in extension `0.3.59`: Pulse auto-buy now cancels on source token
mismatch. The background worker keeps a lightweight Axiom quote registry fed by
content-script heartbeats and Chrome tab-title updates. Armed exit targets now
query that registry for the freshest matching-token quote before evaluating
stop/target triggers.

Validation:

- `node --check extension\src\content.js`
- `node --check extension\src\background.js`
- `node --check extension\src\userscript-wrapper.user.js`
- `git diff --check`

Next manual test: reload the unpacked extension, confirm version `0.3.59`, open
multiple Axiom token tabs, arm a target/stop, and confirm session logs show
quote heartbeats plus target-trigger diagnostics for the matching token.

## 2026-06-04 Axiom Platform Fee Default

Finding: Axiom's published fee table lists the base Wood tier net fee as
`0.95%`, not `0.095%`. The WilyTrader setting is stored as a percent value and
divided by 100 during fee calculation, so the correct default value is `0.95`.

Resolution in extension `0.3.57`: default `platformFeePct` is now `0.95`,
the settings input accepts hundredths, and stored profiles that still have the
old `2%` default migrate to `0.95%`. User-customized non-2% values are left
alone.

Validation:

- `node --check extension\src\content.js`
- `node --check extension\src\userscript-wrapper.user.js`
- `git diff --check`

## 2026-06-04 Desktop OHLC SOL Marking

Session reviewed: `E:\Apps\WilyTrader Captures\20260603.2349 Trade`.

Clarification: `ohlc_sol_open` was intentionally calculated as prior
cumulative SOL P&L minus `2 * buyFeesNative`. In the reviewed UPTIMIST trade,
buy fees were `0.021005 SOL`, so the open printed as about `-0.042 SOL`.
That represents the conservative entry-fee plus estimated exit-fee hole.

Resolution in Desktop `0.1.11`: `ohlc_sol_high`, `ohlc_sol_low`, and the
sampled close point now use the sampled market-cap OHLC movement from entry
market cap, instead of relying only on execution points. The final
`ohlc_sol_close` remains anchored to the actual post-exit trade P&L so it still
matches `pnl_sol`.

Validation:

- `npm --prefix E:\Apps\wilytrader\desktop run typecheck`
- `npm --prefix E:\Apps\wilytrader\desktop run build`
- `git diff --check`

## 2026-06-04 Axiom Execution Quote Hydration Gate

Session reviewed: `E:\Apps\WilyTrader Captures\20260603.2313 Trade`.

Finding: the Screwworm Pulse buy did not fire before the token page loaded, but
the newly loaded Axiom page briefly reported a stale title/header quote of
`$1.99K` before updating to `$5.58K` and then `$6.62K` within about one second.
The execution guard trusted the first title/header quote as long as those two
sources agreed, so the buy was recorded at the stale `$1.99K` value.

Resolution in extension `0.3.56`: Axiom buy/sell execution now waits for the
title/header market cap to be execution-ready. A quote is ready only after a
fresh chart quote confirms it within tolerance, or after the same title/header
quote has remained stable for at least 900 ms. Manual buy/sell clicks wait
briefly inside the original action so the first click is not lost; Pulse
auto-buy continues to retry through its queued readiness loop.

Validation:

- `node --check extension\src\content.js`
- `node --check extension\src\userscript-wrapper.user.js`
- `git diff --check`

Next manual test: reload the unpacked extension, confirm version `0.3.56`, use
Pulse quick buy on a fast-moving Axiom token, and confirm session logs show
`buy-blocked-no-current-axiom-quote` while the title/header quote is still
hydrating instead of recording an early stale fill.

## 2026-06-03 Axiom Stop Trigger Source

Session reviewed: `E:\Apps\WilyTrader Captures\20260603.1700 Trade`.

Finding: the FIXER take-profit and stop-loss targets were both stored, but the
extension never fired the stop because the target watcher evaluated the stale
Axiom title/header quote at `$22.3K`. The user's visible chart crossed the
`$21K` stop, but WilyTrader's selected market-cap source and OHLC sampler stayed
flat at `$22.3K`.

Resolution in extension `0.3.53`: the injected Axiom chart bridge now posts a
250 ms latest-price feed from the TradingView main series. `content.js` uses
that fresh chart quote for live P&L marking, OHLC range sampling, and armed
stop/target trigger checks. Buy/sell execution fills still require the
authoritative Axiom title/header quote, preserving the prior entry-price guard.

Validation:

- `node --check extension\src\content.js`
- `node --check extension\src\userscript-wrapper.user.js`
- `.\desktop\node_modules\.bin\tsc --target es2020 --lib 'dom,es2020' --noEmit --strict false extension/src/axiomChartBridge.ts`
- `git diff --check`

Next manual test: reload the unpacked extension, confirm version `0.3.53`, open
an Axiom token page, arm a 100% stop and target, and confirm session logs show
`axiomChartLatest` plus `target-trigger-quote` when a target is touched.

## 2026-06-04 Trade Log Workbook Formatting

Desktop `0.1.8` fixes two workbook export gaps:

- `trade_date` is now written as an Excel numeric date serial with date number
  formatting instead of text.
- `ohlc_source` hyperlink matching now resolves the exit PNG by execution id
  first, then falls back to token name/address matching. The prior fallback
  preferred token address, but screenshot filenames use token name plus
  execution id, so rows were exported without hyperlink relationships even when
  `Inputs\trade-screenshots\*.png` existed.

Validation:

- `npm --prefix E:\Apps\wilytrader\desktop run typecheck`
- `npm --prefix E:\Apps\wilytrader\desktop run build`
- `git diff --check`

## 2026-06-04 Trade Log Size Basis and Screenshot Formula Links

Session reviewed: `E:\Apps\WilyTrader Captures\20260603.2224 Trade`.

Finding: the Desktop workbook normalized `sol_invested` as
`investedNative + buyFeesNative`, so a 0.5 SOL requested entry exported as
0.521 SOL and failed `size_ok`. The underlying extension execution model still
tracks the wallet debit separately, but the workbook sizing and trade-level P&L
basis should use the requested/base investment amount.

Resolution in Desktop `0.1.9` and extension `0.3.54`: trade-log export now uses
`investedNative` as `sol_invested`, calculates post-fee P&L from
`netReceivedNative - investedNative`, preserves buy/sell fees in their own
columns, and keeps exit-leg cost-basis allocation on the base investment plus
prorated entry fees. The Trade Log sheet also adds an
`ohlc_screenshot_path` column written as an Excel `HYPERLINK(...)` formula with
the local PNG path as visible text.

Validation:

- `npm --prefix E:\Apps\wilytrader\desktop run typecheck`
- `npm --prefix E:\Apps\wilytrader\desktop run build`
- `node --check extension\src\content.js`
- `git diff --check`

## 2026-06-04 Axiom Stop/Target Line Move Hardening

Finding: draggable Axiom stop/target lines already attempted to update the
backing `state.exitTargets` row, but the chart bridge payload used the generic
field name `positionId` even though WilyTrader was passing a target id for exit
target lines. That made the path harder to reason about and fragile if future
bridge messages carried both position and target identifiers.

Resolution in extension `0.3.55`: movable stop/target line messages now carry
an explicit `targetId` plus `tradePositionId`. The content-script listener
resolves by `targetId` first, falls back only for legacy payloads, persists the
new `marketCapUsd`, clears `triggeredAt`, resets chart sync, and logs
`chart-line-moved-applied` with the old/new market cap after persistence.

Validation:

- `node --check extension\src\content.js`
- `node --check extension\src\userscript-wrapper.user.js`
- `.\desktop\node_modules\.bin\tsc --target es2020 --lib 'dom,es2020' --noEmit --strict false extension/src/axiomChartBridge.ts`
- `git diff --check`

## 2026-06-04 Trade Log OHLC Screenshot Column Cleanup

Session reviewed: `E:\Apps\WilyTrader Captures\20260603.2249 Trade`.

Finding: the generated Trade Log included `ohlc_sample_count`, `ohlc_source`,
and `ohlc_screenshot_path`. The screenshot hyperlink formula worked, but the
visible cell text repeated the full local path, making the final columns noisier
than needed for the master log.

Resolution in Desktop `0.1.10`: the Trade Log no longer emits
`ohlc_sample_count` or `ohlc_source`. The screenshot column is now
`ohlc_screenshot`; it still writes an Excel `HYPERLINK(...)` formula with the
full local file URL target, but the displayed text is only the PNG filename.

Validation:

- `npm --prefix E:\Apps\wilytrader\desktop run typecheck`
- `npm --prefix E:\Apps\wilytrader\desktop run build`
- `git diff --check`

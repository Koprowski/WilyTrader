# WilyTrader Handoff

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

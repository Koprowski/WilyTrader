# WilyTrader Extension

Local-only Padre.gg and Axiom paper-trading overlay with execution-ledger JSON export and optional Snipalot localhost sync.

## Install In Chrome

This extension is loaded directly from source. It is not approved by, packaged for, or installed from the Chrome Web Store.

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select the `extension/` folder from this repository.
5. Confirm that **WilyTrader** appears in the extensions list.
6. Open a supported token page such as `https://trade.padre.gg/trade/solana/...` or `https://axiom.trade/meme/...`.

Chrome may show developer-mode warnings for unpacked extensions. That is normal for a local, non-Web-Store extension. Keep Developer mode enabled, and click the extension's reload button on `chrome://extensions` after changing local files. The WilyTrader settings panel also has an **Open Extensions** button that opens the Chrome extension manager for reloads.

## Update Notices

WilyTrader can check public GitHub tag metadata for the latest extension version. When the installed unpacked extension is behind, the panel shows an update notice with an **Open Extensions** button so the user can reload after pulling or downloading the updated files. This does not install anything automatically.

## Behavior

- Shows the overlay only on Padre token pages and Axiom meme token pages (`https://axiom.trade/meme/...`).
- Keeps Axiom home, discover, pulse, trackers, and other non-token routes hidden.
- Uses only `chrome.storage.local`.
- Does not connect to wallets.
- Does not read seed phrases, private keys, wallet providers, or transactions.
- Does not call any trading backend. With update checks enabled, it fetches public GitHub tag metadata to compare extension versions.
- Keeps Snipalot localhost sync off by default.

## Ledger Export

Use **Save JSON** or the header download button in the overlay. The export includes:

- Current paper balances.
- Current open paper positions.
- Every buy/sell execution in `executions`.
- Derived `openPositions`, `closedPositions`, and `positions` summaries.
- Scale-in/out counts, VWAP entry/exit market caps, fees, slippage, and pre/post-fee P&L.
- `mockapeCompatibleTrades` for Snipalot's current compact outcome join.
- Settings used for simulation.
- Optional notes entered in the overlay.

Use the header **+** control to add local fake SOL/BNB or seed a current-token paper position.

The sell controls default to an 8-button grid. The buy controls use six preset buttons plus a custom amount input and Buy button. Use the header plus button to add paper funds or seed a current-token paper position. The inline slippage, rocket, and money-hand icons are active execution settings:

- Slippage changes the simulated execution price and the delayed-execution movement cap.
- Gas is fixed at `0.000005` native. Gas, priority, platform, and bribe fees are debited from buys, removed from sell proceeds, and exported in each execution.
- Delay is active. With custom delay off, priority plus bribe maps to a randomized faster/slower execution delay; with custom delay on, the configured millisecond delay is used directly.
- Defaults use an aggressive meme-trading paper model: base gas `0.000005`, priority `0.007`, and bribe `0.003` native per side.

When Snipalot sync is enabled in WilyTrader settings, the extension tries to POST the latest ledger to:

`http://127.0.0.1:17365/v1/wilytrader/ledger`

If Snipalot is not recording, the sync fails closed and the overlay remains local-only. Snipalot sync is disabled by default. Trade-time Chrome fallback downloads are screenshot-only; use **Save JSON** when you want a ledger file.

The export file is named like:

`wilytrader-axiom-ledger-2026-05-25T23-00-00-000Z.json`

## Axiom Native Chart Lines

WilyTrader injects `src/userscript-wrapper.user.js` on `https://axiom.trade/*`.
That page-context bridge exposes `window.__wileyChartBridge` and listens for
messages from the extension:

```js
function syncNativeLines(position) {
  const post = (message) => window.postMessage({ source: "wileytrader", ...message }, window.location.origin);
  if (!position) return post({ op: "clearAll" });
  post({
    op: "upsert",
    positionId: position.id,
    kind: "avg_entry",
    price: position.entryMarketCapVwapUsd,
    style: { color: "#22c55e", labelText: `AVG ENTRY ${position.entryMarketCapVwapUsd}` },
  });
  if (position.sellCount > 0) {
    post({
      op: "upsert",
      positionId: position.id,
      kind: "avg_exit",
      price: position.exitMarketCapVwapUsd,
      style: { color: "#ef4444", labelText: `AVG EXIT ${position.exitMarketCapVwapUsd}` },
    });
  } else {
    post({ op: "remove", positionId: position.id, kind: "avg_exit" });
  }
}
```

Known fragility points:

- The bridge depends on Axiom's `tradingview_<hex>` iframe id pattern.
- The preferred path uses `tradingViewApi.activeChart().createShape`; if Axiom
  removes that API, the fallback uses private `chartWidget._model.createLineTool`.
- The bridge assumes Axiom's `blob:` TradingView iframe is reachable from a
  page-context script. Content scripts alone cannot see these page JS handles.
- Run `window.__wileyChartBridge.selfTest()` in DevTools after Axiom updates.
  It logs one health line showing iframe, public API, fallback API, and symbol
  status.

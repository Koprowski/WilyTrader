# WilyTrader Extension

Local-only Padre.gg paper-trading overlay with execution-ledger JSON export and optional Snipalot localhost sync.

## Install In Chrome

This extension is loaded directly from source. It is not approved by, packaged for, or installed from the Chrome Web Store.

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select the `extension/` folder from this repository.
5. Confirm that **WilyTrader** appears in the extensions list.
6. Open a Padre token page such as `https://trade.padre.gg/trade/solana/...`.

Chrome may show developer-mode warnings for unpacked extensions. That is normal for a local, non-Web-Store extension. Keep Developer mode enabled, and click the extension's reload button on `chrome://extensions` after changing local files.

## Behavior

- Runs only on `https://trade.padre.gg/*`.
- Uses only `chrome.storage.local`.
- Does not connect to wallets.
- Does not read seed phrases, private keys, wallet providers, or transactions.
- Does not call any internet backend.
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

The sell controls default to a Padre-style 8-button grid. The buy controls use six preset buttons plus a custom amount input and Buy button. Use the header plus button to add paper funds or seed a current-token paper position. The inline slippage, rocket, and money-hand icons are active execution settings:

- Slippage changes the simulated execution price and the delayed-execution movement cap.
- Gas is fixed at `0.000005` native. Gas, priority, platform, and bribe fees are debited from buys, removed from sell proceeds, and exported in each execution.
- Delay is active. With custom delay off, priority plus bribe maps to a randomized faster/slower execution delay; with custom delay on, the configured millisecond delay is used directly.
- Defaults use an aggressive meme-trading paper model: base gas `0.000005`, priority `0.007`, and bribe `0.003` native per side.

When Snipalot sync is enabled in WilyTrader settings, the extension tries to POST the latest ledger to:

`http://127.0.0.1:17365/v1/wilytrader/ledger`

If Snipalot is not recording, the sync fails closed and the overlay remains local-only. Snipalot sync is disabled by default.

The export file is named like:

`wilytrader-padre-ledger-2026-05-25T23-00-00-000Z.json`

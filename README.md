# WilyTrader

Local-only Chrome extension for Padre.gg paper trading with execution-ledger export and optional Snipalot localhost sync.

## What It Does

- Adds a draggable WilyTrader overlay on `https://trade.padre.gg/*`.
- Simulates paper buys and sells without connecting to wallets.
- Tracks execution-level fees, slippage, delay, and P&L.
- Exports a ledger JSON file with executions, open positions, closed positions, notes, settings, and Snipalot-compatible trade summaries.
- Optionally syncs the ledger to Snipalot over `http://127.0.0.1:17365/v1/wilytrader/ledger` during active trade recordings.

## Install Locally

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select `E:\Apps\wilytrader\extension`.
5. Open a Padre token page.

## Privacy Boundary

WilyTrader is content-script only. It does not connect to wallets, request seed phrases, sign transactions, or use a backend. Core paper-trading data is stored in `chrome.storage.local`; Snipalot sync is localhost-only and optional.

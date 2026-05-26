# WilyTrader

Local-only Chrome extension for Padre.gg and Axiom paper trading with execution-ledger export and optional Snipalot localhost sync.

## What It Does

- Adds a draggable WilyTrader overlay on Padre token pages and Axiom meme token pages (`https://axiom.trade/meme/...`).
- Simulates paper buys and sells without connecting to wallets.
- Tracks execution-level fees, slippage, delay, and P&L.
- Exports a ledger JSON file with executions, open positions, closed positions, notes, settings, and Snipalot-compatible trade summaries.
- Can optionally sync the ledger to Snipalot over `http://127.0.0.1:17365/v1/wilytrader/ledger` during active trade recordings.

## Install Locally In Chrome

WilyTrader is not installed from the Chrome Web Store. Install it as an unpacked extension:

1. Download or clone this repository.
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** in the top-right corner.
4. Click **Load unpacked**.
5. Select this repo's `extension/` folder, not the repo root.
6. Chrome should show **WilyTrader** in the extensions list.
7. Open a supported token page at `https://trade.padre.gg/*` or `https://axiom.trade/meme/...`.

Chrome may label unpacked extensions as developer-mode or non-Web-Store extensions. That is expected for local development. Keep Developer mode enabled for the extension to remain loaded, and use the reload button on `chrome://extensions` after editing files.

## Privacy Boundary

WilyTrader is content-script only. It does not connect to wallets, request seed phrases, sign transactions, or use an internet backend. Core paper-trading data is stored in `chrome.storage.local`.

Snipalot sync is localhost-only and opt-in. To enable it, open the WilyTrader settings panel and turn on **Sync to Snipalot localhost bridge**. When enabled, the extension POSTs the current ledger export to `http://127.0.0.1:17365/v1/wilytrader/ledger`. Trade-time Chrome fallback downloads are screenshot-only; use **Save JSON** when you want a ledger file.

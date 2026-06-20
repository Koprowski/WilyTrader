# WilyTrader

Local-only WilyTrader workspace for Axiom.trade (primary) & Padre.gg (worked a few weeks ago but not maintained) paper trading. The existing Chrome extension remains in `extension/`; the new audio-first desktop vertical slice lives in `desktop/`.

## What It Does

- Adds a draggable WilyTrader overlay on Padre token pages and Axiom meme token pages (`https://axiom.trade/meme/...`).
- Shows a draggable, resizable portfolio and session P&L tracker across supported Padre and Axiom pages.
- Simulates paper buys and sells without connecting to wallets.
- Tracks execution-level fees, slippage, delay, and P&L.
- Exports a ledger JSON file with executions, open positions, closed positions, notes, settings, and Snipalot-compatible trade summaries.
- Can optionally sync the ledger to WilyTrader Desktop over `http://127.0.0.1:17365/v1/wilytrader/ledger` during active trade sessions.
- WilyTrader Desktop owns audio-first session folders, microphone recording, transcript artifacts, bridge intake, trade screenshots, and `trade_log.xlsx` / `trade_log.md` generation.

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

## Keep It Updated

If the repo was cloned with Git, pull the latest files and reload the unpacked extension:

```powershell
git -C C:\Tools\WilyTrader pull --ff-only
```

Replace `C:\Tools\WilyTrader` with the local folder that contains this repo. After the pull finishes, open `chrome://extensions` and click reload on **WilyTrader**. The in-extension update notice can open the Chrome extensions page, but Chrome still requires the reload click for unpacked extensions.

If Git is not installed, download the latest ZIP from GitHub, replace the local repo folder, and reload the unpacked extension from `chrome://extensions`.

## Privacy Boundary

WilyTrader is content-script only. It does not connect to wallets, request seed phrases, sign transactions, or use an internet backend. Core paper-trading data is stored in `chrome.storage.local`.

WilyTrader Desktop sync is localhost-only and opt-in. To enable it, start a WilyTrader Desktop trade session, then open the WilyTrader extension settings panel and enable the bridge. When enabled, the extension POSTs the current ledger export to `http://127.0.0.1:17365/v1/wilytrader/ledger`. Trade-time Chrome fallback downloads are screenshot-only; use **Save JSON** when you want a ledger file.

## Desktop Slice

```powershell
cd E:\Apps\wilytrader-desktop\desktop
npm install
npm run build
npm start
```

See `desktop/README.md` and `desktop/ARCHITECTURE.md` for the architecture, session folder shape, and intentionally omitted Snipalot features.

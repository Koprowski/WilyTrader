# WilyTrader Extension

Local-only Padre.gg paper-trading overlay with execution-ledger JSON export and optional Snipalot localhost sync.

## Install

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select `E:\Apps\wilytrader\extension`.
5. Open a Padre token page such as `https://trade.padre.gg/trade/solana/...`.

## Behavior

- Runs only on `https://trade.padre.gg/*`.
- Uses only `chrome.storage.local`.
- Does not connect to wallets.
- Does not read seed phrases, private keys, wallet providers, or transactions.
- Does not call any backend.

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

Use the **Paper Balance** control in the overlay to add local fake SOL/BNB for more test trades.

The buy/sell controls default to Padre-style 8-button grids. The inline **Max Slip**, **Gas**, **Prio**, and **Bribe** fields are active execution settings:

- Slippage changes the simulated execution price and the delayed-execution movement cap.
- Gas, priority, platform, and bribe fees are debited from buys, removed from sell proceeds, and exported in each execution.
- Delay is active. With custom delay off, priority plus bribe maps to a randomized faster/slower execution delay; with custom delay on, the configured millisecond delay is used directly.
- Defaults use an aggressive meme-trading paper model: base gas `0.000005`, priority `0.007`, and bribe `0.003` native per side.

During a Snipalot Trade recording, the extension also tries to POST the latest ledger to:

`http://127.0.0.1:17365/v1/wilytrader/ledger`

If Snipalot is not recording, the sync fails closed and the overlay remains local-only.

The export file is named like:

`wilytrader-padre-ledger-2026-05-25T23-00-00-000Z.json`

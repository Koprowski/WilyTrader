(() => {
  "use strict";

  const STORAGE_KEY = "wilytrader_state_v2";
  const SCHEMA_VERSION = 4;
  const LEGACY_DEFAULT_BUY_AMOUNTS = [0.1, 0.2, 0.5, 1];
  const LEGACY_DEFAULT_SELL_PERCENTS = [10, 25, 50, 100];
  const PADRE_DEFAULT_FEES = {
    gasFeeNative: 0.001,
    priorityFeeNative: 0.01,
    bribeFeeNative: 0,
  };
  const AGGRESSIVE_MEME_FEES = {
    gasFeeNative: 0.000005,
    priorityFeeNative: 0.007,
    bribeFeeNative: 0.003,
  };
  const LEGACY_STORAGE_KEYS = [
    "wilytrader_state_v1",
    ["wily", "mem", "trader_state_v2"].join(""),
    ["wily", "mem", "trader_state_v1"].join(""),
  ];
  const BRIDGE_BASE_URL = "http://127.0.0.1:17365/v1/wilytrader";
  const MARKET_CAP_SUPPLY = 1_000_000_000;
  const DEFAULT_PRICES = { SOL: 190, BNB: 600 };
  const DEFAULT_STATE = {
    schemaVersion: SCHEMA_VERSION,
    balances: { SOL: 3, BNB: 1 },
    positions: {},
    closedPositions: [],
    executions: [],
    notes: [],
    settings: {
      buyAmounts: [0.1, 0.25, 0.5, 1, 3, 0.005, 5, 7],
      sellPercents: [5, 15, 33, 55, 20, 40, 86, 100],
      platformFeePct: 2,
      buyGasFeeNative: AGGRESSIVE_MEME_FEES.gasFeeNative,
      sellGasFeeNative: AGGRESSIVE_MEME_FEES.gasFeeNative,
      buyPriorityFeeNative: AGGRESSIVE_MEME_FEES.priorityFeeNative,
      sellPriorityFeeNative: AGGRESSIVE_MEME_FEES.priorityFeeNative,
      buyBribeFeeNative: AGGRESSIVE_MEME_FEES.bribeFeeNative,
      sellBribeFeeNative: AGGRESSIVE_MEME_FEES.bribeFeeNative,
      buySlippagePct: 80,
      sellSlippagePct: 80,
      useCustomDelay: false,
      customDelayMs: 1000,
      panelPosition: null,
      bridgeEnabled: true,
    },
  };

  const selectors = {
    root: "wt-root",
    panel: "wt-panel",
    minimized: "wt-minimized",
    status: "wt-status",
    bridge: "wt-bridge",
    token: "wt-token",
    price: "wt-price",
    balance: "wt-balance",
    position: "wt-position",
    log: "wt-log",
    settingsModal: "wt-settings-modal",
    logModal: "wt-log-modal",
  };

  let state = null;
  let activeToken = null;
  let root = null;
  let lastRouteKey = "";
  let bridgeState = { active: false, lastMessage: "Bridge idle" };
  let tradeInFlight = false;

  const formatters = {
    native(value, chain) {
      return `${Number(value || 0).toFixed(4)} ${chain}`;
    },
    usd(value) {
      if (!Number.isFinite(value)) return "$0";
      if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
      if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
      if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
      return `$${value.toFixed(2)}`;
    },
    pct(value) {
      const sign = value > 0 ? "+" : "";
      return `${sign}${Number(value || 0).toFixed(2)}%`;
    },
  };

  async function initialize() {
    state = await loadState();
    injectPanel();
    updateActiveToken();
    render();
    bindRouteWatcher();
    void syncBridge("startup");
  }

  function storageGet(keys) {
    return new Promise((resolve) => {
      const storage = getChromeStorage();
      if (!storage) return resolve({});
      try {
        storage.get(keys, (items) => {
          const error = getChromeLastError();
          if (error) {
            handleExtensionContextError(error);
            resolve({});
          } else {
            resolve(items || {});
          }
        });
      } catch (error) {
        handleExtensionContextError(error);
        resolve({});
      }
    });
  }

  function storageSet(key, value) {
    return new Promise((resolve) => {
      const storage = getChromeStorage();
      if (!storage) return resolve(false);
      try {
        storage.set({ [key]: value }, () => {
          const error = getChromeLastError();
          if (error) {
            handleExtensionContextError(error);
            resolve(false);
          } else {
            resolve(true);
          }
        });
      } catch (error) {
        handleExtensionContextError(error);
        resolve(false);
      }
    });
  }

  function getChromeStorage() {
    try {
      return chrome?.storage?.local || null;
    } catch (error) {
      handleExtensionContextError(error);
      return null;
    }
  }

  function getChromeLastError() {
    try {
      return chrome?.runtime?.lastError || null;
    } catch (error) {
      return error;
    }
  }

  function handleExtensionContextError(error) {
    const message = error?.message || String(error || "");
    if (message.includes("Extension context invalidated")) {
      setStatus("Extension reloaded. Refresh the Padre tab to reconnect WilyTrader.");
      return;
    }
    console.error("[WilyTrader]", error);
  }

  async function loadState() {
    const stored = await storageGet([STORAGE_KEY, ...LEGACY_STORAGE_KEYS]);
    const legacyState = LEGACY_STORAGE_KEYS.map((key) => stored[key]).find(Boolean);
    return normalizeState(stored[STORAGE_KEY] || legacyState);
  }

  function normalizeState(stored) {
    const executions = Array.isArray(stored?.executions)
      ? stored.executions
      : migrateLegacyTrades(stored?.trades);
    const merged = {
      ...DEFAULT_STATE,
      ...(stored || {}),
      schemaVersion: SCHEMA_VERSION,
      balances: { ...DEFAULT_STATE.balances, ...(stored?.balances || {}) },
      positions: { ...(stored?.positions || {}) },
      closedPositions: Array.isArray(stored?.closedPositions) ? stored.closedPositions : [],
      executions,
      notes: Array.isArray(stored?.notes) ? stored.notes : [],
      settings: { ...DEFAULT_STATE.settings, ...(stored?.settings || {}) },
    };
    if ((stored?.schemaVersion || 0) < SCHEMA_VERSION) {
      migrateSettingsToCurrentDefaults(merged.settings, stored?.settings || {});
    }
    if (!Array.isArray(merged.settings.buyAmounts) || merged.settings.buyAmounts.length === 0) {
      merged.settings.buyAmounts = DEFAULT_STATE.settings.buyAmounts;
    }
    if (!Array.isArray(merged.settings.sellPercents) || merged.settings.sellPercents.length === 0) {
      merged.settings.sellPercents = DEFAULT_STATE.settings.sellPercents;
    }
    if (stored?.settings?.slippagePct !== undefined) {
      merged.settings.buySlippagePct = Number(stored.settings.slippagePct) || DEFAULT_STATE.settings.buySlippagePct;
      merged.settings.sellSlippagePct = Number(stored.settings.slippagePct) || DEFAULT_STATE.settings.sellSlippagePct;
    }
    if (stored?.settings?.feeNative !== undefined) {
      merged.settings.buyPriorityFeeNative = Number(stored.settings.feeNative) || DEFAULT_STATE.settings.buyPriorityFeeNative;
      merged.settings.sellPriorityFeeNative = Number(stored.settings.feeNative) || DEFAULT_STATE.settings.sellPriorityFeeNative;
    }
    return merged;
  }

  function migrateSettingsToCurrentDefaults(settings, storedSettings) {
    if (arraysEqual(storedSettings.buyAmounts, LEGACY_DEFAULT_BUY_AMOUNTS)) {
      settings.buyAmounts = DEFAULT_STATE.settings.buyAmounts;
    }
    if (arraysEqual(storedSettings.sellPercents, LEGACY_DEFAULT_SELL_PERCENTS)) {
      settings.sellPercents = DEFAULT_STATE.settings.sellPercents;
    }
    if (Number(storedSettings.buySlippagePct) === 30 || storedSettings.buySlippagePct === undefined) {
      settings.buySlippagePct = DEFAULT_STATE.settings.buySlippagePct;
    }
    if (Number(storedSettings.sellSlippagePct) === 30 || storedSettings.sellSlippagePct === undefined) {
      settings.sellSlippagePct = DEFAULT_STATE.settings.sellSlippagePct;
    }
    if (Number(storedSettings.buyGasFeeNative) === PADRE_DEFAULT_FEES.gasFeeNative || storedSettings.buyGasFeeNative === undefined) {
      settings.buyGasFeeNative = DEFAULT_STATE.settings.buyGasFeeNative;
    }
    if (Number(storedSettings.sellGasFeeNative) === PADRE_DEFAULT_FEES.gasFeeNative || storedSettings.sellGasFeeNative === undefined) {
      settings.sellGasFeeNative = DEFAULT_STATE.settings.sellGasFeeNative;
    }
    if (
      Number(storedSettings.buyPriorityFeeNative) === 0.001 ||
      Number(storedSettings.buyPriorityFeeNative) === PADRE_DEFAULT_FEES.priorityFeeNative ||
      storedSettings.buyPriorityFeeNative === undefined
    ) {
      settings.buyPriorityFeeNative = DEFAULT_STATE.settings.buyPriorityFeeNative;
    }
    if (
      Number(storedSettings.sellPriorityFeeNative) === 0.001 ||
      Number(storedSettings.sellPriorityFeeNative) === PADRE_DEFAULT_FEES.priorityFeeNative ||
      storedSettings.sellPriorityFeeNative === undefined
    ) {
      settings.sellPriorityFeeNative = DEFAULT_STATE.settings.sellPriorityFeeNative;
    }
    if (Number(storedSettings.buyBribeFeeNative) === PADRE_DEFAULT_FEES.bribeFeeNative || storedSettings.buyBribeFeeNative === undefined) {
      settings.buyBribeFeeNative = DEFAULT_STATE.settings.buyBribeFeeNative;
    }
    if (Number(storedSettings.sellBribeFeeNative) === PADRE_DEFAULT_FEES.bribeFeeNative || storedSettings.sellBribeFeeNative === undefined) {
      settings.sellBribeFeeNative = DEFAULT_STATE.settings.sellBribeFeeNative;
    }
  }

  function arraysEqual(a, b) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((value, index) => Number(value) === Number(b[index]));
  }

  function migrateLegacyTrades(trades) {
    if (!Array.isArray(trades)) return [];
    return trades.map((trade) => ({
      ...trade,
      schemaVersion: 2,
      executionType: "legacy",
      positionId: trade.positionId || trade.tokenAddress || "legacy",
      timestampMs: typeof trade.timestamp === "number" ? trade.timestamp : Date.parse(trade.timestamp || "") || Date.now(),
    }));
  }

  async function persist() {
    await storageSet(STORAGE_KEY, state);
  }

  function detectToken() {
    const url = new URL(window.location.href);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const tradeIndex = pathParts.indexOf("trade");
    const chainSlug = tradeIndex >= 0 ? pathParts[tradeIndex + 1] : null;
    const address = tradeIndex >= 0 ? pathParts[tradeIndex + 2] : null;
    const chain = chainSlug === "bsc" ? "BNB" : "SOL";
    const platformChain = chainSlug || "solana";
    const name = detectTokenName(address);
    const marketCap = detectMarketCap();
    const unitPriceUsd = marketCap ? marketCap / MARKET_CAP_SUPPLY : null;
    const chainUsd = DEFAULT_PRICES[chain] || 1;
    const unitPriceNative = unitPriceUsd ? unitPriceUsd / chainUsd : null;

    if (!address || !url.hostname.includes("trade.padre.gg")) {
      return {
        platform: "padre",
        chain,
        platformChain,
        address: null,
        key: null,
        name: "No token page",
        marketCap: null,
        unitPriceUsd: null,
        unitPriceNative: null,
      };
    }

    return {
      platform: "padre",
      chain,
      platformChain,
      address,
      key: `padre:${chain}:${address}`,
      name,
      marketCap,
      unitPriceUsd,
      unitPriceNative,
      url: window.location.href,
    };
  }

  function detectTokenName(address) {
    const heading = document.querySelector("h1.MuiTypography-h1");
    const headingText = cleanText(heading?.textContent);
    if (headingText) return headingText;

    const title = document.title || "";
    const titleMatch = title.match(/^([^|$]+?)(?:\s*[|$]|$)/);
    const fromTitle = cleanText(titleMatch?.[1]);
    if (fromTitle && !fromTitle.toLowerCase().includes("padre")) return fromTitle;

    return address ? shortenAddress(address) : "Unknown token";
  }

  function detectMarketCap() {
    const titleMatch = (document.title || "").match(/\$([0-9.]+)\s*([KMB])?/i);
    if (titleMatch) return parseCompactNumber(titleMatch[1], titleMatch[2]);

    const candidates = Array.from(document.querySelectorAll("body *"))
      .slice(0, 1200)
      .map((el) => cleanText(el.textContent))
      .filter(Boolean);

    for (const text of candidates) {
      const match = text.match(/(?:MC|MCap|Market Cap)\s*:?\s*\$?\s*([0-9.]+)\s*([KMB])?/i);
      if (match) return parseCompactNumber(match[1], match[2]);
    }
    return null;
  }

  function parseCompactNumber(value, suffix = "") {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return null;
    const multipliers = { K: 1_000, M: 1_000_000, B: 1_000_000_000 };
    return parsed * (multipliers[String(suffix).toUpperCase()] || 1);
  }

  function cleanText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function shortenAddress(address) {
    if (!address || address.length < 12) return address || "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  function updateActiveToken() {
    activeToken = detectToken();
  }

  function injectPanel() {
    if (document.getElementById(selectors.root)) {
      root = document.getElementById(selectors.root);
      return;
    }

    root = document.createElement("div");
    root.id = selectors.root;
    root.innerHTML = `
      <section class="${selectors.panel}" aria-label="WilyTrader paper trading panel">
        <header class="wt-header">
          <button class="wt-icon-btn" data-action="toggle" title="Minimize" aria-label="Minimize">-</button>
          <div>
            <div class="wt-title">WilyTrader</div>
            <div id="${selectors.status}" class="wt-muted">Local ledger</div>
          </div>
          <div class="wt-header-controls">
            <button class="wt-icon-btn" data-action="settings" title="Settings" aria-label="Settings">&#9881;</button>
            <button class="wt-icon-btn" data-action="export" title="Download JSON" aria-label="Download JSON">DL</button>
          </div>
        </header>
        <div class="wt-body">
          <div class="wt-section">
            <div id="${selectors.token}" class="wt-token"></div>
            <div id="${selectors.price}" class="wt-muted"></div>
            <div id="${selectors.bridge}" class="wt-muted"></div>
          </div>
          <div class="wt-grid">
            <div>
              <div class="wt-label">Balance</div>
              <div id="${selectors.balance}" class="wt-value"></div>
            </div>
            <div>
              <div class="wt-label">Open Position</div>
              <div id="${selectors.position}" class="wt-value"></div>
            </div>
          </div>
          <div class="wt-section">
            <div class="wt-label">Paper Balance</div>
            <div class="wt-custom-row">
              <input class="wt-input" data-deposit type="number" min="0" step="0.01" placeholder="Add amount" />
              <button class="wt-button" data-action="deposit">Add</button>
            </div>
          </div>
          <div class="wt-section">
            <div class="wt-trade-header">
              <div class="wt-trade-title wt-buy-title">Buy</div>
              <div class="wt-chain-pill" data-buy-chain>SOL</div>
            </div>
            <div class="wt-button-row" data-buy-buttons></div>
            <div class="wt-fee-strip" aria-label="Buy execution settings">
              <label class="wt-inline-setting">
                <span>Max Slip</span>
                <input data-quick-setting="buySlippagePct" type="number" min="0" step="0.1" />
              </label>
              <label class="wt-inline-setting">
                <span>Gas</span>
                <input data-quick-setting="buyGasFeeNative" type="number" min="0" step="0.0001" />
              </label>
              <label class="wt-inline-setting">
                <span>Prio</span>
                <input data-quick-setting="buyPriorityFeeNative" type="number" min="0" step="0.0001" />
              </label>
              <label class="wt-inline-setting">
                <span>Bribe</span>
                <input data-quick-setting="buyBribeFeeNative" type="number" min="0" step="0.0001" />
              </label>
            </div>
            <div class="wt-custom-row">
              <input class="wt-input" data-custom-buy type="number" min="0" step="0.01" placeholder="Custom" />
              <button class="wt-button" data-action="custom-buy">Buy</button>
            </div>
          </div>
          <div class="wt-section">
            <div class="wt-trade-header">
              <div class="wt-trade-title wt-sell-title">Sell</div>
              <div class="wt-muted" data-sell-assets>0 Asset</div>
            </div>
            <div class="wt-button-row" data-sell-buttons></div>
            <div class="wt-fee-strip" aria-label="Sell execution settings">
              <label class="wt-inline-setting">
                <span>Max Slip</span>
                <input data-quick-setting="sellSlippagePct" type="number" min="0" step="0.1" />
              </label>
              <label class="wt-inline-setting">
                <span>Gas</span>
                <input data-quick-setting="sellGasFeeNative" type="number" min="0" step="0.0001" />
              </label>
              <label class="wt-inline-setting">
                <span>Prio</span>
                <input data-quick-setting="sellPriorityFeeNative" type="number" min="0" step="0.0001" />
              </label>
              <label class="wt-inline-setting">
                <span>Bribe</span>
                <input data-quick-setting="sellBribeFeeNative" type="number" min="0" step="0.0001" />
              </label>
            </div>
          </div>
          <div class="wt-section">
            <div class="wt-label">Note</div>
            <div class="wt-custom-row">
              <input class="wt-input" data-note type="text" placeholder="Optional rationale tag" />
              <button class="wt-button" data-action="add-note">Add</button>
            </div>
          </div>
          <div class="wt-section">
            <div class="wt-button-row">
              <button class="wt-button" data-action="view-log">View Log</button>
              <button class="wt-button" data-action="bridge-sync">Sync</button>
              <button class="wt-button" data-action="export">Save JSON</button>
              <button class="wt-button wt-danger" data-action="clear">Clear</button>
            </div>
          </div>
          <div id="${selectors.log}" class="wt-log"></div>
        </div>
      </section>
      <div id="${selectors.settingsModal}" class="wt-modal" aria-hidden="true">
        <section class="wt-modal-panel" aria-label="WilyTrader settings">
          <header class="wt-modal-header">
            <div class="wt-title">Settings</div>
            <button class="wt-icon-btn" data-action="close-modal" title="Close" aria-label="Close">x</button>
          </header>
          <div class="wt-modal-body">
            <div class="wt-setting-group">
              <label class="wt-label" for="wt-buy-amounts">Buy buttons (native)</label>
              <input id="wt-buy-amounts" class="wt-input" data-setting="buyAmounts" placeholder="0.1, 0.25, 0.5, 1, 3, 0.005, 5, 7" />
            </div>
            <div class="wt-setting-group">
              <label class="wt-label" for="wt-sell-percents">Sell buttons (%)</label>
              <input id="wt-sell-percents" class="wt-input" data-setting="sellPercents" placeholder="5, 15, 33, 55, 20, 40, 86, 100" />
            </div>
            <div class="wt-settings-grid">
              <div class="wt-setting-group">
                <label class="wt-label" for="wt-buy-gas">Buy gas fee</label>
                <input id="wt-buy-gas" class="wt-input" data-setting="buyGasFeeNative" type="number" min="0" step="0.0001" />
              </div>
              <div class="wt-setting-group">
                <label class="wt-label" for="wt-sell-gas">Sell gas fee</label>
                <input id="wt-sell-gas" class="wt-input" data-setting="sellGasFeeNative" type="number" min="0" step="0.0001" />
              </div>
              <div class="wt-setting-group">
                <label class="wt-label" for="wt-buy-priority">Buy priority fee</label>
                <input id="wt-buy-priority" class="wt-input" data-setting="buyPriorityFeeNative" type="number" min="0" step="0.0001" />
              </div>
              <div class="wt-setting-group">
                <label class="wt-label" for="wt-sell-priority">Sell priority fee</label>
                <input id="wt-sell-priority" class="wt-input" data-setting="sellPriorityFeeNative" type="number" min="0" step="0.0001" />
              </div>
              <div class="wt-setting-group">
                <label class="wt-label" for="wt-buy-bribe">Buy bribe fee</label>
                <input id="wt-buy-bribe" class="wt-input" data-setting="buyBribeFeeNative" type="number" min="0" step="0.0001" />
              </div>
              <div class="wt-setting-group">
                <label class="wt-label" for="wt-sell-bribe">Sell bribe fee</label>
                <input id="wt-sell-bribe" class="wt-input" data-setting="sellBribeFeeNative" type="number" min="0" step="0.0001" />
              </div>
              <div class="wt-setting-group">
                <label class="wt-label" for="wt-buy-slippage">Buy max slippage %</label>
                <input id="wt-buy-slippage" class="wt-input" data-setting="buySlippagePct" type="number" min="0" step="0.1" />
              </div>
              <div class="wt-setting-group">
                <label class="wt-label" for="wt-sell-slippage">Sell max slippage %</label>
                <input id="wt-sell-slippage" class="wt-input" data-setting="sellSlippagePct" type="number" min="0" step="0.1" />
              </div>
              <div class="wt-setting-group">
                <label class="wt-label" for="wt-platform-fee">Platform fee %</label>
                <input id="wt-platform-fee" class="wt-input" data-setting="platformFeePct" type="number" min="0" step="0.1" />
              </div>
              <div class="wt-setting-group">
                <label class="wt-label" for="wt-delay">Custom delay ms</label>
                <input id="wt-delay" class="wt-input" data-setting="customDelayMs" type="number" min="0" step="50" />
              </div>
            </div>
            <label class="wt-check-row">
              <input type="checkbox" data-setting="useCustomDelay" />
              <span>Use custom delay instead of priority-fee delay</span>
            </label>
            <label class="wt-check-row">
              <input type="checkbox" data-setting="bridgeEnabled" />
              <span>Sync to Snipalot localhost bridge</span>
            </label>
            <div class="wt-button-row">
              <button class="wt-button" data-action="reset-settings">Defaults</button>
              <button class="wt-button" data-action="save-settings">Save</button>
            </div>
          </div>
        </section>
      </div>
      <div id="${selectors.logModal}" class="wt-modal" aria-hidden="true">
        <section class="wt-modal-panel" aria-label="WilyTrader execution log">
          <header class="wt-modal-header">
            <div class="wt-title">Execution Log</div>
            <button class="wt-icon-btn" data-action="close-modal" title="Close" aria-label="Close">x</button>
          </header>
          <div class="wt-modal-body">
            <div class="wt-button-row">
              <button class="wt-button" data-action="copy">Copy JSON</button>
              <button class="wt-button" data-action="export">Save JSON</button>
            </div>
            <div class="wt-log-full" data-log-full></div>
          </div>
        </section>
      </div>
    `;
    document.documentElement.appendChild(root);
    root.addEventListener("click", handleClick);
    root.addEventListener("change", handleChange);
    const panel = root.querySelector(`.${selectors.panel}`);
    applyPanelPosition(panel);
    makeDraggable(root.querySelector(".wt-header"), panel);
  }

  function handleClick(event) {
    const target = event.target.closest("button");
    if (!target || !root?.contains(target)) return;

    const action = target.dataset.action;
    const buyAmount = target.dataset.buyAmount;
    const sellPct = target.dataset.sellPct;

    if (buyAmount) void buy(Number(buyAmount));
    else if (sellPct) void sell(Number(sellPct));
    else if (action === "custom-buy") {
      const input = root.querySelector("[data-custom-buy]");
      const amount = Number(input.value);
      if (Number.isFinite(amount) && amount > 0) {
        input.value = "";
        void buy(amount);
      } else {
        setStatus("Enter a valid buy amount.");
      }
    } else if (action === "deposit") {
      const input = root.querySelector("[data-deposit]");
      const amount = Number(input.value);
      if (Number.isFinite(amount) && amount > 0) {
        input.value = "";
        void addPaperBalance(amount);
      } else {
        setStatus("Enter a valid deposit amount.");
      }
    } else if (action === "settings") {
      openSettingsModal();
    } else if (action === "close-modal") {
      closeModals();
    } else if (action === "save-settings") {
      void saveSettingsFromModal();
    } else if (action === "reset-settings") {
      void resetSettingsToDefaults();
    } else if (action === "view-log") {
      openLogModal();
    } else if (action === "add-note") {
      void addNote();
    } else if (action === "bridge-sync") {
      void syncBridge("manual");
    } else if (action === "export") {
      exportJson();
    } else if (action === "copy") {
      void copyJson();
    } else if (action === "clear") {
      void clearTradeLog();
    } else if (action === "toggle") {
      togglePanel();
    }
  }

  function handleChange(event) {
    const target = event.target;
    if (!target?.matches?.("[data-quick-setting]")) return;
    void saveQuickSetting(target.dataset.quickSetting, target.value);
  }

  async function saveQuickSetting(key, rawValue) {
    if (!Object.hasOwn(state.settings, key)) return;
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value < 0) {
      setStatus(`Enter a valid ${key}.`);
      render();
      return;
    }
    state.settings[key] = key === "customDelayMs" ? Math.round(value) : value;
    await persistAndSync("quick-settings");
    render();
    setStatus("Execution settings saved.");
  }

  async function addPaperBalance(amount) {
    updateActiveToken();
    const chain = activeToken?.chain || "SOL";
    state.balances[chain] = (state.balances[chain] || 0) + amount;
    await persistAndSync("balance");
    render();
    setStatus(`Added ${formatters.native(amount, chain)}.`);
  }

  function openSettingsModal() {
    const modal = root.querySelector(`#${selectors.settingsModal}`);
    if (!modal) return;
    root.querySelector("[data-setting='buyAmounts']").value = state.settings.buyAmounts.join(", ");
    root.querySelector("[data-setting='sellPercents']").value = state.settings.sellPercents.join(", ");
    [
      "buyGasFeeNative",
      "sellGasFeeNative",
      "buyPriorityFeeNative",
      "sellPriorityFeeNative",
      "buyBribeFeeNative",
      "sellBribeFeeNative",
      "buySlippagePct",
      "sellSlippagePct",
      "platformFeePct",
      "customDelayMs",
    ].forEach((key) => {
      const input = root.querySelector(`[data-setting='${key}']`);
      if (input) input.value = String(state.settings[key]);
    });
    root.querySelector("[data-setting='useCustomDelay']").checked = Boolean(state.settings.useCustomDelay);
    root.querySelector("[data-setting='bridgeEnabled']").checked = Boolean(state.settings.bridgeEnabled);
    modal.classList.add("wt-modal-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function openLogModal() {
    renderFullLog();
    const modal = root.querySelector(`#${selectors.logModal}`);
    if (!modal) return;
    modal.classList.add("wt-modal-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function closeModals() {
    root.querySelectorAll(".wt-modal").forEach((modal) => {
      modal.classList.remove("wt-modal-open");
      modal.setAttribute("aria-hidden", "true");
    });
  }

  async function saveSettingsFromModal() {
    const nextBuyAmounts = parsePositiveNumberList(root.querySelector("[data-setting='buyAmounts']")?.value, "buy buttons");
    const parsedSellPercents = parsePositiveNumberList(root.querySelector("[data-setting='sellPercents']")?.value, "sell buttons");
    if (!nextBuyAmounts || !parsedSellPercents) return;
    const nextSellPercents = parsedSellPercents.map((value) => Math.min(100, value));

    const numericKeys = [
      "buyGasFeeNative",
      "sellGasFeeNative",
      "buyPriorityFeeNative",
      "sellPriorityFeeNative",
      "buyBribeFeeNative",
      "sellBribeFeeNative",
      "buySlippagePct",
      "sellSlippagePct",
      "platformFeePct",
      "customDelayMs",
    ];
    const next = {
      ...state.settings,
      buyAmounts: nextBuyAmounts,
      sellPercents: nextSellPercents,
      useCustomDelay: Boolean(root.querySelector("[data-setting='useCustomDelay']")?.checked),
      bridgeEnabled: Boolean(root.querySelector("[data-setting='bridgeEnabled']")?.checked),
    };

    for (const key of numericKeys) {
      const value = Number(root.querySelector(`[data-setting='${key}']`)?.value);
      if (!Number.isFinite(value) || value < 0) return setStatus(`Enter a valid ${key}.`);
      next[key] = key === "customDelayMs" ? Math.round(value) : value;
    }

    state.settings = next;
    await persistAndSync("settings");
    closeModals();
    render();
    setStatus("Settings saved.");
  }

  async function resetSettingsToDefaults() {
    state.settings = {
      ...DEFAULT_STATE.settings,
      panelPosition: state.settings.panelPosition || null,
      bridgeEnabled: state.settings.bridgeEnabled,
    };
    await persistAndSync("settings-reset");
    openSettingsModal();
    render();
    setStatus("Settings reset.");
  }

  function parsePositiveNumberList(value, label) {
    const numbers = String(value || "")
      .split(",")
      .map((part) => Number(part.trim()))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (numbers.length === 0) {
      setStatus(`Enter at least one ${label} value.`);
      return null;
    }
    return numbers.slice(0, 8);
  }

  async function addNote() {
    updateActiveToken();
    const input = root.querySelector("[data-note]");
    const text = cleanText(input?.value);
    if (!text) return setStatus("Enter a note first.");
    input.value = "";
    state.notes.push({
      id: createId("note"),
      timestamp: new Date().toISOString(),
      timestampMs: Date.now(),
      tokenKey: activeToken?.key || null,
      tokenName: activeToken?.name || null,
      tokenAddress: activeToken?.address || null,
      text,
    });
    await persistAndSync("note");
    render();
    setStatus("Note added.");
  }

  async function buy(amountNative) {
    if (tradeInFlight) return setStatus("Execution already pending.");
    tradeInFlight = true;
    try {
    updateActiveToken();
    const token = activeToken;
    if (!token.key) return setStatus("Open a Padre token page first.");
    if (!token.unitPriceNative) return setStatus("Price unavailable. Wait for Padre market cap to load.");

    const delayedToken = await waitForSimulatedExecution("buy", token);
    if (!delayedToken) return;

    const chain = delayedToken.chain;
    const fees = calculateFees("buy", amountNative, delayedToken.executionDelayMs);
    const slippagePct = Number(state.settings.buySlippagePct || 0);
    const slippage = slippagePct / 100;
    const totalDebit = amountNative + fees.totalFeeNative;
    if ((state.balances[chain] || 0) < totalDebit) {
      return setStatus(`Insufficient ${chain} paper balance.`);
    }

    const executionPrice = delayedToken.unitPriceNative * (1 + slippage);
    const tokenAmount = amountNative / executionPrice;
    const existing = state.positions[delayedToken.key] || createEmptyPosition(delayedToken);
    const before = snapshotPosition(existing);
    const newCost = existing.costNative + amountNative;
    const newTokenAmount = existing.tokenAmount + tokenAmount;
    const updated = {
      ...existing,
      tokenName: delayedToken.name,
      lastUrl: delayedToken.url,
      tokenAmount: newTokenAmount,
      costNative: newCost,
      avgEntryNative: newCost / newTokenAmount,
      avgEntryUsd: (newCost / newTokenAmount) * (DEFAULT_PRICES[chain] || 1),
      buyCount: (existing.buyCount || 0) + 1,
      updatedAt: new Date().toISOString(),
    };

    state.balances[chain] -= totalDebit;
    state.positions[delayedToken.key] = updated;

    recordExecution({
      side: "buy",
      chain,
      token: delayedToken,
      positionId: updated.positionId,
      requestedAmountNative: amountNative,
      grossNative: amountNative,
      netNative: -totalDebit,
      fees,
      slippagePct,
      tokenAmount,
      executionPriceNative: executionPrice,
      pnlNative: 0,
      positionBefore: before,
      positionAfter: snapshotPosition(updated),
      costBasisNative: 0,
    });

    await persistAndSync("buy");
    setStatus(`Bought ${formatters.native(amountNative, chain)} paper.`);
    render();
    } finally {
      tradeInFlight = false;
    }
  }

  async function sell(percent) {
    if (tradeInFlight) return setStatus("Execution already pending.");
    tradeInFlight = true;
    try {
    updateActiveToken();
    const token = activeToken;
    const position = token.key ? state.positions[token.key] : null;
    if (!token.key || !position) return setStatus("No open paper position for this token.");
    if (!token.unitPriceNative) return setStatus("Price unavailable. Wait for Padre market cap to load.");

    const delayedToken = await waitForSimulatedExecution("sell", token);
    if (!delayedToken) return;

    const chain = delayedToken.chain;
    const sellRatio = Math.min(1, Math.max(0, percent / 100));
    const tokenAmount = position.tokenAmount * sellRatio;
    const costBasis = position.costNative * sellRatio;
    const slippagePct = Number(state.settings.sellSlippagePct || 0);
    const slippage = slippagePct / 100;
    const executionPrice = delayedToken.unitPriceNative * (1 - slippage);
    const grossProceeds = tokenAmount * executionPrice;
    const fees = calculateFees("sell", grossProceeds, delayedToken.executionDelayMs);
    const netProceeds = Math.max(0, grossProceeds - fees.totalFeeNative);
    const pnlNative = netProceeds - costBasis;
    const before = snapshotPosition(position);

    state.balances[chain] = (state.balances[chain] || 0) + netProceeds;

    const remainingTokenAmount = position.tokenAmount - tokenAmount;
    let after = null;
    if (remainingTokenAmount <= 0.000000001 || percent >= 100) {
      delete state.positions[token.key];
    } else {
      const updated = {
        ...position,
        tokenAmount: remainingTokenAmount,
        costNative: position.costNative - costBasis,
        sellCount: (position.sellCount || 0) + 1,
        updatedAt: new Date().toISOString(),
      };
      state.positions[token.key] = updated;
      after = snapshotPosition(updated);
    }

    recordExecution({
      side: "sell",
      chain,
      token: delayedToken,
      positionId: position.positionId,
      requestedAmountNative: null,
      requestedSellPct: percent,
      grossNative: grossProceeds,
      netNative: netProceeds,
      fees,
      slippagePct,
      tokenAmount,
      executionPriceNative: executionPrice,
      pnlNative,
      positionBefore: before,
      positionAfter: after,
      costBasisNative: costBasis,
    });

    if (!after) {
      const summary = buildPositionSummary(position.positionId, "closed");
      if (summary) state.closedPositions.push(summary);
    }

    await persistAndSync("sell");
    setStatus(`Sold ${percent}% paper position.`);
    render();
    } finally {
      tradeInFlight = false;
    }
  }

  function createEmptyPosition(token) {
    const now = new Date().toISOString();
    return {
      positionId: createId("pos"),
      status: "open",
      platform: "padre",
      chain: token.chain,
      platformChain: token.platformChain,
      tokenAddress: token.address,
      tokenName: token.name,
      tokenKey: token.key,
      tokenAmount: 0,
      costNative: 0,
      avgEntryNative: 0,
      avgEntryUsd: 0,
      buyCount: 0,
      sellCount: 0,
      openedAt: now,
      updatedAt: now,
      firstUrl: token.url,
      lastUrl: token.url,
    };
  }

  async function waitForSimulatedExecution(side, token) {
    const delayMs = calculateExecutionDelay(side);
    const priorityFee = Number(side === "buy" ? state.settings.buyPriorityFeeNative : state.settings.sellPriorityFeeNative) || 0;
    const bribeFee = Number(side === "buy" ? state.settings.buyBribeFeeNative : state.settings.sellBribeFeeNative) || 0;
    setStatus(`${side === "buy" ? "Buy" : "Sell"} pending (${delayMs}ms delay, prio ${priorityFee}, bribe ${bribeFee}).`);
    if (delayMs > 0) await new Promise((resolve) => window.setTimeout(resolve, delayMs));
    updateActiveToken();
    const delayedToken = activeToken;
    if (!delayedToken?.key || delayedToken.key !== token.key || !delayedToken.unitPriceNative) {
      setStatus("Execution cancelled: token or price changed.");
      return null;
    }
    const slippageLimit = Number(side === "buy" ? state.settings.buySlippagePct : state.settings.sellSlippagePct) || 0;
    const movementPct = Math.abs(((delayedToken.unitPriceNative - token.unitPriceNative) / token.unitPriceNative) * 100);
    if (movementPct > slippageLimit) {
      setStatus(`Execution cancelled: price moved ${movementPct.toFixed(2)}%.`);
      return null;
    }
    return { ...delayedToken, executionDelayMs: delayMs };
  }

  function calculateExecutionDelay(side) {
    if (state.settings.useCustomDelay) return Math.max(0, Math.round(Number(state.settings.customDelayMs || 0)));
    const priorityFee = Number(side === "buy" ? state.settings.buyPriorityFeeNative : state.settings.sellPriorityFeeNative) || 0;
    const bribeFee = Number(side === "buy" ? state.settings.buyBribeFeeNative : state.settings.sellBribeFeeNative) || 0;
    const urgencyFee = priorityFee + bribeFee;
    const min = 220;
    const max = 1600;
    const lowCompetitiveFee = 0.0001;
    const highCompetitiveFee = 0.01;
    const normalized = Math.min(
      1,
      Math.max(0, Math.log1p(urgencyFee / lowCompetitiveFee) / Math.log1p(highCompetitiveFee / lowCompetitiveFee)),
    );
    const delay = min + (1 - normalized) * (max - min);
    const jitter = 180 * (Math.random() - 0.5);
    return Math.max(0, Math.round(delay + jitter));
  }

  function calculateFees(side, baseNative, executionDelayMs = 0) {
    const platformFeeNative = baseNative * (Number(state.settings.platformFeePct || 0) / 100);
    const gasFeeNative = Number(side === "buy" ? state.settings.buyGasFeeNative : state.settings.sellGasFeeNative) || 0;
    const priorityFeeNative = Number(side === "buy" ? state.settings.buyPriorityFeeNative : state.settings.sellPriorityFeeNative) || 0;
    const bribeFeeNative = Number(side === "buy" ? state.settings.buyBribeFeeNative : state.settings.sellBribeFeeNative) || 0;
    return {
      platformFeeNative,
      gasFeeNative,
      priorityFeeNative,
      bribeFeeNative,
      totalFeeNative: platformFeeNative + gasFeeNative + priorityFeeNative + bribeFeeNative,
      executionDelayMs,
    };
  }

  function recordExecution(fields) {
    const usdPrice = DEFAULT_PRICES[fields.chain] || 1;
    const timestampMs = Date.now();
    state.executions.push({
      id: createId("exec"),
      schemaVersion: 2,
      timestamp: new Date(timestampMs).toISOString(),
      timestampMs,
      source: "wilytrader-padre-overlay",
      platform: "padre",
      chain: fields.chain,
      side: fields.side,
      positionId: fields.positionId,
      tokenAddress: fields.token.address,
      tokenName: fields.token.name,
      url: fields.token.url,
      marketCapUsd: round(fields.token.marketCap, 2),
      unitPriceNative: round(fields.executionPriceNative, 12),
      unitPriceUsd: round(fields.executionPriceNative * usdPrice, 12),
      requestedAmountNative: round(fields.requestedAmountNative),
      requestedSellPct: fields.requestedSellPct ?? null,
      grossNative: round(fields.grossNative),
      grossUsd: round(fields.grossNative * usdPrice),
      netNative: round(fields.netNative),
      netUsd: round(fields.netNative * usdPrice),
      feeNative: round(fields.fees?.totalFeeNative),
      platformFeeNative: round(fields.fees?.platformFeeNative),
      gasFeeNative: round(fields.fees?.gasFeeNative),
      priorityFeeNative: round(fields.fees?.priorityFeeNative),
      bribeFeeNative: round(fields.fees?.bribeFeeNative),
      platformFeePct: Number(state.settings.platformFeePct || 0),
      slippagePct: fields.slippagePct,
      executionDelayMs: fields.fees?.executionDelayMs ?? 0,
      tokenAmount: round(fields.tokenAmount, 12),
      costBasisNative: round(fields.costBasisNative),
      pnlNative: round(fields.pnlNative),
      pnlUsd: round(fields.pnlNative * usdPrice),
      positionBefore: fields.positionBefore,
      positionAfter: fields.positionAfter,
    });
  }

  function snapshotPosition(position) {
    if (!position) return null;
    return {
      tokenAmount: round(position.tokenAmount, 12),
      costNative: round(position.costNative),
      avgEntryNative: round(position.avgEntryNative, 12),
      avgEntryUsd: round(position.avgEntryUsd, 12),
    };
  }

  function buildPositionSummary(positionId, statusOverride) {
    const executions = state.executions
      .filter((execution) => execution.positionId === positionId)
      .sort((a, b) => a.timestampMs - b.timestampMs);
    if (executions.length === 0) return null;

    const buys = executions.filter((execution) => execution.side === "buy");
    const sells = executions.filter((execution) => execution.side === "sell");
    const first = executions[0];
    const last = executions[executions.length - 1];
    const totalTokensBought = sum(buys, "tokenAmount");
    const totalTokensSold = sum(sells, "tokenAmount");
    const investedNative = sum(buys, "grossNative");
    const buyFeesNative = sum(buys, "feeNative");
    const grossReceivedNative = sum(sells, "grossNative");
    const netReceivedNative = sum(sells, "netNative");
    const sellFeesNative = sum(sells, "feeNative");
    const totalFeesNative = buyFeesNative + sellFeesNative;
    const pnlPreFeeNative = grossReceivedNative - investedNative;
    const pnlPostFeeNative = netReceivedNative - investedNative - buyFeesNative;
    const basisNative = investedNative + buyFeesNative;
    const pnlPct = basisNative > 0 ? (pnlPostFeeNative / basisNative) * 100 : 0;
    const remainingTokenAmount = Math.max(0, totalTokensBought - totalTokensSold);
    const status = statusOverride || (remainingTokenAmount > 0 ? "open" : "closed");
    const firstEntryAt = buys[0]?.timestamp || first.timestamp;
    const finalExitAt = status === "closed" && sells.length > 0 ? sells[sells.length - 1].timestamp : null;
    const firstEntryMs = Date.parse(firstEntryAt);
    const finalExitMs = finalExitAt ? Date.parse(finalExitAt) : null;

    return {
      schemaVersion: 2,
      id: positionId,
      status,
      platform: first.platform,
      chain: first.chain,
      tokenAddress: first.tokenAddress,
      tokenName: first.tokenName,
      firstUrl: first.url,
      lastUrl: last.url,
      firstEntryAt,
      finalExitAt,
      timeInTradeSeconds: finalExitMs ? Math.max(0, Math.round((finalExitMs - firstEntryMs) / 1000)) : null,
      buyCount: buys.length,
      sellCount: sells.length,
      scaleInCount: Math.max(0, buys.length - 1),
      scaleOutCount: Math.max(0, sells.length - 1),
      totalTokensBought: round(totalTokensBought, 12),
      totalTokensSold: round(totalTokensSold, 12),
      remainingTokenAmount: round(remainingTokenAmount, 12),
      investedNative: round(investedNative),
      grossReceivedNative: round(grossReceivedNative),
      netReceivedNative: round(netReceivedNative),
      buyFeesNative: round(buyFeesNative),
      sellFeesNative: round(sellFeesNative),
      totalFeesNative: round(totalFeesNative),
      pnlPreFeeNative: round(pnlPreFeeNative),
      pnlPostFeeNative: round(pnlPostFeeNative),
      pnlPct: round(pnlPct, 4),
      entryMarketCapVwapUsd: round(weightedAverage(buys, "marketCapUsd", "tokenAmount"), 2),
      exitMarketCapVwapUsd: round(weightedAverage(sells, "marketCapUsd", "tokenAmount"), 2),
      avgEntryNative: round(weightedAverage(buys, "unitPriceNative", "tokenAmount"), 12),
      avgExitNative: round(weightedAverage(sells, "unitPriceNative", "tokenAmount"), 12),
      executionIds: executions.map((execution) => execution.id),
    };
  }

  function getPositionSummaries() {
    const open = Object.values(state.positions)
      .map((position) => buildPositionSummary(position.positionId, "open"))
      .filter(Boolean);
    return [...state.closedPositions, ...open];
  }

  function buildMockApeCompatibleTrades() {
    return getPositionSummaries()
      .filter((position) => position.status === "closed" && position.finalExitAt)
      .map((position) => ({
        chain: position.chain,
        entryMarketCap: position.entryMarketCapVwapUsd || 0,
        exitMarketCap: position.exitMarketCapVwapUsd || 0,
        id: position.id,
        platform: position.platform,
        pnlPercentage: position.pnlPct,
        pnlSol: position.pnlPostFeeNative,
        solInvested: position.investedNative + position.buyFeesNative,
        solReceived: position.netReceivedNative,
        timestamp: Date.parse(position.finalExitAt),
        tokenName: position.tokenName,
      }));
  }

  function sum(items, key) {
    return items.reduce((total, item) => total + Number(item[key] || 0), 0);
  }

  function weightedAverage(items, valueKey, weightKey) {
    const weighted = items.reduce((total, item) => total + Number(item[valueKey] || 0) * Number(item[weightKey] || 0), 0);
    const weight = sum(items, weightKey);
    return weight > 0 ? weighted / weight : 0;
  }

  function round(value, decimals = 8) {
    if (!Number.isFinite(Number(value))) return 0;
    const factor = 10 ** decimals;
    return Math.round(Number(value || 0) * factor) / factor;
  }

  async function persistAndSync(reason) {
    await persist();
    void syncBridge(reason);
  }

  function render() {
    if (!root || !state) return;
    updateActiveToken();

    const tokenEl = root.querySelector(`#${selectors.token}`);
    const priceEl = root.querySelector(`#${selectors.price}`);
    const bridgeEl = root.querySelector(`#${selectors.bridge}`);
    const balanceEl = root.querySelector(`#${selectors.balance}`);
    const positionEl = root.querySelector(`#${selectors.position}`);
    const buyButtonsEl = root.querySelector("[data-buy-buttons]");
    const sellButtonsEl = root.querySelector("[data-sell-buttons]");
    const buyChainEl = root.querySelector("[data-buy-chain]");
    const sellAssetsEl = root.querySelector("[data-sell-assets]");
    const logEl = root.querySelector(`#${selectors.log}`);

    const token = activeToken;
    const position = token.key ? state.positions[token.key] : null;
    const summary = position ? buildPositionSummary(position.positionId, "open") : null;

    tokenEl.textContent = token.address
      ? `${token.name} (${shortenAddress(token.address)})`
      : "Open a Padre token page";
    priceEl.textContent = token.marketCap
      ? `MC ${formatters.usd(token.marketCap)} - est. ${formatters.usd(token.unitPriceUsd)} per token`
      : "Waiting for Padre market-cap data";
    bridgeEl.textContent = state.settings.bridgeEnabled ? bridgeState.lastMessage : "Bridge disabled";

    balanceEl.textContent = formatters.native(state.balances[token.chain] || 0, token.chain);
    positionEl.textContent = summary
      ? `${formatters.native(summary.investedNative, token.chain)} cost - ${formatters.pct(calculateOpenPnlPct(position, token))}`
      : "None";
    if (buyChainEl) buyChainEl.textContent = token.chain;
    if (sellAssetsEl) {
      sellAssetsEl.textContent = position
        ? `${round(position.tokenAmount, 4)} Asset - ${formatters.usd((position.tokenAmount || 0) * (token.unitPriceUsd || 0))}`
        : "0 Asset - $0";
    }

    root.querySelectorAll("[data-quick-setting]").forEach((input) => {
      const key = input.dataset.quickSetting;
      if (document.activeElement !== input) input.value = String(state.settings[key] ?? "");
    });

    buyButtonsEl.innerHTML = "";
    state.settings.buyAmounts.forEach((amount) => {
      const button = document.createElement("button");
      button.className = "wt-trade-button wt-buy-button";
      button.dataset.buyAmount = String(amount);
      button.textContent = String(amount);
      buyButtonsEl.appendChild(button);
    });

    sellButtonsEl.innerHTML = "";
    state.settings.sellPercents.forEach((percent) => {
      const button = document.createElement("button");
      button.className = "wt-trade-button wt-sell-button";
      button.dataset.sellPct = String(percent);
      button.textContent = `${percent}%`;
      sellButtonsEl.appendChild(button);
    });

    logEl.innerHTML = "";
    const recent = state.executions.slice(-5).reverse();
    if (recent.length === 0) {
      logEl.textContent = "No paper executions yet.";
    } else {
      recent.forEach((execution) => {
        const item = document.createElement("div");
        item.className = `wt-log-item wt-${execution.side}`;
        item.textContent = `${execution.side.toUpperCase()} ${execution.tokenName || shortenAddress(execution.tokenAddress)} - ${formatters.native(Math.abs(execution.grossNative || execution.netNative), execution.chain)} - PnL ${formatters.native(execution.pnlNative, execution.chain)}`;
        logEl.appendChild(item);
      });
    }
  }

  function renderFullLog() {
    const logEl = root.querySelector("[data-log-full]");
    if (!logEl) return;
    logEl.innerHTML = "";
    const entries = state.executions.slice().reverse();
    if (entries.length === 0) {
      logEl.textContent = "No paper executions yet.";
      return;
    }
    entries.forEach((execution) => {
      const item = document.createElement("div");
      item.className = `wt-log-item wt-${execution.side}`;
      item.textContent = [
        `${new Date(execution.timestamp).toLocaleTimeString()} ${execution.side.toUpperCase()} ${execution.tokenName}`,
        `${formatters.native(Math.abs(execution.grossNative || execution.netNative), execution.chain)}`,
        `fees ${formatters.native(execution.feeNative, execution.chain)}`,
        `slip ${execution.slippagePct}%`,
        `delay ${execution.executionDelayMs || 0}ms`,
        `PnL ${formatters.native(execution.pnlNative, execution.chain)}`,
      ].join(" - ");
      logEl.appendChild(item);
    });
  }

  function calculateOpenPnlPct(position, token) {
    if (!position || !token.unitPriceNative || !position.costNative) return 0;
    const mark = position.tokenAmount * token.unitPriceNative;
    return ((mark - position.costNative) / position.costNative) * 100;
  }

  function setStatus(message) {
    const status = root?.querySelector(`#${selectors.status}`);
    if (!status) return;
    status.textContent = message;
    window.setTimeout(() => {
      if (status.textContent === message) status.textContent = "Local ledger";
    }, 2500);
  }

  function togglePanel() {
    const panel = root.querySelector(`.${selectors.panel}`);
    const button = root.querySelector("[data-action='toggle']");
    if (!panel || !button) return;
    const minimized = panel.classList.toggle(selectors.minimized);
    button.textContent = minimized ? "+" : "-";
    button.title = minimized ? "Maximize" : "Minimize";
    button.setAttribute("aria-label", minimized ? "Maximize" : "Minimize");
  }

  function buildExportPayload(reason = "manual") {
    const positions = getPositionSummaries();
    return {
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      source: "wilytrader-padre-extension",
      privacy: "local-only; no backend sync; optional localhost Snipalot bridge",
      reason,
      session: {
        pageUrl: window.location.href,
        pageTitle: document.title,
        activeToken,
      },
      balances: state.balances,
      openPositions: positions.filter((position) => position.status === "open"),
      closedPositions: positions.filter((position) => position.status === "closed"),
      positions,
      executions: state.executions,
      notes: state.notes,
      settings: state.settings,
      mockapeCompatibleTrades: buildMockApeCompatibleTrades(),
    };
  }

  async function syncBridge(reason) {
    if (!state?.settings?.bridgeEnabled) return;
    try {
      const response = await fetch(`${BRIDGE_BASE_URL}/ledger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildExportPayload(reason)),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json().catch(() => ({}));
      bridgeState = {
        active: true,
        lastMessage: data.sessionDir ? "Snipalot bridge synced" : "Snipalot bridge active",
      };
    } catch {
      bridgeState = { active: false, lastMessage: "Snipalot bridge not connected" };
    }
    render();
  }

  function exportJson() {
    const payload = buildExportPayload("download");
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    anchor.href = url;
    anchor.download = `wilytrader-padre-ledger-${stamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    void syncBridge("download");
    setStatus("JSON export created.");
  }

  async function copyJson() {
    const text = JSON.stringify(buildExportPayload("copy"), null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setStatus("JSON copied.");
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      area.style.position = "fixed";
      area.style.left = "-9999px";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
      setStatus("JSON copied.");
    }
  }

  async function clearTradeLog() {
    if (!window.confirm("Clear paper ledger, notes, and open positions?")) return;
    state.executions = [];
    state.closedPositions = [];
    state.positions = {};
    state.notes = [];
    await persistAndSync("clear");
    render();
    setStatus("Paper ledger cleared.");
  }

  function bindRouteWatcher() {
    window.setInterval(() => {
      const routeKey = `${window.location.href}|${document.title}`;
      if (routeKey !== lastRouteKey) {
        lastRouteKey = routeKey;
        updateActiveToken();
        render();
      }
    }, 1000);
  }

  function applyPanelPosition(panel) {
    if (!panel || !state?.settings?.panelPosition) return;
    const { left, top } = state.settings.panelPosition;
    if (!Number.isFinite(left) || !Number.isFinite(top)) return;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    panel.style.left = `${Math.max(8, Math.min(window.innerWidth - panel.offsetWidth - 8, left))}px`;
    panel.style.top = `${Math.max(8, Math.min(window.innerHeight - 48, top))}px`;
  }

  function makeDraggable(handle, panel) {
    if (!handle || !panel) return;
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let panelX = 0;
    let panelY = 0;

    handle.addEventListener("mousedown", (event) => {
      if (event.target.closest("button")) return;
      event.preventDefault();
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      const rect = panel.getBoundingClientRect();
      panelX = rect.left;
      panelY = rect.top;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      panel.style.left = `${panelX}px`;
      panel.style.top = `${panelY}px`;
      document.body.style.userSelect = "none";
    });

    document.addEventListener("mousemove", (event) => {
      if (!dragging) return;
      const nextX = Math.max(8, Math.min(window.innerWidth - panel.offsetWidth - 8, panelX + event.clientX - startX));
      const nextY = Math.max(8, Math.min(window.innerHeight - 48, panelY + event.clientY - startY));
      panel.style.left = `${nextX}px`;
      panel.style.top = `${nextY}px`;
    });

    document.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.userSelect = "";
      const left = Number.parseFloat(panel.style.left);
      const top = Number.parseFloat(panel.style.top);
      if (Number.isFinite(left) && Number.isFinite(top)) {
        state.settings.panelPosition = { left, top };
        void persist();
      }
    });
  }

  function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  if (window.location.hostname.includes("trade.padre.gg")) {
    void initialize().catch((error) => {
      console.error("[WilyTrader] Failed to initialize.", error);
    });
  }
})();

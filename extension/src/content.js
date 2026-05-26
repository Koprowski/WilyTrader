(() => {
  "use strict";

  const STORAGE_KEY = "wilytrader_state_v2";
  const SCHEMA_VERSION = 7;
  const LEGACY_DEFAULT_BUY_AMOUNTS = [0.1, 0.2, 0.5, 1];
  const PADRE_FOUR_DEFAULT_BUY_AMOUNTS = [0.1, 0.25, 0.5, 1];
  const PADRE_EIGHT_DEFAULT_BUY_AMOUNTS = [0.1, 0.25, 0.5, 1, 3, 0.005, 5, 7];
  const SIX_SLOT_DEFAULT_BUY_AMOUNTS = [0.1, 0.25, 0.5, 1, 3, 0.005];
  const LEGACY_DEFAULT_SELL_PERCENTS = [10, 25, 50, 100];
  const PADRE_DEFAULT_SELL_PERCENTS = [5, 15, 33, 55, 20, 40, 86, 100];
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
  const SLIPPAGE_ICON = `
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M5.6149 3.63297C5.98202 3.96106 6.32831 4.272 6.67802 4.57925C6.70572 4.60352 6.7582 4.61275 6.79697 4.60853C7.36875 4.54576 7.94106 4.48431 8.51178 4.41205C8.79873 4.37565 9.0113 4.46506 9.17903 4.70532C9.48576 5.1447 9.80752 5.57354 10.1206 6.0087C10.2551 6.19569 10.2828 6.39824 10.1641 6.60211C10.042 6.81205 9.85552 6.92413 9.6084 6.91253C9.42299 6.90383 9.28954 6.80044 9.18484 6.65459C8.95433 6.33336 8.71934 6.01503 8.49728 5.68827C8.42106 5.57591 8.348 5.54136 8.20901 5.55956C7.64752 5.63367 7.08365 5.69011 6.49947 5.75552C6.53244 5.7906 6.55222 5.81539 6.57543 5.83569C6.93569 6.15139 7.29385 6.46945 7.65833 6.7804C7.83583 6.93205 7.91046 7.11007 7.9007 7.34664C7.87539 7.96114 7.86563 8.57644 7.85429 9.19174C7.84822 9.51719 7.60057 9.76088 7.26827 9.7564C6.94545 9.75218 6.71178 9.51376 6.72391 9.1891C6.74317 8.67983 6.77218 8.17081 6.79011 7.66128C6.79222 7.60062 6.7706 7.51754 6.7284 7.47983C5.80216 6.64958 4.87169 5.82435 3.94176 4.99859C3.91908 4.97829 3.89402 4.96088 3.86238 4.93609C3.66405 5.23042 3.46572 5.51947 3.27556 5.8138C3.25499 5.84572 3.2658 5.9135 3.28506 5.95358C3.46334 6.3207 3.6469 6.68519 3.82835 7.05099C3.96629 7.32897 3.86765 7.60325 3.59178 7.71218C3.3051 7.82532 3.04664 7.69161 2.93613 7.41099C2.79635 7.05653 2.62809 6.71341 2.47117 6.3658C2.41341 6.23789 2.3575 6.10866 2.29235 5.98444C2.21508 5.83701 2.22668 5.69407 2.30765 5.55772C2.6418 4.99517 2.97886 4.43446 3.3175 3.87455C3.34862 3.82312 3.39767 3.78277 3.44013 3.73873C3.45517 3.72317 3.47627 3.71341 3.49209 3.69838C4.16778 3.04774 5.03152 2.77714 5.89736 2.51262C6.02976 2.47227 6.12655 2.40343 6.20989 2.29319C6.42747 2.00598 6.65165 1.72378 6.88031 1.44528C7.02273 1.27174 7.21341 1.23191 7.41411 1.31552C7.61983 1.40097 7.7546 1.59481 7.72347 1.80053C7.70844 1.89969 7.66255 2.00466 7.60136 2.08484C7.32681 2.44457 7.0462 2.79983 6.75688 3.14796C6.69068 3.22761 6.58941 3.29117 6.4913 3.32888C6.20989 3.43701 5.92189 3.52774 5.61464 3.63297H5.6149Z"></path>
      <path d="M5.99919 11.0574C4.55365 11.0574 3.10812 11.0574 1.66258 11.0574C1.60983 11.0574 1.55708 11.0585 1.50434 11.0553C1.24165 11.0392 1.03304 10.8451 1.02935 10.6146C1.02565 10.3844 1.22741 10.1847 1.49062 10.1597C1.53414 10.1554 1.57845 10.157 1.62223 10.157C4.54416 10.157 7.46609 10.157 10.388 10.1578C10.4619 10.1578 10.5384 10.1612 10.6096 10.1792C10.8514 10.2398 10.9938 10.4223 10.9785 10.6405C10.9643 10.8456 10.7789 11.0242 10.5465 11.0521C10.4859 11.0595 10.4236 11.0574 10.3622 11.0574C8.90794 11.0574 7.45343 11.0574 5.99919 11.0574Z"></path>
      <path d="M2.90148 0.922858C3.53181 0.920748 4.03581 1.41895 4.03819 2.04637C4.04056 2.67459 3.54157 3.18018 2.91441 3.18598C2.29515 3.19152 1.77928 2.68198 1.77348 2.05903C1.76794 1.43794 2.27695 0.924968 2.90148 0.922858Z"></path>
    </svg>`;
  const ROCKET_ICON = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M13.6 4.2C15.7 2.1 18.8 1.6 21 2.2C21.6 4.4 21.1 7.5 19 9.6L15.7 12.9L17 18L14.7 20.3L12.1 15.9L8.1 11.9L3.7 9.3L6 7L11.1 8.3L13.6 4.2Z"></path>
      <path d="M7.7 14.7C6.1 14.9 4.7 15.7 3.7 16.8C2.7 17.8 2.1 19.1 2 21C3.9 20.9 5.2 20.3 6.2 19.3C7.3 18.3 8.1 16.9 8.3 15.3L7.7 14.7Z"></path>
      <path d="M16.8 5.9C17.5 5.2 18.6 5.2 19.3 5.9C20 6.6 20 7.7 19.3 8.4C18.6 9.1 17.5 9.1 16.8 8.4C16.1 7.7 16.1 6.6 16.8 5.9Z"></path>
    </svg>`;
  const BRIBE_ICON = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3 15.2C3 14.5 3.5 14 4.2 14H8.2C9.5 14 10.7 14.5 11.6 15.3L12.1 15.8H15.4C16.1 15.8 16.7 16.4 16.7 17.1C16.7 17.8 16.1 18.4 15.4 18.4H11.7C11.3 18.4 11 18.7 11 19.1C11 19.5 11.3 19.8 11.7 19.8H16.1C16.7 19.8 17.3 19.6 17.8 19.2L21.1 16.8C21.8 16.3 22 15.4 21.5 14.8C21.1 14.2 20.2 14 19.6 14.5L17.2 16.2C16.9 15.1 15.9 14.4 14.8 14.4H12.7L12.3 14C11.1 12.9 9.6 12.3 8 12.3H4.2C3.5 12.3 3 12.8 3 13.5V15.2Z"></path>
      <path d="M4 16.1H8.2C9.1 16.1 9.9 16.5 10.5 17.1L11 17.6V21H4C3.4 21 3 20.6 3 20V17.1C3 16.5 3.4 16.1 4 16.1Z"></path>
      <path d="M12.2 3.1H21C21.6 3.1 22 3.5 22 4.1V10.3C22 10.9 21.6 11.3 21 11.3H12.2C11.6 11.3 11.2 10.9 11.2 10.3V4.1C11.2 3.5 11.6 3.1 12.2 3.1ZM16.6 9.5C17.9 9.5 19 8.5 19 7.2C19 5.9 17.9 4.9 16.6 4.9C15.3 4.9 14.2 5.9 14.2 7.2C14.2 8.5 15.3 9.5 16.6 9.5Z"></path>
    </svg>`;
  const NOTE_ICON = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M5 4H15.5L19 7.5V20H5V4Z"></path>
      <path d="M15 4V8H19"></path>
      <path d="M8 12H16"></path>
      <path d="M8 15H13"></path>
      <path d="M17.5 14.5V19.5"></path>
      <path d="M15 17H20"></path>
    </svg>`;
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
      buyAmounts: [0.1, 0.25, 0.5, 1, 2, 5],
      sellPercents: [10, 20, 25, 33, 50, 67, 75, 100],
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
    addModal: "wt-add-modal",
    noteModal: "wt-note-modal",
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
    merged.settings.buyAmounts = normalizeBuyAmounts(merged.settings.buyAmounts);
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
    if (
      arraysEqual(storedSettings.buyAmounts, LEGACY_DEFAULT_BUY_AMOUNTS) ||
      arraysEqual(storedSettings.buyAmounts, PADRE_FOUR_DEFAULT_BUY_AMOUNTS) ||
      arraysEqual(storedSettings.buyAmounts, PADRE_EIGHT_DEFAULT_BUY_AMOUNTS) ||
      arraysEqual(storedSettings.buyAmounts, SIX_SLOT_DEFAULT_BUY_AMOUNTS)
    ) {
      settings.buyAmounts = DEFAULT_STATE.settings.buyAmounts;
    }
    if (arraysEqual(storedSettings.sellPercents, LEGACY_DEFAULT_SELL_PERCENTS) || arraysEqual(storedSettings.sellPercents, PADRE_DEFAULT_SELL_PERCENTS)) {
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

  function normalizeBuyAmounts(amounts) {
    const values = Array.isArray(amounts)
      ? amounts.map(Number).filter((value) => Number.isFinite(value) && value > 0).slice(0, 6)
      : [];
    const defaults = DEFAULT_STATE.settings.buyAmounts;
    for (let index = values.length; index < 6; index += 1) {
      values.push(defaults[index]);
    }
    return values;
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
            <button class="wt-icon-btn" data-action="open-add" title="Add funds or position" aria-label="Add funds or position">+</button>
            <button class="wt-icon-btn" data-action="open-note" title="Add note" aria-label="Add note">${NOTE_ICON}</button>
            <button class="wt-icon-btn" data-action="settings" title="Settings" aria-label="Settings">&#9881;</button>
            <button class="wt-icon-btn" data-action="export" title="Download JSON" aria-label="Download JSON">DL</button>
          </div>
        </header>
        <div class="wt-body">
          <div class="wt-section">
            <div class="wt-token-row">
              <div id="${selectors.token}" class="wt-token"></div>
              <div class="wt-mini-stats">
                <span id="${selectors.balance}"></span>
                <span id="${selectors.position}"></span>
              </div>
            </div>
            <div id="${selectors.price}" class="wt-muted"></div>
            <div id="${selectors.bridge}" class="wt-muted"></div>
          </div>
          <div class="wt-section">
            <div class="wt-trade-header">
              <div class="wt-trade-title wt-buy-title">Buy</div>
              <div class="wt-chain-pill" data-buy-chain>SOL</div>
            </div>
            <div class="wt-button-row wt-buy-grid" data-buy-buttons></div>
            <div class="wt-fee-strip" aria-label="Buy execution settings">
              <label class="wt-inline-setting wt-icon-setting" title="Slippage %" aria-label="Buy slippage percent">
                <span class="wt-fee-icon">${SLIPPAGE_ICON}</span>
                <input data-quick-setting="buySlippagePct" type="number" min="0" step="0.1" />
                <span class="wt-percent-suffix">%</span>
              </label>
              <label class="wt-inline-setting wt-icon-setting" title="Priority fee" aria-label="Buy priority fee">
                <span class="wt-fee-icon">${ROCKET_ICON}</span>
                <input data-quick-setting="buyPriorityFeeNative" type="number" min="0" step="0.0001" />
              </label>
              <label class="wt-inline-setting wt-icon-setting" title="Bribe fee" aria-label="Buy bribe fee">
                <span class="wt-fee-icon">${BRIBE_ICON}</span>
                <input data-quick-setting="buyBribeFeeNative" type="number" min="0" step="0.0001" />
              </label>
            </div>
          </div>
          <div class="wt-section">
            <div class="wt-trade-header">
              <div class="wt-trade-title wt-sell-title">Sell</div>
              <div class="wt-muted" data-sell-assets>0 Asset</div>
            </div>
            <div class="wt-button-row" data-sell-buttons></div>
            <div class="wt-fee-strip" aria-label="Sell execution settings">
              <label class="wt-inline-setting wt-icon-setting" title="Slippage %" aria-label="Sell slippage percent">
                <span class="wt-fee-icon">${SLIPPAGE_ICON}</span>
                <input data-quick-setting="sellSlippagePct" type="number" min="0" step="0.1" />
                <span class="wt-percent-suffix">%</span>
              </label>
              <label class="wt-inline-setting wt-icon-setting" title="Priority fee" aria-label="Sell priority fee">
                <span class="wt-fee-icon">${ROCKET_ICON}</span>
                <input data-quick-setting="sellPriorityFeeNative" type="number" min="0" step="0.0001" />
              </label>
              <label class="wt-inline-setting wt-icon-setting" title="Bribe fee" aria-label="Sell bribe fee">
                <span class="wt-fee-icon">${BRIBE_ICON}</span>
                <input data-quick-setting="sellBribeFeeNative" type="number" min="0" step="0.0001" />
              </label>
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
              <label class="wt-label" for="wt-buy-amounts">Buy presets (6 max)</label>
              <input id="wt-buy-amounts" class="wt-input" data-setting="buyAmounts" placeholder="0.1, 0.25, 0.5, 1, 2, 5" />
            </div>
            <div class="wt-setting-group">
              <label class="wt-label" for="wt-sell-percents">Sell buttons (%)</label>
              <input id="wt-sell-percents" class="wt-input" data-setting="sellPercents" placeholder="10, 20, 25, 33, 50, 67, 75, 100" />
            </div>
            <div class="wt-settings-grid">
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
      <div id="${selectors.addModal}" class="wt-modal" aria-hidden="true">
        <section class="wt-modal-panel" aria-label="WilyTrader add funds or position">
          <header class="wt-modal-header">
            <div class="wt-title">Add</div>
            <button class="wt-icon-btn" data-action="close-modal" title="Close" aria-label="Close">x</button>
          </header>
          <div class="wt-modal-body">
            <div class="wt-setting-group">
              <label class="wt-label" for="wt-add-funds">Add paper balance</label>
              <div class="wt-custom-row">
                <input id="wt-add-funds" class="wt-input" data-deposit type="number" min="0" step="0.01" placeholder="Amount" />
                <button class="wt-button" data-action="deposit">Add</button>
              </div>
            </div>
            <div class="wt-setting-group">
              <label class="wt-label" for="wt-add-position">Add current-token position</label>
              <div class="wt-custom-row">
                <input id="wt-add-position" class="wt-input" data-add-position type="number" min="0" step="0.01" placeholder="Cost" />
                <button class="wt-button" data-action="add-position">Add</button>
              </div>
            </div>
          </div>
        </section>
      </div>
      <div id="${selectors.noteModal}" class="wt-modal" aria-hidden="true">
        <section class="wt-modal-panel" aria-label="WilyTrader add note">
          <header class="wt-modal-header">
            <div class="wt-title">Add Note</div>
            <button class="wt-icon-btn" data-action="close-modal" title="Close" aria-label="Close">x</button>
          </header>
          <div class="wt-modal-body">
            <div class="wt-setting-group">
              <label class="wt-label" for="wt-note-input">Note</label>
              <div class="wt-custom-row">
                <input id="wt-note-input" class="wt-input" data-note type="text" placeholder="Optional rationale tag" />
                <button class="wt-button" data-action="add-note">Add</button>
              </div>
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
    } else if (action === "add-position") {
      const input = root.querySelector("[data-add-position]");
      const amount = Number(input.value);
      if (Number.isFinite(amount) && amount > 0) {
        input.value = "";
        void addManualPosition(amount);
      } else {
        setStatus("Enter a valid position cost.");
      }
    } else if (action === "open-add") {
      openAddModal();
    } else if (action === "open-note") {
      openNoteModal();
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
    closeModals();
    render();
    setStatus(`Added ${formatters.native(amount, chain)}.`);
  }

  async function addManualPosition(amountNative) {
    updateActiveToken();
    const token = activeToken;
    if (!token.key) return setStatus("Open a Padre token page first.");
    if (!token.unitPriceNative) return setStatus("Price unavailable. Wait for Padre market cap to load.");

    const chain = token.chain;
    const tokenAmount = amountNative / token.unitPriceNative;
    const existing = state.positions[token.key] || createEmptyPosition(token);
    const before = snapshotPosition(existing);
    const newCost = existing.costNative + amountNative;
    const newTokenAmount = existing.tokenAmount + tokenAmount;
    const updated = {
      ...existing,
      tokenName: token.name,
      lastUrl: token.url,
      tokenAmount: newTokenAmount,
      costNative: newCost,
      avgEntryNative: newCost / newTokenAmount,
      avgEntryUsd: (newCost / newTokenAmount) * (DEFAULT_PRICES[chain] || 1),
      buyCount: (existing.buyCount || 0) + 1,
      updatedAt: new Date().toISOString(),
    };

    state.positions[token.key] = updated;
    recordExecution({
      side: "buy",
      chain,
      token,
      positionId: updated.positionId,
      requestedAmountNative: amountNative,
      grossNative: amountNative,
      netNative: 0,
      fees: { platformFeeNative: 0, gasFeeNative: 0, priorityFeeNative: 0, bribeFeeNative: 0, totalFeeNative: 0, executionDelayMs: 0 },
      slippagePct: 0,
      tokenAmount,
      executionPriceNative: token.unitPriceNative,
      pnlNative: 0,
      positionBefore: before,
      positionAfter: snapshotPosition(updated),
      costBasisNative: 0,
    });
    await persistAndSync("manual-position");
    closeModals();
    render();
    setStatus(`Added ${formatters.native(amountNative, chain)} paper position.`);
  }

  function openAddModal() {
    const modal = root.querySelector(`#${selectors.addModal}`);
    if (!modal) return;
    const fundsInput = root.querySelector("[data-deposit]");
    const positionInput = root.querySelector("[data-add-position]");
    if (fundsInput) fundsInput.value = "";
    if (positionInput) positionInput.value = "";
    modal.classList.add("wt-modal-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function openNoteModal() {
    const modal = root.querySelector(`#${selectors.noteModal}`);
    if (!modal) return;
    const input = root.querySelector("[data-note]");
    if (input) input.value = "";
    modal.classList.add("wt-modal-open");
    modal.setAttribute("aria-hidden", "false");
  }

  function openSettingsModal() {
    const modal = root.querySelector(`#${selectors.settingsModal}`);
    if (!modal) return;
    root.querySelector("[data-setting='buyAmounts']").value = state.settings.buyAmounts.join(", ");
    root.querySelector("[data-setting='sellPercents']").value = state.settings.sellPercents.join(", ");
    [
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
    const nextBuyAmounts = parsePositiveNumberList(root.querySelector("[data-setting='buyAmounts']")?.value, "buy presets", 6);
    const parsedSellPercents = parsePositiveNumberList(root.querySelector("[data-setting='sellPercents']")?.value, "sell buttons", 8);
    if (!nextBuyAmounts || !parsedSellPercents) return;
    const nextSellPercents = parsedSellPercents.map((value) => Math.min(100, value));

    const numericKeys = [
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

    next.buyAmounts = normalizeBuyAmounts(next.buyAmounts);
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

  function parsePositiveNumberList(value, label, maxItems = 8) {
    const numbers = String(value || "")
      .split(",")
      .map((part) => Number(part.trim()))
      .filter((value) => Number.isFinite(value) && value > 0);
    if (numbers.length === 0) {
      setStatus(`Enter at least one ${label} value.`);
      return null;
    }
    return numbers.slice(0, maxItems);
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
    closeModals();
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

    balanceEl.textContent = `Bal ${formatters.native(state.balances[token.chain] || 0, token.chain)}`;
    positionEl.textContent = summary
      ? `Pos ${formatters.native(summary.investedNative, token.chain)} ${formatters.pct(calculateOpenPnlPct(position, token))}`
      : "Pos none";
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
    const buyPresets = normalizeBuyAmounts(state.settings.buyAmounts);
    state.settings.buyAmounts = buyPresets;
    buyPresets.forEach((amount) => {
      const button = document.createElement("button");
      button.className = "wt-trade-button wt-buy-button";
      button.dataset.buyAmount = String(amount);
      button.textContent = String(amount);
      buyButtonsEl.appendChild(button);
    });
    const customInput = document.createElement("input");
    customInput.className = "wt-input wt-custom-buy-input";
    customInput.dataset.customBuy = "";
    customInput.type = "number";
    customInput.min = "0";
    customInput.step = "0.01";
    customInput.placeholder = "Custom";
    buyButtonsEl.appendChild(customInput);
    const customButton = document.createElement("button");
    customButton.className = "wt-trade-button wt-buy-button wt-custom-buy-button";
    customButton.dataset.action = "custom-buy";
    customButton.textContent = "Buy";
    buyButtonsEl.appendChild(customButton);

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

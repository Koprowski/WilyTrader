(() => {
  "use strict";

  const STORAGE_KEY = "wilytrader_state_v2";
  const SCHEMA_VERSION = 11;
  const LEGACY_DEFAULT_BUY_AMOUNTS = [0.1, 0.2, 0.5, 1];
  const PADRE_FOUR_DEFAULT_BUY_AMOUNTS = [0.1, 0.25, 0.5, 1];
  const PADRE_EIGHT_DEFAULT_BUY_AMOUNTS = [0.1, 0.25, 0.5, 1, 3, 0.005, 5, 7];
  const SIX_SLOT_DEFAULT_BUY_AMOUNTS = [0.1, 0.25, 0.5, 1, 3, 0.005];
  const LEGACY_DEFAULT_SELL_PERCENTS = [10, 25, 50, 100];
  const PADRE_DEFAULT_SELL_PERCENTS = [5, 15, 33, 55, 20, 40, 86, 100];
  const WILYTRADER_V10_DEFAULT_SELL_PERCENTS = [10, 20, 25, 33, 50, 67, 75, 100];
  const PADRE_DEFAULT_FEES = {
    gasFeeNative: 0.001,
    priorityFeeNative: 0.01,
    bribeFeeNative: 0,
  };
  const AGGRESSIVE_MEME_FEES = {
    gasFeeNative: 0.000005,
    priorityFeeNative: 0.001,
    bribeFeeNative: 0.01,
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
  const LEDGER_ICON = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M5 4H19V20H5V4Z"></path>
      <path d="M8 8H16"></path>
      <path d="M8 12H16"></path>
      <path d="M8 16H13"></path>
    </svg>`;
  const CIRCLE_UP_ICON = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z"></path>
      <path d="M12 16V8"></path>
      <path d="M8.5 11.5L12 8L15.5 11.5"></path>
    </svg>`;
  const CIRCLE_DOWN_ICON = `
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3C7.02944 3 3 7.02944 3 12C3 16.9706 7.02944 21 12 21Z"></path>
      <path d="M12 8V16"></path>
      <path d="M8.5 12.5L12 16L15.5 12.5"></path>
    </svg>`;
  const LEGACY_STORAGE_KEYS = [
    "wilytrader_state_v1",
    ["wily", "mem", "trader_state_v2"].join(""),
    ["wily", "mem", "trader_state_v1"].join(""),
  ];
  const BRIDGE_BASE_URL = "http://127.0.0.1:17365/v1/wilytrader";
  const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
  const MARKET_CAP_SUPPLY = 1_000_000_000;
  const DEFAULT_PRICES = { SOL: 190, BNB: 600 };
  const SOLANA_ADDRESS_PATTERN = /[1-9A-HJ-NP-Za-km-z]{32,44}/;
  const ETHEREUM_ADDRESS_PATTERN = /0x[a-fA-F0-9]{40}/;
  const PLATFORM_ADAPTERS = [
    {
      id: "padre",
      label: "Padre",
      hosts: ["trade.padre.gg"],
      detectToken: detectPadreToken,
    },
    {
      id: "axiom",
      label: "Axiom",
      hosts: ["axiom.trade"],
      detectToken: detectAxiomToken,
    },
  ];
  const DEFAULT_STATE = {
    schemaVersion: SCHEMA_VERSION,
    balances: { SOL: 3, BNB: 1 },
    positions: {},
    closedPositions: [],
    executions: [],
    sessions: [],
    sessionStartedAt: new Date().toISOString(),
    notes: [],
    settings: {
      buyAmounts: [0.1, 0.25, 0.5, 1, 2, 5],
      sellPercents: [5, 10, 15, 33, 50, 67, 85, 100],
      platformFeePct: 2,
      buyGasFeeNative: AGGRESSIVE_MEME_FEES.gasFeeNative,
      sellGasFeeNative: AGGRESSIVE_MEME_FEES.gasFeeNative,
      buyPriorityFeeNative: AGGRESSIVE_MEME_FEES.priorityFeeNative,
      sellPriorityFeeNative: AGGRESSIVE_MEME_FEES.priorityFeeNative,
      buyBribeFeeNative: AGGRESSIVE_MEME_FEES.bribeFeeNative,
      sellBribeFeeNative: AGGRESSIVE_MEME_FEES.bribeFeeNative,
      buySlippagePct: 80,
      sellSlippagePct: 80,
      useCustomDelay: true,
      customDelayMs: 1000,
      panelPosition: null,
      bridgeEnabled: false,
      autoScreenshotOnTrade: true,
      fallbackDownloadsEnabled: true,
      updateChecksEnabled: true,
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
    updateNotice: "wt-update-notice",
    log: "wt-log",
    settingsModal: "wt-settings-modal",
    logModal: "wt-log-modal",
    addModal: "wt-add-modal",
  };

  let state = null;
  let activeToken = null;
  let root = null;
  let lastRouteKey = "";
  let bridgeState = { active: false, lastMessage: "Bridge idle" };
  let tradeInFlight = false;
  let extensionContextValid = true;
  let lastSyncedExecutionId = null;
  let pulseQuickBuyBound = false;
  let updateCheckTimerId = null;
  let updateState = {
    checking: false,
    checkedAt: null,
    installedVersion: "",
    latestVersion: "",
    updateAvailable: false,
    error: null,
  };

  const formatters = {
    native(value, chain, decimals = 4) {
      return `${Number(value || 0).toFixed(decimals)} ${chain}`;
    },
    signedNative(value, chain, decimals = 4) {
      const numeric = Number(value || 0);
      const sign = numeric > 0 ? "+" : numeric < 0 ? "-" : "";
      return `${sign}${Math.abs(numeric).toFixed(decimals)} ${chain}`;
    },
    compactNative(value, chain) {
      return `${Number(value || 0).toFixed(2)} ${chain}`;
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
    injectAxiomChartBridgeScript();
    injectPanel();
    updateActiveToken();
    render();
    bindRouteWatcher();
    startUpdateChecks();
    if (isOverlayVisibleRoute()) void syncBridge("startup");
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
      extensionContextValid = false;
      setStatus("Extension reloaded. Refresh this tab to reconnect WilyTrader.");
      return;
    }
    console.error("[WilyTrader]", error);
  }

  function isExtensionContextError(error) {
    return (error?.message || String(error || "")).includes("Extension context invalidated");
  }

  function runTask(task) {
    Promise.resolve(task).catch((error) => {
      if (isExtensionContextError(error)) {
        handleExtensionContextError(error);
      } else {
        console.error("[WilyTrader]", error);
      }
    });
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
      sessions: Array.isArray(stored?.sessions) ? stored.sessions : [],
      sessionStartedAt: stored?.sessionStartedAt || new Date().toISOString(),
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
    if (
      arraysEqual(storedSettings.sellPercents, LEGACY_DEFAULT_SELL_PERCENTS) ||
      arraysEqual(storedSettings.sellPercents, PADRE_DEFAULT_SELL_PERCENTS) ||
      arraysEqual(storedSettings.sellPercents, WILYTRADER_V10_DEFAULT_SELL_PERCENTS)
    ) {
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
    if (Number(storedSettings.buyPriorityFeeNative) === 0.007) {
      settings.buyPriorityFeeNative = DEFAULT_STATE.settings.buyPriorityFeeNative;
    }
    if (Number(storedSettings.sellPriorityFeeNative) === 0.007) {
      settings.sellPriorityFeeNative = DEFAULT_STATE.settings.sellPriorityFeeNative;
    }
    if (Number(storedSettings.buyBribeFeeNative) === 0.003) {
      settings.buyBribeFeeNative = DEFAULT_STATE.settings.buyBribeFeeNative;
    }
    if (Number(storedSettings.sellBribeFeeNative) === 0.003) {
      settings.sellBribeFeeNative = DEFAULT_STATE.settings.sellBribeFeeNative;
    }
    if (storedSettings.useCustomDelay === undefined || storedSettings.useCustomDelay === false) {
      settings.useCustomDelay = DEFAULT_STATE.settings.useCustomDelay;
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
    if (!extensionContextValid) return false;
    await storageSet(STORAGE_KEY, state);
    return true;
  }

  function detectToken() {
    const url = new URL(window.location.href);
    const adapter = getPlatformAdapter(url.hostname);
    if (!adapter) return buildEmptyToken(null, "Unsupported page");
    if (!isOverlayVisibleRoute(url)) return buildEmptyToken(adapter);
    return adapter.detectToken(url);
  }

  function getPlatformAdapter(hostname = window.location.hostname) {
    const normalizedHost = String(hostname || "").toLowerCase();
    return PLATFORM_ADAPTERS.find((adapter) =>
      adapter.hosts.some((host) => normalizedHost === host || normalizedHost.endsWith(`.${host}`)),
    ) || null;
  }

  function isOverlayVisibleRoute(url = new URL(window.location.href)) {
    const adapter = getPlatformAdapter(url.hostname);
    if (!adapter) return false;
    if (adapter.id === "axiom") return isAxiomMemeRoute(url);
    if (adapter.id === "padre") return isPadreTradeRoute(url);
    return false;
  }

  function isAxiomPulseRoute(url = new URL(window.location.href)) {
    const adapter = getPlatformAdapter(url.hostname);
    return adapter?.id === "axiom" && normalizePathname(url.pathname).startsWith("/pulse");
  }

  function isAxiomMemeRoute(url) {
    const path = normalizePathname(url.pathname);
    if (path.startsWith("/meme/")) return true;
    if (path !== "/meme") return false;
    return Boolean(findTokenAddress([url.search, safeDecode(url.hash || "")].join(" ")));
  }

  function isPadreTradeRoute(url) {
    const pathParts = url.pathname.split("/").filter(Boolean);
    const tradeIndex = pathParts.indexOf("trade");
    return tradeIndex >= 0 && Boolean(pathParts[tradeIndex + 1] && pathParts[tradeIndex + 2]);
  }

  function normalizePathname(pathname) {
    return `/${String(pathname || "").replace(/^\/+/, "")}`.toLowerCase();
  }

  function applyOverlayVisibility() {
    if (!root) return false;
    const visible = isOverlayVisibleRoute();
    root.hidden = !visible;
    root.setAttribute("aria-hidden", visible ? "false" : "true");
    if (!visible) {
      closeModals();
      postAxiomChartBridgeMessage({ op: "clearAll" });
    }
    return visible;
  }

  function buildEmptyToken(adapter, name = null) {
    return {
      platform: adapter?.id || "unknown",
      platformLabel: adapter?.label || "Unsupported",
      chain: "SOL",
      platformChain: "solana",
      address: null,
      key: null,
      name: name || `No ${adapter?.label || "supported"} token page`,
      marketCap: null,
      unitPriceUsd: null,
      unitPriceNative: null,
    };
  }

  function buildDetectedToken(adapter, { address, chain = "SOL", platformChain = "solana", name, marketCap, url = window.location.href }) {
    const unitPriceUsd = marketCap ? marketCap / MARKET_CAP_SUPPLY : null;
    const chainUsd = DEFAULT_PRICES[chain] || 1;
    const unitPriceNative = unitPriceUsd ? unitPriceUsd / chainUsd : null;

    if (!address) return buildEmptyToken(adapter);

    return {
      platform: adapter.id,
      platformLabel: adapter.label,
      chain,
      platformChain,
      address,
      key: `${adapter.id}:${chain}:${address}`,
      name: name || shortenAddress(address),
      marketCap,
      unitPriceUsd,
      unitPriceNative,
      url,
    };
  }

  function detectPadreToken(url) {
    const adapter = getPlatformAdapter(url.hostname);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const tradeIndex = pathParts.indexOf("trade");
    const chainSlug = tradeIndex >= 0 ? pathParts[tradeIndex + 1] : null;
    const address = tradeIndex >= 0 ? pathParts[tradeIndex + 2] : null;
    const chain = chainSlug === "bsc" ? "BNB" : "SOL";
    const platformChain = chainSlug || "solana";
    const name = detectTokenName(address, adapter);
    const marketCap = detectMarketCap();
    return buildDetectedToken(adapter, {
      address,
      chain,
      platformChain,
      name,
      marketCap,
    });
  }

  function detectAxiomToken(url) {
    const adapter = getPlatformAdapter(url.hostname);
    const address = detectAxiomTokenAddress(url);
    const name = detectTokenName(address, adapter);
    const marketCap = detectMarketCap();
    return buildDetectedToken(adapter, {
      address,
      chain: "SOL",
      platformChain: "solana",
      name,
      marketCap,
    });
  }

  function detectAxiomTokenAddress(url) {
    const urlCandidate = [
      url.pathname,
      url.search,
      safeDecode(url.hash || ""),
    ].join(" ");
    const fromUrl = findTokenAddress(urlCandidate);
    if (fromUrl) return fromUrl;

    const labels = ["ca", "contract", "contract address", "mint", "pair"];
    const candidates = getPageTextCandidates(1500);

    for (const text of candidates) {
      const lowerText = text.toLowerCase();
      if (!labels.some((label) => lowerText.includes(label))) continue;
      const fromLabel = findTokenAddress(text);
      if (fromLabel) return fromLabel;
    }

    return findTokenAddress(candidates.join(" "));
  }

  function findTokenAddress(text) {
    const source = String(text || "");
    return source.match(ETHEREUM_ADDRESS_PATTERN)?.[0] || source.match(SOLANA_ADDRESS_PATTERN)?.[0] || null;
  }

  function safeDecode(value) {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  function detectTokenName(address, adapter) {
    const heading = queryPageSelector(
      "h1.MuiTypography-h1, h1, h2, [data-testid*='token-name' i], [class*='token-name' i], [class*='pair-name' i], [class*='asset-name' i]",
    );
    const headingText = cleanText(heading?.textContent);
    if (headingText && !findTokenAddress(headingText)) return headingText;

    const title = document.title || "";
    const titleMatch = title.match(/^([^|$]+?)(?:\s*[|$]|$)/);
    const fromTitle = cleanText(titleMatch?.[1]);
    if (fromTitle && !fromTitle.toLowerCase().includes(adapter?.id || "")) return fromTitle;

    return address ? shortenAddress(address) : "Unknown token";
  }

  function detectMarketCap() {
    const titleMatch = (document.title || "").match(/\$([0-9.]+)\s*([KMB])?/i);
    if (titleMatch) return parseCompactNumber(titleMatch[1], titleMatch[2]);

    const candidates = getPageTextCandidates(1200);

    for (const text of candidates) {
      const match = text.match(/(?:MC|MCap|Market Cap)\s*:?\s*\$?\s*([0-9.]+)\s*([KMB])?/i);
      if (match) return parseCompactNumber(match[1], match[2]);
    }
    return null;
  }

  function parseCompactNumber(value, suffix = "") {
    const parsed = Number.parseFloat(String(value || "").replace(/,/g, ""));
    if (!Number.isFinite(parsed)) return null;
    const multipliers = { K: 1_000, M: 1_000_000, B: 1_000_000_000 };
    return parsed * (multipliers[String(suffix).toUpperCase()] || 1);
  }

  function cleanText(text) {
    return String(text || "").replace(/\s+/g, " ").trim();
  }

  function queryPageSelector(selector) {
    return Array.from(document.querySelectorAll(selector)).find((element) => !root?.contains(element)) || null;
  }

  function getPageTextCandidates(limit = 1200) {
    return Array.from(document.querySelectorAll("body *"))
      .filter((element) => !root?.contains(element))
      .slice(0, limit)
      .map((element) => cleanText(element.textContent))
      .filter(Boolean);
  }

  function shortenAddress(address) {
    if (!address || address.length < 12) return address || "";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  function updateActiveToken() {
    activeToken = detectToken();
  }

  function injectPanel() {
    const existingRoot = document.getElementById(selectors.root);
    if (existingRoot) existingRoot.remove();

    root = document.createElement("div");
    root.id = selectors.root;
    root.innerHTML = `
      <section class="${selectors.panel}" aria-label="WilyTrader paper trading panel">
        <header class="wt-header">
          <button type="button" class="wt-icon-btn" data-action="toggle" title="Minimize" aria-label="Minimize">-</button>
          <div>
            <div class="wt-title">WilyTrader</div>
            <div id="${selectors.status}" class="wt-muted">Local ledger</div>
          </div>
          <div class="wt-header-controls">
            <button type="button" class="wt-icon-btn" data-action="open-add" title="Add funds or position" aria-label="Add funds or position">+</button>
            <button type="button" class="wt-icon-btn wt-collapsed-action" data-action="buy-default" title="Buy default" aria-label="Buy default">${CIRCLE_UP_ICON}</button>
            <button type="button" class="wt-icon-btn wt-collapsed-action" data-action="sell-all" title="Sell 100%" aria-label="Sell 100%">${CIRCLE_DOWN_ICON}</button>
            <button type="button" class="wt-icon-btn" data-action="view-log" title="Ledger" aria-label="Ledger">${LEDGER_ICON}</button>
            <button type="button" class="wt-icon-btn" data-action="settings" title="Settings" aria-label="Settings">&#9881;</button>
          </div>
        </header>
        <div class="wt-body">
          <div id="${selectors.updateNotice}" class="wt-update-notice" hidden>
            <div class="wt-update-copy">
              <strong>Update available</strong>
              <span data-update-detail></span>
            </div>
            <button type="button" class="wt-button" data-action="open-extension-manager">Open Extensions</button>
          </div>
          <div class="wt-section">
            <div class="wt-token-row">
              <div id="${selectors.token}" class="wt-token"></div>
              <div class="wt-mini-stats">
                <span id="${selectors.balance}"></span>
                <span id="${selectors.position}"></span>
              </div>
            </div>
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
              <input id="wt-sell-percents" class="wt-input" data-setting="sellPercents" placeholder="5, 10, 15, 33, 50, 67, 85, 100" />
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
              <span>Auto-save logs to active Snipalot trade session folder</span>
            </label>
            <label class="wt-check-row">
              <input type="checkbox" data-setting="autoScreenshotOnTrade" />
              <span>Save screenshot on each buy/sell</span>
            </label>
            <label class="wt-check-row">
              <input type="checkbox" data-setting="fallbackDownloadsEnabled" />
              <span>If Snipalot is unavailable, save fallback screenshots to Chrome Downloads</span>
            </label>
            <label class="wt-check-row">
              <input type="checkbox" data-setting="updateChecksEnabled" />
              <span>Check GitHub for WilyTrader extension updates</span>
            </label>
            <div class="wt-settings-note">Snipalot saves to the active trade session folder. The Chrome fallback saves under Downloads/WilyTrader and crops to the largest visible chart when possible. After installing an update, open Extensions and reload WilyTrader.</div>
            <div class="wt-button-row">
              <button class="wt-button wt-button-secondary" data-action="check-for-update">Check Update</button>
              <button class="wt-button wt-button-secondary" data-action="open-extension-manager">Open Extensions</button>
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
              <label class="wt-label" for="wt-set-funds">Set paper balance</label>
              <div class="wt-custom-row">
                <input id="wt-set-funds" class="wt-input" data-set-balance type="number" min="0" step="0.01" placeholder="New balance" />
                <button class="wt-button" data-action="set-balance">Set</button>
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
              <button class="wt-button" data-action="copy">Copy Session</button>
              <button class="wt-button" data-action="export">Save Session</button>
              <button class="wt-button" data-action="new-session">New Session</button>
            </div>
            <div class="wt-ledger-summary" data-ledger-summary></div>
            <div class="wt-log-full" data-log-full></div>
          </div>
        </section>
      </div>
    `;
    document.documentElement.appendChild(root);
    root.addEventListener("pointerdown", stopOverlayEvent, true);
    root.addEventListener("click", handleClick, true);
    root.addEventListener("change", handleChange);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleWindowError);
    window.addEventListener("message", handleAxiomChartBridgeEvent);
    bindAxiomPulseQuickBuy();
    const panel = root.querySelector(`.${selectors.panel}`);
    applyPanelPosition(panel);
    makeDraggable(root.querySelector(".wt-header"), panel);
  }

  function injectAxiomChartBridgeScript() {
    if (getPlatformAdapter(window.location.hostname)?.id !== "axiom") return;
    if (document.getElementById("wt-axiom-chart-bridge-script")) return;
    try {
      const runtime = chrome?.runtime;
      if (!runtime?.getURL) return;
      const script = document.createElement("script");
      script.id = "wt-axiom-chart-bridge-script";
      script.src = runtime.getURL("src/userscript-wrapper.user.js");
      script.async = false;
      (document.head || document.documentElement).appendChild(script);
    } catch (error) {
      console.debug("[WilyTrader] Axiom chart bridge injection skipped.", error);
    }
  }

  function handleAxiomChartBridgeEvent(event) {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const data = event.data || {};
    if (data.source !== "wiley-chart-bridge") return;
    if (data.event === "chartRebound" || data.event === "symbolChange") {
      injectAxiomChartBridgeScript();
      render();
    }
  }

  function bindAxiomPulseQuickBuy() {
    if (pulseQuickBuyBound) return;
    pulseQuickBuyBound = true;
    document.addEventListener("pointerdown", handleAxiomPulseQuickBuyPointerDown, true);
    document.addEventListener("click", handleAxiomPulseQuickBuyClick, true);
  }

  function handleUnhandledRejection(event) {
    if (!isExtensionContextError(event.reason)) return;
    event.preventDefault();
    handleExtensionContextError(event.reason);
  }

  function handleWindowError(event) {
    if (!isExtensionContextError(event.error || event.message)) return;
    event.preventDefault();
    handleExtensionContextError(event.error || event.message);
  }

  function stopOverlayEvent(event) {
    if (!root?.contains(event.target)) return;
    event.stopPropagation();
  }

  function handleClick(event) {
    const target = event.target.closest("button");
    if (!target || !root?.contains(target)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const action = target.dataset.action;
    const buyAmount = target.dataset.buyAmount;
    const sellPct = target.dataset.sellPct;
    const hasBuyAmount = Object.hasOwn(target.dataset, "buyAmount");
    const hasSellPct = Object.hasOwn(target.dataset, "sellPct");

    if (hasBuyAmount) runTask(buy(Number(buyAmount)));
    else if (hasSellPct) runTask(sell(Number(sellPct)));
    else if (action === "custom-buy") {
      const input = root.querySelector("[data-custom-buy]");
      const amount = Number(input.value);
      if (Number.isFinite(amount) && amount > 0) {
        input.value = "";
        runTask(buy(amount));
      } else {
        setStatus("Enter a valid buy amount.");
      }
    } else if (action === "deposit") {
      const input = root.querySelector("[data-deposit]");
      const amount = Number(input.value);
      if (Number.isFinite(amount) && amount > 0) {
        input.value = "";
        runTask(addPaperBalance(amount));
      } else {
        setStatus("Enter a valid deposit amount.");
      }
    } else if (action === "set-balance") {
      const input = root.querySelector("[data-set-balance]");
      const amount = Number(input.value);
      if (Number.isFinite(amount) && amount >= 0) {
        input.value = "";
        runTask(setPaperBalance(amount));
      } else {
        setStatus("Enter a valid balance amount.");
      }
    } else if (action === "open-add") {
      openAddModal();
    } else if (action === "buy-default") {
      const amount = normalizeBuyAmounts(state.settings.buyAmounts)[0];
      runTask(buy(amount));
    } else if (action === "sell-all") {
      runTask(sell(100));
    } else if (action === "settings") {
      openSettingsModal();
    } else if (action === "close-modal") {
      closeModals();
    } else if (action === "save-settings") {
      runTask(saveSettingsFromModal());
    } else if (action === "reset-settings") {
      runTask(resetSettingsToDefaults());
    } else if (action === "open-extension-manager") {
      runTask(openExtensionManager());
    } else if (action === "check-for-update") {
      runTask(checkForExtensionUpdate("manual"));
    } else if (action === "view-log") {
      openLogModal();
    } else if (action === "add-note") {
      runTask(addNote());
    } else if (action === "new-session") {
      runTask(startNewSession());
    } else if (action === "bridge-sync") {
      runTask(syncBridge("manual"));
    } else if (action === "export") {
      exportJson();
    } else if (action === "copy") {
      runTask(copyJson());
    } else if (action === "clear") {
      runTask(clearTradeLog());
    } else if (action === "toggle") {
      togglePanel();
    }
  }

  function handleAxiomPulseQuickBuyPointerDown(event) {
    if (!isPrimaryPointerEvent(event)) return;
    const quickBuyBox = findAxiomPulseQuickBuyBox(event.target);
    if (!quickBuyBox) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function handleAxiomPulseQuickBuyClick(event) {
    if (event.button !== undefined && event.button !== 0) return;
    const quickBuyBox = findAxiomPulseQuickBuyBox(event.target);
    if (!quickBuyBox) return;

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const token = detectAxiomPulseQuickBuyToken(quickBuyBox);
    if (!token?.key) {
      flashAxiomPulseQuickBuyBox(quickBuyBox, "wt-axiom-pulse-quick-buy-error", 900);
      setStatus("Pulse quick buy could not find that token address.");
      return;
    }
    if (!token.unitPriceNative) {
      flashAxiomPulseQuickBuyBox(quickBuyBox, "wt-axiom-pulse-quick-buy-error", 900);
      setStatus("Pulse quick buy needs the row market cap to load.");
      return;
    }

    quickBuyBox.classList.add("wt-axiom-pulse-quick-buy-active");
    runTask(
      buy(getDefaultBuyAmount(), token, {
        resolveLatestToken: () => {
          const refreshed = detectAxiomPulseQuickBuyToken(quickBuyBox);
          return refreshed?.unitPriceNative ? refreshed : token;
        },
      }).finally(() => {
        window.setTimeout(() => {
          quickBuyBox.classList.remove("wt-axiom-pulse-quick-buy-active");
        }, 450);
      }),
    );
  }

  function isPrimaryPointerEvent(event) {
    return event.button === undefined || event.button === 0;
  }

  function findAxiomPulseQuickBuyBox(target) {
    if (!isAxiomPulseRoute()) return null;
    if (!(target instanceof Element) || root?.contains(target)) return null;

    let element = target;
    for (let depth = 0; element && depth < 8; depth += 1, element = element.parentElement) {
      if (root?.contains(element)) return null;
      if (isAxiomPulseQuickBuyBoxElement(element)) return element;
    }
    return null;
  }

  function isAxiomPulseQuickBuyBoxElement(element) {
    const text = cleanText(element.textContent);
    if (!/^\d+(?:\.\d+)?\s*SOL$/i.test(text)) return false;

    const rect = element.getBoundingClientRect();
    if (!rect || rect.width < 105 || rect.width > 360 || rect.height < 48 || rect.height > 180) return false;
    if (rect.right < 0 || rect.left > window.innerWidth || rect.bottom < 0 || rect.top > window.innerHeight) return false;

    const style = window.getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return false;
    const classAndStyle = [
      element.getAttribute("class") || "",
      element.getAttribute("style") || "",
      style.boxShadow,
      style.backgroundColor,
    ].join(" ");
    const hasAxiomBlueButtonStyle = /primaryBlue/i.test(classAndStyle) || /82,\s*111,\s*255/.test(classAndStyle);
    return style.cursor === "pointer" && (hasAxiomBlueButtonStyle || element.tagName === "BUTTON");
  }

  function detectAxiomPulseQuickBuyToken(quickBuyBox) {
    const adapter = getPlatformAdapter(window.location.hostname);
    if (!adapter || adapter.id !== "axiom") return null;

    const row = findAxiomPulseTokenRow(quickBuyBox);
    const address = findAxiomPulseTokenAddress(row || quickBuyBox, quickBuyBox);
    if (!address) return null;

    const marketCap = detectAxiomPulseMarketCap(row || quickBuyBox, quickBuyBox);
    const name = detectAxiomPulseTokenName(row || quickBuyBox, quickBuyBox, address);
    const url = buildAxiomMemeUrl(address);
    return buildDetectedToken(adapter, {
      address,
      chain: "SOL",
      platformChain: "solana",
      name,
      marketCap,
      url,
    });
  }

  function findAxiomPulseTokenRow(quickBuyBox) {
    const quickRect = quickBuyBox.getBoundingClientRect();
    const candidates = [];
    let element = quickBuyBox.parentElement;
    for (let depth = 0; element && depth < 10; depth += 1, element = element.parentElement) {
      if (root?.contains(element)) continue;
      const rect = element.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) continue;
      if (rect.width < quickRect.width + 90) continue;
      if (rect.width > Math.min(window.innerWidth, 900)) continue;
      if (rect.height < Math.max(48, quickRect.height * 0.65) || rect.height > 210) continue;
      if (!element.contains(quickBuyBox)) continue;
      candidates.push({ element, area: rect.width * rect.height });
    }
    return candidates.sort((a, b) => a.area - b.area)[0]?.element || quickBuyBox.parentElement || quickBuyBox;
  }

  function findAxiomPulseTokenAddress(row, quickBuyBox) {
    return findAxiomMemeHrefAddress(row)
      || findTokenAddressInElementAttributes(row)
      || findAxiomMemeHrefAddress(row?.parentElement)
      || findTokenAddressInElementAttributes(row?.parentElement)
      || findTokenAddressInElementAttributes(quickBuyBox);
  }

  function findAxiomMemeHrefAddress(scope) {
    if (!scope?.querySelectorAll) return null;
    const anchors = Array.from(scope.querySelectorAll("a[href]"));
    for (const anchor of anchors) {
      const href = safeDecode(anchor.getAttribute("href") || anchor.href || "");
      if (!/\/meme(?:\/|\?|$)/i.test(href)) continue;
      const address = findTokenAddress(href);
      if (address) return address;
    }
    for (const anchor of anchors) {
      const href = safeDecode(anchor.getAttribute("href") || anchor.href || "");
      const address = findTokenAddress(href);
      if (address) return address;
    }
    return null;
  }

  function findTokenAddressInElementAttributes(scope) {
    if (!scope?.querySelectorAll) return null;
    const elements = [scope, ...Array.from(scope.querySelectorAll("*")).slice(0, 180)];
    for (const element of elements) {
      for (const attr of Array.from(element.attributes || [])) {
        const name = attr.name.toLowerCase();
        if (["class", "style", "id"].includes(name)) continue;
        const value = safeDecode(attr.value || "");
        if (/^data:/i.test(value)) continue;
        if (["src", "srcset"].includes(name) && !/(coin|meme|search|address|mint|token|contract|\bca\b)/i.test(value)) continue;
        if (!/(meme|address|mint|token|contract|\bca\b|href|title|aria-label|data-)/i.test(`${name} ${value}`)) continue;
        const address = findTokenAddress(value);
        if (address) return address;
      }
    }
    return null;
  }

  function getDefaultBuyAmount() {
    return normalizeBuyAmounts(state?.settings?.buyAmounts)[0];
  }

  function detectAxiomPulseMarketCap(row, quickBuyBox) {
    const texts = [quickBuyBox, row]
      .filter(Boolean)
      .map((element) => cleanText(element.textContent));
    for (const text of texts) {
      const match = text.match(/\bMC\s*:?\s*\$?\s*([0-9.,]+)\s*([KMB])?/i);
      if (match) return parseCompactNumber(match[1], match[2]);
    }
    return null;
  }

  function detectAxiomPulseTokenName(row, quickBuyBox, address) {
    const quickRect = quickBuyBox.getBoundingClientRect();
    const candidates = Array.from(row.querySelectorAll("a, span, div, p"))
      .filter((element) => element !== quickBuyBox && !element.contains(quickBuyBox) && !quickBuyBox.contains(element))
      .map((element) => ({
        element,
        text: cleanText(element.textContent),
        rect: element.getBoundingClientRect(),
      }))
      .filter(({ text, rect }) => {
        if (!text || text.length < 2 || text.length > 72) return false;
        if (findTokenAddress(text) || text.includes(shortenAddress(address))) return false;
        if (/^@|^\$|[%$]|^\d/.test(text)) return false;
        if (/\b(MC|TX|SOL|P1|P2|P3|F)\b/i.test(text)) return false;
        if (!/[A-Za-z]/.test(text)) return false;
        return rect && rect.width > 0 && rect.height > 0 && rect.left < quickRect.left;
      })
      .sort((a, b) => (a.rect.top - b.rect.top) || (a.rect.left - b.rect.left));

    return candidates[0]?.text || shortenAddress(address);
  }

  function buildAxiomMemeUrl(address) {
    return `${window.location.origin}/meme/${address}`;
  }

  function flashAxiomPulseQuickBuyBox(element, className, durationMs) {
    element.classList.add(className);
    window.setTimeout(() => element.classList.remove(className), durationMs);
  }

  function handleChange(event) {
    const target = event.target;
    if (!target?.matches?.("[data-quick-setting]")) return;
    runTask(saveQuickSetting(target.dataset.quickSetting, target.value));
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

  async function setPaperBalance(amount) {
    updateActiveToken();
    const chain = activeToken?.chain || "SOL";
    state.balances[chain] = amount;
    await persistAndSync("balance-set");
    closeModals();
    render();
    setStatus(`Set balance to ${formatters.native(amount, chain)}.`);
  }

  function openAddModal() {
    const modal = root.querySelector(`#${selectors.addModal}`);
    if (!modal) return;
    const fundsInput = root.querySelector("[data-deposit]");
    const setBalanceInput = root.querySelector("[data-set-balance]");
    if (fundsInput) fundsInput.value = "";
    if (setBalanceInput) setBalanceInput.value = "";
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
    root.querySelector("[data-setting='autoScreenshotOnTrade']").checked = Boolean(state.settings.autoScreenshotOnTrade);
    root.querySelector("[data-setting='fallbackDownloadsEnabled']").checked = Boolean(state.settings.fallbackDownloadsEnabled);
    root.querySelector("[data-setting='updateChecksEnabled']").checked = Boolean(state.settings.updateChecksEnabled);
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
      autoScreenshotOnTrade: Boolean(root.querySelector("[data-setting='autoScreenshotOnTrade']")?.checked),
      fallbackDownloadsEnabled: Boolean(root.querySelector("[data-setting='fallbackDownloadsEnabled']")?.checked),
      updateChecksEnabled: Boolean(root.querySelector("[data-setting='updateChecksEnabled']")?.checked),
    };

    for (const key of numericKeys) {
      const value = Number(root.querySelector(`[data-setting='${key}']`)?.value);
      if (!Number.isFinite(value) || value < 0) return setStatus(`Enter a valid ${key}.`);
      next[key] = key === "customDelayMs" ? Math.round(value) : value;
    }

    next.buyAmounts = normalizeBuyAmounts(next.buyAmounts);
    state.settings = next;
    await persistAndSync("settings");
    if (state.settings.updateChecksEnabled) runTask(checkForExtensionUpdate("settings"));
    closeModals();
    render();
    setStatus("Settings saved.");
  }

  async function resetSettingsToDefaults() {
    state.settings = {
      ...DEFAULT_STATE.settings,
      panelPosition: state.settings.panelPosition || null,
      bridgeEnabled: state.settings.bridgeEnabled,
      autoScreenshotOnTrade: state.settings.autoScreenshotOnTrade,
      fallbackDownloadsEnabled: state.settings.fallbackDownloadsEnabled,
      updateChecksEnabled: state.settings.updateChecksEnabled,
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

  async function buy(amountNative, tokenOverride = null, options = {}) {
    if (tradeInFlight) return setStatus("Execution already pending.");
    if (!Number.isFinite(amountNative) || amountNative <= 0) return setStatus("Enter a valid buy amount.");
    tradeInFlight = true;
    try {
      const token = tokenOverride || (updateActiveToken(), activeToken);
      if (tokenOverride) activeToken = tokenOverride;
      if (!token.key) return setStatus("Open a supported token page first.");
      if (!token.unitPriceNative) return setStatus(`Price unavailable. Wait for ${token.platformLabel || "the platform"} market cap to load.`);

      const delayedToken = await waitForSimulatedExecution("buy", token, options);
      if (!delayedToken) return;

      const chain = delayedToken.chain;
      const fees = calculateFees("buy", amountNative, delayedToken.executionDelayMs);
      const maxSlippagePct = Number(state.settings.buySlippagePct || 0);
      const realizedSlippagePct = calculateRealizedSlippagePct(maxSlippagePct);
      const slippage = realizedSlippagePct / 100;
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
        slippagePct: realizedSlippagePct,
        maxSlippagePct,
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
    if (!Number.isFinite(percent) || percent <= 0) return setStatus("Enter a valid sell percentage.");
    tradeInFlight = true;
    try {
    updateActiveToken();
    const token = activeToken;
    const position = token.key ? state.positions[token.key] : null;
    if (!token.key || !position) return setStatus("No open paper position for this token.");
    if (!token.unitPriceNative) return setStatus(`Price unavailable. Wait for ${token.platformLabel || "the platform"} market cap to load.`);

    const delayedToken = await waitForSimulatedExecution("sell", token);
    if (!delayedToken) return;

    const chain = delayedToken.chain;
    const sellRatio = normalizeSellRatio(percent);
    const tokenAmount = position.tokenAmount * sellRatio;
    const costBasis = position.costNative * sellRatio;
    const maxSlippagePct = Number(state.settings.sellSlippagePct || 0);
    const realizedSlippagePct = calculateRealizedSlippagePct(maxSlippagePct);
    const slippage = realizedSlippagePct / 100;
    const executionPrice = delayedToken.unitPriceNative * Math.max(0.000001, 1 - slippage);
    const grossProceeds = tokenAmount * executionPrice;
    const fees = calculateFees("sell", grossProceeds, delayedToken.executionDelayMs);
    const netProceeds = Math.max(0, grossProceeds - fees.totalFeeNative);
    const pnlNative = netProceeds - costBasis;
    const before = snapshotPosition(position);

    state.balances[chain] = (state.balances[chain] || 0) + netProceeds;

    const remainingTokenAmount = position.tokenAmount - tokenAmount;
    let after = null;
    if (shouldClosePositionAfterSell(position.tokenAmount, remainingTokenAmount, sellRatio)) {
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
      slippagePct: realizedSlippagePct,
      maxSlippagePct,
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

  function normalizeSellRatio(percent) {
    return Math.min(1, Math.max(0, percent / 100));
  }

  function shouldClosePositionAfterSell(originalTokenAmount, remainingTokenAmount, sellRatio) {
    if (sellRatio >= 1) return true;
    const relativeDustThreshold = Math.max(Number(originalTokenAmount || 0) * 1e-9, Number.EPSILON);
    return remainingTokenAmount <= relativeDustThreshold;
  }

  function createEmptyPosition(token) {
    const now = new Date().toISOString();
    return {
      positionId: createId("pos"),
      status: "open",
      platform: token.platform,
      platformLabel: token.platformLabel,
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

  async function waitForSimulatedExecution(side, token, options = {}) {
    const delayMs = calculateExecutionDelay(side);
    const priorityFee = Number(side === "buy" ? state.settings.buyPriorityFeeNative : state.settings.sellPriorityFeeNative) || 0;
    const bribeFee = Number(side === "buy" ? state.settings.buyBribeFeeNative : state.settings.sellBribeFeeNative) || 0;
    setStatus(`${side === "buy" ? "Buy" : "Sell"} pending (${delayMs}ms delay, prio ${priorityFee}, bribe ${bribeFee}).`);
    if (delayMs > 0) await new Promise((resolve) => window.setTimeout(resolve, delayMs));
    const delayedToken = await resolveExecutionTokenAfterDelay(token, options);
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

  async function resolveExecutionTokenAfterDelay(token, options = {}) {
    if (typeof options.resolveLatestToken === "function") {
      const resolved = await Promise.resolve(options.resolveLatestToken(token));
      if (resolved?.key) activeToken = resolved;
      return resolved || token;
    }
    updateActiveToken();
    return activeToken;
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

  function calculateRealizedSlippagePct(maxSlippagePct) {
    const max = Math.max(0, Number(maxSlippagePct || 0));
    if (max <= 0) return 0;
    const cap = Math.min(max, Math.max(0.15, max * 0.06), 5);
    const realized = cap * (0.25 + Math.random() * 0.75);
    return round(realized, 4);
  }

  function recordExecution(fields) {
    const usdPrice = DEFAULT_PRICES[fields.chain] || 1;
    const timestampMs = Date.now();
    state.executions.push({
      id: createId("exec"),
      schemaVersion: 2,
      timestamp: new Date(timestampMs).toISOString(),
      timestampMs,
      source: `wilytrader-${fields.token.platform}-overlay`,
      platform: fields.token.platform,
      platformLabel: fields.token.platformLabel,
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
      maxSlippagePct: fields.maxSlippagePct ?? fields.slippagePct,
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
    const latestExecution = state.executions[state.executions.length - 1] || null;
    const isNewTradeExecution =
      (reason === "buy" || reason === "sell") &&
      latestExecution?.id &&
      latestExecution.id !== lastSyncedExecutionId;
    const shouldCaptureScreenshot = Boolean(state.settings.autoScreenshotOnTrade) && isNewTradeExecution;
    if (latestExecution?.id) lastSyncedExecutionId = latestExecution.id;
    runTask(syncTradeArtifacts(reason, isNewTradeExecution ? latestExecution : null, shouldCaptureScreenshot));
  }

  function render() {
    if (!root || !state) return;
    const visible = applyOverlayVisibility();
    updateActiveToken();
    if (!visible) return;

    const tokenEl = root.querySelector(`#${selectors.token}`);
    const balanceEl = root.querySelector(`#${selectors.balance}`);
    const positionEl = root.querySelector(`#${selectors.position}`);
    const buyButtonsEl = root.querySelector("[data-buy-buttons]");
    const sellButtonsEl = root.querySelector("[data-sell-buttons]");
    const buyChainEl = root.querySelector("[data-buy-chain]");
    const sellAssetsEl = root.querySelector("[data-sell-assets]");
    const logEl = root.querySelector(`#${selectors.log}`);

    if (!tokenEl || !balanceEl || !positionEl || !buyButtonsEl || !sellButtonsEl) {
      injectPanel();
      render();
      return;
    }

    renderUpdateNotice();

    const token = activeToken;
    const position = token.key ? state.positions[token.key] : null;
    const summary = position ? buildPositionSummary(position.positionId, "open") : findLatestTokenPositionSummary(token);
    const openPnlPct = position ? calculateOpenPnlPct(position, token) : 0;

    tokenEl.textContent = token.address
      ? `${token.name} (${shortenAddress(token.address)})`
      : "Open a supported token page";
    balanceEl.textContent = `Bal ${formatters.compactNative(state.balances[token.chain] || 0, token.chain)}`;
    positionEl.classList.toggle("wt-pnl-up", Boolean(position) && openPnlPct > 0);
    positionEl.classList.toggle("wt-pnl-down", Boolean(position) && openPnlPct < 0);
    positionEl.classList.toggle("wt-pnl-flat", Boolean(position) && openPnlPct === 0);
    positionEl.textContent = position
      ? `Pos ${formatters.native(position.costNative, token.chain)} ${formatters.pct(openPnlPct)}`
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
      button.type = "button";
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
    customButton.type = "button";
    customButton.className = "wt-trade-button wt-buy-button wt-custom-buy-button";
    customButton.dataset.action = "custom-buy";
    customButton.textContent = "Buy";
    buyButtonsEl.appendChild(customButton);

    sellButtonsEl.innerHTML = "";
    state.settings.sellPercents.forEach((percent) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "wt-trade-button wt-sell-button";
      button.dataset.action = "sell-percent";
      button.dataset.sellPct = String(percent);
      button.textContent = `${percent}%`;
      sellButtonsEl.appendChild(button);
    });

    if (logEl) {
      logEl.innerHTML = "";
      const recent = state.executions.slice(-1).reverse();
      recent.forEach((execution) => {
        const item = document.createElement("div");
        item.className = `wt-log-item wt-${execution.side}`;
        item.textContent = `${execution.side.toUpperCase()} ${execution.tokenName || shortenAddress(execution.tokenAddress)} - ${formatters.native(Math.abs(execution.grossNative || execution.netNative), execution.chain)} - PnL ${formatters.native(execution.pnlNative, execution.chain)}`;
        logEl.appendChild(item);
      });
    }
    syncAxiomNativeChartLines(summary, token, position);
  }

  function findLatestTokenPositionSummary(token) {
    if (!token?.key) return null;
    const closed = state.closedPositions
      .filter((position) => position.tokenAddress === token.address && position.chain === token.chain)
      .sort((a, b) => Date.parse(b.finalExitAt || b.firstEntryAt || "") - Date.parse(a.finalExitAt || a.firstEntryAt || ""));
    if (closed[0]) return closed[0];

    const relatedExecution = state.executions
      .slice()
      .reverse()
      .find((execution) => execution.tokenAddress === token.address && execution.chain === token.chain);
    return relatedExecution ? buildPositionSummary(relatedExecution.positionId) : null;
  }

  function renderUpdateNotice() {
    const notice = root?.querySelector(`#${selectors.updateNotice}`);
    if (!notice) return;
    const shouldShow = Boolean(state?.settings?.updateChecksEnabled && updateState.updateAvailable);
    notice.hidden = !shouldShow;
    if (!shouldShow) return;

    const detail = notice.querySelector("[data-update-detail]");
    if (detail) {
      const current = updateState.installedVersion || "current";
      const latest = updateState.latestVersion || "latest";
      detail.textContent = `Installed ${current}; latest ${latest}. Reload the unpacked extension after updating files.`;
    }
  }

  function syncAxiomNativeChartLines(summary, token, position) {
    if (token?.platform !== "axiom") return;
    if (!position || !summary?.id) {
      postAxiomChartBridgeMessage({ op: "clearAll" });
      return;
    }

    const entryPrice = getAxiomChartPrice(summary, "entry", token);
    if (entryPrice > 0) {
      postAxiomChartBridgeMessage({
        op: "upsert",
        positionId: summary.id,
        kind: "avg_entry",
        price: entryPrice,
        style: buildAxiomChartLineStyle("avg_entry", entryPrice),
      });
    }

    const exitPrice = getAxiomChartPrice(summary, "exit", token);
    if (summary.sellCount > 0 && exitPrice > 0) {
      postAxiomChartBridgeMessage({
        op: "upsert",
        positionId: summary.id,
        kind: "avg_exit",
        price: exitPrice,
        style: buildAxiomChartLineStyle("avg_exit", exitPrice),
      });
    } else {
      postAxiomChartBridgeMessage({
        op: "remove",
        positionId: summary.id,
        kind: "avg_exit",
      });
    }
  }

  function getAxiomChartPrice(summary, side, token) {
    const marketCap = side === "entry" ? summary.entryMarketCapVwapUsd : summary.exitMarketCapVwapUsd;
    if (Number(marketCap) > 0) return Number(marketCap);

    const avgNative = side === "entry" ? summary.avgEntryNative : summary.avgExitNative;
    const chainUsd = DEFAULT_PRICES[token.chain] || 1;
    const estimatedMarketCap = Number(avgNative || 0) * chainUsd * MARKET_CAP_SUPPLY;
    return Number.isFinite(estimatedMarketCap) && estimatedMarketCap > 0 ? estimatedMarketCap : 0;
  }

  function buildAxiomChartLineStyle(kind, price) {
    const isEntry = kind === "avg_entry";
    return {
      color: isEntry ? "#22c55e" : "#ef4444",
      lineWidth: 2,
      lineStyle: "solid",
      labelText: `${isEntry ? "AVG ENTRY" : "AVG EXIT"} ${formatters.usd(price)}`,
      labelBackground: isEntry ? "rgba(34, 197, 94, 0.86)" : "rgba(239, 68, 68, 0.86)",
      showPrice: true,
    };
  }

  function postAxiomChartBridgeMessage(message) {
    if (getPlatformAdapter(window.location.hostname)?.id !== "axiom") return;
    window.postMessage({ source: "wileytrader", ...message }, window.location.origin);
  }

  function renderFullLog() {
    renderLedgerSummary();
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
        `slip ${execution.slippagePct}% / max ${execution.maxSlippagePct ?? execution.slippagePct}%`,
        `delay ${execution.executionDelayMs || 0}ms`,
        `PnL ${formatters.native(execution.pnlNative, execution.chain)}`,
      ].join(" - ");
      logEl.appendChild(item);
    });
  }

  function renderLedgerSummary() {
    const summaryEl = root.querySelector("[data-ledger-summary]");
    if (!summaryEl) return;
    const summary = buildCurrentSessionSummary();
    const rows = [
      ["Runtime", formatDuration(summary.elapsedMs)],
      ["Started", summary.startedAt ? new Date(summary.startedAt).toLocaleString() : "Current"],
      ["Executions", String(summary.executionCount)],
      ["Realized", formatters.native(summary.realizedPnlNative, summary.chain, 3)],
      ["Active Open", formatters.native(summary.activeOpenPnlNative, summary.chain, 3)],
      ["Fees", formatters.native(summary.totalFeesNative, summary.chain)],
      ["Total", formatters.native(summary.totalPnlNative, summary.chain, 3)],
    ];
    summaryEl.innerHTML = "";
    rows.forEach(([label, value]) => {
      const item = document.createElement("div");
      item.className = "wt-ledger-stat";
      item.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
      summaryEl.appendChild(item);
    });
    if (state.sessions.length > 0) {
      const title = document.createElement("div");
      title.className = "wt-ledger-heading";
      title.textContent = "Previous Sessions";
      summaryEl.appendChild(title);
      state.sessions.slice(-5).reverse().forEach((session) => {
        const item = document.createElement("div");
        item.className = "wt-ledger-session";
        item.textContent = `${new Date(session.endedAt).toLocaleString()} - ${session.executionCount} trades: ${formatters.signedNative(session.totalPnlNative, session.chain, 2)}`;
        summaryEl.appendChild(item);
      });
    }
  }

  function buildCurrentSessionSummary() {
    const chain = activeToken?.chain || state.executions[state.executions.length - 1]?.chain || "SOL";
    const buys = state.executions.filter((execution) => execution.side === "buy");
    const sells = state.executions.filter((execution) => execution.side === "sell");
    const buyFeesNative = sum(buys, "feeNative");
    const realizedPnlNative = sum(sells, "pnlNative") - buyFeesNative;
    const totalFeesNative = sum(state.executions, "feeNative");
    const activePosition = activeToken?.key ? state.positions[activeToken.key] : null;
    const activeMarkNative = activePosition && activeToken?.unitPriceNative ? activePosition.tokenAmount * activeToken.unitPriceNative : 0;
    const activeOpenPnlNative = activePosition ? activeMarkNative - activePosition.costNative : 0;
    return {
      chain,
      startedAt: state.sessionStartedAt,
      executionCount: state.executions.length,
      realizedPnlNative: round(realizedPnlNative),
      activeOpenPnlNative: round(activeOpenPnlNative),
      totalFeesNative: round(totalFeesNative),
      totalPnlNative: round(realizedPnlNative + activeOpenPnlNative),
      elapsedMs: Date.now() - (Date.parse(state.sessionStartedAt || "") || Date.now()),
    };
  }

  function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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

  function buildExportPayload(reason = "manual", eventExecution = null, captureScreenshot = false) {
    const positions = getPositionSummaries();
    return {
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      source: `wilytrader-${activeToken?.platform || "supported"}-extension`,
      privacy: "local-only; no backend sync; optional localhost Snipalot bridge",
      reason,
      event: eventExecution
        ? {
            type: "execution",
            captureScreenshot: Boolean(captureScreenshot),
            executionId: eventExecution.id,
            platform: eventExecution.platform,
            side: eventExecution.side,
            timestamp: eventExecution.timestamp,
            tokenName: eventExecution.tokenName,
            tokenAddress: eventExecution.tokenAddress,
          }
        : null,
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
      currentSessionSummary: buildCurrentSessionSummary(),
      previousSessions: state.sessions,
      notes: state.notes,
      settings: state.settings,
      mockapeCompatibleTrades: buildMockApeCompatibleTrades(),
    };
  }

  async function saveFallbackTradeArtifacts(reason, eventExecution, captureScreenshot) {
    if (!captureScreenshot) return;
    const event = eventExecution
      ? {
          type: "execution",
          captureScreenshot: true,
          executionId: eventExecution.id,
          platform: eventExecution.platform,
          side: eventExecution.side,
          timestamp: eventExecution.timestamp,
          tokenName: eventExecution.tokenName,
          tokenAddress: eventExecution.tokenAddress,
        }
      : null;
    const response = await sendRuntimeMessage({
      type: "WILYTRADER_SAVE_FALLBACK",
      event,
      sessionStartedAt: state.sessionStartedAt,
      saveLedger: false,
      captureScreenshot: true,
      captureRect: detectBestChartCaptureRect(),
    });
    if (response?.ok) {
      setStatus("Saved fallback screenshot to Chrome Downloads.");
    } else {
      setStatus("Fallback screenshot failed. Use ledger export if needed.");
    }
  }

  async function openExtensionManager() {
    const response = await sendRuntimeMessage({ type: "WILYTRADER_OPEN_EXTENSION_MANAGER" });
    if (response?.ok) setStatus("Opened Chrome Extensions. Click Reload on WilyTrader after pulling updates.");
    else setStatus("Could not open Chrome Extensions. Go to chrome://extensions manually.");
  }

  function startUpdateChecks() {
    if (updateCheckTimerId !== null) return;
    window.setTimeout(() => runTask(checkForExtensionUpdate("startup")), 1500);
    updateCheckTimerId = window.setInterval(() => runTask(checkForExtensionUpdate("scheduled")), UPDATE_CHECK_INTERVAL_MS);
  }

  async function checkForExtensionUpdate(reason = "scheduled") {
    if (!state?.settings?.updateChecksEnabled) {
      updateState = { ...updateState, checking: false, updateAvailable: false, error: null };
      renderUpdateNotice();
      if (reason === "manual") setStatus("Update checks are disabled in settings.");
      return;
    }
    if (updateState.checking) return;

    updateState = { ...updateState, checking: true, error: null };
    renderUpdateNotice();
    const response = await sendRuntimeMessage({ type: "WILYTRADER_CHECK_FOR_UPDATE" });
    if (response?.ok) {
      updateState = {
        checking: false,
        checkedAt: response.checkedAt || new Date().toISOString(),
        installedVersion: response.installedVersion || "",
        latestVersion: response.latestVersion || "",
        updateAvailable: Boolean(response.updateAvailable),
        error: null,
      };
      if (reason === "manual") {
        setStatus(updateState.updateAvailable ? `Update available: ${updateState.latestVersion}.` : "WilyTrader is up to date.");
      }
    } else {
      updateState = {
        ...updateState,
        checking: false,
        checkedAt: new Date().toISOString(),
        updateAvailable: false,
        error: response?.error || "Update check failed.",
      };
      if (reason === "manual") setStatus("Update check failed.");
    }
    renderUpdateNotice();
  }

  function sendRuntimeMessage(message) {
    return new Promise((resolve) => {
      if (!extensionContextValid) return resolve({ ok: false, error: "Extension context invalidated." });
      try {
        const runtime = chrome?.runtime;
        if (!runtime?.sendMessage) return resolve({ ok: false, error: "Runtime messaging unavailable." });
        runtime.sendMessage(message, (response) => {
          const error = getChromeLastError();
          if (error) {
            handleExtensionContextError(error);
            resolve({ ok: false, error: error.message });
          } else {
            resolve(response || { ok: false, error: "No background response." });
          }
        });
      } catch (error) {
        handleExtensionContextError(error);
        resolve({ ok: false, error: error?.message || String(error) });
      }
    });
  }

  function detectBestChartCaptureRect() {
    const ignoredRoot = root;
    const candidates = Array.from(document.querySelectorAll("canvas, svg"))
      .filter((element) => !ignoredRoot?.contains(element))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const visibleWidth = Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0);
        const visibleHeight = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
        return {
          left: Math.max(0, rect.left),
          top: Math.max(0, rect.top),
          width: Math.max(0, visibleWidth),
          height: Math.max(0, visibleHeight),
          area: Math.max(0, visibleWidth) * Math.max(0, visibleHeight),
          devicePixelRatio: window.devicePixelRatio || 1,
        };
      })
      .filter((rect) => rect.area >= 40_000 && rect.width >= 240 && rect.height >= 160)
      .sort((a, b) => b.area - a.area);

    const best = candidates[0];
    if (!best) return null;
    return {
      left: best.left,
      top: best.top,
      width: best.width,
      height: best.height,
      devicePixelRatio: best.devicePixelRatio,
      source: "largest-visible-canvas-or-svg",
    };
  }

  async function syncTradeArtifacts(reason, eventExecution = null, captureScreenshot = false) {
    const bridgeSynced = await syncBridge(reason, eventExecution, captureScreenshot);
    if (!bridgeSynced && eventExecution && state?.settings?.fallbackDownloadsEnabled) {
      await saveFallbackTradeArtifacts(reason, eventExecution, captureScreenshot);
    }
  }

  async function syncBridge(reason, eventExecution = null, captureScreenshot = false) {
    if (!extensionContextValid) return false;
    if (!state?.settings?.bridgeEnabled) return false;
    try {
      const response = await fetch(`${BRIDGE_BASE_URL}/ledger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildExportPayload(reason, eventExecution, captureScreenshot)),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json().catch(() => ({}));
      bridgeState = {
        active: true,
        lastMessage: data.sessionDir ? "Snipalot bridge synced" : "Snipalot bridge active",
      };
      return true;
    } catch {
      bridgeState = { active: false, lastMessage: "Snipalot bridge not connected" };
      return false;
    } finally {
      render();
    }
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
    anchor.download = `wilytrader-${activeToken?.platform || "supported"}-ledger-${stamp}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    runTask(syncBridge("download"));
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

  async function startNewSession() {
    if (!window.confirm("End this session and start a new one? Current trades and notes will be archived as a previous session summary.")) return;
    const sessionSummary = buildCurrentSessionSummary();
    if (sessionSummary.executionCount > 0 || state.notes.length > 0) {
      state.sessions.push({
        ...sessionSummary,
        id: createId("session"),
        endedAt: new Date().toISOString(),
        closedPositionCount: state.closedPositions.length,
        noteCount: state.notes.length,
      });
      state.sessions = state.sessions.slice(-25);
    }
    state.executions = [];
    state.closedPositions = [];
    state.positions = {};
    state.notes = [];
    state.sessionStartedAt = new Date().toISOString();
    await persistAndSync("new-session");
    renderFullLog();
    render();
    setStatus("New session started.");
  }

  async function clearTradeLog() {
    if (!window.confirm("Clear paper ledger, notes, open positions, and previous sessions?")) return;
    state.sessions = [];
    state.executions = [];
    state.closedPositions = [];
    state.positions = {};
    state.notes = [];
    state.sessionStartedAt = new Date().toISOString();
    await persistAndSync("clear");
    renderFullLog();
    render();
    setStatus("Paper ledger cleared.");
  }

  function bindRouteWatcher() {
    window.setInterval(() => {
      if (!extensionContextValid) return;
      const routeKey = `${window.location.href}|${document.title}`;
      if (routeKey !== lastRouteKey) {
        lastRouteKey = routeKey;
        injectAxiomChartBridgeScript();
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
        runTask(persist());
      }
    });
  }

  function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  if (getPlatformAdapter(window.location.hostname)) {
    runTask(initialize());
  }
})();

(() => {
  "use strict";

  const STORAGE_KEY = "wilytrader_state_v2";
  const SCHEMA_VERSION = 13;
  const PANEL_SCALE_MIN = 0.7;
  const PANEL_SCALE_MAX = 1.5;
  const PANEL_VIEWPORT_MARGIN = 8;
  const TRACKER_BASE_WIDTH = 480;
  const TRACKER_BASE_HEIGHT = 76;
  const TRACKER_SCALE_MIN = 0.25;
  const TRACKER_RESIZE_DIAGNOSTICS = true;
  const EXIT_TARGET_DIAGNOSTICS = true;
  const PULSE_AUTO_BUY_KEY = "wilytrader_axiom_pulse_auto_buy_v1";
  const PULSE_AUTO_BUY_TTL_MS = 2 * 60 * 1000;
  const PULSE_AUTO_BUY_CHECK_MS = 350;
  const AXIOM_TARGET_TRIGGER_INTERVAL_MS = 500;
  const EXIT_TARGET_MARKET_CAP_STEP = 1000;
  const EXIT_TARGET_MENU_MAX_OPTIONS = 60;
  const EXIT_TARGET_KINDS = {
    stopLoss: "stop_loss",
    takeProfit: "take_profit",
  };
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
  const DESKTOP_STATUS_HEARTBEAT_MS = 5_000;
  const LIVE_POSITION_DIAGNOSTIC_MS = 3_000;
  const TRADE_SOUND_PATH = "assets/cash-register-sound.mp3";
  const TRADE_SOUND_GAIN = 0.85;
  const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
  const CHART_ARTIFACT_PAGE_STARTED_MS = Date.now();
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
    exitTargets: {},
    closedPositions: [],
    executions: [],
    sessions: [],
    sessionStartedAt: new Date().toISOString(),
    notes: [],
    settings: {
      defaultBuyAmount: 0.5,
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
      panelScale: 1,
      trackerEnabled: true,
      trackerPosition: null,
      trackerSize: null,
      trackerScale: 1,
      bridgeEnabled: true,
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
    tracker: "wt-pnl-tracker",
    trackerPortfolio: "wt-tracker-portfolio",
    trackerPnl: "wt-tracker-pnl",
    trackerPct: "wt-tracker-pct",
    trackerBar: "wt-tracker-bar",
    updateNotice: "wt-update-notice",
    pulseLayer: "wt-pulse-layer",
    log: "wt-log",
    settingsModal: "wt-settings-modal",
    logModal: "wt-log-modal",
    addModal: "wt-add-modal",
    pnlModal: "wt-pnl-modal",
    contextMenu: "wt-context-menu",
  };

  let state = null;
  let activeToken = null;
  let root = null;
  let lastRouteKey = "";
  let bridgeState = { active: false, lastMessage: "Bridge idle" };
  let tradeInFlight = false;
  let extensionContextValid = true;
  let lastSyncedExecutionId = null;
  let lastAxiomChartArtifactKey = null;
  let lastAxiomExitTargetSyncKey = null;
  let lastAxiomExitTargetLineKeys = new Set();
  let targetExitInFlight = null;
  let lastExitTargetMenuOpenedAt = 0;
  let pulseQuickBuyBound = false;
  let pendingPulseAutoBuyInFlight = false;
  let pulseQuickBuyQueuedUntil = 0;
  let pulseQuickBuyLayer = null;
  let pulseQuickBuyLayerRefreshId = null;
  let pulseQuickBuyLayerRefreshFrame = 0;
  let pulseQuickBuyTargetSeq = 0;
  let pulseQuickBuyTargets = new Map();
  let pulseQuickBuyLabelSeq = 0;
  let lastLivePositionDiagnosticAt = 0;
  let lastLivePositionDiagnosticKey = "";
  let pulseQuickBuyTokenLabels = new Map();
  let pendingPulseAutoBuyCheckId = null;
  let updateCheckTimerId = null;
  let tradeSoundContext = null;
  let tradeSoundBufferPromise = null;
  let tradeSoundErrorLogged = false;
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
    preloadTradeExecutionSound();
    schedulePendingPulseAutoBuyCheck();
    bindRouteWatcher();
    bindLivePositionWatcher();
    bindExitTargetWatcher();
    bindDesktopStatusHeartbeat();
    startUpdateChecks();
    runTask(sendDesktopExtensionStatus("startup"));
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

  function emitDiagnostic(stage, details = {}, options = {}) {
    const payload = {
      stage,
      at: new Date().toISOString(),
      installedVersion: getInstalledExtensionVersion(),
      pageUrl: window.location.href,
      pageTitle: document.title,
      bridgeEnabled: Boolean(state?.settings?.bridgeEnabled),
      executionCount: Array.isArray(state?.executions) ? state.executions.length : null,
      lastSyncedExecutionId,
      activeToken: summarizeToken(activeToken),
      details,
    };
    console.debug("[WilyTrader][diagnostic]", payload);
    if (options.desktop !== false) runTask(postDesktopDiagnostic(payload));
  }

  async function postDesktopDiagnostic(payload) {
    if (!extensionContextValid) return;
    await fetch(`${BRIDGE_BASE_URL}/diagnostics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  function getInstalledExtensionVersion() {
    try {
      return chrome?.runtime?.getManifest?.()?.version || null;
    } catch {
      return null;
    }
  }

  function summarizeToken(token) {
    if (!token) return null;
    return {
      key: token.key || null,
      name: token.name || null,
      address: token.address || null,
      chain: token.chain || null,
      marketCap: round(token.marketCap, 2),
      unitPriceNative: round(token.unitPriceNative, 12),
      url: token.url || null,
    };
  }

  function summarizePosition(position) {
    if (!position) return null;
    return {
      positionId: position.positionId || null,
      tokenKey: position.tokenKey || null,
      tokenName: position.tokenName || null,
      costNative: round(position.costNative),
      tokenAmount: round(position.tokenAmount, 12),
      avgEntryNative: round(position.avgEntryNative, 12),
      buyCount: position.buyCount || 0,
      sellCount: position.sellCount || 0,
      updatedAt: position.updatedAt || null,
    };
  }

  function buildMarketCapDiagnostics() {
    return {
      selected: round(detectMarketCap(), 2),
      axiomTitle: round(detectAxiomTitleMarketCap(), 2),
      axiomVisible: round(detectAxiomVisibleMarketCap(), 2),
    };
  }

  function preloadTradeExecutionSound() {
    void loadTradeSoundBuffer().catch(logTradeSoundError);
  }

  function primeTradeExecutionSound() {
    void unlockTradeSound().catch(logTradeSoundError);
  }

  async function unlockTradeSound() {
    const context = getTradeSoundContext();
    if (!context) return;
    if (context.state === "suspended") await context.resume();
    await loadTradeSoundBuffer();
  }

  function playTradeExecutionSound() {
    const context = getTradeSoundContext();
    if (!context) {
      playTradeSoundWithAudioElement();
      return;
    }

    loadTradeSoundBuffer()
      .then((buffer) => {
        const startSound = () => {
          const source = context.createBufferSource();
          const gain = context.createGain();
          source.buffer = buffer;
          gain.gain.value = TRADE_SOUND_GAIN;
          source.connect(gain);
          gain.connect(context.destination);
          source.start(0);
        };
        if (context.state !== "suspended") {
          startSound();
          return;
        }
        context.resume().then(startSound).catch((error) => {
          logTradeSoundError(error);
          playTradeSoundWithAudioElement();
        });
      })
      .catch((error) => {
        logTradeSoundError(error);
        playTradeSoundWithAudioElement();
      });
  }

  function loadTradeSoundBuffer() {
    if (tradeSoundBufferPromise) return tradeSoundBufferPromise;
    const context = getTradeSoundContext();
    const url = getTradeSoundUrl();
    if (!context || !url) {
      tradeSoundBufferPromise = Promise.reject(new Error("Trade execution sound is unavailable."));
      return tradeSoundBufferPromise;
    }

    tradeSoundBufferPromise = fetch(url)
      .then((response) => {
        if (!response.ok) throw new Error(`Trade execution sound failed to load (${response.status}).`);
        return response.arrayBuffer();
      })
      .then((arrayBuffer) => context.decodeAudioData(arrayBuffer));
    return tradeSoundBufferPromise;
  }

  function playTradeSoundWithAudioElement() {
    const url = getTradeSoundUrl();
    if (!url) return;
    try {
      const audio = new Audio(url);
      audio.volume = TRADE_SOUND_GAIN;
      audio.preload = "auto";
      const playResult = audio.play();
      if (playResult?.catch) playResult.catch(logTradeSoundError);
    } catch (error) {
      logTradeSoundError(error);
    }
  }

  function getTradeSoundContext() {
    const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextConstructor) return null;
    if (!tradeSoundContext) tradeSoundContext = new AudioContextConstructor();
    return tradeSoundContext;
  }

  function getTradeSoundUrl() {
    try {
      return chrome?.runtime?.getURL?.(TRADE_SOUND_PATH) || "";
    } catch (error) {
      if (isExtensionContextError(error)) handleExtensionContextError(error);
      return "";
    }
  }

  function logTradeSoundError(error) {
    if (tradeSoundErrorLogged) return;
    tradeSoundErrorLogged = true;
    console.debug("[WilyTrader] Trade execution sound skipped.", error);
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
      exitTargets: normalizeExitTargets(stored?.exitTargets),
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
    merged.settings.defaultBuyAmount = normalizeDefaultBuyAmount(stored?.settings?.defaultBuyAmount, stored?.settings);
    merged.settings.panelScale = normalizePanelScale(merged.settings.panelScale);
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

  function normalizeExitTargets(targets) {
    if (!targets || typeof targets !== "object") return {};
    return Object.fromEntries(
      Object.entries(targets)
        .map(([, target]) => normalizeExitTarget(target))
        .filter(Boolean)
        .map((target) => [target.id, target])
    );
  }

  function normalizeTargetSellPercent(value) {
    const percent = Number(value);
    if (!Number.isFinite(percent) || percent <= 0) return 100;
    return Math.min(100, Math.max(0.01, percent));
  }

  function normalizeExitTarget(target) {
    const kind = target?.kind === EXIT_TARGET_KINDS.takeProfit ? EXIT_TARGET_KINDS.takeProfit : target?.kind === EXIT_TARGET_KINDS.stopLoss ? EXIT_TARGET_KINDS.stopLoss : null;
    const marketCapUsd = Number(target?.marketCapUsd);
    if (!kind || !Number.isFinite(marketCapUsd) || marketCapUsd <= 0) return null;
    const id = String(target.id || createId("target"));
    return {
      id,
      kind,
      tokenKey: target.tokenKey || null,
      tokenAddress: target.tokenAddress || null,
      tokenName: target.tokenName || null,
      positionId: target.positionId || null,
      sellPercent: normalizeTargetSellPercent(target.sellPercent ?? target.requestedSellPct ?? 100),
      marketCapUsd,
      createdAt: target.createdAt || new Date().toISOString(),
      updatedAt: target.updatedAt || target.createdAt || new Date().toISOString(),
      triggeredAt: target.triggeredAt || null,
    };
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

  function normalizeDefaultBuyAmount(value, storedSettings = null) {
    const amount = Number(value);
    if (Number.isFinite(amount) && amount > 0) return amount;

    const storedAmounts = normalizeBuyAmounts(storedSettings?.buyAmounts);
    if (storedAmounts[0] && Number(storedAmounts[0]) !== Number(DEFAULT_STATE.settings.buyAmounts[0])) {
      return storedAmounts[0];
    }
    return DEFAULT_STATE.settings.defaultBuyAmount;
  }

  function normalizePanelScale(value) {
    const scale = Number(value);
    if (!Number.isFinite(scale)) return DEFAULT_STATE.settings.panelScale;
    return Math.max(PANEL_SCALE_MIN, Math.min(PANEL_SCALE_MAX, scale));
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
    const platformVisible = Boolean(getPlatformAdapter(window.location.hostname));
    const panelVisible = isOverlayVisibleRoute();
    const trackerVisible = Boolean(platformVisible && state?.settings?.trackerEnabled);
    const overlayVisible = panelVisible || trackerVisible;
    const panel = root.querySelector(`.${selectors.panel}`);
    const tracker = root.querySelector(`.${selectors.tracker}`);

    root.hidden = !overlayVisible;
    root.setAttribute("aria-hidden", overlayVisible ? "false" : "true");
    if (panel) panel.hidden = !panelVisible;
    if (tracker) tracker.hidden = !trackerVisible;
    if (!overlayVisible) {
      closeModals();
    }
    if (!panelVisible) {
      lastAxiomChartArtifactKey = null;
      lastAxiomExitTargetSyncKey = null;
      lastAxiomExitTargetLineKeys = new Set();
      postAxiomChartBridgeMessage({ op: "clearAll" });
    }
    return panelVisible;
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
    if (adapter?.id === "axiom") {
      const axiomName = detectAxiomTokenDisplayName(address);
      if (axiomName) return axiomName;
    }

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

  function detectAxiomTokenDisplayName(address) {
    return detectAxiomHeaderTokenName(address) || detectAxiomChartTokenName(address);
  }

  function detectAxiomHeaderTokenName(address) {
    const selectors = [
      "#platform-layout-container [class*='min-h-[64px]'] [class*='text-nowrap'] span.md\\:hidden > div",
      "#platform-layout-container [class*='min-h-[64px]'] [class*='text-nowrap'] span[class*='md:hidden'] > div",
      "#platform-layout-container [class*='min-h-[64px]'] [class*='text-nowrap'] [title]",
      "#platform-layout-container [class*='min-h-[64px]'] [class*='text-nowrap'] [aria-label]",
      "#platform-layout-container [class*='min-h-[64px]'] [class*='text-nowrap']",
    ];
    const candidates = [];
    selectors.forEach((selector) => {
      document.querySelectorAll(selector).forEach((element) => {
        if (root?.contains(element)) return;
        candidates.push(element.getAttribute("title"));
        candidates.push(element.getAttribute("aria-label"));
        candidates.push(element.textContent);
      });
    });

    const shortened = shortenAddress(address);
    for (const candidate of candidates) {
      const name = extractAxiomTokenDisplayName(candidate, shortened, { allowPlainName: true });
      if (name) return name;
    }
    return null;
  }

  function detectAxiomChartTokenName(address) {
    const shortened = shortenAddress(address);
    for (const text of getPageTextCandidates(2000)) {
      if (!text || text.length > 240) continue;
      if (findTokenAddress(text) || (shortened && text.includes(shortened))) continue;

      const name = extractAxiomTokenDisplayName(text, shortened);
      if (name) return name;

      const pairMatch = text.match(/\b([A-Za-z][A-Za-z0-9 ._'’-]{1,80}?)\/(?:USD|SOL)\s+on\b/i);
      const pairName = cleanTokenDisplayName(pairMatch?.[1]);
      if (pairName) return pairName;

      const headerMatch = text.match(/^[A-Z0-9$]{2,16}\s+([A-Za-z][A-Za-z0-9 ._'’-]{1,80}?)(?=\s+\d+[smhdw]\b|\s+\$|\s+Price\b|$)/);
      const headerName = cleanTokenDisplayName(headerMatch?.[1]);
      if (headerName) return headerName;
    }
    return null;
  }

  function extractAxiomTokenDisplayName(value, shortenedAddress = "", options = {}) {
    const text = cleanText(value);
    if (!text || text.length > 240) return null;
    if (findTokenAddress(text) || (shortenedAddress && text.includes(shortenedAddress))) return null;

    const chartMatch = text.match(/\b([A-Za-z][A-Za-z0-9 ._'’-]{1,80}?)\/(?:USD|SOL)\s+on\b/i);
    const chartName = cleanTokenDisplayName(chartMatch?.[1]);
    if (chartName) return chartName;

    const headerMatch = text.match(/^[A-Z0-9$]{2,16}\s+([A-Za-z][A-Za-z0-9 ._'’-]{1,80}?)(?=\s+\d+[smhdw]\b|\s+\$|\s+Price\b|$)/);
    const headerName = cleanTokenDisplayName(headerMatch?.[1]);
    if (headerName) return headerName;

    return options.allowPlainName ? cleanTokenDisplayName(text) : null;
  }

  function cleanTokenDisplayName(value) {
    const text = cleanText(value);
    if (!text || text.length < 2 || text.length > 80) return null;
    if (/^(price|market|chart|trade|token|usd|sol)$/i.test(text)) return null;
    if (/^[A-Z0-9$]{2,16}$/.test(text)) return null;
    if (!/[A-Za-z]/.test(text)) return null;
    return text;
  }

  function detectMarketCap() {
    const axiomTitleMarketCap = isAxiomMemeRoute(new URL(window.location.href))
      ? detectAxiomTitleMarketCap()
      : null;
    if (axiomTitleMarketCap) return axiomTitleMarketCap;

    const visibleAxiomMarketCap = detectAxiomVisibleMarketCap();
    if (visibleAxiomMarketCap) return visibleAxiomMarketCap;

    const titleMarketCap = detectAxiomTitleMarketCap();
    if (titleMarketCap) return titleMarketCap;

    const candidates = getPageTextCandidates(1200);

    for (const text of candidates) {
      const match = text.match(/(?:MC|MCap|Market Cap)\s*:?\s*\$?\s*([0-9.]+)\s*([KMB])?/i);
      if (match) return parseCompactNumber(match[1], match[2]);
    }
    return null;
  }

  function detectAxiomTitleMarketCap() {
    const titleMatch = (document.title || "").match(/\$([0-9.]+)\s*([KMB])?/i);
    return titleMatch ? parseCompactNumber(titleMatch[1], titleMatch[2]) : null;
  }

  function detectAxiomVisibleMarketCap() {
    if (getPlatformAdapter(window.location.hostname)?.id !== "axiom") return null;
    const candidates = Array.from(document.querySelectorAll("body *"))
      .filter((element) => !root?.contains(element))
      .map((element) => {
        const text = cleanText(element.textContent);
        if (!/^\$[0-9,.]+(?:\.[0-9]+)?\s*[KMB]$/i.test(text)) return null;
        const rect = element.getBoundingClientRect();
        if (!rect || rect.width <= 0 || rect.height <= 0) return null;
        if (rect.top < 0 || rect.top > 155 || rect.left < 0 || rect.right > window.innerWidth) return null;
        const style = window.getComputedStyle(element);
        if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return null;
        return {
          text,
          marketCap: parseCurrencyMarketCap(text),
          left: rect.left,
          top: rect.top,
        };
      })
      .filter((candidate) => candidate?.marketCap && candidate.marketCap >= 1_000)
      .sort((a, b) => a.left - b.left || a.top - b.top);
    return candidates[0]?.marketCap || null;
  }

  function parseCurrencyMarketCap(value) {
    const match = String(value || "").match(/^\$?\s*([0-9,.]+(?:\.[0-9]+)?)\s*([KMB])?$/i);
    return match ? parseCompactNumber(match[1], match[2]) : null;
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
      <section class="${selectors.tracker}" data-pnl-tracker aria-label="WilyTrader portfolio tracker">
        <div class="wt-tracker-scale">
          <button type="button" class="wt-tracker-settings" data-action="settings" title="Settings" aria-label="Settings">&#9881;</button>
          <div class="wt-tracker-face" data-tracker-drag>
            <div class="wt-tracker-metric">
              <strong id="${selectors.trackerPortfolio}">0.00 SOL</strong>
              <span>Paper Balance</span>
            </div>
            <button type="button" class="wt-tracker-brand" data-action="tracker-menu" title="WilyTrader tracker actions" aria-label="WilyTrader tracker actions" aria-expanded="false">
              <span>WilyTrader</span>
              <span class="wt-sol-mark"></span>
            </button>
            <div class="wt-tracker-metric wt-tracker-pnl-metric">
              <strong id="${selectors.trackerPnl}">+0.00 SOL</strong>
              <span>Session PNL <em id="${selectors.trackerPct}">+0.00%</em></span>
            </div>
          </div>
          <div class="wt-tracker-rail" aria-hidden="true"><span id="${selectors.trackerBar}"></span></div>
        </div>
        <div class="wt-tracker-menu" data-tracker-menu hidden>
          <button type="button" data-action="tracker-open-add-balance">Add Paper Balance</button>
          <button type="button" data-action="tracker-open-set-balance">Set Paper Balance</button>
          <button type="button" data-action="tracker-view-log">View Ledger</button>
          <button type="button" data-action="tracker-reset-session">Reset Trading Session</button>
        </div>
        <div class="wt-tracker-resize wt-tracker-resize-nw" data-tracker-resize-corner="top-left" title="Scale tracker" aria-hidden="true"></div>
        <div class="wt-tracker-resize wt-tracker-resize-ne" data-tracker-resize-corner="top-right" title="Scale tracker" aria-hidden="true"></div>
        <div class="wt-tracker-resize wt-tracker-resize-sw" data-tracker-resize-corner="bottom-left" title="Scale tracker" aria-hidden="true"></div>
        <div class="wt-tracker-resize wt-tracker-resize-se" data-tracker-resize-corner="bottom-right" title="Scale tracker" aria-hidden="true"></div>
      </section>
      <div id="${selectors.contextMenu}" class="wt-context-menu" hidden>
        <div class="wt-context-title">WilyTrader</div>
        <button type="button" data-action="context-set-stop-loss">WT Stop Loss</button>
        <button type="button" data-action="context-set-take-profit">WT 100% Exit</button>
        <button type="button" data-action="context-custom-target">Custom MC Target</button>
        <button type="button" data-action="context-clear-targets">Clear WT Targets</button>
      </div>
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
                <button type="button" class="wt-mini-pnl-button" data-action="view-closed-pnl" title="Closed trade P&L" aria-label="Closed trade P&L" hidden>P&amp;L</button>
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
              <label class="wt-inline-setting wt-icon-setting" title="Max price move %" aria-label="Buy max price move percent">
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
              <label class="wt-inline-setting wt-icon-setting" title="Max price move %" aria-label="Sell max price move percent">
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
          <div class="wt-section wt-exit-section">
            <div class="wt-trade-header">
              <div class="wt-trade-title wt-exit-title">Exit Orders</div>
              <div class="wt-muted" data-exit-target-summary>None</div>
            </div>
            <div class="wt-target-row">
              <input class="wt-input wt-target-input" data-exit-target-mc type="text" placeholder="$120K or 120000" />
              <button type="button" class="wt-button wt-button-secondary" data-action="set-stop-loss">SL</button>
              <button type="button" class="wt-button" data-action="set-take-profit">TP</button>
            </div>
            <div class="wt-target-list" data-exit-target-list></div>
          </div>
        </div>
        <div class="wt-resize-handle wt-resize-nw" data-resize-corner="top-left" title="Scale panel" aria-hidden="true"></div>
        <div class="wt-resize-handle wt-resize-ne" data-resize-corner="top-right" title="Scale panel" aria-hidden="true"></div>
        <div class="wt-resize-handle wt-resize-sw" data-resize-corner="bottom-left" title="Scale panel" aria-hidden="true"></div>
        <div class="wt-resize-handle wt-resize-se" data-resize-corner="bottom-right" title="Scale panel" aria-hidden="true"></div>
      </section>
      <div id="${selectors.settingsModal}" class="wt-modal" aria-hidden="true">
        <section class="wt-modal-panel" aria-label="WilyTrader settings">
          <header class="wt-modal-header">
            <div class="wt-title">Settings</div>
            <button class="wt-icon-btn" data-action="close-modal" title="Close" aria-label="Close">x</button>
          </header>
          <div class="wt-modal-body">
            <div class="wt-setting-group">
              <label class="wt-label" for="wt-default-buy-amount">Default buy amount</label>
              <input id="wt-default-buy-amount" class="wt-input" data-setting="defaultBuyAmount" type="number" min="0" step="0.01" placeholder="0.5" />
            </div>
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
                <label class="wt-label" for="wt-buy-slippage">Buy max price move %</label>
                <input id="wt-buy-slippage" class="wt-input" data-setting="buySlippagePct" type="number" min="0" step="0.1" />
              </div>
              <div class="wt-setting-group">
                <label class="wt-label" for="wt-sell-slippage">Sell max price move %</label>
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
              <input type="checkbox" data-setting="trackerEnabled" />
              <span>Show floating portfolio and session PNL tracker</span>
            </label>
            <label class="wt-check-row">
              <input type="checkbox" data-setting="bridgeEnabled" />
              <span>Auto-save logs to WilyTrader Desktop trade session folder</span>
            </label>
            <label class="wt-check-row">
              <input type="checkbox" data-setting="autoScreenshotOnTrade" />
              <span>Save screenshot on each buy/sell</span>
            </label>
            <label class="wt-check-row">
              <input type="checkbox" data-setting="fallbackDownloadsEnabled" />
              <span>If WilyTrader Desktop is unavailable, save fallback screenshots to Chrome Downloads</span>
            </label>
            <label class="wt-check-row">
              <input type="checkbox" data-setting="updateChecksEnabled" />
              <span>Check GitHub for WilyTrader extension updates</span>
            </label>
            <div class="wt-settings-note">WilyTrader Desktop saves to the active trade session folder. The Chrome fallback saves under Downloads/WilyTrader and crops to the largest visible chart when possible. After installing an update, open Extensions and reload WilyTrader.</div>
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
      <div id="${selectors.pnlModal}" class="wt-modal" aria-hidden="true">
        <section class="wt-modal-panel wt-pnl-panel" aria-label="WilyTrader closed trade P&L">
          <header class="wt-modal-header">
            <div>
              <div class="wt-title">Closed P&amp;L</div>
              <div class="wt-muted" data-pnl-token></div>
            </div>
            <button class="wt-icon-btn" data-action="close-modal" title="Close" aria-label="Close">x</button>
          </header>
          <div class="wt-modal-body">
            <div class="wt-closed-pnl" data-closed-pnl></div>
          </div>
        </section>
      </div>
    `;
    document.documentElement.appendChild(root);
    root.addEventListener("pointerdown", stopOverlayEvent, true);
    root.addEventListener("mousedown", handleOverlayMouseDown, true);
    root.addEventListener("click", handleClick, true);
    root.addEventListener("contextmenu", handleOverlayContextMenu);
    root.addEventListener("change", handleChange);
    document.removeEventListener("pointerdown", closeTrackerMenuOnOutsidePointer, true);
    document.addEventListener("pointerdown", closeTrackerMenuOnOutsidePointer, true);
    document.removeEventListener("pointerdown", closeContextMenuOnOutsidePointer, true);
    document.addEventListener("pointerdown", closeContextMenuOnOutsidePointer, true);
    document.removeEventListener("contextmenu", handleAxiomContextMenu, true);
    document.addEventListener("contextmenu", handleAxiomContextMenu, true);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleWindowError);
    window.addEventListener("message", handleAxiomChartBridgeEvent);
    bindAxiomPulseQuickBuy();
    const panel = root.querySelector(`.${selectors.panel}`);
    const tracker = root.querySelector(`.${selectors.tracker}`);
    applyPanelScale(panel);
    applyPanelPosition(panel);
    applyTrackerScale(tracker);
    applyTrackerPosition(tracker);
    makeDraggable(root.querySelector(".wt-header"), panel);
    makePanelScalable(panel);
    makeDraggable(root.querySelector("[data-tracker-drag]"), tracker, { positionKey: "trackerPosition" });
    makeTrackerScalable(tracker);
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
      lastAxiomChartArtifactKey = null;
      lastAxiomExitTargetSyncKey = null;
      injectAxiomChartBridgeScript();
      render();
      window.setTimeout(render, 500);
    } else if (data.event === "lineMoved") {
      runTask(handleAxiomExitTargetLineMoved(data));
    }
  }

  function bindAxiomPulseQuickBuy() {
    if (pulseQuickBuyBound) return;
    pulseQuickBuyBound = true;
    ["pointerdown", "pointerup", "mousedown", "mouseup", "click"].forEach((eventName) => {
      document.addEventListener(eventName, handleAxiomPulseQuickBuyEvent, true);
    });
    ensureAxiomPulseQuickBuyLayer();
    if (!pulseQuickBuyLayerRefreshId) {
      pulseQuickBuyLayerRefreshId = window.setInterval(refreshAxiomPulseQuickBuyLayer, 350);
    }
    window.addEventListener("scroll", scheduleAxiomPulseQuickBuyLayerRefresh, true);
    window.addEventListener("resize", scheduleAxiomPulseQuickBuyLayerRefresh, true);
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
    logExitTargetDiagnostic("root-pointerdown", event);
    const trackerHandle = event.target?.closest?.("[data-tracker-resize-corner]");
    if (trackerHandle) {
      logTrackerResizeDiagnostic("root-stop-overlay-event", event, {
        corner: trackerHandle.dataset.trackerResizeCorner || null,
      });
    }
    event.stopPropagation();
  }

  function handleOverlayMouseDown(event) {
    if (!root?.contains(event.target)) return;
    if (event.button !== 2) return;
    logExitTargetDiagnostic("root-mousedown", event);
  }

  function logTrackerResizeDiagnostic(stage, event = null, extra = {}, level = "debug") {
    if (!TRACKER_RESIZE_DIAGNOSTICS) return;
    const target = event?.target || null;
    const tracker = root?.querySelector?.(`.${selectors.tracker}`) || null;
    const handle = target?.closest?.("[data-tracker-resize-corner]") || null;
    const payload = {
      stage,
      eventType: event?.type || null,
      pointerId: Number.isFinite(event?.pointerId) ? event.pointerId : null,
      button: Number.isFinite(event?.button) ? event.button : null,
      buttons: Number.isFinite(event?.buttons) ? event.buttons : null,
      clientX: Number.isFinite(event?.clientX) ? event.clientX : null,
      clientY: Number.isFinite(event?.clientY) ? event.clientY : null,
      eventPhase: event ? eventPhaseName(event.eventPhase) : null,
      defaultPrevented: event?.defaultPrevented ?? null,
      cancelBubble: event?.cancelBubble ?? null,
      target: elementSummary(target),
      handle: elementSummary(handle),
      tracker: elementSummary(tracker),
      corner: handle?.dataset?.trackerResizeCorner || null,
      rootContainsTarget: Boolean(root && target && root.contains(target)),
      trackerContainsTarget: Boolean(tracker && target && tracker.contains(target)),
      path: event?.composedPath ? event.composedPath().slice(0, 8).map(elementSummary) : [],
      ...extra,
    };
    const log = console[level] || console.debug;
    log.call(console, `[WilyTrader][tracker-resize] ${stage}`, payload);
  }

  function eventPhaseName(phase) {
    if (phase === Event.CAPTURING_PHASE) return "capturing";
    if (phase === Event.AT_TARGET) return "at-target";
    if (phase === Event.BUBBLING_PHASE) return "bubbling";
    return "none";
  }

  function elementSummary(element) {
    if (!element || element === window) return element === window ? "window" : null;
    if (element === document) return "document";
    if (element === document.documentElement) return "html";
    if (!element.tagName) return String(element);
    const id = element.id ? `#${element.id}` : "";
    const classes = typeof element.className === "string" && element.className
      ? `.${element.className.trim().replace(/\s+/g, ".")}`
      : "";
    return `${element.tagName.toLowerCase()}${id}${classes}`;
  }

  function rectSnapshot(rect) {
    if (!rect) return null;
    return {
      left: round(rect.left, 2),
      top: round(rect.top, 2),
      width: round(rect.width, 2),
      height: round(rect.height, 2),
      right: round(rect.right, 2),
      bottom: round(rect.bottom, 2),
    };
  }

  function handleOverlayContextMenu(event) {
    logExitTargetDiagnostic("root-contextmenu", event);
    handleSellButtonTargetContextEvent(event);
  }

  function handleSellButtonTargetContextEvent(event) {
    const target = event.target?.closest?.("button");
    if (!target || !root?.contains(target)) {
      logExitTargetDiagnostic("target-menu-ignored-no-button", event, { target: elementSummary(target) });
      return false;
    }
    const rawSellPercent = target.dataset.action === "sell-all" ? 100 : Number(target.dataset.sellPct);
    if (!Number.isFinite(rawSellPercent) || rawSellPercent <= 0) {
      logExitTargetDiagnostic("target-menu-ignored-no-sell-percent", event, {
        action: target.dataset.action || null,
        sellPercent: rawSellPercent,
        buttonText: cleanText(target.textContent),
      });
      return false;
    }
    const sellPercent = normalizeTargetSellPercent(rawSellPercent);
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const now = Date.now();
    if (now - lastExitTargetMenuOpenedAt < 250) {
      logExitTargetDiagnostic("target-menu-duplicate-suppressed", event, { elapsedMs: now - lastExitTargetMenuOpenedAt });
      return true;
    }
    lastExitTargetMenuOpenedAt = now;
    logExitTargetDiagnostic("target-menu-opening", event, {
      action: target.dataset.action || null,
      sellPercent,
      buttonText: cleanText(target.textContent),
    });
    showSellButtonTargetMenu(event.clientX, event.clientY, target.getBoundingClientRect(), sellPercent);
    return true;
  }

  function logExitTargetDiagnostic(stage, event = null, extra = {}, level = "debug") {
    if (!EXIT_TARGET_DIAGNOSTICS) return;
    const target = event?.target || null;
    const button = target?.closest?.("button") || null;
    const menu = root?.querySelector?.(`#${selectors.contextMenu}`) || null;
    const payload = {
      stage,
      eventType: event?.type || null,
      button: Number.isFinite(event?.button) ? event.button : null,
      buttons: Number.isFinite(event?.buttons) ? event.buttons : null,
      clientX: Number.isFinite(event?.clientX) ? event.clientX : null,
      clientY: Number.isFinite(event?.clientY) ? event.clientY : null,
      defaultPrevented: event?.defaultPrevented ?? null,
      target: elementSummary(target),
      nearestButton: elementSummary(button),
      buttonAction: button?.dataset?.action || null,
      buttonSellPct: button?.dataset?.sellPct || null,
      buttonText: button ? cleanText(button.textContent) : null,
      rootContainsTarget: Boolean(root && target && root.contains(target)),
      activeTokenKey: activeToken?.key || null,
      activeMarketCap: activeToken?.marketCap || null,
      menuHidden: menu ? menu.hidden : null,
      path: event?.composedPath ? event.composedPath().slice(0, 8).map(elementSummary) : [],
      ...extra,
    };
    const log = console[level] || console.debug;
    log.call(console, `[WilyTrader][exit-target] ${stage}`, payload);
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
    if (hasBuyAmount || hasSellPct || action === "custom-buy" || action === "buy-default" || action === "sell-all") {
      primeTradeExecutionSound();
    }

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
      runTask(buy(getDefaultBuyAmount()));
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
    } else if (action === "view-closed-pnl") {
      openClosedPnlModal();
    } else if (action === "add-note") {
      runTask(addNote());
    } else if (action === "new-session") {
      runTask(startNewSession());
    } else if (action === "tracker-menu") {
      toggleTrackerMenu();
    } else if (action === "tracker-open-add-balance") {
      closeTrackerMenu();
      openAddModal({ focus: "deposit" });
    } else if (action === "tracker-open-set-balance") {
      closeTrackerMenu();
      openAddModal({ focus: "set-balance" });
    } else if (action === "tracker-view-log") {
      closeTrackerMenu();
      openLogModal();
    } else if (action === "tracker-reset-session") {
      closeTrackerMenu();
      runTask(startNewSession({
        confirmMessage: "Reset session P&L and start a new session? Current trades and notes will be archived as a previous session summary.",
        statusMessage: "Session P&L reset.",
      }));
    } else if (action === "set-stop-loss") {
      runTask(setExitTargetFromPanel(EXIT_TARGET_KINDS.stopLoss));
    } else if (action === "set-take-profit") {
      runTask(setExitTargetFromPanel(EXIT_TARGET_KINDS.takeProfit));
    } else if (action === "clear-exit-target") {
      runTask(clearExitTarget(target.dataset.targetId));
    } else if (action === "select-exit-target-mc") {
      closeContextMenu();
      logExitTargetDiagnostic("target-menu-select", event, {
        targetKind: target.dataset.targetKind || null,
        targetMarketCap: target.dataset.targetMarketCap || null,
        targetSellPercent: target.dataset.targetSellPercent || null,
      });
      runTask(setExitTarget(
        target.dataset.targetKind,
        Number(target.dataset.targetMarketCap),
        normalizeTargetSellPercent(target.dataset.targetSellPercent)
      ));
    } else if (action === "context-set-stop-loss") {
      closeContextMenu();
      runTask(setExitTargetAtCurrentMarketCap(EXIT_TARGET_KINDS.stopLoss, 100));
    } else if (action === "context-set-take-profit") {
      closeContextMenu();
      runTask(setExitTargetAtCurrentMarketCap(EXIT_TARGET_KINDS.takeProfit, 100));
    } else if (action === "context-custom-target") {
      closeContextMenu();
      runTask(promptForExitTarget(null, 100));
    } else if (action === "context-clear-targets") {
      closeContextMenu();
      runTask(clearAllExitTargetsForActivePosition());
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

  function handleAxiomPulseQuickBuyEvent(event) {
    if (!isPrimaryPointerEvent(event)) return;
    if (isWilyTraderUiTarget(event.target) || isWilyTraderModalOpen()) return;
    const quickBuyBox = findAxiomPulseQuickBuyBox(event.target);
    if (!quickBuyBox) return;
    const row = findAxiomPulseTokenRow(quickBuyBox);
    if (!isAxiomPulseTokenRowContentVisible(row, quickBuyBox)) {
      refreshAxiomPulseQuickBuyLayer();
      return;
    }
    const navigationTarget = findAxiomPulseRowNavigationTarget(row, quickBuyBox);
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    if (Date.now() < pulseQuickBuyQueuedUntil) return;
    primeTradeExecutionSound();
    queueAxiomPulseAutoBuy(quickBuyBox, {
      row,
      navigationTarget,
      token: detectAxiomPulseQuickBuyToken(quickBuyBox, { row, navigationTarget }),
    });
  }

  function handleAxiomPulseLayerPointerDown(event) {
    if (!isPrimaryPointerEvent(event)) return;
    const target = event.target.closest("[data-wt-pulse-quick-buy-target-id]");
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    const pulseTarget = resolveAxiomPulseQuickBuyTarget(target, event);
    const quickBuyBox = pulseTarget?.box;
    if (!quickBuyBox) return refreshAxiomPulseQuickBuyLayer();
    if (isWilyTraderModalOpen() || !getAxiomPulseQuickBuyVisibleRect(quickBuyBox, pulseTarget.row)) {
      refreshAxiomPulseQuickBuyLayer();
      return;
    }
    if (!isAxiomPulseTokenRowContentVisible(pulseTarget.row || findAxiomPulseTokenRow(quickBuyBox), quickBuyBox)) {
      refreshAxiomPulseQuickBuyLayer();
      return;
    }
    if (Date.now() < pulseQuickBuyQueuedUntil) return;
    primeTradeExecutionSound();
    queueAxiomPulseAutoBuy(quickBuyBox, pulseTarget);
  }

  function handleAxiomPulseLayerSuppress(event) {
    const target = event.target.closest("[data-wt-pulse-quick-buy-target-id]");
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function queueAxiomPulseAutoBuy(quickBuyBox, context = {}) {
    pulseQuickBuyQueuedUntil = Date.now() + 1000;
    const row = context.row || findAxiomPulseTokenRow(quickBuyBox);
    const navigationTarget = context.navigationTarget || findAxiomPulseRowNavigationTarget(row, quickBuyBox);
    const token = context.token || detectAxiomPulseQuickBuyToken(quickBuyBox, { row, navigationTarget });
    if (!token?.key) {
      flashAxiomPulseQuickBuyBox(quickBuyBox, "wt-axiom-pulse-quick-buy-error", 900);
      setStatus("Pulse quick buy could not find that token address.");
      return;
    }

    quickBuyBox.classList.add("wt-axiom-pulse-quick-buy-active");
    const amount = getDefaultBuyAmount();
    if (!writePendingPulseAutoBuy(token, amount)) {
      quickBuyBox.classList.remove("wt-axiom-pulse-quick-buy-active");
      flashAxiomPulseQuickBuyBox(quickBuyBox, "wt-axiom-pulse-quick-buy-error", 900);
      setStatus("Pulse auto-buy could not be queued.");
      return;
    }
    setStatus(`Opening ${token.name || shortenAddress(token.address)} for ${formatters.native(amount, token.chain)} auto-buy.`);
    schedulePendingPulseAutoBuyCheck(PULSE_AUTO_BUY_CHECK_MS);
    window.setTimeout(() => {
      quickBuyBox.classList.remove("wt-axiom-pulse-quick-buy-active");
      triggerAxiomPulseRowNavigation(row, quickBuyBox, navigationTarget);
      schedulePendingPulseAutoBuyCheck(PULSE_AUTO_BUY_CHECK_MS);
    }, 120);
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

  function findAxiomPulseQuickBuyBoxes() {
    if (!isAxiomPulseRoute()) return [];
    return Array.from(document.querySelectorAll("body *"))
      .filter((element) => !root?.contains(element) && !pulseQuickBuyLayer?.contains(element))
      .filter(isAxiomPulseQuickBuyBoxElement)
      .filter((element, index, items) => {
        const rect = element.getBoundingClientRect();
        return !items.some((other, otherIndex) => {
          if (otherIndex === index || !other.contains?.(element)) return false;
          const otherRect = other.getBoundingClientRect();
          return Math.abs(otherRect.left - rect.left) <= 2
            && Math.abs(otherRect.top - rect.top) <= 2
            && Math.abs(otherRect.width - rect.width) <= 4
            && Math.abs(otherRect.height - rect.height) <= 4;
        });
      });
  }

  function findVisibleAxiomPulseQuickBuyTargets() {
    return findAxiomPulseQuickBuyBoxes()
      .map((box) => ({
        box,
        row: findAxiomPulseTokenRow(box),
      }))
      .map(({ box, row }) => ({
        box,
        row,
        rect: getAxiomPulseQuickBuyVisibleRect(box, row),
      }))
      .filter(({ rect }) => rect && rect.width > 0 && rect.height > 0)
      .filter(({ row, box }) => isAxiomPulseTokenRowContentVisible(row, box))
      .sort(compareAxiomPulseQuickBuyTargets);
  }

  function getClippedViewportRect(rect) {
    const left = Math.max(0, rect.left);
    const top = Math.max(0, rect.top);
    const right = Math.min(window.innerWidth, rect.right);
    const bottom = Math.min(window.innerHeight, rect.bottom);
    return {
      left,
      top,
      right,
      bottom,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    };
  }

  function compareAxiomPulseQuickBuyTargets(a, b) {
    const rowTolerance = Math.max(18, Math.min(a.rect.height || 0, b.rect.height || 0) * 0.6);
    if (Math.abs(a.rect.top - b.rect.top) > rowTolerance) return a.rect.top - b.rect.top;
    return (a.rect.left - b.rect.left) || (a.rect.top - b.rect.top);
  }

  function scheduleAxiomPulseQuickBuyLayerRefresh() {
    if (pulseQuickBuyLayerRefreshFrame) return;
    const refresh = () => {
      pulseQuickBuyLayerRefreshFrame = 0;
      refreshAxiomPulseQuickBuyLayer();
    };
    pulseQuickBuyLayerRefreshFrame = window.requestAnimationFrame
      ? window.requestAnimationFrame(refresh)
      : window.setTimeout(refresh, 16);
  }

  function ensureAxiomPulseQuickBuyLayer() {
    if (pulseQuickBuyLayer?.isConnected) return pulseQuickBuyLayer;
    pulseQuickBuyLayer = document.getElementById(selectors.pulseLayer);
    if (!pulseQuickBuyLayer) {
      pulseQuickBuyLayer = document.createElement("div");
      pulseQuickBuyLayer.id = selectors.pulseLayer;
      pulseQuickBuyLayer.setAttribute("aria-hidden", "true");
      document.documentElement.appendChild(pulseQuickBuyLayer);
    }
    pulseQuickBuyLayer.addEventListener("pointerdown", handleAxiomPulseLayerPointerDown, true);
    ["pointerup", "mousedown", "mouseup", "click"].forEach((eventName) => {
      pulseQuickBuyLayer.addEventListener(eventName, handleAxiomPulseLayerSuppress, true);
    });
    return pulseQuickBuyLayer;
  }

  function refreshAxiomPulseQuickBuyLayer() {
    const layer = ensureAxiomPulseQuickBuyLayer();
    if (!layer) return;
    if (!isAxiomPulseRoute() || isWilyTraderModalOpen()) {
      layer.hidden = true;
      layer.innerHTML = "";
      pulseQuickBuyTargets = new Map();
      return;
    }

    const targets = findVisibleAxiomPulseQuickBuyTargets();
    layer.hidden = false;
    layer.innerHTML = "";
    pulseQuickBuyTargets = new Map();
    targets.forEach(({ box, row, rect }, index) => {
      const navigationTarget = findAxiomPulseRowNavigationTarget(row, box);
      const token = detectAxiomPulseQuickBuyToken(box, { row, navigationTarget });
      const label = getAxiomPulseQuickBuyLabel(token, index);
      const targetId = `pulse-target-${++pulseQuickBuyTargetSeq}`;
      const hitTarget = document.createElement("div");
      hitTarget.className = "wt-pulse-quick-buy-hit";
      hitTarget.dataset.wtPulseQuickBuyIndex = String(index);
      hitTarget.dataset.wtPulseQuickBuyTargetId = targetId;
      hitTarget.dataset.wtPulseLabel = String(label);
      hitTarget.title = token?.name
        ? `WilyTrader pulse quick-buy target ${label}: ${token.name}`
        : `WilyTrader pulse quick-buy target ${label}`;
      hitTarget.style.left = `${rect.left}px`;
      hitTarget.style.top = `${rect.top}px`;
      hitTarget.style.width = `${rect.width}px`;
      hitTarget.style.height = `${rect.height}px`;
      pulseQuickBuyTargets.set(targetId, { box, row, navigationTarget, token, rect, label, createdAt: Date.now() });
      layer.appendChild(hitTarget);
    });
  }

  function getAxiomPulseQuickBuyLabel(token, fallbackIndex) {
    const key = token?.key || "";
    if (!key) return fallbackIndex + 1;
    if (!pulseQuickBuyTokenLabels.has(key)) {
      pulseQuickBuyTokenLabels.set(key, ++pulseQuickBuyLabelSeq);
    }
    return pulseQuickBuyTokenLabels.get(key);
  }

  function isAxiomPulseTokenRowContentVisible(row, quickBuyBox) {
    if (!row?.getBoundingClientRect || !quickBuyBox?.getBoundingClientRect) return true;
    if (row === quickBuyBox) return true;

    const rowRect = getClippedViewportRect(row.getBoundingClientRect());
    const quickRect = getClippedViewportRect(quickBuyBox.getBoundingClientRect());
    if (rowRect.width <= 0 || rowRect.height <= 0) return false;

    const contentLeft = rowRect.left + Math.min(28, Math.max(8, rowRect.width * 0.08));
    const contentRight = Math.min(rowRect.right - 8, quickRect.left - 12);
    if (contentRight - contentLeft < 32) return false;

    const xCandidates = [
      contentLeft,
      contentLeft + (contentRight - contentLeft) * 0.45,
      contentRight - 8,
    ];
    const yCandidates = [
      rowRect.top + Math.min(24, rowRect.height * 0.32),
      rowRect.top + rowRect.height * 0.5,
      rowRect.bottom - Math.min(18, rowRect.height * 0.28),
    ];

    return yCandidates.some((y) =>
      xCandidates.some((x) => isAxiomPulseTokenRowContentPointVisible(row, quickBuyBox, x, y))
    );
  }

  function isAxiomPulseTokenRowContentPointVisible(row, quickBuyBox, x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false;

    const stack = document.elementsFromPoint(x, y);
    for (const element of stack) {
      if (!element || element === document.documentElement || element === document.body) continue;
      if (root?.contains(element) || pulseQuickBuyLayer?.contains(element)) continue;
      if (element === quickBuyBox || quickBuyBox.contains?.(element)) continue;
      if (element === row || row.contains(element)) return true;

      const style = window.getComputedStyle(element);
      if (style.pointerEvents === "none" || style.visibility === "hidden" || style.display === "none") continue;
      if (style.position === "fixed" || style.position === "sticky") return false;
    }
    return false;
  }

  function resolveAxiomPulseQuickBuyTarget(hitTarget, event) {
    const targetId = hitTarget?.dataset?.wtPulseQuickBuyTargetId;
    const mapped = targetId ? pulseQuickBuyTargets.get(targetId) : null;
    if (mapped?.box && isAxiomPulseQuickBuyBoxCurrentForHitTarget(hitTarget, mapped.box)) {
      return mapped;
    }

    const pointedBox = findAxiomPulseQuickBuyBoxAtPoint(event.clientX, event.clientY);
    if (pointedBox) {
      const row = findAxiomPulseTokenRow(pointedBox);
      const navigationTarget = findAxiomPulseRowNavigationTarget(row, pointedBox);
      return {
        box: pointedBox,
        row,
        navigationTarget,
        token: detectAxiomPulseQuickBuyToken(pointedBox, { row, navigationTarget }),
      };
    }

    scheduleAxiomPulseQuickBuyLayerRefresh();
    return null;
  }

  function isAxiomPulseQuickBuyBoxCurrentForHitTarget(hitTarget, box) {
    if (!box?.isConnected || !isAxiomPulseQuickBuyBoxElement(box)) return false;
    const hitRect = hitTarget.getBoundingClientRect();
    const boxRect = getAxiomPulseQuickBuyVisibleRect(box, findAxiomPulseTokenRow(box));
    if (!boxRect) return false;
    return Math.abs(hitRect.left - boxRect.left) <= 4
      && Math.abs(hitRect.top - boxRect.top) <= 4
      && Math.abs(hitRect.width - boxRect.width) <= 8
      && Math.abs(hitRect.height - boxRect.height) <= 8;
  }

  function getAxiomPulseQuickBuyVisibleRect(box, row = null) {
    if (!box?.getBoundingClientRect) return null;
    let rect = getClippedViewportRect(box.getBoundingClientRect());
    if (row?.getBoundingClientRect && row !== box) {
      rect = intersectViewportRects(rect, getClippedViewportRect(row.getBoundingClientRect()));
    }
    if (rect.width <= 0 || rect.height <= 0) return null;

    const xCandidates = [
      rect.left + rect.width * 0.5,
      rect.left + Math.min(16, rect.width * 0.35),
      rect.right - Math.min(16, rect.width * 0.35),
    ];
    const visibleYs = [];
    const step = Math.max(3, Math.min(8, rect.height / 12));
    for (let y = rect.top + 1; y <= rect.bottom - 1; y += step) {
      if (xCandidates.some((x) => isAxiomPulseQuickBuyPointVisible(box, x, y))) {
        visibleYs.push(y);
      }
    }
    const bottomProbe = rect.bottom - 1;
    if (xCandidates.some((x) => isAxiomPulseQuickBuyPointVisible(box, x, bottomProbe))) {
      visibleYs.push(bottomProbe);
    }
    if (visibleYs.length === 0) return null;

    const visibleTop = Math.max(rect.top, Math.min(...visibleYs) - step);
    const visibleBottom = Math.min(rect.bottom, Math.max(...visibleYs) + step);
    return {
      left: rect.left,
      top: visibleTop,
      right: rect.right,
      bottom: visibleBottom,
      width: rect.width,
      height: Math.max(0, visibleBottom - visibleTop),
    };
  }

  function intersectViewportRects(a, b) {
    const left = Math.max(a.left, b.left);
    const top = Math.max(a.top, b.top);
    const right = Math.min(a.right, b.right);
    const bottom = Math.min(a.bottom, b.bottom);
    return {
      left,
      top,
      right,
      bottom,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top),
    };
  }

  function findAxiomPulseQuickBuyBoxAtPoint(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const stack = document.elementsFromPoint(x, y);
    for (const element of stack) {
      if (!element || root?.contains(element) || pulseQuickBuyLayer?.contains(element)) continue;
      const quickBuyBox = findAxiomPulseQuickBuyBox(element);
      if (quickBuyBox) return quickBuyBox;
    }
    return null;
  }

  function isWilyTraderUiTarget(target) {
    return Boolean(target && root?.contains(target));
  }

  function isWilyTraderModalOpen() {
    return Boolean(root?.querySelector(".wt-modal-open"));
  }

  function isAxiomPulseQuickBuyPointVisible(box, x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) return false;

    const stack = document.elementsFromPoint(x, y);
    for (const element of stack) {
      if (!element || element === document.documentElement || element === document.body) continue;
      if (root?.contains(element) || pulseQuickBuyLayer?.contains(element)) continue;
      if (element === box || box.contains(element)) return true;
      if (element.contains?.(box)) continue;
      if (isAxiomPulseClippingElement(element)) return false;
    }
    return false;
  }

  function isAxiomPulseClippingElement(element) {
    const style = window.getComputedStyle(element);
    if (style.pointerEvents === "none" || style.visibility === "hidden" || style.display === "none") return false;
    if (style.position !== "fixed" && style.position !== "sticky") return false;

    const rect = element.getBoundingClientRect();
    return rect.width >= 80 && rect.height >= 20;
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

  function detectAxiomPulseQuickBuyToken(quickBuyBox, context = {}) {
    const adapter = getPlatformAdapter(window.location.hostname);
    if (!adapter || adapter.id !== "axiom") return null;

    const row = context.row || findAxiomPulseTokenRow(quickBuyBox);
    const navigationTarget = context.navigationTarget || findAxiomPulseRowNavigationTarget(row, quickBuyBox);
    const address = findAxiomPulseTokenAddress(row || quickBuyBox, quickBuyBox, navigationTarget);
    if (!address) return null;

    const tokenScope = row || navigationTarget || quickBuyBox;
    const marketCap = detectAxiomPulseMarketCap(tokenScope, quickBuyBox);
    const name = detectAxiomPulseTokenName(tokenScope, quickBuyBox, address);
    return buildDetectedToken(adapter, {
      address,
      chain: "SOL",
      platformChain: "solana",
      name,
      marketCap,
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

  function findAxiomPulseTokenAddress(row, quickBuyBox, navigationTarget = null) {
    return findAxiomMemeHrefAddress(navigationTarget)
      || findTokenAddressInElementAttributes(navigationTarget)
      || findAxiomClosestMemeHrefAddress(row, quickBuyBox)
      || findAxiomMemeHrefAddress(row)
      || findTokenAddressInElementAttributes(row)
      || findAxiomMemeHrefAddress(row?.parentElement)
      || findTokenAddressInElementAttributes(row?.parentElement)
      || findTokenAddressInElementAttributes(quickBuyBox);
  }

  function findAxiomClosestMemeHrefAddress(scope, quickBuyBox) {
    if (!scope?.querySelectorAll || !quickBuyBox?.getBoundingClientRect) return null;
    const quickRect = quickBuyBox.getBoundingClientRect();
    const quickCenterX = quickRect.left + quickRect.width / 2;
    const quickCenterY = quickRect.top + quickRect.height / 2;
    const candidates = Array.from(scope.querySelectorAll("a[href]"))
      .map((anchor) => {
        const href = safeDecode(anchor.getAttribute("href") || anchor.href || "");
        const address = findTokenAddress(href);
        if (!address) return null;
        const rect = anchor.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const overlapsVertically = rect.bottom >= quickRect.top - 120 && rect.top <= quickRect.bottom + 120;
        const memeBonus = /\/meme(?:\/|\?|$)/i.test(href) ? -1000 : 0;
        const verticalPenalty = overlapsVertically ? 0 : 10000;
        const distance = Math.abs(centerY - quickCenterY) * 4 + Math.abs(centerX - quickCenterX);
        return { address, score: memeBonus + verticalPenalty + distance };
      })
      .filter(Boolean)
      .sort((a, b) => a.score - b.score);
    return candidates[0]?.address || null;
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
    return normalizeDefaultBuyAmount(state?.settings?.defaultBuyAmount, state?.settings);
  }

  function writePendingPulseAutoBuy(token, amountNative) {
    if (!token?.address) return false;
    const pending = {
      sourceTokenAddress: token.address,
      sourceTokenKey: token.key,
      tokenName: token.name,
      chain: token.chain || "SOL",
      amountNative,
      sourceUrl: window.location.href,
      createdAt: Date.now(),
    };
    try {
      window.sessionStorage.setItem(PULSE_AUTO_BUY_KEY, JSON.stringify(pending));
      return true;
    } catch (error) {
      console.debug("[WilyTrader] Could not save pending Pulse auto-buy.", error);
      return false;
    }
  }

  function readPendingPulseAutoBuy() {
    try {
      const raw = window.sessionStorage.getItem(PULSE_AUTO_BUY_KEY);
      if (!raw) return null;
      const pending = JSON.parse(raw);
      if (!pending?.sourceTokenAddress || !Number.isFinite(Number(pending.amountNative))) {
        clearPendingPulseAutoBuy();
        return null;
      }
      if (Date.now() - Number(pending.createdAt || 0) > PULSE_AUTO_BUY_TTL_MS) {
        clearPendingPulseAutoBuy();
        return null;
      }
      return pending;
    } catch (error) {
      clearPendingPulseAutoBuy();
      return null;
    }
  }

  function clearPendingPulseAutoBuy() {
    try {
      window.sessionStorage.removeItem(PULSE_AUTO_BUY_KEY);
    } catch {
      // Ignore storage cleanup failures; the pending payload is best-effort.
    }
  }

  function schedulePendingPulseAutoBuyCheck(delayMs = 0) {
    if (pendingPulseAutoBuyCheckId !== null) return;
    pendingPulseAutoBuyCheckId = window.setTimeout(() => {
      pendingPulseAutoBuyCheckId = null;
      runTask(maybeRunPendingPulseAutoBuy());
    }, delayMs);
  }

  async function maybeRunPendingPulseAutoBuy() {
    if (pendingPulseAutoBuyInFlight || tradeInFlight || !state) {
      if (readPendingPulseAutoBuy()) schedulePendingPulseAutoBuyCheck(PULSE_AUTO_BUY_CHECK_MS);
      return;
    }
    const pending = readPendingPulseAutoBuy();
    if (!pending) return;
    if (!isAxiomMemeRoute(new URL(window.location.href))) {
      schedulePendingPulseAutoBuyCheck(PULSE_AUTO_BUY_CHECK_MS);
      return;
    }

    updateActiveToken();
    const token = activeToken;
    if (!token?.key) {
      schedulePendingPulseAutoBuyCheck(PULSE_AUTO_BUY_CHECK_MS);
      return;
    }
    const sourceTokenMismatch = Boolean(pending.sourceTokenKey && token.key !== pending.sourceTokenKey);

    const readiness = getPulseAutoBuyReadiness(token, pending);
    if (!readiness.ready) {
      setStatus(readiness.message);
      schedulePendingPulseAutoBuyCheck(PULSE_AUTO_BUY_CHECK_MS);
      return;
    }

    const amountNative = Number(pending.amountNative);
    const minFees = calculateFees("buy", amountNative, 0);
    if ((state.balances[token.chain] || 0) < amountNative + minFees.totalFeeNative) {
      clearPendingPulseAutoBuy();
      setStatus(`Insufficient ${token.chain} paper balance for Pulse auto-buy.`);
      return;
    }

    pendingPulseAutoBuyInFlight = true;
    try {
      if (sourceTokenMismatch) {
        console.warn("[WilyTrader] Pulse token guess differed from opened token; auto-buying opened token page.", {
          pendingToken: pending.sourceTokenKey,
          pendingTokenName: pending.tokenName,
          openedToken: token.key,
          openedTokenName: token.name,
        });
      }
      setStatus(sourceTokenMismatch
        ? `Pulse target resolved to opened token ${token.name || shortenAddress(token.address)}; auto-buying ${formatters.native(pending.amountNative, token.chain)}.`
        : `Auto-buying ${formatters.native(pending.amountNative, token.chain)} from Pulse.`);
      const execution = await buy(amountNative, token, {
        resolveLatestToken: () => {
          updateActiveToken();
          const latest = activeToken?.key === token.key ? activeToken : null;
          return latest && getPulseAutoBuyReadiness(latest, pending).ready ? latest : null;
        },
      });
      if (execution?.id) {
        clearPendingPulseAutoBuy();
      } else if (readPendingPulseAutoBuy()) {
        schedulePendingPulseAutoBuyCheck(PULSE_AUTO_BUY_CHECK_MS);
      }
    } finally {
      pendingPulseAutoBuyInFlight = false;
    }
  }

  function getPulseAutoBuyReadiness(token, pending) {
    const amount = formatters.native(pending.amountNative, pending.chain || token?.chain || "SOL");
    if (!token?.key) {
      return { ready: false, message: `Waiting for Axiom token page before auto-buying ${amount}.` };
    }
    const expectedKey = pending.sourceTokenKey;
    if (expectedKey && token.key !== expectedKey) {
      return { ready: false, message: `Pulse opened a different token; waiting for the selected token page.` };
    }
    if (!token.unitPriceNative || !Number.isFinite(Number(token.marketCap)) || Number(token.marketCap) <= 0) {
      return { ready: false, message: `Waiting for token page price before auto-buying ${amount}.` };
    }
    const titleMarketCap = detectAxiomTitleMarketCap();
    if (!titleMarketCap) {
      return { ready: false, message: `Waiting for Axiom page title market cap before auto-buying ${amount}.` };
    }
    return { ready: true, message: "" };
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

  function triggerAxiomPulseRowNavigation(row, quickBuyBox, navigationTarget = null) {
    navigationTarget = navigationTarget || findAxiomPulseRowNavigationTarget(row, quickBuyBox);
    if (!navigationTarget) {
      setStatus("Pulse auto-buy queued, but row navigation target was not found.");
      return;
    }

    if (typeof navigationTarget.click === "function") {
      navigationTarget.click();
      return;
    }

    if (typeof MouseEvent === "function") {
      const clickEvent = new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        button: 0,
      });
      navigationTarget.dispatchEvent(clickEvent);
    }
  }

  function findAxiomPulseRowNavigationTarget(row, quickBuyBox) {
    let element = row;
    for (let depth = 0; element && depth < 8; depth += 1, element = element.parentElement) {
      if (root?.contains(element)) return null;
      if (element === quickBuyBox || element.contains?.(quickBuyBox)) {
        const text = cleanText(element.textContent);
        const rect = element.getBoundingClientRect();
        if (rect.width >= 240 && rect.height >= 80 && /MC/i.test(text) && /TX/i.test(text)) return element;
      }
    }
    return row || null;
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

  function openAddModal(options = {}) {
    const modal = root.querySelector(`#${selectors.addModal}`);
    if (!modal) return;
    const fundsInput = root.querySelector("[data-deposit]");
    const setBalanceInput = root.querySelector("[data-set-balance]");
    if (fundsInput) fundsInput.value = "";
    if (setBalanceInput) setBalanceInput.value = "";
    modal.classList.add("wt-modal-open");
    modal.setAttribute("aria-hidden", "false");
    refreshAxiomPulseQuickBuyLayer();
    const focusTarget = options.focus === "set-balance" ? setBalanceInput : fundsInput;
    window.setTimeout(() => focusTarget?.focus?.(), 0);
  }

  function toggleTrackerMenu() {
    const menu = root?.querySelector("[data-tracker-menu]");
    const button = root?.querySelector("[data-action='tracker-menu']");
    if (!menu) return;
    const willOpen = menu.hidden;
    menu.hidden = !willOpen;
    button?.setAttribute("aria-expanded", willOpen ? "true" : "false");
  }

  function closeTrackerMenu() {
    const menu = root?.querySelector("[data-tracker-menu]");
    const button = root?.querySelector("[data-action='tracker-menu']");
    if (menu) menu.hidden = true;
    button?.setAttribute("aria-expanded", "false");
  }

  function closeTrackerMenuOnOutsidePointer(event) {
    const menu = root?.querySelector("[data-tracker-menu]");
    if (!menu || menu.hidden) return;
    if (root?.querySelector(`.${selectors.tracker}`)?.contains(event.target)) return;
    closeTrackerMenu();
  }

  function openSettingsModal() {
    const modal = root.querySelector(`#${selectors.settingsModal}`);
    if (!modal) return;
    root.querySelector("[data-setting='buyAmounts']").value = state.settings.buyAmounts.join(", ");
    root.querySelector("[data-setting='sellPercents']").value = state.settings.sellPercents.join(", ");
    [
      "defaultBuyAmount",
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
    root.querySelector("[data-setting='trackerEnabled']").checked = Boolean(state.settings.trackerEnabled);
    root.querySelector("[data-setting='bridgeEnabled']").checked = Boolean(state.settings.bridgeEnabled);
    root.querySelector("[data-setting='autoScreenshotOnTrade']").checked = Boolean(state.settings.autoScreenshotOnTrade);
    root.querySelector("[data-setting='fallbackDownloadsEnabled']").checked = Boolean(state.settings.fallbackDownloadsEnabled);
    root.querySelector("[data-setting='updateChecksEnabled']").checked = Boolean(state.settings.updateChecksEnabled);
    modal.classList.add("wt-modal-open");
    modal.setAttribute("aria-hidden", "false");
    refreshAxiomPulseQuickBuyLayer();
  }

  function openLogModal() {
    renderFullLog();
    const modal = root.querySelector(`#${selectors.logModal}`);
    if (!modal) return;
    modal.classList.add("wt-modal-open");
    modal.setAttribute("aria-hidden", "false");
    refreshAxiomPulseQuickBuyLayer();
  }

  function openClosedPnlModal() {
    updateActiveToken();
    const summary = findLatestClosedTokenPositionSummary(activeToken);
    if (!summary) {
      setStatus("No completed P&L for this token yet.");
      render();
      return;
    }
    renderClosedPnl(summary);
    const modal = root.querySelector(`#${selectors.pnlModal}`);
    if (!modal) return;
    modal.classList.add("wt-modal-open");
    modal.setAttribute("aria-hidden", "false");
    refreshAxiomPulseQuickBuyLayer();
  }

  function closeModals() {
    root.querySelectorAll(".wt-modal").forEach((modal) => {
      modal.classList.remove("wt-modal-open");
      modal.setAttribute("aria-hidden", "true");
    });
    refreshAxiomPulseQuickBuyLayer();
  }

  async function saveSettingsFromModal() {
    const nextBuyAmounts = parsePositiveNumberList(root.querySelector("[data-setting='buyAmounts']")?.value, "buy presets", 6);
    const parsedSellPercents = parsePositiveNumberList(root.querySelector("[data-setting='sellPercents']")?.value, "sell buttons", 8);
    if (!nextBuyAmounts || !parsedSellPercents) return;
    const nextSellPercents = parsedSellPercents.map((value) => Math.min(100, value));

    const numericKeys = [
      "defaultBuyAmount",
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
      trackerEnabled: Boolean(root.querySelector("[data-setting='trackerEnabled']")?.checked),
      bridgeEnabled: Boolean(root.querySelector("[data-setting='bridgeEnabled']")?.checked),
      autoScreenshotOnTrade: Boolean(root.querySelector("[data-setting='autoScreenshotOnTrade']")?.checked),
      fallbackDownloadsEnabled: Boolean(root.querySelector("[data-setting='fallbackDownloadsEnabled']")?.checked),
      updateChecksEnabled: Boolean(root.querySelector("[data-setting='updateChecksEnabled']")?.checked),
    };

    for (const key of numericKeys) {
      const value = Number(root.querySelector(`[data-setting='${key}']`)?.value);
      if (!Number.isFinite(value) || value < 0 || (key === "defaultBuyAmount" && value <= 0)) return setStatus(`Enter a valid ${key}.`);
      next[key] = key === "customDelayMs" ? Math.round(value) : value;
    }

    next.buyAmounts = normalizeBuyAmounts(next.buyAmounts);
    next.defaultBuyAmount = normalizeDefaultBuyAmount(next.defaultBuyAmount, next);
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
      panelScale: state.settings.panelScale,
      trackerEnabled: state.settings.trackerEnabled,
      trackerPosition: state.settings.trackerPosition || null,
      trackerSize: null,
      trackerScale: normalizeTrackerScale(state.settings.trackerScale || trackerSizeToScale(state.settings.trackerSize)),
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

  function handleAxiomContextMenu(event) {
    if (!isAxiomMemeRoute(new URL(window.location.href))) return;
    if (isWilyTraderUiTarget(event.target) || isWilyTraderModalOpen()) return;
    const token = (updateActiveToken(), activeToken);
    if (!token?.key || !state.positions[token.key]) return;
    showContextMenu(event.clientX, event.clientY);
  }

  function showContextMenu(clientX, clientY) {
    const menu = root?.querySelector(`#${selectors.contextMenu}`);
    if (!menu) return;
    menu.innerHTML = `
      <div class="wt-context-title">WilyTrader</div>
      <button type="button" data-action="context-set-stop-loss">WT Stop Loss @ current MC</button>
      <button type="button" data-action="context-set-take-profit">WT 100% Exit @ current MC</button>
      <button type="button" data-action="context-custom-target">Custom MC Target</button>
      <button type="button" data-action="context-clear-targets">Clear WT Targets</button>
    `;
    positionContextMenu(menu, clientX, clientY);
  }

  function showSellButtonTargetMenu(clientX, clientY, anchorRect = null, sellPercent = 100) {
    const menu = root?.querySelector(`#${selectors.contextMenu}`);
    if (!menu) {
      logExitTargetDiagnostic("target-menu-missing-root-menu", null, { clientX, clientY, sellPercent }, "warn");
      return;
    }
    const targetSellPercent = normalizeTargetSellPercent(sellPercent);
    updateActiveToken();
    const currentMarketCap = Number(activeToken?.marketCap || 0);
    if (!Number.isFinite(currentMarketCap) || currentMarketCap <= 0) {
      logExitTargetDiagnostic("target-menu-market-cap-unavailable", null, {
        clientX,
        clientY,
        sellPercent: targetSellPercent,
        activeTokenKey: activeToken?.key || null,
        detectedMarketCap: activeToken?.marketCap || null,
      }, "warn");
      return setStatus("Current market cap is unavailable.");
    }
    const targetOptions = buildMarketCapMenuOptions(EXIT_TARGET_KINDS.takeProfit, currentMarketCap).reverse();
    const stopOptions = buildMarketCapMenuOptions(EXIT_TARGET_KINDS.stopLoss, currentMarketCap);
    logExitTargetDiagnostic("target-menu-render", null, {
      clientX,
      clientY,
      anchorRect: rectSnapshot(anchorRect),
      sellPercent: targetSellPercent,
      currentMarketCap,
      firstTargetOption: targetOptions[0] || null,
      firstStopOption: stopOptions[0] || null,
      optionCount: { target: targetOptions.length, stop: stopOptions.length },
    });
    const stopLossHtml = Math.round(targetSellPercent) === 100
      ? buildMarketCapSubmenuHtml("Target Stop Loss MC", EXIT_TARGET_KINDS.stopLoss, stopOptions, targetSellPercent)
      : "";
    menu.innerHTML = `
      <div class="wt-context-title">WilyTrader ${formatTargetSellPercent(targetSellPercent)} @ ${formatters.usd(currentMarketCap)}</div>
      ${buildMarketCapSubmenuHtml("Target Exit MC", EXIT_TARGET_KINDS.takeProfit, targetOptions, targetSellPercent, "bottom")}
      ${stopLossHtml}
      <button type="button" data-action="context-clear-targets">Clear WT Targets</button>
    `;
    bindSubmenuInitialScroll(menu);
    positionContextMenu(menu, clientX, clientY, anchorRect, "side");
  }

  function buildMarketCapMenuOptions(kind, currentMarketCap) {
    const step = EXIT_TARGET_MARKET_CAP_STEP;
    if (kind === EXIT_TARGET_KINDS.stopLoss) {
      const start = Math.floor((currentMarketCap - 1) / step) * step;
      const options = [];
      for (let value = start; value >= step && options.length < EXIT_TARGET_MENU_MAX_OPTIONS; value -= step) {
        options.push(value);
      }
      return options;
    }
    const start = Math.floor(currentMarketCap / step) * step + step;
    return Array.from({ length: EXIT_TARGET_MENU_MAX_OPTIONS }, (_, index) => start + index * step);
  }

  function buildMarketCapSubmenuHtml(label, kind, options, sellPercent = 100, initialScroll = "") {
    const rows = options
      .map((marketCap) => `<button type="button" data-action="select-exit-target-mc" data-target-kind="${kind}" data-target-market-cap="${marketCap}" data-target-sell-percent="${sellPercent}">${formatters.usd(marketCap)}</button>`)
      .join("");
    const scrollAttr = initialScroll ? ` data-initial-scroll="${initialScroll}"` : "";
    const placement = kind === EXIT_TARGET_KINDS.stopLoss ? "below" : "above";
    return `
      <div class="wt-context-submenu" data-submenu-placement="${placement}">
        <button type="button" class="wt-context-submenu-trigger" aria-haspopup="true">${label}</button>
        <div class="wt-context-submenu-panel"${scrollAttr}>${rows}</div>
      </div>
    `;
  }

  function bindSubmenuInitialScroll(menu) {
    menu.querySelectorAll("[data-initial-scroll='bottom']").forEach((panel) => {
      const submenu = panel.closest(".wt-context-submenu");
      const trigger = submenu?.querySelector(".wt-context-submenu-trigger");
      const scrollToBottom = () => {
        panel.scrollTop = panel.scrollHeight;
        window.requestAnimationFrame(() => {
          panel.scrollTop = panel.scrollHeight;
        });
        window.setTimeout(() => {
          panel.scrollTop = panel.scrollHeight;
        }, 40);
      };
      [submenu, trigger, panel].filter(Boolean).forEach((element) => {
        element.addEventListener("mouseenter", scrollToBottom);
        element.addEventListener("pointerenter", scrollToBottom);
        element.addEventListener("focusin", scrollToBottom);
      });
    });
  }

  function constrainSubmenusToViewport(menu) {
    const margin = 8;
    menu.querySelectorAll(".wt-context-submenu").forEach((submenu) => {
      const trigger = submenu.querySelector(".wt-context-submenu-trigger");
      if (!trigger) return;
      const triggerRect = trigger.getBoundingClientRect();
      const opensBelow = submenu.dataset.submenuPlacement === "below";
      const availableHeight = opensBelow
        ? Math.max(96, window.innerHeight - triggerRect.bottom - margin)
        : Math.max(96, triggerRect.top - margin);
      submenu.style.setProperty("--wt-context-submenu-max-height", `${availableHeight}px`);
    });
  }

  function positionContextMenu(menu, clientX, clientY, anchorRect = null, placement = "below") {
    const margin = 8;
    const gap = 6;
    const submenuWidth = 132;
    menu.hidden = false;
    const rect = menu.getBoundingClientRect();
    let left = clientX;
    let top = clientY;
    let submenuShouldOpenLeft = false;
    if (anchorRect) {
      if (placement === "side") {
        const fitsLeft = anchorRect.left - rect.width - gap >= margin;
        const fitsRight = anchorRect.right + rect.width + gap <= window.innerWidth - margin;
        if (fitsLeft || !fitsRight) {
          left = anchorRect.left - rect.width - gap;
          submenuShouldOpenLeft = true;
        } else {
          left = anchorRect.right + gap;
        }
        top = anchorRect.top + anchorRect.height / 2 - rect.height / 2;
      } else {
        const anchorCenter = anchorRect.left + anchorRect.width / 2;
        const panelIsRightAligned = anchorCenter > window.innerWidth / 2;
        left = panelIsRightAligned ? anchorRect.right - rect.width : anchorRect.left;
        top = anchorRect.bottom + gap;
        if (top + rect.height > window.innerHeight - margin) {
          top = anchorRect.top - rect.height - gap;
        }
      }
    }
    left = Math.min(Math.max(margin, left), Math.max(margin, window.innerWidth - rect.width - margin));
    top = Math.min(Math.max(margin, top), Math.max(margin, window.innerHeight - rect.height - margin));
    submenuShouldOpenLeft ||= left + rect.width + submenuWidth > window.innerWidth - margin && left > submenuWidth;
    menu.classList.toggle("wt-context-menu-left", submenuShouldOpenLeft);
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    constrainSubmenusToViewport(menu);
    logExitTargetDiagnostic("target-menu-positioned", null, {
      requested: { left: clientX, top: clientY },
      applied: { left, top },
      placement,
      anchorRect: rectSnapshot(anchorRect),
      rect: rectSnapshot(menu.getBoundingClientRect()),
      leftOpening: menu.classList.contains("wt-context-menu-left"),
    });
  }

  function closeContextMenu() {
    const menu = root?.querySelector(`#${selectors.contextMenu}`);
    if (menu) menu.hidden = true;
  }

  function closeContextMenuOnOutsidePointer(event) {
    const menu = root?.querySelector(`#${selectors.contextMenu}`);
    if (!menu || menu.hidden || menu.contains(event.target)) return;
    closeContextMenu();
  }

  async function setExitTargetFromPanel(kind) {
    const input = root.querySelector("[data-exit-target-mc]");
    const marketCapUsd = parseMarketCapInput(input?.value);
    if (!marketCapUsd) return setStatus("Enter a valid market cap target.");
    await setExitTarget(kind, marketCapUsd, 100);
    if (input) input.value = "";
  }

  async function setExitTargetAtCurrentMarketCap(kind, sellPercent = 100) {
    updateActiveToken();
    const marketCapUsd = Number(activeToken?.marketCap || 0);
    if (!Number.isFinite(marketCapUsd) || marketCapUsd <= 0) {
      return setStatus("Current market cap is unavailable.");
    }
    await setExitTarget(kind, marketCapUsd, sellPercent);
  }

  async function promptForExitTarget(kind = null, sellPercent = 100) {
    updateActiveToken();
    const current = Number(activeToken?.marketCap || 0);
    const defaultValue = current > 0 ? formatters.usd(current) : "";
    const percent = normalizeTargetSellPercent(sellPercent);
    const label = kind ? `${formatExitTargetKind(kind)} ${formatTargetSellPercent(percent)}` : `WT market cap target ${formatTargetSellPercent(percent)}`;
    const raw = window.prompt(label, defaultValue);
    if (raw === null) return;
    const marketCapUsd = parseMarketCapInput(raw);
    if (!marketCapUsd) return setStatus("Enter a valid market cap target.");
    const resolvedKind = kind || (current > 0 && marketCapUsd >= current ? EXIT_TARGET_KINDS.takeProfit : EXIT_TARGET_KINDS.stopLoss);
    await setExitTarget(resolvedKind, marketCapUsd, percent);
  }

  async function setExitTarget(kind, marketCapUsd, sellPercent = 100) {
    updateActiveToken();
    const token = activeToken;
    const position = token?.key ? state.positions[token.key] : null;
    if (!token?.key || !position) return setStatus("Open a paper position before setting an exit target.");
    const normalizedKind = kind === EXIT_TARGET_KINDS.takeProfit ? EXIT_TARGET_KINDS.takeProfit : EXIT_TARGET_KINDS.stopLoss;
    const now = new Date().toISOString();
    const id = createId("target");
    state.exitTargets[id] = {
      id,
      kind: normalizedKind,
      tokenKey: token.key,
      tokenAddress: token.address,
      tokenName: token.name,
      positionId: position.positionId,
      sellPercent: normalizeTargetSellPercent(sellPercent),
      marketCapUsd: Number(marketCapUsd),
      createdAt: now,
      updatedAt: now,
      triggeredAt: null,
    };
    logExitTargetDiagnostic("target-order-set", null, {
      id,
      kind: normalizedKind,
      sellPercent: normalizeTargetSellPercent(sellPercent),
      marketCapUsd: Number(marketCapUsd),
      tokenKey: token.key,
      positionId: position.positionId,
    });
    lastAxiomExitTargetSyncKey = null;
    await persistAndSync("exit-target");
    render();
    setStatus(`${formatExitTargetKind(normalizedKind)} ${formatTargetSellPercent(sellPercent)} set at ${formatters.usd(marketCapUsd)}.`);
  }

  async function clearExitTarget(targetId) {
    const target = state.exitTargets?.[targetId];
    if (!target) return;
    delete state.exitTargets[target.id];
    lastAxiomExitTargetSyncKey = null;
    await persistAndSync("exit-target-clear");
    render();
    setStatus(`${formatExitTargetKind(target.kind)} ${formatTargetSellPercent(target.sellPercent)} cleared.`);
  }

  async function clearAllExitTargetsForActivePosition() {
    const targets = getActiveExitTargets();
    targets.forEach((target) => {
      delete state.exitTargets[target.id];
    });
    lastAxiomExitTargetSyncKey = null;
    await persistAndSync("exit-target-clear");
    render();
    setStatus(targets.length ? "WT exit targets cleared." : "No WT exit targets to clear.");
  }

  async function handleAxiomExitTargetLineMoved(data) {
    logExitTargetDiagnostic("chart-line-moved-message", null, data);
    const kind = data.kind === EXIT_TARGET_KINDS.takeProfit ? EXIT_TARGET_KINDS.takeProfit : data.kind === EXIT_TARGET_KINDS.stopLoss ? EXIT_TARGET_KINDS.stopLoss : null;
    const marketCapUsd = Number(data.price);
    if (!kind || !Number.isFinite(marketCapUsd) || marketCapUsd <= 0 || !data.positionId) {
      logExitTargetDiagnostic("chart-line-moved-ignored-invalid", null, data, "warn");
      return;
    }
    const target = state.exitTargets[data.positionId] || Object.values(state.exitTargets || {}).find((item) => item?.positionId === data.positionId && item.kind === kind);
    if (!target) {
      logExitTargetDiagnostic("chart-line-moved-ignored-no-target", null, data, "warn");
      return;
    }
    if (Math.abs(Number(target.marketCapUsd || 0) - marketCapUsd) < 1) {
      logExitTargetDiagnostic("chart-line-moved-ignored-same-price", null, data);
      return;
    }
    target.marketCapUsd = marketCapUsd;
    target.updatedAt = new Date().toISOString();
    target.triggeredAt = null;
    lastAxiomExitTargetSyncKey = null;
    await persistAndSync("exit-target-moved");
    render();
    setStatus(`${formatExitTargetKind(kind)} moved to ${formatters.usd(marketCapUsd)}.`);
  }

  function parseMarketCapInput(value) {
    const text = String(value || "").trim();
    const match = text.match(/\$?\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*([KMB])?/i);
    if (!match) return null;
    const parsed = parseMarketCapInputNumber(match[1], match[2]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  function parseMarketCapInputNumber(value, suffix = "") {
    if (suffix) return parseCompactNumber(value, suffix);
    const raw = String(value || "").replace(/,/g, "");
    const parsed = Number.parseFloat(raw);
    if (!Number.isFinite(parsed)) return null;
    const digitCount = raw.replace(/\D/g, "").length;
    return digitCount > 0 && digitCount <= 3 ? parsed * 1000 : parsed;
  }

  function getActiveExitTargets() {
    updateActiveToken();
    const token = activeToken;
    const position = token?.key ? state.positions[token.key] : null;
    if (!position) return [];
    return Object.values(state.exitTargets || {})
      .filter((target) => target?.positionId === position.positionId && !target.triggeredAt)
      .sort((a, b) => Number(a.marketCapUsd || 0) - Number(b.marketCapUsd || 0));
  }

  function formatExitTargetKind(kind) {
    return kind === EXIT_TARGET_KINDS.takeProfit ? "WT target" : "WT stop";
  }

  function formatTargetSellPercent(percent) {
    return `${Number(normalizeTargetSellPercent(percent)).toFixed(0)}%`;
  }

  async function buy(amountNative, tokenOverride = null, options = {}) {
    if (tradeInFlight) return setStatus("Execution already pending.");
    if (!Number.isFinite(amountNative) || amountNative <= 0) return setStatus("Enter a valid buy amount.");
    tradeInFlight = true;
    try {
      const token = tokenOverride || (updateActiveToken(), activeToken);
      if (tokenOverride) activeToken = tokenOverride;
      emitDiagnostic("buy-start", {
        amountNative,
        token: summarizeToken(token),
        marketCaps: buildMarketCapDiagnostics(),
      });
      if (!token.key) {
        emitDiagnostic("buy-blocked-no-token", { amountNative, token: summarizeToken(token) });
        return setStatus("Open a supported token page first.");
      }
      if (!token.unitPriceNative) {
        emitDiagnostic("buy-blocked-no-price", { amountNative, token: summarizeToken(token), marketCaps: buildMarketCapDiagnostics() });
        return setStatus(`Price unavailable. Wait for ${token.platformLabel || "the platform"} market cap to load.`);
      }

      const delayedToken = await waitForSimulatedExecution("buy", token, options);
      if (!delayedToken) {
        emitDiagnostic("buy-blocked-no-delayed-token", { amountNative, token: summarizeToken(token) });
        return;
      }
      emitDiagnostic("buy-delayed-token", {
        amountNative,
        originalToken: summarizeToken(token),
        delayedToken: summarizeToken(delayedToken),
        marketCaps: buildMarketCapDiagnostics(),
      });

      const chain = delayedToken.chain;
      const fees = calculateFees("buy", amountNative, delayedToken.executionDelayMs);
      const maxSlippagePct = Number(state.settings.buySlippagePct || 0);
      const totalDebit = amountNative + fees.totalFeeNative;
      if ((state.balances[chain] || 0) < totalDebit) {
        return setStatus(`Insufficient ${chain} paper balance.`);
      }

      const executionPrice = delayedToken.unitPriceNative;
      const tokenAmount = amountNative / executionPrice;
      const existing = state.positions[delayedToken.key] || createEmptyPosition(delayedToken);
      const before = snapshotPosition(existing);
      const newCost = existing.costNative + amountNative;
      const newTokenAmount = existing.tokenAmount + tokenAmount;
      const baseUpdated = {
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
      const updated = withUpdatedPositionMarketCapRange(baseUpdated, delayedToken).position;

      state.balances[chain] -= totalDebit;
      state.positions[delayedToken.key] = updated;

      const execution = recordExecution({
        side: "buy",
        chain,
        token: delayedToken,
        positionId: updated.positionId,
        requestedAmountNative: amountNative,
        grossNative: amountNative,
        netNative: -totalDebit,
        fees,
        slippagePct: 0,
        maxSlippagePct,
        priceMovePct: delayedToken.priceMovePct,
        tokenAmount,
        executionPriceNative: executionPrice,
        pnlNative: 0,
        positionBefore: before,
        positionAfter: snapshotPosition(updated),
        costBasisNative: 0,
      });
      emitDiagnostic("execution-recorded", {
        side: "buy",
        executionId: execution.id,
        positionId: execution.positionId,
        executionMarketCapUsd: execution.executionMarketCapUsd,
        unitPriceNative: execution.unitPriceNative,
        tokenAmount: execution.tokenAmount,
        positionAfter: summarizePosition(updated),
      });
      playTradeExecutionSound();

      await persistAndSync("buy");
      setStatus(`Bought ${formatters.native(amountNative, chain)} @ ${formatMarketCapFill(execution)}.`);
      render();
      return execution;
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
    emitDiagnostic("sell-start", {
      percent,
      token: summarizeToken(token),
      position: summarizePosition(position),
      marketCaps: buildMarketCapDiagnostics(),
    });
    if (!token.key || !position) {
      emitDiagnostic("sell-blocked-no-position", { percent, token: summarizeToken(token), positionKeys: Object.keys(state.positions || {}) });
      return setStatus("No open paper position for this token.");
    }
    if (!token.unitPriceNative) {
      emitDiagnostic("sell-blocked-no-price", { percent, token: summarizeToken(token), marketCaps: buildMarketCapDiagnostics() });
      return setStatus(`Price unavailable. Wait for ${token.platformLabel || "the platform"} market cap to load.`);
    }

    const delayedToken = await waitForSimulatedExecution("sell", token);
    if (!delayedToken) {
      emitDiagnostic("sell-blocked-no-delayed-token", { percent, token: summarizeToken(token) });
      return;
    }

    const chain = delayedToken.chain;
    const sellRatio = normalizeSellRatio(percent);
    const tokenAmount = position.tokenAmount * sellRatio;
    const costBasis = position.costNative * sellRatio;
    const maxSlippagePct = Number(state.settings.sellSlippagePct || 0);
    const executionPrice = delayedToken.unitPriceNative;
    const grossProceeds = tokenAmount * executionPrice;
    const fees = calculateFees("sell", grossProceeds, delayedToken.executionDelayMs);
    const netProceeds = Math.max(0, grossProceeds - fees.totalFeeNative);
    const pnlNative = netProceeds - costBasis;
    const before = snapshotPosition(position);

    state.balances[chain] = (state.balances[chain] || 0) + netProceeds;

    const closingRangePosition = withUpdatedPositionMarketCapRange(position, delayedToken).position;
    const remainingTokenAmount = position.tokenAmount - tokenAmount;
    let after = null;
    if (shouldClosePositionAfterSell(position.tokenAmount, remainingTokenAmount, sellRatio)) {
      delete state.positions[token.key];
    } else {
      const updated = {
        ...closingRangePosition,
        tokenAmount: remainingTokenAmount,
        costNative: position.costNative - costBasis,
        sellCount: (position.sellCount || 0) + 1,
        updatedAt: new Date().toISOString(),
      };
      state.positions[token.key] = updated;
      after = snapshotPosition(updated);
    }

    const execution = recordExecution({
      side: "sell",
      chain,
      token: delayedToken,
      positionId: position.positionId,
      requestedAmountNative: null,
      requestedSellPct: percent,
      grossNative: grossProceeds,
      netNative: netProceeds,
      fees,
      slippagePct: 0,
      maxSlippagePct,
      priceMovePct: delayedToken.priceMovePct,
      tokenAmount,
      executionPriceNative: executionPrice,
      pnlNative,
      positionBefore: before,
      positionAfter: after,
      costBasisNative: costBasis,
    });
    emitDiagnostic("execution-recorded", {
      side: "sell",
      executionId: execution.id,
      positionId: execution.positionId,
      executionMarketCapUsd: execution.executionMarketCapUsd,
      unitPriceNative: execution.unitPriceNative,
      requestedSellPct: execution.requestedSellPct,
      tokenAmount: execution.tokenAmount,
      pnlNative: execution.pnlNative,
      positionAfter: summarizePosition(after),
    });
    playTradeExecutionSound();

    if (!after) {
      const summary = buildPositionSummary(position.positionId, "closed", closingRangePosition);
      if (summary) state.closedPositions.push(summary);
      removeExitTargetsForPosition(position.positionId);
    }

    await persistAndSync("sell");
    setStatus(`Sold ${percent}% @ ${formatMarketCapFill(execution)}.`);
    render();
    return execution;
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

  function removeExitTargetsForPosition(positionId) {
    Object.keys(state.exitTargets || {}).forEach((key) => {
      if (state.exitTargets[key]?.positionId === positionId) delete state.exitTargets[key];
    });
    lastAxiomExitTargetSyncKey = null;
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
      highMarketCapAfterEntry: round(token.marketCap, 2),
      highMarketCapAt: now,
      lowMarketCapAfterEntry: round(token.marketCap, 2),
      lowMarketCapAt: now,
      firstUrl: token.url,
      lastUrl: token.url,
    };
  }

  function withUpdatedPositionMarketCapRange(position, token, timestampMs = Date.now()) {
    const marketCap = round(token?.marketCap, 2);
    if (!position || !Number.isFinite(marketCap) || marketCap <= 0) return { position, changed: false };
    const timestamp = new Date(timestampMs).toISOString();
    const currentHigh = Number(position.highMarketCapAfterEntry || 0);
    const currentLow = Number(position.lowMarketCapAfterEntry || 0);
    let changed = false;
    const updated = { ...position };
    if (!currentHigh || marketCap > currentHigh) {
      updated.highMarketCapAfterEntry = marketCap;
      updated.highMarketCapAt = timestamp;
      changed = true;
    }
    if (!currentLow || marketCap < currentLow) {
      updated.lowMarketCapAfterEntry = marketCap;
      updated.lowMarketCapAt = timestamp;
      changed = true;
    }
    return { position: updated, changed };
  }

  function updateActivePositionMarketCapRange({ persistRange = true } = {}) {
    const token = activeToken;
    const position = token?.key ? state.positions[token.key] : null;
    if (!position) return false;
    const result = withUpdatedPositionMarketCapRange(position, token);
    if (!result.changed) return false;
    state.positions[token.key] = result.position;
    if (persistRange) runTask(persist());
    return true;
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
    const priceMovePct = calculatePriceMovePct(token.unitPriceNative, delayedToken.unitPriceNative);
    if (Math.abs(priceMovePct) > slippageLimit) {
      setStatus(`Execution cancelled: price moved ${Math.abs(priceMovePct).toFixed(2)}%.`);
      return null;
    }
    return { ...delayedToken, executionDelayMs: delayMs, priceMovePct };
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

  function calculatePriceMovePct(beforePrice, afterPrice) {
    const before = Number(beforePrice);
    const after = Number(afterPrice);
    if (!Number.isFinite(before) || before <= 0 || !Number.isFinite(after)) return 0;
    return round(((after - before) / before) * 100, 4);
  }

  function recordExecution(fields) {
    const usdPrice = DEFAULT_PRICES[fields.chain] || 1;
    const timestampMs = Date.now();
    const sourceMarketCapUsd = round(fields.token.marketCap, 2);
    const executionMarketCapUsd = Number(sourceMarketCapUsd) > 0
      ? sourceMarketCapUsd
      : round(fields.executionPriceNative * usdPrice * MARKET_CAP_SUPPLY, 2);
    const costBasisNative = round(fields.costBasisNative);
    const pnlNative = round(fields.pnlNative);
    const pnlPct = costBasisNative > 0 ? round((pnlNative / costBasisNative) * 100, 4) : 0;
    const execution = {
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
      marketCapUsd: sourceMarketCapUsd,
      sourceMarketCapUsd,
      executionMarketCapUsd,
      unitPriceNative: round(fields.executionPriceNative, 12),
      unitPriceUsd: round(fields.executionPriceNative * usdPrice, 12),
      requestedAmountNative: round(fields.requestedAmountNative),
      requestedSellPct: fields.requestedSellPct ?? null,
      tradeSizeNative: fields.side === "buy" ? round(fields.grossNative) : round(fields.netNative),
      solInvestedNative: fields.side === "buy" ? round(fields.grossNative) : 0,
      solDebitedNative: fields.side === "buy" ? round(Math.abs(fields.netNative)) : 0,
      solReceivedNative: fields.side === "sell" ? round(fields.netNative) : 0,
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
      priceMovePct: round(fields.priceMovePct, 4),
      executionDelayMs: fields.fees?.executionDelayMs ?? 0,
      tokenAmount: round(fields.tokenAmount, 12),
      costBasisNative,
      pnlNative,
      pnlPct,
      pnlUsd: round(fields.pnlNative * usdPrice),
      positionBefore: fields.positionBefore,
      positionAfter: fields.positionAfter,
    };
    state.executions.push(execution);
    return execution;
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

  function buildPositionSummary(positionId, statusOverride, positionState = null) {
    const executions = state.executions
      .filter((execution) => execution.positionId === positionId)
      .sort((a, b) => getExecutionTimestampMs(a) - getExecutionTimestampMs(b));
    return buildPositionSummaryFromExecutions(positionId, statusOverride, executions, positionState);
  }

  function buildPositionSummaryFromExecutions(positionId, statusOverride, executions, positionState = null) {
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
    const totalPlatformFeesNative = sum(executions, "platformFeeNative");
    const totalGasFeesNative = sum(executions, "gasFeeNative");
    const totalPriorityFeesNative = sum(executions, "priorityFeeNative");
    const totalBribeFeesNative = sum(executions, "bribeFeeNative");
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
      totalPlatformFeesNative: round(totalPlatformFeesNative),
      totalGasFeesNative: round(totalGasFeesNative),
      totalPriorityFeesNative: round(totalPriorityFeesNative),
      totalBribeFeesNative: round(totalBribeFeesNative),
      pnlPreFeeNative: round(pnlPreFeeNative),
      pnlPostFeeNative: round(pnlPostFeeNative),
      pnlPct: round(pnlPct, 4),
      entryMarketCapVwapUsd: round(weightedAverageFirst(buys, ["executionMarketCapUsd", "marketCapUsd"], "tokenAmount"), 2),
      exitMarketCapVwapUsd: round(weightedAverageFirst(sells, ["executionMarketCapUsd", "marketCapUsd"], "tokenAmount"), 2),
      entrySourceMarketCapVwapUsd: round(weightedAverage(buys, "marketCapUsd", "tokenAmount"), 2),
      exitSourceMarketCapVwapUsd: round(weightedAverage(sells, "marketCapUsd", "tokenAmount"), 2),
      highMarketCapAfterEntry: round(positionState?.highMarketCapAfterEntry, 2),
      highMarketCapAt: positionState?.highMarketCapAt || null,
      lowMarketCapAfterEntry: round(positionState?.lowMarketCapAfterEntry, 2),
      lowMarketCapAt: positionState?.lowMarketCapAt || null,
      avgEntryNative: round(weightedAverage(buys, "unitPriceNative", "tokenAmount"), 12),
      avgExitNative: round(weightedAverage(sells, "unitPriceNative", "tokenAmount"), 12),
      executionIds: executions.map((execution) => execution.id),
    };
  }

  function getPositionSummaries() {
    const open = Object.values(state.positions)
      .map((position) => buildPositionSummary(position.positionId, "open", position))
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
        highMarketCapAfterEntry: position.highMarketCapAfterEntry || 0,
        highMarketCapAt: position.highMarketCapAt || null,
        lowMarketCapAfterEntry: position.lowMarketCapAfterEntry || 0,
        lowMarketCapAt: position.lowMarketCapAt || null,
        id: position.id,
        platform: position.platform,
        pnlPercentage: position.pnlPct,
        pnlSol: position.pnlPostFeeNative,
        solInvested: position.investedNative + position.buyFeesNative,
        solReceived: position.netReceivedNative,
        buyFeesNative: position.buyFeesNative,
        sellFeesNative: position.sellFeesNative,
        timestamp: Date.parse(position.finalExitAt),
        entryTimestamp: Date.parse(position.firstEntryAt),
        firstEntryAt: position.firstEntryAt,
        timeInTradeSeconds: position.timeInTradeSeconds,
        tokenAddress: position.tokenAddress,
        tokenName: position.tokenName,
      }));
  }

  function sum(items, key) {
    return items.reduce((total, item) => total + Number(item[key] || 0), 0);
  }

  function sumFirst(items, keys) {
    return items.reduce((total, item) => {
      const value = keys.map((key) => Number(item[key] || 0)).find((candidate) => candidate > 0) || 0;
      return total + value;
    }, 0);
  }

  function weightedAverage(items, valueKey, weightKey) {
    const weighted = items.reduce((total, item) => total + Number(item[valueKey] || 0) * Number(item[weightKey] || 0), 0);
    const weight = sum(items, weightKey);
    return weight > 0 ? weighted / weight : 0;
  }

  function weightedAverageFirst(items, valueKeys, weightKey) {
    const weighted = items.reduce((total, item) => {
      const value = valueKeys.map((key) => Number(item[key] || 0)).find((candidate) => candidate > 0) || 0;
      return total + value * Number(item[weightKey] || 0);
    }, 0);
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
    const previousLastSyncedExecutionId = lastSyncedExecutionId;
    const isNewTradeExecution =
      (reason === "buy" || reason === "sell") &&
      latestExecution?.id &&
      latestExecution.id !== lastSyncedExecutionId;
    const shouldCaptureScreenshot = Boolean(state.settings.autoScreenshotOnTrade) && isNewTradeExecution;
    emitDiagnostic("persist-sync", {
      reason,
      latestExecutionId: latestExecution?.id || null,
      previousLastSyncedExecutionId,
      isNewTradeExecution: Boolean(isNewTradeExecution),
      shouldCaptureScreenshot,
      bridgeEnabled: Boolean(state.settings.bridgeEnabled),
      fallbackDownloadsEnabled: Boolean(state.settings.fallbackDownloadsEnabled),
    });
    if (latestExecution?.id) lastSyncedExecutionId = latestExecution.id;
    runTask(syncTradeArtifacts(reason, isNewTradeExecution ? latestExecution : null, shouldCaptureScreenshot));
  }

  function render() {
    if (!root || !state) return;
    const panelVisible = applyOverlayVisibility();
    updateActiveToken();
    updateActivePositionMarketCapRange();
    renderFloatingTracker();
    syncActiveAxiomChartArtifacts();
    if (!panelVisible) return;

    const tokenEl = root.querySelector(`#${selectors.token}`);
    const balanceEl = root.querySelector(`#${selectors.balance}`);
    const positionEl = root.querySelector(`#${selectors.position}`);
    const buyButtonsEl = root.querySelector("[data-buy-buttons]");
    const sellButtonsEl = root.querySelector("[data-sell-buttons]");
    const buyChainEl = root.querySelector("[data-buy-chain]");
    const sellAssetsEl = root.querySelector("[data-sell-assets]");
    const exitTargetSummaryEl = root.querySelector("[data-exit-target-summary]");
    const exitTargetListEl = root.querySelector("[data-exit-target-list]");
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
    const chartSummary = buildChartArtifactSummary(summary);
    const positionPnl = position ? calculateMarkedPositionMetrics(position, token) : null;
    const closedSummary = findLatestClosedTokenPositionSummary(token);
    const displayedPnl = positionPnl || closedSummary ? {
      totalPnlNative: positionPnl?.totalPnlNative ?? closedSummary.pnlPostFeeNative,
      totalPnlPct: positionPnl?.totalPnlPct ?? closedSummary.pnlPct,
    } : null;
    const pnlButton = root.querySelector("[data-action='view-closed-pnl']");

    tokenEl.textContent = token.address
      ? `${token.name} (${shortenAddress(token.address)})`
      : "Open a supported token page";
    balanceEl.textContent = `Bal ${formatters.compactNative(state.balances[token.chain] || 0, token.chain)}`;
    positionEl.classList.toggle("wt-pnl-up", Boolean(displayedPnl) && displayedPnl.totalPnlNative > 0);
    positionEl.classList.toggle("wt-pnl-down", Boolean(displayedPnl) && displayedPnl.totalPnlNative < 0);
    positionEl.classList.toggle("wt-pnl-flat", Boolean(displayedPnl) && displayedPnl.totalPnlNative === 0);
    positionEl.textContent = position
      ? `Pos ${formatters.native(position.costNative, token.chain)} ${formatters.pct(positionPnl.totalPnlPct)}`
      : closedSummary
        ? `Closed ${formatters.pct(closedSummary.pnlPct)}`
      : "Pos none";
    positionEl.title = position
      ? `Open P&L ${formatters.signedNative(positionPnl.totalPnlNative, token.chain)} (${formatters.pct(positionPnl.totalPnlPct)})`
      : closedSummary
        ? `Closed P&L ${formatters.signedNative(closedSummary.pnlPostFeeNative, closedSummary.chain)} (${formatters.pct(closedSummary.pnlPct)})`
      : "";
    if (pnlButton) pnlButton.hidden = !closedSummary;
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
      button.title = Math.round(Number(percent)) === 100
        ? "Right-click for 100% market-cap target and stop orders"
        : `Right-click for ${percent}% market-cap target orders`;
      button.addEventListener("contextmenu", handleSellButtonTargetContextEvent, true);
      sellButtonsEl.appendChild(button);
    });

    renderExitTargets(exitTargetSummaryEl, exitTargetListEl);

    if (logEl) {
      logEl.innerHTML = "";
      const recent = state.executions.slice(-1).reverse();
      recent.forEach((execution) => {
        const item = document.createElement("div");
        item.className = `wt-log-item wt-${execution.side}`;
        item.textContent = formatExecutionLogLine(execution, { compact: true });
        logEl.appendChild(item);
      });
    }
    syncAxiomNativeChartLines(chartSummary, token);
    syncAxiomExitTargetLines(token);
  }

  function syncActiveAxiomChartArtifacts() {
    if (!state || activeToken?.platform !== "axiom") return;
    if (!isAxiomMemeRoute(new URL(window.location.href))) return;

    const token = activeToken;
    const position = token.key ? state.positions[token.key] : null;
    const summary = position ? buildPositionSummary(position.positionId, "open") : findLatestTokenPositionSummary(token);
    syncAxiomNativeChartLines(buildChartArtifactSummary(summary), token);
    syncAxiomExitTargetLines(token);
  }

  function renderExitTargets(summaryEl, listEl) {
    const targets = getActiveExitTargets();
    if (summaryEl) summaryEl.textContent = targets.length ? `${targets.length} armed` : "None";
    if (!listEl) return;
    listEl.innerHTML = "";
    if (targets.length === 0) {
      const empty = document.createElement("div");
      empty.className = "wt-muted";
      empty.textContent = "No active target";
      listEl.appendChild(empty);
      return;
    }
    targets.forEach((target) => {
      const row = document.createElement("div");
      row.className = `wt-target-chip wt-${target.kind.replace("_", "-")}`;
      const label = document.createElement("span");
      label.textContent = `${target.kind === EXIT_TARGET_KINDS.takeProfit ? "TP" : "SL"} ${formatTargetSellPercent(target.sellPercent)} ${formatters.usd(target.marketCapUsd)}`;
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.action = "clear-exit-target";
      button.dataset.targetId = target.id;
      button.title = `Clear ${formatExitTargetKind(target.kind)} ${formatTargetSellPercent(target.sellPercent)}`;
      button.setAttribute("aria-label", `Clear ${formatExitTargetKind(target.kind)} ${formatTargetSellPercent(target.sellPercent)}`);
      button.textContent = "x";
      row.append(label, button);
      listEl.appendChild(row);
    });
  }

  function renderFloatingTracker() {
    const tracker = root?.querySelector(`.${selectors.tracker}`);
    if (!tracker || tracker.hidden) return;

    const metrics = buildFloatingTrackerMetrics();
    const portfolioEl = root.querySelector(`#${selectors.trackerPortfolio}`);
    const pnlEl = root.querySelector(`#${selectors.trackerPnl}`);
    const pctEl = root.querySelector(`#${selectors.trackerPct}`);
    const barEl = root.querySelector(`#${selectors.trackerBar}`);
    const direction = metrics.sessionPnlNative > 0 ? "up" : metrics.sessionPnlNative < 0 ? "down" : "flat";

    tracker.classList.toggle("wt-tracker-up", direction === "up");
    tracker.classList.toggle("wt-tracker-down", direction === "down");
    tracker.classList.toggle("wt-tracker-flat", direction === "flat");
    tracker.title = [
      `Paper balance ${formatTrackerNative(metrics.balanceNative, metrics.chain)}`,
      `Session PNL ${formatTrackerNative(metrics.sessionPnlNative, metrics.chain, true)} (${formatters.pct(metrics.sessionPnlPct)})`,
      `Realized ${formatTrackerNative(metrics.realizedPnlNative, metrics.chain, true)}`,
      `Marked open ${formatTrackerNative(metrics.markedOpenPnlNative, metrics.chain, true)}`,
    ].join("\n");

    if (portfolioEl) portfolioEl.textContent = formatTrackerNative(metrics.balanceNative, metrics.chain);
    if (pnlEl) pnlEl.textContent = formatTrackerNative(metrics.sessionPnlNative, metrics.chain, true);
    if (pctEl) pctEl.textContent = formatters.pct(metrics.sessionPnlPct);
    if (barEl) barEl.style.width = "100%";
  }

  function buildFloatingTrackerMetrics() {
    const latestExecution = state.executions[state.executions.length - 1] || null;
    const chain = activeToken?.chain || latestExecution?.chain || "SOL";
    const buys = state.executions.filter((execution) => execution.chain === chain && execution.side === "buy");
    const sells = state.executions.filter((execution) => execution.chain === chain && execution.side === "sell");
    const positions = Object.values(state.positions).filter((position) => position.chain === chain);
    const balanceNative = Number(state.balances[chain] || 0);
    let portfolioNative = balanceNative;
    let markedOpenPnlNative = 0;

    positions.forEach((position) => {
      const isActivePosition = activeToken?.key && (position.tokenKey === activeToken.key || state.positions[activeToken.key] === position);
      const markNative = isActivePosition && activeToken?.unitPriceNative
        ? Number(position.tokenAmount || 0) * Number(activeToken.unitPriceNative || 0)
        : Number(position.costNative || 0);
      portfolioNative += markNative;
      if (isActivePosition && activeToken?.unitPriceNative) {
        markedOpenPnlNative += markNative - Number(position.costNative || 0);
      }
    });

    const buyFeesNative = sum(buys, "feeNative");
    const realizedPnlNative = sum(sells, "pnlNative") - buyFeesNative;
    const sessionPnlNative = realizedPnlNative + markedOpenPnlNative;
    const sessionBasisNative = portfolioNative - sessionPnlNative;
    const sessionPnlPct = sessionBasisNative > 0 ? (sessionPnlNative / sessionBasisNative) * 100 : 0;

    return {
      chain,
      balanceNative: round(balanceNative, 2),
      portfolioNative: round(portfolioNative, 2),
      realizedPnlNative: round(realizedPnlNative, 2),
      markedOpenPnlNative: round(markedOpenPnlNative, 2),
      sessionPnlNative: round(sessionPnlNative, 2),
      sessionPnlPct: round(sessionPnlPct, 2),
    };
  }

  function formatTrackerNative(value, chain, signed = false) {
    const numeric = Number(value || 0);
    const sign = signed && numeric > 0 ? "+" : signed && numeric < 0 ? "-" : "";
    return `${sign}${Math.abs(numeric).toFixed(2)} ${chain}`;
  }

  function calculateMarkedPositionMetrics(position, token) {
    const positionExecutions = state.executions.filter((execution) => execution.positionId === position.positionId);
    const buys = positionExecutions.filter((execution) => execution.side === "buy");
    const sells = positionExecutions.filter((execution) => execution.side === "sell");
    const buyFeesNative = sum(buys, "feeNative");
    const realizedPnlNative = sum(sells, "pnlNative") - buyFeesNative;
    const markNative = token?.unitPriceNative
      ? Number(position.tokenAmount || 0) * Number(token.unitPriceNative || 0)
      : Number(position.costNative || 0);
    const markedOpenPnlNative = markNative - Number(position.costNative || 0);
    const totalPnlNative = realizedPnlNative + markedOpenPnlNative;
    const basisNative = sumFirst(buys, ["solInvestedNative", "grossNative"]) + buyFeesNative;
    const totalPnlPct = basisNative > 0 ? (totalPnlNative / basisNative) * 100 : 0;

    return {
      realizedPnlNative: round(realizedPnlNative),
      markedOpenPnlNative: round(markedOpenPnlNative),
      totalPnlNative: round(totalPnlNative),
      totalPnlPct: round(totalPnlPct, 4),
    };
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

  function findLatestClosedTokenPositionSummary(token) {
    if (!token?.key) return null;
    return state.closedPositions
      .filter((position) => position.status === "closed" && position.finalExitAt && position.tokenAddress === token.address && position.chain === token.chain)
      .sort((a, b) => Date.parse(b.finalExitAt || b.firstEntryAt || "") - Date.parse(a.finalExitAt || a.firstEntryAt || ""))[0] || null;
  }

  function buildChartArtifactSummary(summary) {
    if (!summary?.id) return null;
    const executionIds = new Set(summary?.executionIds || []);
    if (executionIds.size === 0) return null;
    const cutoffMs = getChartArtifactCutoffMs();
    const chartExecutions = state.executions
      .filter((execution) => executionIds.has(execution.id) && getExecutionTimestampMs(execution) >= cutoffMs)
      .sort((a, b) => getExecutionTimestampMs(a) - getExecutionTimestampMs(b));
    return buildPositionSummaryFromExecutions(summary.id, summary.status, chartExecutions);
  }

  function getChartArtifactCutoffMs() {
    const sessionStartedMs = Date.parse(state?.sessionStartedAt || "");
    return Math.max(CHART_ARTIFACT_PAGE_STARTED_MS, Number.isFinite(sessionStartedMs) ? sessionStartedMs : 0);
  }

  function getExecutionTimestampMs(execution) {
    const timestampMs = Number(execution?.timestampMs);
    if (Number.isFinite(timestampMs) && timestampMs > 0) return timestampMs;
    const parsed = Date.parse(execution?.timestamp || "");
    return Number.isFinite(parsed) ? parsed : 0;
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

  function syncAxiomNativeChartLines(summary, token) {
    if (token?.platform !== "axiom") return;
    if (!summary?.id) {
      lastAxiomChartArtifactKey = null;
      postAxiomChartBridgeMessage({ op: "clearAll" });
      return;
    }
    if (lastAxiomChartArtifactKey !== summary.id) {
      lastAxiomChartArtifactKey = summary.id;
      postAxiomChartBridgeMessage({ op: "clearAll" });
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
    syncAxiomExecutionMarkers(summary, token);
  }

  function syncAxiomExitTargetLines(token) {
    if (token?.platform !== "axiom") return;
    const targets = getActiveExitTargets();
    const syncKey = targets
      .map((target) => `${target.id}:${target.kind}:${round(target.marketCapUsd, 2)}:${round(target.sellPercent, 2)}`)
      .sort()
      .join("|");
    if (lastAxiomExitTargetSyncKey === syncKey) return;
    lastAxiomExitTargetSyncKey = syncKey;

    const nextLineKeys = new Set(targets.map((target) => axiomExitTargetLineKey(target)));
    lastAxiomExitTargetLineKeys.forEach((key) => {
      if (nextLineKeys.has(key)) return;
      const [positionId, kind] = key.split("|");
      if (positionId && kind) postAxiomChartBridgeMessage({ op: "remove", positionId, kind });
    });

    targets.forEach((target) => {
      postAxiomChartBridgeMessage({
        op: "upsert",
        positionId: target.id,
        kind: target.kind,
        price: target.marketCapUsd,
        style: buildAxiomExitTargetLineStyle(target),
      });
    });
    lastAxiomExitTargetLineKeys = nextLineKeys;
  }

  function axiomExitTargetLineKey(target) {
    return `${target.id}|${target.kind}`;
  }

  function buildAxiomExitTargetLineStyle(target) {
    const isTakeProfit = target.kind === EXIT_TARGET_KINDS.takeProfit;
    return {
      color: isTakeProfit ? "#31e6ba" : "#ff3d8f",
      lineWidth: 2,
      lineStyle: "solid",
      labelText: `${isTakeProfit ? "WT TARGET" : "WT STOP"} ${formatTargetSellPercent(target.sellPercent)} ${formatters.usd(target.marketCapUsd)}`,
      labelBackground: isTakeProfit ? "rgba(49, 230, 186, 0.86)" : "rgba(255, 61, 143, 0.86)",
      labelAlign: "center",
      showPrice: true,
      movable: true,
    };
  }

  function syncAxiomExecutionMarkers(summary, token) {
    const executionIds = new Set(summary.executionIds || []);
    const cutoffMs = getChartArtifactCutoffMs();
    state.executions
      .filter((execution) => executionIds.has(execution.id) && getExecutionTimestampMs(execution) >= cutoffMs)
      .forEach((execution) => {
        const price = getAxiomExecutionMarkerPrice(execution, token);
        const time = Math.floor((getExecutionTimestampMs(execution) || Date.now()) / 1000);
        if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(time)) return;
        postAxiomChartBridgeMessage({
          op: "upsertMarker",
          positionId: summary.id,
          markerId: execution.id,
          side: execution.side,
          time,
          price,
          style: buildAxiomExecutionMarkerStyle(execution, price),
        });
      });
  }

  function getAxiomChartPrice(summary, side, token) {
    const marketCap = side === "entry" ? summary.entryMarketCapVwapUsd : summary.exitMarketCapVwapUsd;
    if (Number(marketCap) > 0) return Number(marketCap);

    const avgNative = side === "entry" ? summary.avgEntryNative : summary.avgExitNative;
    const chainUsd = DEFAULT_PRICES[token.chain] || 1;
    const estimatedMarketCap = Number(avgNative || 0) * chainUsd * MARKET_CAP_SUPPLY;
    return Number.isFinite(estimatedMarketCap) && estimatedMarketCap > 0 ? estimatedMarketCap : 0;
  }

  function getAxiomExecutionMarkerPrice(execution, token) {
    const marketCap = Number(execution.executionMarketCapUsd || execution.marketCapUsd || execution.sourceMarketCapUsd || 0);
    if (marketCap > 0) return marketCap;
    const unitNative = Number(execution.unitPriceNative || 0);
    const chainUsd = DEFAULT_PRICES[token.chain] || 1;
    const estimatedMarketCap = unitNative * chainUsd * MARKET_CAP_SUPPLY;
    return Number.isFinite(estimatedMarketCap) && estimatedMarketCap > 0 ? estimatedMarketCap : 0;
  }

  function buildAxiomChartLineStyle(kind, price) {
    const isEntry = kind === "avg_entry";
    return {
      color: isEntry ? "#22c55e" : "#ef4444",
      lineWidth: 1,
      lineStyle: "dashed",
      labelText: `${isEntry ? "AVG ENTRY" : "AVG EXIT"} ${formatters.usd(price)}`,
      labelBackground: isEntry ? "rgba(34, 197, 94, 0.86)" : "rgba(239, 68, 68, 0.86)",
      labelAlign: isEntry ? "left" : "center",
      showPrice: true,
      movable: true,
    };
  }

  function buildAxiomExecutionMarkerStyle(execution, price) {
    const isBuy = execution.side === "buy";
    return {
      color: isBuy ? "#22c55e" : "#ef4444",
      shape: "flag",
      text: `${isBuy ? "BUY" : "SELL"} ${formatters.usd(price)}`,
      background: isBuy ? "rgba(34, 197, 94, 0.9)" : "rgba(239, 68, 68, 0.9)",
      textColor: "#ffffff",
      fontSize: 10,
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
      item.textContent = formatExecutionLogLine(execution);
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
      ["Buy Gross", formatters.native(summary.totalInvestedNative, summary.chain, 3)],
      ["Sell Net", formatters.native(summary.totalReceivedNative, summary.chain, 3)],
      ["Entry MC", summary.entryMarketCapVwapUsd ? formatters.usd(summary.entryMarketCapVwapUsd) : "-"],
      ["Exit MC", summary.exitMarketCapVwapUsd ? formatters.usd(summary.exitMarketCapVwapUsd) : "-"],
      ["Fees", formatters.native(summary.totalFeesNative, summary.chain)],
      ["Net P&L", formatters.native(summary.totalPnlNative, summary.chain, 3)],
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
        const context = formatSessionTradeContext(session);
        item.textContent = [
          `${new Date(session.endedAt).toLocaleString()} - ${session.executionCount} trades`,
          `Total ${formatters.signedNative(session.totalPnlNative, session.chain, 2)}`,
          context,
        ].filter(Boolean).join(" - ");
        summaryEl.appendChild(item);
      });
    }
  }

  function renderClosedPnl(summary) {
    const container = root.querySelector("[data-closed-pnl]");
    const tokenEl = root.querySelector("[data-pnl-token]");
    if (!container || !summary) return;

    const chain = summary.chain || activeToken?.chain || "SOL";
    const pnlNative = Number(summary.pnlPostFeeNative || 0);
    const directionClass = getPnlDirectionClass(pnlNative);
    const executions = getSummaryExecutions(summary);
    const ledger = buildRoundTripLedger(summary, executions, chain);

    if (tokenEl) {
      tokenEl.textContent = [
        summary.tokenName || activeToken?.name || shortenAddress(summary.tokenAddress),
        summary.finalExitAt ? new Date(summary.finalExitAt).toLocaleString() : "",
      ].filter(Boolean).join(" - ");
    }

    container.innerHTML = "";
    const hero = document.createElement("section");
    hero.className = `wt-pnl-hero ${directionClass}`;

    const pnlValue = document.createElement("strong");
    pnlValue.textContent = formatters.signedNative(pnlNative, chain, 4);
    hero.appendChild(pnlValue);

    const pnlMeta = document.createElement("span");
    pnlMeta.textContent = `${formatters.pct(summary.pnlPct || 0)} net wallet P&L after fees`;
    hero.appendChild(pnlMeta);
    container.appendChild(hero);

    const stats = document.createElement("div");
    stats.className = "wt-pnl-stats";
    [
      ["Buy gross exposure", formatters.native(summary.investedNative || 0, chain, 4)],
      ["Buy wallet debit", formatters.native(ledger.buyWalletDebitNative, chain, 4)],
      ["Sell gross value", formatters.native(summary.grossReceivedNative || 0, chain, 4)],
      ["Sell net received", formatters.native(summary.netReceivedNative || 0, chain, 4)],
      ["Entry fees", formatters.native(summary.buyFeesNative || 0, chain, 4)],
      ["Exit fees", formatters.native(summary.sellFeesNative || 0, chain, 4)],
      ["Platform fees", formatters.native(summary.totalPlatformFeesNative || 0, chain, 4)],
      ["Fixed fees", formatters.native(
        Number(summary.totalGasFeesNative || 0) +
        Number(summary.totalPriorityFeesNative || 0) +
        Number(summary.totalBribeFeesNative || 0),
        chain,
        4
      )],
      ["Gross price P&L", formatters.signedNative(summary.pnlPreFeeNative || 0, chain, 4)],
      ["Fee drag", formatters.signedNative(-ledger.totalFeesNative, chain, 4)],
      ["Hold Time", formatClosedPositionHoldTime(summary)],
      ["Legs", `${summary.buyCount || 0} buys / ${summary.sellCount || 0} sells`],
    ].forEach(([label, value]) => stats.appendChild(createPnlStat(label, value)));
    container.appendChild(stats);

    const feeNote = document.createElement("div");
    feeNote.className = "wt-pnl-note";
    feeNote.textContent = [
      `Current simulator model: buy buttons create ${formatters.native(summary.investedNative || 0, chain, 4)} of token exposure, then fees are charged on top as wallet debit.`,
      `Break-even gross exit value for this exact round trip was ${formatters.native(ledger.breakEvenGrossExitNative, chain, 4)} before profit.`,
    ].join(" ");
    container.appendChild(feeNote);

    const title = document.createElement("div");
    title.className = "wt-pnl-subtitle";
    title.textContent = "Round Trip Cash-Flow Ledger";
    container.appendChild(title);

    const legList = document.createElement("div");
    legList.className = "wt-pnl-leg-list";
    if (ledger.rows.length === 0) {
      const empty = document.createElement("div");
      empty.className = "wt-muted";
      empty.textContent = "No execution legs recorded for this position.";
      legList.appendChild(empty);
    } else {
      ledger.rows.forEach((row) => legList.appendChild(createExecutionLedgerRow(row, chain)));
    }
    container.appendChild(legList);
  }

  function createPnlStat(label, value) {
    const item = document.createElement("div");
    item.className = "wt-pnl-stat";
    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    const valueEl = document.createElement("strong");
    valueEl.textContent = value;
    item.append(labelEl, valueEl);
    return item;
  }

  function createExecutionLedgerRow(ledgerRow, chain) {
    const execution = ledgerRow.execution;
    const pnlNative = Number(ledgerRow.runningPnlNative || 0);
    const row = document.createElement("div");
    row.className = `wt-pnl-leg ${getPnlDirectionClass(pnlNative)}`;

    const header = document.createElement("div");
    header.className = "wt-pnl-leg-header";
    const title = document.createElement("strong");
    title.textContent = formatLedgerLegTitle(ledgerRow);
    const pnl = document.createElement("span");
    pnl.textContent = `Run P&L ${formatters.signedNative(ledgerRow.runningPnlNative, chain, 4)}`;
    header.append(title, pnl);

    const details = document.createElement("div");
    details.className = "wt-pnl-leg-details";
    getLedgerLegStats(ledgerRow, chain).forEach(([label, value]) => {
      details.appendChild(createPnlStat(label, value));
    });

    row.append(header, details);
    return row;
  }

  function buildRoundTripLedger(summary, executions, chain) {
    let runningPnlNative = 0;
    let buyWalletDebitNative = 0;
    const sideCounts = { buy: 0, sell: 0 };
    const rows = executions.map((execution, index) => {
      const feeNative = Number(execution.feeNative || 0);
      sideCounts[execution.side] = (sideCounts[execution.side] || 0) + 1;
      if (execution.side === "buy") {
        buyWalletDebitNative += Math.abs(Number(execution.netNative || execution.solDebitedNative || 0));
        runningPnlNative -= feeNative;
      } else {
        runningPnlNative += Number(execution.pnlNative || 0);
      }
      return {
        execution,
        index,
        sideIndex: sideCounts[execution.side],
        runningPnlNative: round(runningPnlNative),
        fixedFeeNative: round(
          Number(execution.gasFeeNative || 0) +
          Number(execution.priorityFeeNative || 0) +
          Number(execution.bribeFeeNative || 0)
        ),
      };
    });
    const totalFeesNative = Number(summary.totalFeesNative || 0);
    const investedNative = Number(summary.investedNative || 0);
    const breakEvenGrossExitNative = investedNative + totalFeesNative;
    return {
      chain,
      rows,
      buyWalletDebitNative: round(buyWalletDebitNative),
      totalFeesNative: round(totalFeesNative),
      breakEvenGrossExitNative: round(breakEvenGrossExitNative),
    };
  }

  function formatLedgerLegTitle(ledgerRow) {
    const execution = ledgerRow.execution;
    const side = execution.side === "buy" ? "Buy" : "Sell";
    const pct = execution.side === "sell" && execution.requestedSellPct ? ` ${Number(execution.requestedSellPct).toFixed(0)}%` : "";
    const time = execution.timestamp ? ` - ${new Date(execution.timestamp).toLocaleTimeString()}` : "";
    return `${side} ${ledgerRow.sideIndex || ledgerRow.index + 1}${pct}${time}`;
  }

  function getLedgerLegStats(ledgerRow, chain) {
    const execution = ledgerRow.execution;
    const feeStats = [
      ["Platform fee", formatters.native(execution.platformFeeNative || 0, chain, 4)],
      ["Fixed fees", formatters.native(ledgerRow.fixedFeeNative || 0, chain, 4)],
      ["Gas / prio / bribe", [
        formatters.native(execution.gasFeeNative || 0, chain, 4),
        formatters.native(execution.priorityFeeNative || 0, chain, 4),
        formatters.native(execution.bribeFeeNative || 0, chain, 4),
      ].join(" / ")],
      ["Total fee", formatters.native(execution.feeNative || 0, chain, 4)],
    ];
    if (execution.side === "buy") {
      return [
        ["Token exposure", formatters.native(execution.grossNative || execution.solInvestedNative || 0, chain, 4)],
        ["Wallet debit", formatters.native(Math.abs(Number(execution.netNative || execution.solDebitedNative || 0)), chain, 4)],
        ...feeStats,
        ["Fill", formatMarketCapFill(execution)],
      ];
    }
    return [
      ["Gross sell value", formatters.native(execution.grossNative || 0, chain, 4)],
      ["Wallet received", formatters.native(execution.netNative || execution.solReceivedNative || 0, chain, 4)],
      ["Cost basis", formatters.native(execution.costBasisNative || 0, chain, 4)],
      ["Leg P&L", `${formatters.signedNative(execution.pnlNative || 0, chain, 4)} (${formatters.pct(execution.pnlPct || 0)})`],
      ...feeStats,
      ["Fill", formatMarketCapFill(execution)],
    ];
  }

  function getSummaryExecutions(summary) {
    const executionIds = new Set(summary?.executionIds || []);
    return state.executions
      .filter((execution) => executionIds.size > 0 ? executionIds.has(execution.id) : execution.positionId === summary.id)
      .sort((a, b) => getExecutionTimestampMs(a) - getExecutionTimestampMs(b));
  }

  function getPnlDirectionClass(value) {
    const numeric = Number(value || 0);
    if (numeric > 0) return "wt-pnl-up";
    if (numeric < 0) return "wt-pnl-down";
    return "wt-pnl-flat";
  }

  function formatClosedPositionHoldTime(summary) {
    if (Number.isFinite(Number(summary?.timeInTradeSeconds))) {
      return formatDuration(Number(summary.timeInTradeSeconds) * 1000);
    }
    const firstEntryMs = Date.parse(summary?.firstEntryAt || "");
    const finalExitMs = Date.parse(summary?.finalExitAt || "");
    if (!Number.isFinite(firstEntryMs) || !Number.isFinite(finalExitMs)) return "-";
    return formatDuration(finalExitMs - firstEntryMs);
  }

  function buildCurrentSessionSummary() {
    const chain = activeToken?.chain || state.executions[state.executions.length - 1]?.chain || "SOL";
    const buys = state.executions.filter((execution) => execution.side === "buy");
    const sells = state.executions.filter((execution) => execution.side === "sell");
    const positionSummaries = getPositionSummaries();
    const buyFeesNative = sum(buys, "feeNative");
    const realizedPnlNative = sum(sells, "pnlNative") - buyFeesNative;
    const totalFeesNative = sum(state.executions, "feeNative");
    const totalInvestedNative = sumFirst(buys, ["solInvestedNative", "grossNative"]);
    const totalReceivedNative = sumFirst(sells, ["solReceivedNative", "netNative"]);
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
      totalInvestedNative: round(totalInvestedNative),
      totalReceivedNative: round(totalReceivedNative),
      entryMarketCapVwapUsd: round(weightedAverageFirst(buys, ["executionMarketCapUsd", "marketCapUsd"], "tokenAmount"), 2),
      exitMarketCapVwapUsd: round(weightedAverageFirst(sells, ["executionMarketCapUsd", "marketCapUsd"], "tokenAmount"), 2),
      latestExecution: state.executions[state.executions.length - 1] || null,
      positionSummaries,
      elapsedMs: Date.now() - (Date.parse(state.sessionStartedAt || "") || Date.now()),
    };
  }

  function formatExecutionLogLine(execution, options = {}) {
    const tokenName = execution.tokenName || shortenAddress(execution.tokenAddress);
    const time = options.compact ? "" : `${new Date(execution.timestamp).toLocaleTimeString()} `;
    const size = execution.side === "buy"
      ? `In ${formatters.native(execution.solInvestedNative || execution.grossNative, execution.chain)}`
      : `Out ${formatters.native(execution.solReceivedNative || execution.netNative, execution.chain)} net`;
    const pnl = execution.side === "sell"
      ? `PnL ${formatters.signedNative(execution.pnlNative, execution.chain)} (${formatters.pct(execution.pnlPct || 0)})`
      : "Entry";
    return [
      `${time}${execution.side.toUpperCase()} ${tokenName}`,
      size,
      formatMarketCapFill(execution),
      `fees ${formatters.native(execution.feeNative, execution.chain)}`,
      `move ${formatters.pct(execution.priceMovePct || 0)} / max ${Number(execution.maxSlippagePct ?? 0).toFixed(2)}%`,
      `delay ${execution.executionDelayMs || 0}ms`,
      pnl,
    ].join(" - ");
  }

  function formatMarketCapFill(execution) {
    const source = Number(execution?.sourceMarketCapUsd || execution?.marketCapUsd || 0);
    const fill = Number(execution?.executionMarketCapUsd || execution?.marketCapUsd || 0);
    if (source > 0 && fill > 0 && Math.abs(source - fill) / Math.max(source, 1) > 0.0001) {
      return `shown MC ${formatters.usd(source)} -> fill MC ${formatters.usd(fill)}`;
    }
    if (fill > 0) return `fill MC ${formatters.usd(fill)}`;
    if (source > 0) return `shown MC ${formatters.usd(source)}`;
    return "MC unavailable";
  }

  function formatSessionTradeContext(session) {
    const positions = Array.isArray(session.positionSummaries) ? session.positionSummaries : [];
    const latestPosition = positions.slice().reverse().find((position) => position?.buyCount || position?.sellCount);
    if (latestPosition) {
      return [
        latestPosition.tokenName,
        `In ${formatters.native(latestPosition.investedNative || 0, latestPosition.chain || session.chain)}`,
        latestPosition.entryMarketCapVwapUsd ? `Entry ${formatters.usd(latestPosition.entryMarketCapVwapUsd)}` : "",
        latestPosition.sellCount > 0 ? `Out ${formatters.native(latestPosition.netReceivedNative || 0, latestPosition.chain || session.chain)}` : "",
        latestPosition.exitMarketCapVwapUsd ? `Exit ${formatters.usd(latestPosition.exitMarketCapVwapUsd)}` : "",
        `PnL ${formatters.signedNative(latestPosition.pnlPostFeeNative || 0, latestPosition.chain || session.chain)} (${formatters.pct(latestPosition.pnlPct || 0)})`,
      ].filter(Boolean).join(" ");
    }
    if (session.latestExecution) return formatExecutionLogLine(session.latestExecution, { compact: true });
    return "";
  }

  function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
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

  function buildExportPayload(reason = "manual", eventExecution = null, captureScreenshot = false, screenshot = null) {
    const positions = getPositionSummaries();
    return {
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      source: `wilytrader-${activeToken?.platform || "supported"}-extension`,
      privacy: "local-only; no backend sync; optional localhost WilyTrader bridge",
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
      screenshot,
      balances: state.balances,
      openPositions: positions.filter((position) => position.status === "open"),
      closedPositions: positions.filter((position) => position.status === "closed"),
      positions,
      exitTargets: state.exitTargets,
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

  async function captureBridgeScreenshot(captureScreenshot) {
    if (!captureScreenshot) return null;
    const captureRect = detectBestChartCaptureRect();
    const response = await sendRuntimeMessage({
      type: "WILYTRADER_CAPTURE_SCREENSHOT",
      captureRect,
    });
    if (!response?.ok || !response.dataUrl) {
      return {
        dataUrl: null,
        capturedAt: new Date().toISOString(),
        capturedAtMs: Date.now(),
        captureRect,
        source: "chrome-tabs-captureVisibleTab",
        error: response?.error || "Chrome screenshot capture returned no image data.",
      };
    }
    return {
      dataUrl: response.dataUrl,
      capturedAt: response.capturedAt,
      capturedAtMs: response.capturedAtMs,
      capturedOffsetMs: Number.isFinite(response.capturedAtMs)
        ? response.capturedAtMs - (Date.parse(state.sessionStartedAt || "") || response.capturedAtMs)
        : null,
      captureRect: response.captureRect || null,
      source: response.source || "chrome-tab-capture",
    };
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
      runTask(sendDesktopExtensionStatus("update-check"));
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

  async function sendDesktopExtensionStatus(reason = "heartbeat") {
    if (!extensionContextValid) return;
    try {
      const manifest = chrome?.runtime?.getManifest?.() || {};
      const token = (updateActiveToken(), activeToken);
      await fetch(`${BRIDGE_BASE_URL}/extension-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          name: manifest.name || "WilyTrader",
          installedVersion: manifest.version || null,
          extensionId: chrome?.runtime?.id || null,
          pageUrl: window.location.href,
          tokenName: token?.key ? token.name : null,
          tokenAddress: token?.key ? token.address : null,
          tokenChain: token?.key ? token.chain : null,
          checkedAt: new Date().toISOString(),
          updateState,
        }),
      });
    } catch {
      // Desktop may not be running; this heartbeat is best-effort only.
    }
  }

  function bindDesktopStatusHeartbeat() {
    window.setInterval(() => {
      if (!extensionContextValid) return;
      runTask(sendDesktopExtensionStatus("heartbeat"));
    }, DESKTOP_STATUS_HEARTBEAT_MS);
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
    emitDiagnostic("sync-artifacts-start", {
      reason,
      eventExecutionId: eventExecution?.id || null,
      captureScreenshot: Boolean(captureScreenshot),
      bridgeEnabled: Boolean(state?.settings?.bridgeEnabled),
      fallbackDownloadsEnabled: Boolean(state?.settings?.fallbackDownloadsEnabled),
    });
    const bridgeSynced = await syncBridge(reason, eventExecution, captureScreenshot);
    if (!bridgeSynced && eventExecution && state?.settings?.fallbackDownloadsEnabled) {
      emitDiagnostic("sync-artifacts-fallback", {
        reason,
        eventExecutionId: eventExecution.id,
        captureScreenshot: Boolean(captureScreenshot),
      });
      await saveFallbackTradeArtifacts(reason, eventExecution, captureScreenshot);
    }
    emitDiagnostic("sync-artifacts-complete", {
      reason,
      eventExecutionId: eventExecution?.id || null,
      bridgeSynced,
    });
  }

  async function syncBridge(reason, eventExecution = null, captureScreenshot = false) {
    if (!extensionContextValid) return false;
    if (!state?.settings?.bridgeEnabled && !eventExecution) {
      emitDiagnostic("bridge-skip-disabled", { reason, eventExecutionId: null });
      return false;
    }
    try {
      emitDiagnostic("bridge-post-start", {
        reason,
        eventExecutionId: eventExecution?.id || null,
        captureScreenshot: Boolean(captureScreenshot),
        bridgeEnabled: Boolean(state?.settings?.bridgeEnabled),
      });
      const screenshot = await captureBridgeScreenshot(captureScreenshot);
      const response = await fetch(`${BRIDGE_BASE_URL}/ledger`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildExportPayload(reason, eventExecution, captureScreenshot, screenshot)),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json().catch(() => ({}));
      bridgeState = {
        active: true,
        lastMessage: data.sessionDir ? "WilyTrader bridge synced" : "WilyTrader bridge active",
      };
      emitDiagnostic("bridge-post-success", {
        reason,
        eventExecutionId: eventExecution?.id || null,
        sessionDir: data.sessionDir || null,
        ledgerPath: data.ledgerPath || null,
        screenshotPath: data.screenshotPath || null,
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "unknown error");
      bridgeState = { active: false, lastMessage: `WilyTrader bridge not connected: ${message}` };
      emitDiagnostic("bridge-post-failed", {
        reason,
        eventExecutionId: eventExecution?.id || null,
        error: message,
      });
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

  async function startNewSession(options = {}) {
    const confirmMessage = options.confirmMessage || "End this session and start a new one? Current trades and notes will be archived as a previous session summary.";
    if (!window.confirm(confirmMessage)) return;
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
    state.exitTargets = {};
    state.notes = [];
    lastAxiomExitTargetSyncKey = null;
    state.sessionStartedAt = new Date().toISOString();
    await persistAndSync("new-session");
    renderFullLog();
    render();
    setStatus(options.statusMessage || "New session started.");
  }

  async function clearTradeLog() {
    if (!window.confirm("Clear paper ledger, notes, open positions, and previous sessions?")) return;
    state.sessions = [];
    state.executions = [];
    state.closedPositions = [];
    state.positions = {};
    state.exitTargets = {};
    state.notes = [];
    lastAxiomExitTargetSyncKey = null;
    state.sessionStartedAt = new Date().toISOString();
    await persistAndSync("clear");
    renderFullLog();
    render();
    setStatus("Paper ledger cleared.");
  }

  function bindRouteWatcher() {
    window.setInterval(() => {
      if (!extensionContextValid) return;
      const routeKey = `${window.location.href}|${document.title}|${round(detectMarketCap() || 0, 2)}`;
      if (routeKey !== lastRouteKey) {
        lastRouteKey = routeKey;
        injectAxiomChartBridgeScript();
        updateActiveToken();
        render();
        schedulePendingPulseAutoBuyCheck();
      }
    }, 1000);
  }

  function bindLivePositionWatcher() {
    window.setInterval(() => {
      if (!extensionContextValid) return;
      updateActiveToken();
      const token = activeToken;
      if (!token?.key || !state?.positions?.[token.key]) return;
      render();
      emitLivePositionDiagnostic("live-position-watcher");
    }, 1000);
  }

  function emitLivePositionDiagnostic(reason) {
    const token = activeToken;
    const position = token?.key ? state?.positions?.[token.key] : null;
    if (!token?.key || !position) return;
    const pnl = calculateMarkedPositionMetrics(position, token);
    const marketCaps = buildMarketCapDiagnostics();
    const now = Date.now();
    const key = [
      token.key,
      round(token.marketCap, 2),
      round(token.unitPriceNative, 12),
      round(pnl.totalPnlNative, 8),
      round(pnl.totalPnlPct, 4),
      marketCaps.axiomTitle,
      marketCaps.axiomVisible,
    ].join("|");
    if (key === lastLivePositionDiagnosticKey && now - lastLivePositionDiagnosticAt < LIVE_POSITION_DIAGNOSTIC_MS) return;
    lastLivePositionDiagnosticKey = key;
    lastLivePositionDiagnosticAt = now;
    emitDiagnostic("live-position", {
      reason,
      token: summarizeToken(token),
      position: summarizePosition(position),
      marketCaps,
      pnl,
    });
  }

  function bindExitTargetWatcher() {
    window.setInterval(() => {
      if (!extensionContextValid) return;
      runTask(evaluateExitTargets());
    }, AXIOM_TARGET_TRIGGER_INTERVAL_MS);
  }

  async function evaluateExitTargets() {
    if (targetExitInFlight || tradeInFlight) return;
    if (!isAxiomMemeRoute(new URL(window.location.href))) return;
    updateActiveToken();
    const token = activeToken;
    const marketCapUsd = Number(token?.marketCap || 0);
    if (!token?.key || !Number.isFinite(marketCapUsd) || marketCapUsd <= 0) return;
    const position = state.positions[token.key];
    if (!position) return;
    const targets = Object.values(state.exitTargets || {})
      .filter((target) => target?.positionId === position.positionId && !target.triggeredAt)
      .sort((a, b) => targetTriggerPriority(a, b, marketCapUsd));
    const triggered = targets.find((target) => isExitTargetTriggered(target, marketCapUsd));
    if (!triggered) return;
    targetExitInFlight = triggered.id;
    triggered.triggeredAt = new Date().toISOString();
    try {
      await persistAndSync("exit-target-triggered");
      const sellPercent = normalizeTargetSellPercent(triggered.sellPercent);
      setStatus(`${formatExitTargetKind(triggered.kind)} ${formatTargetSellPercent(sellPercent)} touched ${formatters.usd(triggered.marketCapUsd)}.`);
      const execution = await sell(sellPercent);
      if (!execution && state.exitTargets[targetExitInFlight]) {
        state.exitTargets[targetExitInFlight].triggeredAt = null;
        await persistAndSync("exit-target-rearmed");
      } else if (execution && state.exitTargets[triggered.id]) {
        delete state.exitTargets[triggered.id];
        lastAxiomExitTargetSyncKey = null;
        await persistAndSync("exit-target-filled");
        render();
      }
    } finally {
      targetExitInFlight = null;
    }
  }

  function isExitTargetTriggered(target, marketCapUsd) {
    if (target.kind === EXIT_TARGET_KINDS.takeProfit) return marketCapUsd >= Number(target.marketCapUsd || 0);
    if (target.kind === EXIT_TARGET_KINDS.stopLoss) return marketCapUsd <= Number(target.marketCapUsd || 0);
    return false;
  }

  function targetTriggerPriority(a, b, marketCapUsd) {
    const aDistance = Math.abs(Number(a.marketCapUsd || 0) - marketCapUsd);
    const bDistance = Math.abs(Number(b.marketCapUsd || 0) - marketCapUsd);
    return aDistance - bDistance;
  }

  function applyPanelPosition(panel) {
    if (panel && state?.settings?.panelPosition) panel.style.transformOrigin = "top left";
    applySavedPosition(panel, state?.settings?.panelPosition);
  }

  function applyPanelScale(panel) {
    if (!panel) return;
    const scale = normalizePanelScale(state?.settings?.panelScale);
    state.settings.panelScale = scale;
    panel.style.setProperty("--wt-panel-scale", String(scale));
    panel.style.transformOrigin = state.settings.panelPosition ? "top left" : "bottom right";
  }

  function applyTrackerPosition(tracker) {
    applySavedPosition(tracker, state?.settings?.trackerPosition);
  }

  function applySavedPosition(element, position) {
    if (!element || !position) return;
    const { left, top } = position;
    if (!Number.isFinite(left) || !Number.isFinite(top)) return;
    const next = clampElementPosition(element, left, top);
    element.style.right = "auto";
    element.style.bottom = "auto";
    element.style.left = `${next.left}px`;
    element.style.top = `${next.top}px`;
  }

  function applyTrackerScale(tracker) {
    if (!tracker) return;
    const scale = normalizeTrackerScale(state?.settings?.trackerScale || trackerSizeToScale(state?.settings?.trackerSize));
    state.settings.trackerScale = scale;
    state.settings.trackerSize = null;
    tracker.style.setProperty("--wt-tracker-scale", String(Number(scale.toFixed(3))));
    tracker.style.transformOrigin = "top left";
  }

  function trackerSizeToScale(size) {
    if (!size) return DEFAULT_STATE.settings.trackerScale;
    const widthScale = Number.isFinite(size.width) ? size.width / TRACKER_BASE_WIDTH : 0;
    const heightScale = Number.isFinite(size.height) ? size.height / TRACKER_BASE_HEIGHT : 0;
    return Math.max(widthScale, heightScale, DEFAULT_STATE.settings.trackerScale);
  }

  function normalizeTrackerScale(scale) {
    const numeric = Number(scale);
    if (!Number.isFinite(numeric) || numeric <= 0) return DEFAULT_STATE.settings.trackerScale;
    return Math.max(TRACKER_SCALE_MIN, numeric);
  }

  function clampElementPosition(element, left, top) {
    const rect = element.getBoundingClientRect();
    const width = rect.width || element.offsetWidth;
    const height = rect.height || element.offsetHeight;
    const maxLeft = Math.max(PANEL_VIEWPORT_MARGIN, window.innerWidth - width - PANEL_VIEWPORT_MARGIN);
    const maxTop = Math.max(PANEL_VIEWPORT_MARGIN, window.innerHeight - height - PANEL_VIEWPORT_MARGIN);
    return {
      left: Math.max(PANEL_VIEWPORT_MARGIN, Math.min(maxLeft, left)),
      top: Math.max(PANEL_VIEWPORT_MARGIN, Math.min(maxTop, top)),
    };
  }

  function pinPanelToVisualRect(panel, rect = panel.getBoundingClientRect()) {
    panel.style.transformOrigin = "top left";
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    panel.style.left = `${rect.left}px`;
    panel.style.top = `${rect.top}px`;
  }

  function makeDraggable(handle, panel, options = {}) {
    if (!handle || !panel) return;
    const positionKey = options.positionKey || "panelPosition";
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
      if (panel.classList.contains(selectors.panel)) pinPanelToVisualRect(panel, rect);
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
      const next = clampElementPosition(panel, panelX + event.clientX - startX, panelY + event.clientY - startY);
      panel.style.left = `${next.left}px`;
      panel.style.top = `${next.top}px`;
    });

    document.addEventListener("mouseup", () => {
      if (!dragging) return;
      dragging = false;
      document.body.style.userSelect = "";
      const left = Number.parseFloat(panel.style.left);
      const top = Number.parseFloat(panel.style.top);
      if (Number.isFinite(left) && Number.isFinite(top)) {
        state.settings[positionKey] = { left, top };
        runTask(persist());
      }
    });
  }

  function makePanelScalable(panel) {
    if (!panel) return;
    const handles = panel.querySelectorAll("[data-resize-corner]");
    let resizing = null;

    const finishResize = () => {
      if (!resizing) return;
      const { pointerId, handle } = resizing;
      resizing = null;
      document.body.style.userSelect = "";
      try {
        if (handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId);
      } catch {
        // Pointer capture may already be released by the browser.
      }
      const rect = panel.getBoundingClientRect();
      const scale = normalizePanelScale(getPanelScale());
      state.settings.panelScale = scale;
      setPanelScale(panel, scale);
      pinPanelToVisualRect(panel, rect);
      state.settings.panelPosition = { left: rect.left, top: rect.top };
      runTask(persist());
    };

    const updateResize = (event) => {
      if (!resizing || event.pointerId !== resizing.pointerId) return;
      if (event.buttons === 0) {
        finishResize();
        return;
      }
      event.preventDefault();
      const distance = Math.hypot(event.clientX - resizing.anchor.x, event.clientY - resizing.anchor.y);
      const rawScale = resizing.startScale * (distance / Math.max(1, resizing.startDistance));
      const maxScale = getPanelAnchorMaxScale(resizing.anchor, resizing.baseWidth, resizing.baseHeight);
      const nextScale = Math.max(PANEL_SCALE_MIN, Math.min(maxScale, rawScale));
      setPanelScale(panel, nextScale);
    };

    const startResize = (event) => {
      const handle = event.target?.closest?.("[data-resize-corner]");
      if (!handle || !panel.contains(handle) || event.button !== 0 || resizing) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      const rect = panel.getBoundingClientRect();
      const anchor = getPanelScaleAnchor(handle.dataset.resizeCorner, rect);
      if (!anchor) return;

      panel.style.transformOrigin = anchor.origin;
      positionPanelForScaleAnchor(panel, anchor, panel.offsetWidth, panel.offsetHeight);
      resizing = {
        anchor,
        baseWidth: panel.offsetWidth,
        baseHeight: panel.offsetHeight,
        handle,
        pointerId: event.pointerId,
        startScale: getPanelScale(),
        startDistance: Math.hypot(event.clientX - anchor.x, event.clientY - anchor.y),
      };
      handle.setPointerCapture?.(event.pointerId);
      document.body.style.userSelect = "none";
    };

    root.addEventListener("pointerdown", startResize, true);
    handles.forEach((handle) => {
      handle.addEventListener("pointermove", updateResize);
      handle.addEventListener("pointerup", finishResize);
      handle.addEventListener("pointercancel", finishResize);
      handle.addEventListener("lostpointercapture", finishResize);
    });

    window.addEventListener("blur", finishResize);
  }

  function getPanelScale() {
    return normalizePanelScale(state?.settings?.panelScale ?? DEFAULT_STATE.settings.panelScale);
  }

  function setPanelScale(panel, scale) {
    const normalized = normalizePanelScale(scale);
    state.settings.panelScale = normalized;
    panel.style.setProperty("--wt-panel-scale", String(Number(normalized.toFixed(3))));
  }

  function getPanelScaleAnchor(corner, rect) {
    const anchors = {
      "top-left": { x: rect.right, y: rect.bottom, origin: "bottom right", xDir: -1, yDir: -1 },
      "top-right": { x: rect.left, y: rect.bottom, origin: "bottom left", xDir: 1, yDir: -1 },
      "bottom-left": { x: rect.right, y: rect.top, origin: "top right", xDir: -1, yDir: 1 },
      "bottom-right": { x: rect.left, y: rect.top, origin: "top left", xDir: 1, yDir: 1 },
    };
    return anchors[corner] || null;
  }

  function positionPanelForScaleAnchor(panel, anchor, width, height) {
    panel.style.right = "auto";
    panel.style.bottom = "auto";
    panel.style.left = `${anchor.xDir > 0 ? anchor.x : anchor.x - width}px`;
    panel.style.top = `${anchor.yDir > 0 ? anchor.y : anchor.y - height}px`;
  }

  function getPanelAnchorMaxScale(anchor, baseWidth, baseHeight) {
    const availableWidth = anchor.xDir > 0
      ? window.innerWidth - PANEL_VIEWPORT_MARGIN - anchor.x
      : anchor.x - PANEL_VIEWPORT_MARGIN;
    const availableHeight = anchor.yDir > 0
      ? window.innerHeight - PANEL_VIEWPORT_MARGIN - anchor.y
      : anchor.y - PANEL_VIEWPORT_MARGIN;
    return Math.max(
      PANEL_SCALE_MIN,
      Math.min(PANEL_SCALE_MAX, availableWidth / baseWidth, availableHeight / baseHeight),
    );
  }

  function makeTrackerScalable(tracker) {
    if (!tracker) return;
    const handles = tracker.querySelectorAll("[data-tracker-resize-corner]");
    if (!handles.length) return;
    let resizing = null;
    let updateLogCount = 0;
    let observedPointerDown = null;

    logTrackerResizeDiagnostic("bind", null, {
      handleCount: handles.length,
      trackerRect: rectSnapshot(tracker.getBoundingClientRect()),
      handles: Array.from(handles).map((handle) => ({
        corner: handle.dataset.trackerResizeCorner || null,
        rect: rectSnapshot(handle.getBoundingClientRect()),
        pointerEvents: window.getComputedStyle(handle).pointerEvents,
        opacity: window.getComputedStyle(handle).opacity,
        zIndex: window.getComputedStyle(handle).zIndex,
      })),
    });

    const removeResizeListeners = () => {
      document.removeEventListener("pointermove", updateResize, true);
      document.removeEventListener("pointerup", finishResize, true);
      document.removeEventListener("pointercancel", finishResize, true);
      document.removeEventListener("mouseup", finishResize, true);
      window.removeEventListener("blur", finishResize);
    };

    const finishResize = () => {
      if (!resizing) return;
      const { pointerId, handle } = resizing;
      logTrackerResizeDiagnostic("finish", null, {
        pointerId,
        corner: handle.dataset.trackerResizeCorner || null,
        currentScale: state.settings.trackerScale,
        trackerRect: rectSnapshot(tracker.getBoundingClientRect()),
      });
      resizing = null;
      removeResizeListeners();
      document.body.style.userSelect = "";
      try {
        if (handle.hasPointerCapture?.(pointerId)) handle.releasePointerCapture(pointerId);
      } catch {
        // Pointer capture may already be released by the browser.
      }
      const scale = normalizeTrackerScale(state.settings.trackerScale);
      state.settings.trackerScale = scale;
      state.settings.trackerSize = null;
      setTrackerScale(tracker, scale);
      pinTrackerToVisualRect(tracker, tracker.getBoundingClientRect());
      state.settings.trackerPosition = {
        left: Number.parseFloat(tracker.style.left),
        top: Number.parseFloat(tracker.style.top),
      };
      runTask(persist());
    };

    const updateResize = (event) => {
      if (!resizing) return;
      if (Number.isFinite(event.pointerId) && event.pointerId !== resizing.pointerId) return;
      if (event.buttons === 0) {
        logTrackerResizeDiagnostic("pointermove-buttons-zero", event, {
          activePointerId: resizing.pointerId,
        });
        finishResize();
        return;
      }
      event.preventDefault();
      const distance = Math.hypot(event.clientX - resizing.anchor.x, event.clientY - resizing.anchor.y);
      const rawScale = resizing.startScale * (distance / Math.max(1, resizing.startDistance));
      const maxScale = getTrackerAnchorMaxScale(resizing.anchor);
      const nextScale = Math.max(TRACKER_SCALE_MIN, Math.min(maxScale, rawScale));
      if (updateLogCount < 5 || updateLogCount % 20 === 0) {
        logTrackerResizeDiagnostic("update", event, {
          distance,
          rawScale,
          maxScale,
          nextScale,
          updateLogCount,
        });
      }
      updateLogCount += 1;
      setTrackerScale(tracker, nextScale);
    };

    const startResize = (event) => {
      const handle = event.target?.closest?.("[data-tracker-resize-corner]");
      if (!handle || !tracker.contains(handle) || event.button !== 0 || resizing) return;
      if (observedPointerDown?.pointerId === event.pointerId) {
        observedPointerDown.started = true;
      }
      logTrackerResizeDiagnostic("start-candidate", event, {
        corner: handle.dataset.trackerResizeCorner || null,
      });
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      const rect = tracker.getBoundingClientRect();
      const anchor = getTrackerScaleAnchor(handle.dataset.trackerResizeCorner, rect);
      if (!anchor) return;
      updateLogCount = 0;
      tracker.style.transformOrigin = anchor.origin;
      positionTrackerForScaleAnchor(tracker, anchor);
      resizing = {
        pointerId: event.pointerId,
        anchor,
        handle,
        startScale: getTrackerScale(),
        startDistance: Math.hypot(event.clientX - anchor.x, event.clientY - anchor.y),
      };
      logTrackerResizeDiagnostic("start", event, {
        corner: handle.dataset.trackerResizeCorner || null,
        anchor,
        startScale: resizing.startScale,
        startDistance: resizing.startDistance,
        trackerRectBeforePin: rectSnapshot(rect),
      });
      handle.setPointerCapture?.(event.pointerId);
      document.addEventListener("pointermove", updateResize, true);
      document.addEventListener("pointerup", finishResize, true);
      document.addEventListener("pointercancel", finishResize, true);
      document.addEventListener("mouseup", finishResize, true);
      window.addEventListener("blur", finishResize);
      document.body.style.userSelect = "none";
    };

    const diagnoseRootPointerDown = (event) => {
      const handle = event.target?.closest?.("[data-tracker-resize-corner]");
      if (!handle || !tracker.contains(handle) || event.button !== 0) return;
      observedPointerDown = {
        pointerId: event.pointerId,
        corner: handle.dataset.trackerResizeCorner || null,
        started: false,
      };
      logTrackerResizeDiagnostic("root-pointerdown-observed", event, {
        corner: observedPointerDown.corner,
      });
      window.setTimeout(() => {
        if (observedPointerDown?.pointerId !== event.pointerId) return;
        if (observedPointerDown.started) return;
        logTrackerResizeDiagnostic("start-not-observed-after-root-pointerdown", event, {
          corner: observedPointerDown.corner,
          reason: "Root saw a resize handle pointerdown, but the tracker resize handler did not start on the same event.",
        }, "warn");
      }, 0);
    };

    root.addEventListener("pointerdown", diagnoseRootPointerDown, true);
    root.addEventListener("pointerdown", startResize, true);
    handles.forEach((handle) => {
      handle.addEventListener("lostpointercapture", finishResize);
    });
  }

  function getTrackerScale() {
    return normalizeTrackerScale(state?.settings?.trackerScale || trackerSizeToScale(state?.settings?.trackerSize));
  }

  function setTrackerScale(tracker, scale) {
    const normalized = normalizeTrackerScale(scale);
    state.settings.trackerScale = normalized;
    tracker.style.setProperty("--wt-tracker-scale", String(Number(normalized.toFixed(3))));
  }

  function getTrackerAnchorMaxScale(anchor) {
    const availableWidth = anchor.xDir > 0
      ? window.innerWidth - PANEL_VIEWPORT_MARGIN - anchor.x
      : anchor.x - PANEL_VIEWPORT_MARGIN;
    const availableHeight = anchor.yDir > 0
      ? window.innerHeight - PANEL_VIEWPORT_MARGIN - anchor.y
      : anchor.y - PANEL_VIEWPORT_MARGIN;
    return Math.max(
      TRACKER_SCALE_MIN,
      Math.min(availableWidth / TRACKER_BASE_WIDTH, availableHeight / TRACKER_BASE_HEIGHT),
    );
  }

  function getTrackerScaleAnchor(corner, rect) {
    const anchors = {
      "top-left": { x: rect.right, y: rect.bottom, origin: "bottom right", xDir: -1, yDir: -1 },
      "top-right": { x: rect.left, y: rect.bottom, origin: "bottom left", xDir: 1, yDir: -1 },
      "bottom-left": { x: rect.right, y: rect.top, origin: "top right", xDir: -1, yDir: 1 },
      "bottom-right": { x: rect.left, y: rect.top, origin: "top left", xDir: 1, yDir: 1 },
    };
    return anchors[corner] || null;
  }

  function positionTrackerForScaleAnchor(tracker, anchor) {
    tracker.style.right = "auto";
    tracker.style.bottom = "auto";
    tracker.style.left = `${anchor.xDir > 0 ? anchor.x : anchor.x - TRACKER_BASE_WIDTH}px`;
    tracker.style.top = `${anchor.yDir > 0 ? anchor.y : anchor.y - TRACKER_BASE_HEIGHT}px`;
  }

  function pinTrackerToVisualRect(tracker, rect = tracker.getBoundingClientRect()) {
    tracker.style.transformOrigin = "top left";
    tracker.style.right = "auto";
    tracker.style.bottom = "auto";
    tracker.style.left = `${rect.left}px`;
    tracker.style.top = `${rect.top}px`;
  }

  function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  if (getPlatformAdapter(window.location.hostname)) {
    runTask(initialize());
  }
})();

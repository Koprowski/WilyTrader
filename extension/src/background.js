const UPDATE_TAGS_URL = "https://api.github.com/repos/Koprowski/WilyTrader/tags?per_page=10";
const BRIDGE_DIAGNOSTICS_URL = "http://127.0.0.1:17365/v1/wilytrader/diagnostics";
const AXIOM_QUOTE_MAX_AGE_MS = 5_000;
const AXIOM_QUOTE_REGISTRY_MAX_ENTRIES = 200;
const TARGET_MONITOR_INTERVAL_MS = 500;
const TARGET_STATE_MAX_AGE_MS = 10_000;
const TARGET_COMMAND_COOLDOWN_MS = 3_000;
const TARGET_IN_FLIGHT_MAX_AGE_MS = 30_000;
const TARGET_DIAGNOSTIC_THROTTLE_MS = 3_000;
const AXIOM_ADDRESS_PATTERN = /[1-9A-HJ-NP-Za-km-z]{32,44}/;

const quoteRegistry = new Map();
const targetStateByTab = new Map();
const targetInFlight = new Map();
const targetCommandCooldown = new Map();
const targetDiagnosticLastEmitted = new Map();
let targetMonitorRunning = false;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type) return false;

  if (message.type === "WILYTRADER_SAVE_FALLBACK") {
    saveFallbackArtifacts(message, sender)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
    return true;
  }

  if (message.type === "WILYTRADER_CAPTURE_SCREENSHOT") {
    captureScreenshotForBridge(message, sender)
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
    return true;
  }

  if (message.type === "WILYTRADER_OPEN_EXTENSION_MANAGER") {
    openExtensionManager()
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
    return true;
  }

  if (message.type === "WILYTRADER_CHECK_FOR_UPDATE") {
    checkForUpdate()
      .then((result) => sendResponse(result))
      .catch((error) => sendResponse({ ok: false, error: error?.message || String(error) }));
    return true;
  }

  if (message.type === "WILYTRADER_QUOTE_HEARTBEAT") {
    sendResponse(storeContentQuoteHeartbeat(message, sender));
    return false;
  }

  if (message.type === "WILYTRADER_GET_TOKEN_QUOTE") {
    sendResponse(getTokenQuote(message));
    return false;
  }

  if (message.type === "WILYTRADER_SYNC_TARGETS") {
    sendResponse(syncTargetState(message, sender));
    runTargetMonitor("target-sync");
    return false;
  }

  if (message.type === "WILYTRADER_TARGET_EXECUTION_RESULT") {
    sendResponse(recordTargetExecutionResult(message, sender));
    return false;
  }

  if (message.type === "WILYTRADER_GET_TARGET_MONITOR_STATUS") {
    sendResponse(getTargetMonitorStatus());
    return false;
  }

  return false;
});

if (chrome?.tabs?.onUpdated) {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!changeInfo?.title && !changeInfo?.url) return;
    storeTabTitleQuote(tab || { id: tabId });
    runTargetMonitor("tab-updated");
  });
}

if (chrome?.tabs?.onRemoved) {
  chrome.tabs.onRemoved.addListener((tabId) => {
    targetStateByTab.delete(tabId);
    for (const [key, quote] of quoteRegistry.entries()) {
      if (quote.tabId === tabId) quoteRegistry.delete(key);
    }
    emitTargetDiagnostic("target-monitor-tab-removed", { tabId });
  });
}

if (chrome?.tabs?.query) {
  chrome.runtime.onStartup?.addListener?.(() => refreshAxiomTabQuotes());
  chrome.runtime.onInstalled?.addListener?.(() => refreshAxiomTabQuotes());
  refreshAxiomTabQuotes();
}

setInterval(() => runTargetMonitor("interval"), TARGET_MONITOR_INTERVAL_MS);

function refreshAxiomTabQuotes() {
  try {
    chrome.tabs.query({ url: "https://axiom.trade/meme/*" }, (tabs) => {
      if (chrome.runtime.lastError) return;
      (tabs || []).forEach((tab) => storeTabTitleQuote(tab));
    });
  } catch {
    // Best-effort only; content heartbeats will fill the registry too.
  }
}

function storeContentQuoteHeartbeat(message, sender) {
  const quote = normalizeQuote({
    ...(message.quote || {}),
    tabId: sender?.tab?.id ?? message.quote?.tabId ?? null,
    windowId: sender?.tab?.windowId ?? message.quote?.windowId ?? null,
    url: sender?.tab?.url || message.quote?.url || null,
    title: sender?.tab?.title || message.quote?.title || null,
    source: message.quote?.source || "content-heartbeat",
  });
  if (!quote) return { ok: false, error: "Invalid quote heartbeat." };
  storeQuote(quote);
  runTargetMonitor("quote-heartbeat");
  return { ok: true, quote };
}

function storeTabTitleQuote(tab) {
  const quote = quoteFromTab(tab);
  if (!quote) return null;
  storeQuote(quote);
  return quote;
}

function quoteFromTab(tab) {
  const url = parseUrl(tab?.url);
  if (!url || url.hostname !== "axiom.trade" || !normalizePathname(url.pathname).startsWith("/meme/")) return null;
  const address = extractAxiomAddress(url);
  if (!address) return null;
  const marketCap = parseAxiomTitleMarketCap(tab?.title);
  if (!marketCap) return null;
  return normalizeQuote({
    platform: "axiom",
    chain: "SOL",
    tokenAddress: address,
    tokenKey: `axiom:SOL:${address}`,
    tokenName: parseAxiomTitleTokenName(tab?.title),
    marketCap,
    source: "axiom-tab-title",
    rawText: tab?.title || null,
    url: tab?.url || null,
    title: tab?.title || null,
    tabId: tab?.id ?? null,
    windowId: tab?.windowId ?? null,
    readAtMs: Date.now(),
  });
}

function getTokenQuote(message) {
  pruneQuoteRegistry();
  const tokenKey = normalizeString(message.tokenKey);
  const tokenAddress = normalizeString(message.tokenAddress);
  const candidates = Array.from(quoteRegistry.values())
    .filter((quote) => {
      if (tokenKey && quote.tokenKey === tokenKey) return true;
      if (tokenAddress && quote.tokenAddress === tokenAddress) return true;
      return false;
    })
    .sort((a, b) => Number(b.readAtMs || 0) - Number(a.readAtMs || 0));
  const maxAgeMs = Number(message.maxAgeMs || AXIOM_QUOTE_MAX_AGE_MS);
  const quote = candidates.find((item) => Date.now() - Number(item.readAtMs || 0) <= maxAgeMs) || null;
  return { ok: true, quote };
}

function syncTargetState(message, sender) {
  const tabId = sender?.tab?.id ?? null;
  if (!Number.isFinite(Number(tabId))) return { ok: false, error: "Missing sender tab." };
  const syncedAtMs = Date.now();
  const activeToken = normalizeTokenIdentity(message.activeToken);
  const positions = Array.isArray(message.positions) ? message.positions.filter(Boolean) : [];
  const targets = Array.isArray(message.exitTargets) ? message.exitTargets.filter(Boolean) : [];
  targetStateByTab.set(Number(tabId), {
    tabId: Number(tabId),
    windowId: sender?.tab?.windowId ?? null,
    url: sender?.tab?.url || message.pageUrl || activeToken?.url || null,
    title: sender?.tab?.title || message.pageTitle || null,
    activeToken,
    positions,
    targets,
    reason: normalizeString(message.reason) || "sync",
    sessionStartedAt: normalizeString(message.sessionStartedAt) || null,
    executionCount: Number.isFinite(Number(message.executionCount)) ? Number(message.executionCount) : null,
    syncedAtMs,
  });
  const syncReason = normalizeString(message.reason) || "sync";
  if (positions.length > 0 || targets.length > 0 || !/heartbeat/i.test(syncReason)) {
    emitTargetDiagnosticThrottled("target-monitor-state-synced", {
      tabId: Number(tabId),
      activeToken,
      positions: positions.length,
      targets: targets.length,
      reason: syncReason,
    }, `sync:${tabId}`, TARGET_DIAGNOSTIC_THROTTLE_MS);
  }
  return { ok: true, tabId: Number(tabId), syncedAtMs };
}

function recordTargetExecutionResult(message, sender) {
  const targetId = normalizeString(message.targetId);
  const correlationId = normalizeString(message.correlationId);
  if (targetId) {
    targetInFlight.delete(targetId);
    targetCommandCooldown.set(targetId, Date.now() + TARGET_COMMAND_COOLDOWN_MS);
  }
  emitTargetDiagnostic(message.ok ? "target-monitor-execution-success" : "target-monitor-execution-failed", {
    targetId,
    correlationId,
    tabId: sender?.tab?.id ?? null,
    positionId: normalizeString(message.positionId),
    tokenKey: normalizeString(message.tokenKey),
    tokenAddress: normalizeString(message.tokenAddress),
    executionId: normalizeString(message.executionId),
    error: normalizeString(message.error),
    reason: normalizeString(message.reason),
  }, message.ok ? "info" : "warn");
  return { ok: true };
}

function getTargetMonitorStatus() {
  pruneTargetMonitorState();
  return {
    ok: true,
    tabs: targetStateByTab.size,
    quotes: quoteRegistry.size,
    inFlight: targetInFlight.size,
    targets: collectTargetCandidates().length,
  };
}

function storeQuote(quote) {
  quoteRegistry.set(quote.registryKey, quote);
  pruneQuoteRegistry();
}

function pruneQuoteRegistry() {
  const now = Date.now();
  for (const [key, quote] of quoteRegistry.entries()) {
    if (now - Number(quote.readAtMs || 0) > AXIOM_QUOTE_MAX_AGE_MS * 6) quoteRegistry.delete(key);
  }
  if (quoteRegistry.size <= AXIOM_QUOTE_REGISTRY_MAX_ENTRIES) return;
  Array.from(quoteRegistry.entries())
    .sort((a, b) => Number(a[1].readAtMs || 0) - Number(b[1].readAtMs || 0))
    .slice(0, quoteRegistry.size - AXIOM_QUOTE_REGISTRY_MAX_ENTRIES)
    .forEach(([key]) => quoteRegistry.delete(key));
}

function pruneTargetMonitorState() {
  const now = Date.now();
  for (const [tabId, state] of targetStateByTab.entries()) {
    if (now - Number(state.syncedAtMs || 0) > TARGET_STATE_MAX_AGE_MS * 6) targetStateByTab.delete(tabId);
  }
  for (const [targetId, inFlight] of targetInFlight.entries()) {
    if (now - Number(inFlight.startedAtMs || 0) > TARGET_IN_FLIGHT_MAX_AGE_MS) {
      targetInFlight.delete(targetId);
      emitTargetDiagnostic("target-monitor-inflight-expired", { targetId, correlationId: inFlight.correlationId }, "warn");
    }
  }
  for (const [targetId, untilMs] of targetCommandCooldown.entries()) {
    if (untilMs <= now) targetCommandCooldown.delete(targetId);
  }
}

function runTargetMonitor(reason) {
  if (targetMonitorRunning) return;
  targetMonitorRunning = true;
  Promise.resolve()
    .then(() => evaluateCentralTargets(reason))
    .catch((error) => emitTargetDiagnostic("target-monitor-error", { reason, error: error?.message || String(error) }, "error"))
    .finally(() => {
      targetMonitorRunning = false;
    });
}

async function evaluateCentralTargets(reason) {
  pruneQuoteRegistry();
  pruneTargetMonitorState();
  const candidates = collectTargetCandidates();
  const now = Date.now();
  for (const candidate of candidates) {
    const target = candidate.target;
    if (!target?.id || target.triggeredAt) continue;
    if (targetInFlight.has(target.id)) continue;
    if ((targetCommandCooldown.get(target.id) || 0) > now) continue;
    const quote = selectTargetQuote(target);
    if (!quote) {
      emitTargetDiagnosticThrottled("target-monitor-fail-closed-no-fresh-quote", {
        reason,
        target: summarizeTarget(target),
      }, `noquote:${target.id}`);
      continue;
    }
    const marketCapUsd = Number(quote.marketCap || 0);
    if (!isTargetTriggered(target, marketCapUsd)) continue;
    const owner = selectTargetOwner(candidate, quote);
    if (!owner.ok) {
      emitTargetDiagnosticThrottled("target-monitor-fail-closed-tab", {
        reason,
        target: summarizeTarget(target),
        quote: summarizeQuote(quote),
        failure: owner.reason,
        tabId: owner.tabId ?? candidate.tabId,
      }, `owner:${target.id}:${owner.reason}`);
      targetCommandCooldown.set(target.id, now + TARGET_COMMAND_COOLDOWN_MS);
      continue;
    }
    await dispatchTargetExecution(candidate, owner.state, quote, reason);
  }
}

function collectTargetCandidates() {
  const latestByTarget = new Map();
  for (const state of targetStateByTab.values()) {
    for (const target of state.targets || []) {
      const normalized = normalizeTarget(target);
      if (!normalized?.id || normalized.triggeredAt) continue;
      const position = findPositionForTarget(state, normalized);
      if (!position) continue;
      const previous = latestByTarget.get(normalized.id);
      const updatedAtMs = parseTimeMs(normalized.updatedAt) || parseTimeMs(normalized.createdAt) || state.syncedAtMs || 0;
      if (!previous || updatedAtMs >= previous.updatedAtMs) {
        latestByTarget.set(normalized.id, {
          target: normalized,
          position,
          tabId: state.tabId,
          windowId: state.windowId,
          state,
          updatedAtMs,
        });
      }
    }
  }
  return Array.from(latestByTarget.values());
}

function normalizeTarget(target) {
  if (!target || typeof target !== "object") return null;
  const id = normalizeString(target.id);
  const positionId = normalizeString(target.positionId);
  if (!id || !positionId) return null;
  return {
    ...target,
    id,
    positionId,
    tokenKey: normalizeString(target.tokenKey),
    tokenAddress: normalizeString(target.tokenAddress),
    tokenName: normalizeString(target.tokenName),
    kind: normalizeString(target.kind),
    sellPercent: Number(target.sellPercent || 100),
    marketCapUsd: Number(target.marketCapUsd || 0),
    triggeredAt: normalizeString(target.triggeredAt),
    createdAt: normalizeString(target.createdAt),
    updatedAt: normalizeString(target.updatedAt),
  };
}

function findPositionForTarget(state, target) {
  return (state.positions || []).find((position) => {
    if (!position || typeof position !== "object") return false;
    if (normalizeString(position.positionId) === target.positionId) return true;
    if (target.tokenKey && normalizeString(position.tokenKey) === target.tokenKey) return true;
    if (target.tokenAddress && normalizeString(position.tokenAddress) === target.tokenAddress) return true;
    return false;
  }) || null;
}

function selectTargetQuote(target) {
  const now = Date.now();
  return Array.from(quoteRegistry.values())
    .filter((quote) => targetMatchesQuote(target, quote))
    .filter((quote) => now - Number(quote.readAtMs || 0) <= AXIOM_QUOTE_MAX_AGE_MS)
    .sort((a, b) => Number(b.readAtMs || 0) - Number(a.readAtMs || 0))[0] || null;
}

function targetMatchesQuote(target, quote) {
  if (!quote) return false;
  if (target.tokenKey && quote.tokenKey === target.tokenKey) return true;
  if (target.tokenAddress && quote.tokenAddress === target.tokenAddress) return true;
  return false;
}

function isTargetTriggered(target, marketCapUsd) {
  if (!Number.isFinite(marketCapUsd) || marketCapUsd <= 0) return false;
  const targetMarketCapUsd = Number(target.marketCapUsd || 0);
  if (!Number.isFinite(targetMarketCapUsd) || targetMarketCapUsd <= 0) return false;
  if (target.kind === "take_profit") return marketCapUsd >= targetMarketCapUsd;
  if (target.kind === "stop_loss") return marketCapUsd <= targetMarketCapUsd;
  return false;
}

function selectTargetOwner(candidate, quote) {
  const state = targetStateByTab.get(candidate.tabId);
  if (!state) return { ok: false, reason: "missing-owner-state", tabId: candidate.tabId };
  const now = Date.now();
  if (now - Number(state.syncedAtMs || 0) > TARGET_STATE_MAX_AGE_MS) {
    return { ok: false, reason: "stale-owner-state", tabId: state.tabId };
  }
  const activeToken = state.activeToken;
  if (!activeTokenMatchesTarget(activeToken, candidate.target)) {
    return { ok: false, reason: "owner-active-token-mismatch", tabId: state.tabId };
  }
  if (quote.tabId !== null && quote.tabId !== state.tabId && !activeTokenMatchesQuote(activeToken, quote)) {
    return { ok: false, reason: "quote-owner-mismatch", tabId: state.tabId };
  }
  return { ok: true, state };
}

function activeTokenMatchesTarget(activeToken, target) {
  if (!activeToken) return false;
  if (target.tokenKey && activeToken.key === target.tokenKey) return true;
  if (target.tokenAddress && activeToken.address === target.tokenAddress) return true;
  return false;
}

function activeTokenMatchesQuote(activeToken, quote) {
  if (!activeToken || !quote) return false;
  if (activeToken.key && quote.tokenKey === activeToken.key) return true;
  if (activeToken.address && quote.tokenAddress === activeToken.address) return true;
  return false;
}

async function dispatchTargetExecution(candidate, ownerState, quote, reason) {
  const target = candidate.target;
  const correlationId = `target-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  targetInFlight.set(target.id, {
    correlationId,
    startedAtMs: Date.now(),
    tabId: ownerState.tabId,
  });
  const command = {
    type: "WILYTRADER_EXECUTE_EXIT_TARGET",
    correlationId,
    targetId: target.id,
    positionId: target.positionId,
    tokenKey: target.tokenKey || null,
    tokenAddress: target.tokenAddress || null,
    kind: target.kind,
    sellPercent: Number(target.sellPercent || 100),
    targetMarketCapUsd: Number(target.marketCapUsd || 0),
    triggerMarketCapUsd: Number(quote.marketCap || 0),
    triggerSource: quote.source || null,
    triggerReadAtMs: quote.readAtMs || null,
    triggerQuoteAgeMs: Math.max(0, Date.now() - Number(quote.readAtMs || 0)),
    triggerTabId: quote.tabId ?? null,
    ownerTabId: ownerState.tabId,
  };
  emitTargetDiagnostic("target-monitor-command-dispatch", {
    reason,
    command,
    quote: summarizeQuote(quote),
  }, "info");
  const response = await sendTabMessage(ownerState.tabId, command);
  if (response?.ok && response.executionId) {
    targetInFlight.delete(target.id);
    targetCommandCooldown.set(target.id, Date.now() + TARGET_COMMAND_COOLDOWN_MS);
  } else if (!response?.ok) {
    targetInFlight.delete(target.id);
    targetCommandCooldown.set(target.id, Date.now() + TARGET_COMMAND_COOLDOWN_MS);
    emitTargetDiagnostic("target-monitor-command-failed", {
      command,
      response,
    }, "warn");
  }
}

function sendTabMessage(tabId, message) {
  return new Promise((resolve) => {
    try {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        const error = chrome.runtime.lastError;
        if (error) resolve({ ok: false, error: error.message });
        else resolve(response || { ok: false, error: "No content response." });
      });
    } catch (error) {
      resolve({ ok: false, error: error?.message || String(error) });
    }
  });
}

function normalizeQuote(input) {
  const tokenAddress = normalizeString(input?.tokenAddress);
  const tokenKey = normalizeString(input?.tokenKey) || (tokenAddress ? `axiom:SOL:${tokenAddress}` : "");
  const marketCap = Number(input?.marketCap || 0);
  if (!tokenKey || !tokenAddress || !Number.isFinite(marketCap) || marketCap <= 0) return null;
  const tabId = Number.isFinite(Number(input?.tabId)) ? Number(input.tabId) : null;
  return {
    platform: input?.platform || "axiom",
    chain: input?.chain || "SOL",
    tokenKey,
    tokenAddress,
    tokenName: normalizeString(input?.tokenName) || null,
    marketCap,
    source: normalizeString(input?.source) || "unknown",
    rawText: normalizeString(input?.rawText) || null,
    url: normalizeString(input?.url) || null,
    title: normalizeString(input?.title) || null,
    tabId,
    windowId: Number.isFinite(Number(input?.windowId)) ? Number(input.windowId) : null,
    readAtMs: Number.isFinite(Number(input?.readAtMs)) ? Number(input.readAtMs) : Date.now(),
    registryKey: `${tokenKey}|${tabId ?? "tab"}|${normalizeString(input?.source) || "unknown"}`,
  };
}

function parseAxiomTitleMarketCap(title) {
  const match = String(title || "").match(/\$\s*([0-9][0-9,]*(?:\.[0-9]+)?)\s*([KMB])?/i);
  if (!match) return null;
  return parseCompactNumber(match[1], match[2]);
}

function parseAxiomTitleTokenName(title) {
  const text = String(title || "").split("|")[0] || "";
  const beforePrice = text.split("$")[0] || "";
  return beforePrice.replace(/[↑↓↗↘▲▼]/g, "").trim() || null;
}

function parseCompactNumber(value, suffix = "") {
  const parsed = Number.parseFloat(String(value || "").replace(/,/g, ""));
  if (!Number.isFinite(parsed)) return null;
  const normalized = String(suffix || "").toUpperCase();
  if (normalized === "K") return parsed * 1_000;
  if (normalized === "M") return parsed * 1_000_000;
  if (normalized === "B") return parsed * 1_000_000_000;
  return parsed;
}

function extractAxiomAddress(url) {
  const parts = normalizePathname(url.pathname).split("/").filter(Boolean);
  const memeIndex = parts.indexOf("meme");
  const candidate = memeIndex >= 0 ? parts[memeIndex + 1] : null;
  return AXIOM_ADDRESS_PATTERN.test(candidate || "") ? candidate : null;
}

function normalizePathname(pathname) {
  return String(pathname || "").replace(/\/+/g, "/").replace(/\/$/, "");
}

function parseUrl(value) {
  try {
    return new URL(value || "");
  } catch {
    return null;
  }
}

function normalizeString(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeTokenIdentity(token) {
  if (!token || typeof token !== "object") return null;
  const address = normalizeString(token.address || token.tokenAddress);
  const key = normalizeString(token.key || token.tokenKey) || (address ? `axiom:SOL:${address}` : "");
  if (!key && !address) return null;
  return {
    key,
    address,
    name: normalizeString(token.name || token.tokenName) || null,
    chain: normalizeString(token.chain) || "SOL",
    marketCap: Number.isFinite(Number(token.marketCap)) ? Number(token.marketCap) : null,
    marketCapSource: normalizeString(token.marketCapSource) || null,
    marketCapReadAtMs: Number.isFinite(Number(token.marketCapReadAtMs)) ? Number(token.marketCapReadAtMs) : null,
    url: normalizeString(token.url) || null,
  };
}

function summarizeTarget(target) {
  if (!target) return null;
  return {
    id: target.id || null,
    kind: target.kind || null,
    positionId: target.positionId || null,
    tokenKey: target.tokenKey || null,
    tokenAddress: target.tokenAddress || null,
    tokenName: target.tokenName || null,
    sellPercent: Number.isFinite(Number(target.sellPercent)) ? Number(target.sellPercent) : null,
    marketCapUsd: Number.isFinite(Number(target.marketCapUsd)) ? Number(target.marketCapUsd) : null,
    createdAt: target.createdAt || null,
    updatedAt: target.updatedAt || null,
  };
}

function summarizeQuote(quote) {
  if (!quote) return null;
  return {
    tokenKey: quote.tokenKey || null,
    tokenAddress: quote.tokenAddress || null,
    tokenName: quote.tokenName || null,
    marketCap: quote.marketCap || null,
    source: quote.source || null,
    readAtMs: quote.readAtMs || null,
    quoteAgeMs: quote.readAtMs ? Math.max(0, Date.now() - Number(quote.readAtMs)) : null,
    tabId: quote.tabId ?? null,
    windowId: quote.windowId ?? null,
    url: quote.url || null,
    title: quote.title || null,
  };
}

function parseTimeMs(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : null;
}

function emitTargetDiagnosticThrottled(stage, details = {}, key = stage, throttleMs = TARGET_DIAGNOSTIC_THROTTLE_MS) {
  const now = Date.now();
  const last = targetDiagnosticLastEmitted.get(key) || 0;
  if (now - last < throttleMs) return;
  targetDiagnosticLastEmitted.set(key, now);
  emitTargetDiagnostic(stage, details);
}

function emitTargetDiagnostic(stage, details = {}, level = "debug") {
  const payload = {
    stage,
    at: new Date().toISOString(),
    installedVersion: chrome.runtime.getManifest?.()?.version || null,
    pageUrl: "chrome-extension://background",
    pageTitle: "WilyTrader background",
    bridgeEnabled: null,
    executionCount: null,
    lastSyncedExecutionId: null,
    activeToken: null,
    details,
  };
  const log = console[level] || console.debug;
  log.call(console, "[WilyTrader][target-monitor]", payload);
  postDesktopDiagnostic(payload);
}

async function postDesktopDiagnostic(payload) {
  try {
    await fetch(BRIDGE_DIAGNOSTICS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Desktop may not be running; target diagnostics remain visible in extension logs.
  }
}

async function checkForUpdate() {
  const installedVersion = chrome.runtime.getManifest().version;
  const url = `${UPDATE_TAGS_URL}&t=${Date.now()}`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/vnd.github+json" },
  });
  if (!response.ok) throw new Error(`Update check failed: HTTP ${response.status}`);
  const tags = await response.json();
  const latestVersion = latestVersionFromTags(tags);
  if (!latestVersion) throw new Error("Update metadata did not include a version tag.");
  return {
    ok: true,
    installedVersion,
    latestVersion,
    updateAvailable: compareVersions(installedVersion, latestVersion) < 0,
    checkedAt: new Date().toISOString(),
  };
}

function latestVersionFromTags(tags) {
  if (!Array.isArray(tags)) return "";
  return tags
    .map((tag) => String(tag?.name || "").replace(/^v/i, ""))
    .filter((version) => /^\d+\.\d+\.\d+$/.test(version))
    .sort(compareVersions)
    .pop() || "";
}

function compareVersions(current, latest) {
  const a = String(current || "").replace(/^v/i, "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const b = String(latest || "").replace(/^v/i, "").split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    if ((a[index] || 0) < (b[index] || 0)) return -1;
    if ((a[index] || 0) > (b[index] || 0)) return 1;
  }
  return 0;
}

function openExtensionManager() {
  return new Promise((resolve, reject) => {
    const extensionUrl = `chrome://extensions/?id=${chrome.runtime.id}`;
    chrome.tabs.create({ url: extensionUrl }, (tab) => {
      const error = chrome.runtime.lastError;
      if (error) {
        chrome.tabs.create({ url: "chrome://extensions/" }, (fallbackTab) => {
          const fallbackError = chrome.runtime.lastError;
          if (fallbackError) reject(new Error(fallbackError.message));
          else resolve({ ok: true, url: "chrome://extensions/", tabId: fallbackTab?.id || null });
        });
        return;
      }
      resolve({ ok: true, url: extensionUrl, tabId: tab?.id || null });
    });
  });
}

async function saveFallbackArtifacts(message, sender) {
  const payload = message.payload || {};
  const event = message.event || payload.event || {};
  const sessionSlug = makeSessionSlug(payload, message);
  const eventSlug = makeEventSlug(event);
  const basePath = `WilyTrader/${sessionSlug}/${eventSlug}`;

  let ledgerDownloadId = null;
  if (message.saveLedger === true) {
    ledgerDownloadId = await downloadDataUrl({
      url: jsonDataUrl(payload),
      filename: `${basePath}-ledger.json`,
    });
  }

  let screenshotDownloadId = null;
  if (message.captureScreenshot === true) {
    const dataUrl = await captureVisibleTab(sender?.tab?.windowId);
    const screenshotUrl = await maybeCropDataUrl(dataUrl, message.captureRect);
    screenshotDownloadId = await downloadDataUrl({
      url: screenshotUrl,
      filename: `${basePath}.png`,
    });
  }

  if (!ledgerDownloadId && !screenshotDownloadId) {
    throw new Error("No fallback artifact requested.");
  }

  return {
    ok: true,
    mode: "chrome-downloads",
    ledgerDownloadId,
    screenshotDownloadId,
  };
}

async function captureScreenshotForBridge(message, sender) {
  const capturedAtMs = Date.now();
  const dataUrl = await captureVisibleTab(sender?.tab?.windowId);
  const screenshotUrl = await maybeCropDataUrl(dataUrl, message.captureRect);
  return {
    ok: true,
    dataUrl: screenshotUrl,
    capturedAt: new Date(capturedAtMs).toISOString(),
    capturedAtMs,
    captureRect: message.captureRect || null,
    source: "chrome-tabs-captureVisibleTab",
  };
}

function captureVisibleTab(windowId) {
  return new Promise((resolve, reject) => {
    const callback = (dataUrl) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else if (!dataUrl) reject(new Error("No screenshot data returned."));
      else resolve(dataUrl);
    };
    if (typeof windowId === "number") chrome.tabs.captureVisibleTab(windowId, { format: "png" }, callback);
    else chrome.tabs.captureVisibleTab({ format: "png" }, callback);
  });
}

async function maybeCropDataUrl(dataUrl, rect) {
  if (!rect || !Number.isFinite(rect.width) || !Number.isFinite(rect.height)) return dataUrl;
  if (rect.width <= 0 || rect.height <= 0) return dataUrl;
  try {
    const imageBlob = await (await fetch(dataUrl)).blob();
    const bitmap = await createImageBitmap(imageBlob);
    const scale = Number(rect.devicePixelRatio) || 1;
    const sx = clamp(Math.round(Number(rect.left || 0) * scale), 0, bitmap.width - 1);
    const sy = clamp(Math.round(Number(rect.top || 0) * scale), 0, bitmap.height - 1);
    const sw = clamp(Math.round(Number(rect.width) * scale), 1, bitmap.width - sx);
    const sh = clamp(Math.round(Number(rect.height) * scale), 1, bitmap.height - sy);
    const canvas = new OffscreenCanvas(sw, sh);
    const context = canvas.getContext("2d");
    if (!context) return dataUrl;
    context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
    const croppedBlob = await canvas.convertToBlob({ type: "image/png" });
    return blobToDataUrl(croppedBlob);
  } catch {
    return dataUrl;
  }
}

function downloadDataUrl({ url, filename }) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download({ url, filename, saveAs: false }, (downloadId) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(downloadId);
    });
  });
}

function jsonDataUrl(value) {
  return `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify(value, null, 2))}`;
}

async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return `data:${blob.type || "application/octet-stream"};base64,${btoa(binary)}`;
}

function makeSessionSlug(payload, message = {}) {
  const startedAt = message.sessionStartedAt || payload?.currentSessionSummary?.startedAt || payload?.exportedAt || new Date().toISOString();
  return sanitizeFilePart(String(startedAt).replace(/[:.]/g, "-"));
}

function makeEventSlug(event) {
  const timestamp = sanitizeFilePart(String(event.timestamp || new Date().toISOString()).replace(/[:.]/g, "-"));
  const side = sanitizeFilePart(String(event.side || "trade"));
  const token = sanitizeFilePart(String(event.tokenAddress || event.tokenName || "token")).slice(0, 40);
  const executionId = sanitizeFilePart(String(event.executionId || "execution")).slice(0, 60);
  return `${timestamp}-${side}-${token}-${executionId}`;
}

function sanitizeFilePart(value) {
  const cleaned = value.trim().replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "");
  return cleaned || "wilytrader";
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

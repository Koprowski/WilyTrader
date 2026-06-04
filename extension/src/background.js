const UPDATE_TAGS_URL = "https://api.github.com/repos/Koprowski/WilyTrader/tags?per_page=10";
const AXIOM_QUOTE_MAX_AGE_MS = 5_000;
const AXIOM_QUOTE_REGISTRY_MAX_ENTRIES = 200;
const AXIOM_ADDRESS_PATTERN = /[1-9A-HJ-NP-Za-km-z]{32,44}/;

const quoteRegistry = new Map();

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

  return false;
});

if (chrome?.tabs?.onUpdated) {
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!changeInfo?.title && !changeInfo?.url) return;
    storeTabTitleQuote(tab || { id: tabId });
  });
}

if (chrome?.tabs?.query) {
  chrome.runtime.onStartup?.addListener?.(() => refreshAxiomTabQuotes());
  chrome.runtime.onInstalled?.addListener?.(() => refreshAxiomTabQuotes());
  refreshAxiomTabQuotes();
}

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

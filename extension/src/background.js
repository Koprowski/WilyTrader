const UPDATE_TAGS_URL = "https://api.github.com/repos/Koprowski/WilyTrader/tags?per_page=10";

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

  return false;
});

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

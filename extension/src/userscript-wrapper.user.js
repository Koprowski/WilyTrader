// ==UserScript==
// @name         WilyTrader Axiom Chart Bridge
// @namespace    https://github.com/Koprowski/WilyTrader
// @version      0.3.51
// @description  Draw WilyTrader average entry/exit lines as native TradingView chart shapes on axiom.trade.
// @match        https://axiom.trade/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  "use strict";

  if (window.__wileyChartBridge) return;

  const IFRAME_ID_RE = /^tradingview_[a-f0-9]+$/i;
  const DEFAULT_ENTRY_STYLE = {
    color: "#22c55e",
    lineWidth: 1,
    lineStyle: "dashed",
    labelText: "AVG ENTRY",
    showPrice: true,
  };
  const DEFAULT_EXIT_STYLE = {
    color: "#ef4444",
    lineWidth: 1,
    lineStyle: "dashed",
    labelText: "AVG EXIT",
    showPrice: true,
  };

  function createAxiomChartBridge(opts = {}) {
    const desiredLines = new Map();
    const desiredMarkers = new Map();
    const symbolListeners = new Set();
    const reboundListeners = new Set();
    let bound = null;
    let bindPromise = null;
    let mutationObserver = null;
    let symbolUnsubscribe = null;
    let symbolPollId = null;
    let lineMovePollId = null;
    let lastSymbol = "";
    let flushScheduled = false;

    startObserver();

    async function ready() {
      await ensureBound();
    }

    async function upsertLine(positionId, kind, price, style) {
      if (!positionId || !Number.isFinite(price) || price <= 0) return;
      const key = lineKey(positionId, kind);
      desiredLines.set(key, {
        ...(desiredLines.get(key) || {}),
        positionId,
        kind,
        price,
        style: normalizeStyle(kind, style || {}),
      });
      scheduleFlush();
    }

    async function removeLine(positionId, kind) {
      const key = lineKey(positionId, kind);
      const existing = desiredLines.get(key);
      desiredLines.delete(key);
      if (!existing) return;
      const chart = await tryEnsureBound();
      if (chart) removeStoredLine(chart, existing);
    }

    async function upsertMarker(positionId, markerId, side, time, price, style) {
      if (!positionId || !markerId || !Number.isFinite(time) || !Number.isFinite(price) || price <= 0) return;
      desiredMarkers.set(markerId, {
        ...(desiredMarkers.get(markerId) || {}),
        positionId,
        markerId,
        side,
        time,
        price,
        style: normalizeMarkerStyle(side, style || {}),
      });
      scheduleFlush();
    }

    async function removeMarker(markerId) {
      const existing = desiredMarkers.get(markerId);
      desiredMarkers.delete(markerId);
      if (!existing) return;
      const chart = await tryEnsureBound();
      if (chart) removeStoredMarker(chart, existing);
    }

    async function clearAll() {
      const lines = Array.from(desiredLines.values());
      const markers = Array.from(desiredMarkers.values());
      desiredLines.clear();
      desiredMarkers.clear();
      const chart = await tryEnsureBound();
      if (!chart) return;
      lines.forEach((line) => removeStoredLine(chart, line));
      markers.forEach((marker) => removeStoredMarker(chart, marker));
    }

    function onSymbolChange(cb) {
      symbolListeners.add(cb);
      return () => symbolListeners.delete(cb);
    }

    function onChartRebound(cb) {
      reboundListeners.add(cb);
      return () => reboundListeners.delete(cb);
    }

    async function selfTest() {
      const iframe = findActiveIframe();
      let win = null;
      let api = null;
      let chartWidget = null;
      let chart = null;
      try {
        win = iframe?.contentWindow || null;
        api = win?.tradingViewApi || null;
        chartWidget = win?.chartWidget || null;
        chart = resolveChart(api);
      } catch {
        // Health checks must not throw into the host app.
      }
      const health = {
        ok: Boolean(iframe && api && chartWidget && (chart?.createShape || chartWidget?._model?.createLineTool)),
        iframeFound: Boolean(iframe),
        iframeId: iframe?.id,
        hasTradingViewApi: Boolean(api),
        hasChartWidget: Boolean(chartWidget),
        hasPublicCreateShape: Boolean(chart?.createShape),
        hasInternalCreateLineTool: Boolean(chartWidget?._model?.createLineTool),
        symbol: safeGetSymbol(chart),
      };
      health.message = `WileyChartBridge health ok=${health.ok} iframe=${health.iframeId || "none"} api=${health.hasTradingViewApi} public=${health.hasPublicCreateShape} internal=${health.hasInternalCreateLineTool} symbol=${health.symbol || "unknown"}`;
      console.info(health.message);
      return health;
    }

    function startObserver() {
      if (mutationObserver) return;
      if (!document.body) {
        window.setTimeout(startObserver, 50);
        return;
      }
      mutationObserver = new MutationObserver(() => {
        const nextIframe = findActiveIframe();
        if (!nextIframe || nextIframe === bound?.iframe) return;
        rebind();
      });
      mutationObserver.observe(document.body, { childList: true, subtree: true });
    }

    function startLineMovePoll() {
      if (lineMovePollId !== null) return;
      lineMovePollId = window.setInterval(pollMovableLinePrices, 350);
    }

    function pollMovableLinePrices() {
      if (!bound) return;
      desiredLines.forEach((line) => {
        if (!isMovableLine(line)) return;
        const price = readStoredLinePrice(bound, line);
        if (!Number.isFinite(price) || Number(price) <= 0) return;
        if (Math.abs(Number(line.price || 0) - Number(price)) < 1) return;
        line.price = Number(price);
        window.postMessage({
          source: "wiley-chart-bridge",
          event: "lineMoved",
          positionId: line.positionId,
          kind: line.kind,
          price: line.price,
        }, window.location.origin);
      });
    }

    function rebind() {
      detachSymbolWatcher();
      bound = null;
      bindPromise = null;
      desiredLines.forEach((line) => {
        line.entityId = undefined;
        line.source = undefined;
        line.mode = undefined;
      });
      desiredMarkers.forEach((marker) => {
        marker.entityId = undefined;
        marker.mode = undefined;
      });
      reboundListeners.forEach((cb) => safeCall(() => cb()));
      window.postMessage({ source: "wiley-chart-bridge", event: "chartRebound" }, window.location.origin);
      scheduleFlush();
    }

    async function tryEnsureBound() {
      try {
        return await ensureBound();
      } catch (error) {
        console.debug("[WileyChartBridge] Chart not ready.", error);
        return null;
      }
    }

    async function ensureBound() {
      if (bound && isIframeUsable(bound.iframe)) return bound;
      if (bindPromise) return bindPromise;
      bindPromise = bindToChart().finally(() => {
        bindPromise = null;
      });
      bound = await bindPromise;
      attachSymbolWatcher(bound);
      return bound;
    }

    async function bindToChart() {
      const started = Date.now();
      while (Date.now() - started < 10_000) {
        const iframe = findActiveIframe();
        if (iframe?.contentWindow) {
          const win = iframe.contentWindow;
          await awaitWidgetReady(win);
          const api = win.tradingViewApi;
          const chartWidget = win.chartWidget;
          const chart = resolveChart(api);
          if (api && chartWidget && chart) return { iframe, win, api, chartWidget, chart };
        }
        await delay(150);
      }
      throw new Error("Timed out waiting for Axiom TradingView chart.");
    }

    async function awaitWidgetReady(win) {
      const readyValue = win.widgetReady;
      if (readyValue && typeof readyValue.then === "function") {
        await Promise.race([readyValue.catch(() => undefined), delay(3000)]);
      }
      const started = Date.now();
      while (Date.now() - started < 10_000) {
        if (win.tradingViewApi && win.chartWidget) return;
        await delay(100);
      }
    }

    function findActiveIframe() {
      const frames = Array.from(document.querySelectorAll("iframe"))
        .filter((iframe) => IFRAME_ID_RE.test(iframe.id))
        .map((iframe, index) => ({ iframe, index, rect: iframe.getBoundingClientRect() }))
        .filter(({ rect }) => rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.left < window.innerWidth && rect.top < window.innerHeight)
        .sort((a, b) => (b.rect.width * b.rect.height) - (a.rect.width * a.rect.height));
      if (opts.preferIframeIndex !== undefined) {
        return frames.find((item) => item.index === opts.preferIframeIndex)?.iframe || frames[0]?.iframe || null;
      }
      return frames[0]?.iframe || null;
    }

    function isIframeUsable(iframe) {
      if (!iframe.isConnected) return false;
      const rect = iframe.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }

    function resolveChart(api) {
      return safeCall(() => api?.activeChart?.())
        || safeCall(() => api?.chart?.(0))
        || safeCall(() => api?.chart?.());
    }

    function scheduleFlush() {
      if (flushScheduled) return;
      flushScheduled = true;
      window.setTimeout(() => {
        flushScheduled = false;
        void flushDesiredLines();
      }, 0);
    }

    async function flushDesiredLines() {
      const chart = await tryEnsureBound();
      if (!chart) return;
      for (const [key, line] of desiredLines.entries()) {
        try {
          const next = await upsertStoredLine(chart, line);
          desiredLines.set(key, next);
        } catch (error) {
          console.debug("[WileyChartBridge] Failed to upsert line.", error);
        }
      }
      for (const [key, marker] of desiredMarkers.entries()) {
        try {
          const next = await upsertStoredMarker(chart, marker);
          desiredMarkers.set(key, next);
        } catch (error) {
          console.debug("[WileyChartBridge] Failed to upsert marker.", error);
        }
      }
    }

    async function upsertStoredLine(boundChart, line) {
      const entity = line.entityId ? safeCall(() => boundChart.chart.getShapeById?.(line.entityId)) : null;
      if (entity) {
        if (!isMovableLine(line)) setEntityPoints(entity, line.price, boundChart);
        setEntityProperties(entity, line.style);
        return line;
      }
      if (line.source || line.entityId) {
        removeStoredLine(boundChart, line);
      }
      if (boundChart.chart?.createShape) {
        const id = await createPublicShape(boundChart, line);
        if (isMovableLine(line)) startLineMovePoll();
        return { ...line, entityId: id, mode: "public" };
      }
      const source = createInternalLineTool(boundChart, line);
      if (isMovableLine(line)) startLineMovePoll();
      return { ...line, source, entityId: source, mode: "internal" };
    }

    async function createPublicShape(boundChart, line) {
      const point = { time: resolveRightmostTime(boundChart), price: line.price };
      return boundChart.chart.createShape(point, {
        shape: "horizontal_line",
        lock: !isMovableLine(line),
        disableSelection: false,
        disableSave: true,
        disableUndo: true,
        overrides: buildOverrides(line.style),
      });
    }

    function createInternalLineTool(boundChart, line) {
      // Fragile fallback: this relies on TradingView private model internals and may break on Axiom updates.
      const model = boundChart.chartWidget?._model;
      if (!model?.createLineTool) throw new Error("No TradingView line creation API found.");
      return model.createLineTool("LineToolHorzLine", [{ price: line.price, index: resolveLastBarIndex(boundChart) }], buildInternalProperties(line.style));
    }

    function removeStoredLine(boundChart, line) {
      if (line.entityId && boundChart.chart?.removeEntity) {
        safeCall(() => boundChart.chart.removeEntity(line.entityId));
      }
      if (line.source && boundChart.chartWidget?._model?.removeSource) {
        safeCall(() => boundChart.chartWidget._model.removeSource(line.source));
      }
      line.entityId = undefined;
      line.source = undefined;
      line.mode = undefined;
    }

    async function upsertStoredMarker(boundChart, marker) {
      const markerTime = resolveMarkerTime(boundChart, marker.time);
      const point = { time: markerTime, price: marker.price };
      const entity = marker.entityId ? safeCall(() => boundChart.chart.getShapeById?.(marker.entityId)) : null;
      if (entity) {
        safeCall(() => entity.setPoints?.([point]));
        safeCall(() => entity.setProperties?.(buildMarkerOverrides(marker)));
        return { ...marker, time: markerTime };
      }
      if (!boundChart.chart?.createShape) {
        throw new Error("No TradingView marker creation API found.");
      }
      const id = await boundChart.chart.createShape(point, {
        shape: marker.style.shape || (marker.side === "buy" ? "arrow_up" : "arrow_down"),
        lock: true,
        disableSelection: false,
        disableSave: true,
        disableUndo: true,
        overrides: buildMarkerOverrides(marker),
      });
      return { ...marker, time: markerTime, entityId: id, mode: "public" };
    }

    function removeStoredMarker(boundChart, marker) {
      if (marker.entityId && boundChart.chart?.removeEntity) {
        safeCall(() => boundChart.chart.removeEntity(marker.entityId));
      }
      marker.entityId = undefined;
      marker.mode = undefined;
    }

    function setEntityPoints(entity, price, boundChart) {
      safeCall(() => entity.setPoints?.([{ time: resolveRightmostTime(boundChart), price }]));
    }

    function setEntityProperties(entity, style) {
      safeCall(() => entity.setProperties?.(buildOverrides(style)));
    }

    function buildOverrides(style) {
      return {
        linecolor: style.color,
        linewidth: style.lineWidth ?? 1,
        linestyle: toTvLineStyle(style.lineStyle),
        showLabel: Boolean(style.labelText),
        text: style.labelText || "",
        showPrice: style.showPrice !== false,
        horzLabelsAlign: style.labelAlign || "center",
        vertLabelsAlign: "middle",
        textcolor: "#ffffff",
        backgroundColor: style.labelBackground || style.color,
        fontsize: 11,
        bold: true,
      };
    }

    function buildInternalProperties(style) {
      return {
        color: style.color,
        linewidth: style.lineWidth ?? 1,
        linestyle: toTvLineStyle(style.lineStyle),
        text: style.labelText || "",
        showLabel: Boolean(style.labelText),
        showPrice: style.showPrice !== false,
        horzLabelsAlign: style.labelAlign || "center",
        vertLabelsAlign: "middle",
        lock: !style.movable,
        disableSave: true,
      };
    }

    function isMovableLine(line) {
      return Boolean(line.style?.movable);
    }

    function readStoredLinePrice(boundChart, line) {
      const entity = line.entityId ? safeCall(() => boundChart.chart.getShapeById?.(line.entityId)) : null;
      const entityPoints = entity ? readPointList(entity) : null;
      const entityPrice = extractPointPrice(entityPoints?.[0]);
      if (Number.isFinite(entityPrice)) return entityPrice;

      const sourcePoints = line.source ? readPointList(line.source) : null;
      const sourcePrice = extractPointPrice(sourcePoints?.[0]);
      return Number.isFinite(sourcePrice) ? sourcePrice : null;
    }

    function readPointList(source) {
      const points = safeCall(() => source.getPoints?.())
        || safeCall(() => source.points?.())
        || safeCall(() => source._points)
        || safeCall(() => source._points?.());
      return Array.isArray(points) ? points : null;
    }

    function extractPointPrice(point) {
      const price = Number(point?.price ?? point?._price ?? point?.value?.price ?? point?.value?._price);
      return Number.isFinite(price) && price > 0 ? price : null;
    }

    function buildMarkerOverrides(marker) {
      return {
        color: marker.style.color,
        linecolor: marker.style.color,
        text: marker.style.text || "",
        textcolor: marker.style.textColor || "#ffffff",
        backgroundColor: marker.style.background || marker.style.color,
        fontsize: marker.style.fontSize ?? 11,
        bold: true,
      };
    }

    function toTvLineStyle(style) {
      if (style === "dotted") return 1;
      if (style === "dashed") return 2;
      return 0;
    }

    function resolveRightmostTime(boundChart) {
      return safeCall(() => boundChart.chart.getVisibleRange?.()?.to)
        || safeCall(() => boundChart.chart.getVisibleRange?.().to)
        || Math.floor(Date.now() / 1000);
    }

    function resolveLastBarIndex(boundChart) {
      return safeCall(() => boundChart.chartWidget.getTimeScale?.().rightmostIndex?.())
        || safeCall(() => boundChart.chartWidget._model?.timeScale?.().rightmostIndex?.())
        || 0;
    }

    function resolveMarkerTime(boundChart, requestedTime) {
      const time = Math.floor(Number(requestedTime));
      if (!Number.isFinite(time) || time <= 0) return Math.floor(Date.now() / 1000);
      const resolutionSeconds = resolveChartResolutionSeconds(boundChart);
      if (!Number.isFinite(resolutionSeconds) || resolutionSeconds <= 1) return time;
      return Math.floor(time / resolutionSeconds) * resolutionSeconds;
    }

    function resolveChartResolutionSeconds(boundChart) {
      const resolution =
        safeCall(() => boundChart.chart.resolution?.())
        || safeCall(() => boundChart.chart.interval?.())
        || safeCall(() => boundChart.api.activeChart?.().resolution?.())
        || safeCall(() => boundChart.chartWidget.activeChart?.().resolution?.())
        || safeCall(() => boundChart.chartWidget.symbolInterval?.().interval)
        || safeCall(() => boundChart.chartWidget._model?.mainSeries?.().interval?.());
      return parseChartResolutionSeconds(resolution);
    }

    function parseChartResolutionSeconds(value) {
      const raw = String(value || "").trim().toUpperCase();
      if (!raw) return 0;
      const match = raw.match(/^(\d+(?:\.\d+)?)([A-Z]*)$/);
      if (!match) return 0;
      const amount = Number(match[1]);
      if (!Number.isFinite(amount) || amount <= 0) return 0;
      const unit = match[2] || "MIN";
      if (unit === "S") return Math.round(amount);
      if (unit === "D") return Math.round(amount * 86400);
      if (unit === "W") return Math.round(amount * 604800);
      if (unit === "M") return Math.round(amount * 2592000);
      return Math.round(amount * 60);
    }

    function attachSymbolWatcher(boundChart) {
      detachSymbolWatcher();
      const chart = boundChart.chart;
      lastSymbol = safeGetSymbol(chart) || "";
      const subscription = safeCall(() => chart.onSymbolChanged?.());
      if (subscription?.subscribe) {
        const handler = (symbolInfo) => {
          handleSymbolChange(extractSymbol(symbolInfo, chart));
        };
        subscription.subscribe(null, handler);
        symbolUnsubscribe = () => safeCall(() => subscription.unsubscribe?.(null, handler));
        return;
      }
      symbolPollId = window.setInterval(() => handleSymbolChange(safeGetSymbol(chart) || ""), 1000);
    }

    function detachSymbolWatcher() {
      if (symbolUnsubscribe) {
        symbolUnsubscribe();
        symbolUnsubscribe = null;
      }
      if (symbolPollId !== null) {
        window.clearInterval(symbolPollId);
        symbolPollId = null;
      }
    }

    function handleSymbolChange(symbol) {
      if (!symbol || symbol === lastSymbol) return;
      lastSymbol = symbol;
      void clearAll();
      symbolListeners.forEach((cb) => safeCall(() => cb(symbol)));
      window.postMessage({ source: "wiley-chart-bridge", event: "symbolChange", symbol }, window.location.origin);
    }

    function safeGetSymbol(chart) {
      return String(safeCall(() => chart.symbol?.()) || safeCall(() => chart.symbolExt?.()?.symbol) || "");
    }

    function extractSymbol(symbolInfo, chart) {
      if (typeof symbolInfo === "string") return symbolInfo;
      if (symbolInfo && typeof symbolInfo === "object") {
        return String(symbolInfo.symbol || symbolInfo.ticker || symbolInfo.full_name || "");
      }
      return safeGetSymbol(chart);
    }

    function normalizeStyle(kind, style) {
      const defaults = kind === "avg_entry" ? DEFAULT_ENTRY_STYLE : DEFAULT_EXIT_STYLE;
      return { ...defaults, ...style };
    }

    function normalizeMarkerStyle(side, style) {
      const color = side === "buy" ? "#22c55e" : "#f97316";
      return {
        color: style.color || color,
        textColor: "#ffffff",
        fontSize: 11,
        ...style,
      };
    }

    return {
      ready,
      upsertLine,
      removeLine,
      upsertMarker,
      removeMarker,
      clearAll,
      onSymbolChange,
      onChartRebound,
      selfTest,
    };
  }

  function lineKey(positionId, kind) {
    return `${positionId}:${kind}`;
  }

  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function safeCall(fn) {
    try {
      return fn();
    } catch {
      return undefined;
    }
  }

  const bridge = createAxiomChartBridge();
  window.__wileyChartBridge = bridge;

  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== window.location.origin) return;
    const data = event.data || {};
    if (data.source !== "wileytrader") return;
    if (data.op === "upsert") {
      void bridge.upsertLine(data.positionId, data.kind, Number(data.price), data.style || {});
    } else if (data.op === "remove") {
      void bridge.removeLine(data.positionId, data.kind);
    } else if (data.op === "upsertMarker") {
      void bridge.upsertMarker(data.positionId, data.markerId, data.side, Number(data.time), Number(data.price), data.style || {});
    } else if (data.op === "removeMarker") {
      void bridge.removeMarker(data.markerId);
    } else if (data.op === "clearAll") {
      void bridge.clearAll();
    } else if (data.op === "selfTest") {
      void bridge.selfTest();
    }
  });
})();

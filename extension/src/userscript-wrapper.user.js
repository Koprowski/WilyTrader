// ==UserScript==
// @name         WileyTrader Axiom Chart Bridge
// @namespace    https://github.com/Koprowski/WilyTrader
// @version      0.2.4
// @description  Draw WileyTrader average entry/exit lines as native TradingView chart shapes on axiom.trade.
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
    lineWidth: 2,
    lineStyle: "solid",
    labelText: "AVG ENTRY",
    showPrice: true,
  };
  const DEFAULT_EXIT_STYLE = {
    color: "#ef4444",
    lineWidth: 2,
    lineStyle: "solid",
    labelText: "AVG EXIT",
    showPrice: true,
  };

  function createAxiomChartBridge(opts = {}) {
    const desiredLines = new Map();
    const symbolListeners = new Set();
    const reboundListeners = new Set();
    let bound = null;
    let bindPromise = null;
    let mutationObserver = null;
    let symbolUnsubscribe = null;
    let symbolPollId = null;
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

    async function clearAll() {
      const lines = Array.from(desiredLines.values());
      desiredLines.clear();
      const chart = await tryEnsureBound();
      if (!chart) return;
      lines.forEach((line) => removeStoredLine(chart, line));
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

    function rebind() {
      detachSymbolWatcher();
      bound = null;
      bindPromise = null;
      desiredLines.forEach((line) => {
        line.entityId = undefined;
        line.source = undefined;
        line.mode = undefined;
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
    }

    async function upsertStoredLine(boundChart, line) {
      const entity = line.entityId ? safeCall(() => boundChart.chart.getShapeById?.(line.entityId)) : null;
      if (entity) {
        setEntityPoints(entity, line.price, boundChart);
        setEntityProperties(entity, line.style);
        return line;
      }
      if (boundChart.chart?.createShape) {
        const id = await createPublicShape(boundChart, line);
        return { ...line, entityId: id, mode: "public" };
      }
      const source = createInternalLineTool(boundChart, line);
      return { ...line, source, entityId: source, mode: "internal" };
    }

    async function createPublicShape(boundChart, line) {
      const point = { time: resolveRightmostTime(boundChart), price: line.price };
      return boundChart.chart.createShape(point, {
        shape: "horizontal_line",
        lock: true,
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

    function setEntityPoints(entity, price, boundChart) {
      safeCall(() => entity.setPoints?.([{ time: resolveRightmostTime(boundChart), price }]));
    }

    function setEntityProperties(entity, style) {
      safeCall(() => entity.setProperties?.(buildOverrides(style)));
    }

    function buildOverrides(style) {
      return {
        linecolor: style.color,
        linewidth: style.lineWidth ?? 2,
        linestyle: toTvLineStyle(style.lineStyle),
        showLabel: Boolean(style.labelText),
        text: style.labelText || "",
        showPrice: style.showPrice !== false,
        horzLabelsAlign: "right",
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
        linewidth: style.lineWidth ?? 2,
        linestyle: toTvLineStyle(style.lineStyle),
        text: style.labelText || "",
        showLabel: Boolean(style.labelText),
        showPrice: style.showPrice !== false,
        lock: true,
        disableSave: true,
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

    return {
      ready,
      upsertLine,
      removeLine,
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
    } else if (data.op === "clearAll") {
      void bridge.clearAll();
    } else if (data.op === "selfTest") {
      void bridge.selfTest();
    }
  });
})();

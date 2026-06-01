export type PriceLineKind = "avg_entry" | "avg_exit" | "stop_loss" | "take_profit";
export type ExecutionMarkerSide = "buy" | "sell";

export interface PriceLineStyle {
  color: string;
  lineWidth?: number;
  lineStyle?: "solid" | "dashed" | "dotted";
  labelText?: string;
  labelBackground?: string;
  labelAlign?: "left" | "center" | "right";
  showPrice?: boolean;
  movable?: boolean;
}

export interface ExecutionMarkerStyle {
  color: string;
  text?: string;
  shape?: string;
  textColor?: string;
  background?: string;
  fontSize?: number;
}

export interface AxiomChartBridgeHealth {
  ok: boolean;
  iframeFound: boolean;
  iframeId?: string;
  hasTradingViewApi: boolean;
  hasChartWidget: boolean;
  hasPublicCreateShape: boolean;
  hasInternalCreateLineTool: boolean;
  symbol?: string;
  message: string;
}

export interface AxiomChartBridge {
  ready(): Promise<void>;
  upsertLine(positionId: string, kind: PriceLineKind, price: number, style: PriceLineStyle): Promise<void>;
  removeLine(positionId: string, kind: PriceLineKind): Promise<void>;
  upsertMarker(positionId: string, markerId: string, side: ExecutionMarkerSide, time: number, price: number, style: ExecutionMarkerStyle): Promise<void>;
  removeMarker(markerId: string): Promise<void>;
  clearAll(): Promise<void>;
  onSymbolChange(cb: (newSymbol: string) => void): () => void;
  onChartRebound(cb: () => void): () => void;
  selfTest(): Promise<AxiomChartBridgeHealth>;
}

type TradingViewWindow = Window & {
  TradingView?: unknown;
  chartWidget?: any;
  tradingViewApi?: any;
  ChartApiInstance?: any;
  widgetReady?: Promise<unknown> | boolean;
};

type StoredLine = {
  positionId: string;
  kind: PriceLineKind;
  price: number;
  style: PriceLineStyle;
  entityId?: unknown;
  source?: unknown;
  mode?: "public" | "internal";
};

type StoredMarker = {
  positionId: string;
  markerId: string;
  side: ExecutionMarkerSide;
  time: number;
  price: number;
  style: ExecutionMarkerStyle;
  entityId?: unknown;
  mode?: "public";
};

type BoundChart = {
  iframe: HTMLIFrameElement;
  win: TradingViewWindow;
  api: any;
  chartWidget: any;
  chart: any;
};

const IFRAME_ID_RE = /^tradingview_[a-f0-9]+$/i;
const DEFAULT_ENTRY_STYLE: PriceLineStyle = {
  color: "#22c55e",
  lineWidth: 1,
  lineStyle: "dashed",
  labelText: "AVG ENTRY",
  showPrice: true,
};
const DEFAULT_EXIT_STYLE: PriceLineStyle = {
  color: "#ef4444",
  lineWidth: 1,
  lineStyle: "dashed",
  labelText: "AVG EXIT",
  showPrice: true,
};

export function createAxiomChartBridge(opts: { preferIframeIndex?: number } = {}): AxiomChartBridge {
  const desiredLines = new Map<string, StoredLine>();
  const desiredMarkers = new Map<string, StoredMarker>();
  const symbolListeners = new Set<(newSymbol: string) => void>();
  const reboundListeners = new Set<() => void>();
  let bound: BoundChart | null = null;
  let bindPromise: Promise<BoundChart> | null = null;
  let mutationObserver: MutationObserver | null = null;
  let symbolUnsubscribe: (() => void) | null = null;
  let symbolPollId: number | null = null;
  let lineMovePollId: number | null = null;
  let lastSymbol = "";
  let flushScheduled = false;

  startObserver();

  async function ready(): Promise<void> {
    await ensureBound();
  }

  async function upsertLine(positionId: string, kind: PriceLineKind, price: number, style: PriceLineStyle): Promise<void> {
    if (!positionId || !Number.isFinite(price) || price <= 0) return;
    const key = lineKey(positionId, kind);
    desiredLines.set(key, {
      ...(desiredLines.get(key) || {}),
      positionId,
      kind,
      price,
      style: normalizeStyle(kind, style),
    });
    scheduleFlush();
  }

  async function removeLine(positionId: string, kind: PriceLineKind): Promise<void> {
    const key = lineKey(positionId, kind);
    const existing = desiredLines.get(key);
    desiredLines.delete(key);
    if (!existing) return;
    const chart = await tryEnsureBound();
    if (chart) removeStoredLine(chart, existing);
  }

  async function upsertMarker(
    positionId: string,
    markerId: string,
    side: ExecutionMarkerSide,
    time: number,
    price: number,
    style: ExecutionMarkerStyle,
  ): Promise<void> {
    if (!positionId || !markerId || !Number.isFinite(time) || !Number.isFinite(price) || price <= 0) return;
    desiredMarkers.set(markerId, {
      ...(desiredMarkers.get(markerId) || {}),
      positionId,
      markerId,
      side,
      time,
      price,
      style: normalizeMarkerStyle(side, style),
    });
    scheduleFlush();
  }

  async function removeMarker(markerId: string): Promise<void> {
    const existing = desiredMarkers.get(markerId);
    desiredMarkers.delete(markerId);
    if (!existing) return;
    const chart = await tryEnsureBound();
    if (chart) removeStoredMarker(chart, existing);
  }

  async function clearAll(): Promise<void> {
    const lines = Array.from(desiredLines.values());
    const markers = Array.from(desiredMarkers.values());
    desiredLines.clear();
    desiredMarkers.clear();
    const chart = await tryEnsureBound();
    if (!chart) return;
    lines.forEach((line) => removeStoredLine(chart, line));
    markers.forEach((marker) => removeStoredMarker(chart, marker));
  }

  function onSymbolChange(cb: (newSymbol: string) => void): () => void {
    symbolListeners.add(cb);
    return () => symbolListeners.delete(cb);
  }

  function onChartRebound(cb: () => void): () => void {
    reboundListeners.add(cb);
    return () => reboundListeners.delete(cb);
  }

  async function selfTest(): Promise<AxiomChartBridgeHealth> {
    const iframe = findActiveIframe();
    let win: TradingViewWindow | null = null;
    let api: any = null;
    let chartWidget: any = null;
    let chart: any = null;
    try {
      win = iframe?.contentWindow as TradingViewWindow | null;
      api = win?.tradingViewApi;
      chartWidget = win?.chartWidget;
      chart = resolveChart(api);
    } catch {
      // Keep health output compact and non-throwing.
    }
    const health: AxiomChartBridgeHealth = {
      ok: Boolean(iframe && api && chartWidget && (chart?.createShape || chartWidget?._model?.createLineTool)),
      iframeFound: Boolean(iframe),
      iframeId: iframe?.id,
      hasTradingViewApi: Boolean(api),
      hasChartWidget: Boolean(chartWidget),
      hasPublicCreateShape: Boolean(chart?.createShape),
      hasInternalCreateLineTool: Boolean(chartWidget?._model?.createLineTool),
      symbol: safeGetSymbol(chart),
      message: "",
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
      const price = readStoredLinePrice(bound as BoundChart, line);
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

  async function tryEnsureBound(): Promise<BoundChart | null> {
    try {
      return await ensureBound();
    } catch (error) {
      console.debug("[WileyChartBridge] Chart not ready.", error);
      return null;
    }
  }

  async function ensureBound(): Promise<BoundChart> {
    if (bound && isIframeUsable(bound.iframe)) return bound;
    if (bindPromise) return bindPromise;
    bindPromise = bindToChart().finally(() => {
      bindPromise = null;
    });
    bound = await bindPromise;
    attachSymbolWatcher(bound);
    return bound;
  }

  async function bindToChart(): Promise<BoundChart> {
    const started = Date.now();
    while (Date.now() - started < 10_000) {
      const iframe = findActiveIframe();
      if (iframe?.contentWindow) {
        const win = iframe.contentWindow as TradingViewWindow;
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

  async function awaitWidgetReady(win: TradingViewWindow) {
    const readyValue = win.widgetReady;
    if (readyValue && typeof (readyValue as Promise<unknown>).then === "function") {
      await Promise.race([(readyValue as Promise<unknown>).catch(() => undefined), delay(3000)]);
    }
    const started = Date.now();
    while (Date.now() - started < 10_000) {
      if (win.tradingViewApi && win.chartWidget) return;
      await delay(100);
    }
  }

  function findActiveIframe(): HTMLIFrameElement | null {
    const frames = Array.from(document.querySelectorAll<HTMLIFrameElement>("iframe"))
      .filter((iframe) => IFRAME_ID_RE.test(iframe.id))
      .map((iframe, index) => ({ iframe, index, rect: iframe.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.left < window.innerWidth && rect.top < window.innerHeight)
      .sort((a, b) => (b.rect.width * b.rect.height) - (a.rect.width * a.rect.height));
    if (opts.preferIframeIndex !== undefined) {
      return frames.find((item) => item.index === opts.preferIframeIndex)?.iframe || frames[0]?.iframe || null;
    }
    return frames[0]?.iframe || null;
  }

  function isIframeUsable(iframe: HTMLIFrameElement) {
    if (!iframe.isConnected) return false;
    const rect = iframe.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function resolveChart(api: any) {
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

  async function upsertStoredLine(boundChart: BoundChart, line: StoredLine): Promise<StoredLine> {
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

  async function createPublicShape(boundChart: BoundChart, line: StoredLine): Promise<unknown> {
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

  function createInternalLineTool(boundChart: BoundChart, line: StoredLine): unknown {
    // Fragile fallback: this relies on TradingView private model internals and may break on Axiom updates.
    const model = boundChart.chartWidget?._model;
    if (!model?.createLineTool) throw new Error("No TradingView line creation API found.");
    return model.createLineTool("LineToolHorzLine", [{ price: line.price, index: resolveLastBarIndex(boundChart) }], buildInternalProperties(line.style));
  }

  function removeStoredLine(boundChart: BoundChart, line: StoredLine) {
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

  async function upsertStoredMarker(boundChart: BoundChart, marker: StoredMarker): Promise<StoredMarker> {
    const entity = marker.entityId ? safeCall(() => boundChart.chart.getShapeById?.(marker.entityId)) : null;
    if (entity) {
      safeCall(() => entity.setPoints?.([{ time: marker.time, price: marker.price }]));
      safeCall(() => entity.setProperties?.(buildMarkerOverrides(marker)));
      return marker;
    }
    if (!boundChart.chart?.createShape) {
      throw new Error("No TradingView marker creation API found.");
    }
    const id = await boundChart.chart.createShape({ time: marker.time, price: marker.price }, {
      shape: marker.style.shape || (marker.side === "buy" ? "arrow_up" : "arrow_down"),
      lock: true,
      disableSelection: false,
      disableSave: true,
      disableUndo: true,
      overrides: buildMarkerOverrides(marker),
    });
    return { ...marker, entityId: id, mode: "public" };
  }

  function removeStoredMarker(boundChart: BoundChart, marker: StoredMarker) {
    if (marker.entityId && boundChart.chart?.removeEntity) {
      safeCall(() => boundChart.chart.removeEntity(marker.entityId));
    }
    marker.entityId = undefined;
    marker.mode = undefined;
  }

  function setEntityPoints(entity: any, price: number, boundChart: BoundChart) {
    safeCall(() => entity.setPoints?.([{ time: resolveRightmostTime(boundChart), price }]));
  }

  function setEntityProperties(entity: any, style: PriceLineStyle) {
    safeCall(() => entity.setProperties?.(buildOverrides(style)));
  }

  function buildOverrides(style: PriceLineStyle) {
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

  function buildInternalProperties(style: PriceLineStyle) {
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

  function isMovableLine(line: StoredLine) {
    return Boolean(line.style?.movable);
  }

  function readStoredLinePrice(boundChart: BoundChart, line: StoredLine): number | null {
    const entity = line.entityId ? safeCall(() => boundChart.chart.getShapeById?.(line.entityId)) : null;
    const entityPoints = entity ? readPointList(entity) : null;
    const entityPrice = extractPointPrice(entityPoints?.[0]);
    if (Number.isFinite(entityPrice)) return entityPrice;

    const sourcePoints = line.source ? readPointList(line.source) : null;
    const sourcePrice = extractPointPrice(sourcePoints?.[0]);
    return Number.isFinite(sourcePrice) ? sourcePrice : null;
  }

  function readPointList(source: any): any[] | null {
    const points = safeCall(() => source.getPoints?.())
      || safeCall(() => source.points?.())
      || safeCall(() => source._points)
      || safeCall(() => source._points?.());
    return Array.isArray(points) ? points : null;
  }

  function extractPointPrice(point: any): number | null {
    const price = Number(point?.price ?? point?._price ?? point?.value?.price ?? point?.value?._price);
    return Number.isFinite(price) && price > 0 ? price : null;
  }

  function buildMarkerOverrides(marker: StoredMarker) {
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

  function toTvLineStyle(style: PriceLineStyle["lineStyle"]) {
    if (style === "dotted") return 1;
    if (style === "dashed") return 2;
    return 0;
  }

  function resolveRightmostTime(boundChart: BoundChart) {
    return safeCall(() => boundChart.chart.getVisibleRange?.()?.to)
      || safeCall(() => boundChart.chart.getVisibleRange?.().to)
      || Math.floor(Date.now() / 1000);
  }

  function resolveLastBarIndex(boundChart: BoundChart) {
    return safeCall(() => boundChart.chartWidget.getTimeScale?.().rightmostIndex?.())
      || safeCall(() => boundChart.chartWidget._model?.timeScale?.().rightmostIndex?.())
      || 0;
  }

  function attachSymbolWatcher(boundChart: BoundChart) {
    detachSymbolWatcher();
    const chart = boundChart.chart;
    lastSymbol = safeGetSymbol(chart) || "";
    const subscription = safeCall(() => chart.onSymbolChanged?.());
    if (subscription?.subscribe) {
      const handler = (symbolInfo: unknown) => {
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

  function handleSymbolChange(symbol: string) {
    if (!symbol || symbol === lastSymbol) return;
    lastSymbol = symbol;
    void clearAll();
    symbolListeners.forEach((cb) => safeCall(() => cb(symbol)));
    window.postMessage({ source: "wiley-chart-bridge", event: "symbolChange", symbol }, window.location.origin);
  }

  function safeGetSymbol(chart: any): string {
    return String(safeCall(() => chart.symbol?.()) || safeCall(() => chart.symbolExt?.()?.symbol) || "");
  }

  function extractSymbol(symbolInfo: unknown, chart: any): string {
    if (typeof symbolInfo === "string") return symbolInfo;
    if (symbolInfo && typeof symbolInfo === "object") {
      const info = symbolInfo as Record<string, unknown>;
      return String(info.symbol || info.ticker || info.full_name || "");
    }
    return safeGetSymbol(chart);
  }

  function normalizeStyle(kind: PriceLineKind, style: PriceLineStyle): PriceLineStyle {
    const defaults = kind === "avg_entry" ? DEFAULT_ENTRY_STYLE : DEFAULT_EXIT_STYLE;
    return { ...defaults, ...style };
  }

  function normalizeMarkerStyle(side: ExecutionMarkerSide, style: ExecutionMarkerStyle): ExecutionMarkerStyle {
    const color = side === "buy" ? "#22c55e" : "#ef4444";
    return {
      color: style.color || color,
      textColor: "#ffffff",
      fontSize: 11,
      ...style,
    };
  }

  function lineKey(positionId: string, kind: PriceLineKind) {
    return `${positionId}:${kind}`;
  }

  function delay(ms: number) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }

  function safeCall<T>(fn: () => T): T | undefined {
    try {
      return fn();
    } catch {
      return undefined;
    }
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

declare global {
  interface Window {
    __wileyChartBridge?: AxiomChartBridge;
  }
}

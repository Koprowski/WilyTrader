import { app, BrowserWindow, clipboard, desktopCapturer, dialog, globalShortcut, ipcMain, shell } from 'electron';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { execSync, spawn } from 'node:child_process';
import JSZip from 'jszip';
import { resolveGeminiCliExecutable } from './gemini-cli-exec';
import type {
  AbandonSessionResult,
  AudioChunkMeta,
  AudioRecordingMeta,
  BridgeExecutionEvent,
  BridgeScreenshotPayload,
  MasterSyncResult,
  StopSessionResult,
  TranscriptSegment,
  WilyTraderDesktopSettings,
  WilyTraderDesktopStatus,
  WilyTraderDesktopUpdateStatus,
  WilyTraderExtensionStatus,
  WilyTraderSessionFinalization,
} from '../shared';

const BRIDGE_PORT = 17365;
const MAX_BRIDGE_BODY_BYTES = 25 * 1024 * 1024;
const WILYTRADER_TAGS_API_URL = 'https://api.github.com/repos/Koprowski/WilyTrader/tags?per_page=10';
const WILYTRADER_LATEST_RELEASE_API_URL = 'https://api.github.com/repos/Koprowski/WilyTrader/releases/latest';
const WILYTRADER_RELEASE_BASE_URL = 'https://github.com/Koprowski/WilyTrader/releases';
const WILYTRADER_DESKTOP_ASSET_SUFFIX = 'desktop-setup.exe';
const WILYTRADER_EXTENSION_ASSET_SUFFIX = 'extension.zip';
const MASTER_TRADING_LOG_FILE_NAME = 'master trading log.xlsx';
const MASTER_TRADING_LOG_TEMPLATE_FILE_NAME = 'master trading log - Template.xlsx';
const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const ffmpegPath = require('ffmpeg-static') as string | null;

interface ActiveTradeSession {
  sessionDir: string;
  inputsDir: string;
  audioDir: string;
  screenshotDir: string;
  screenshotMetadataDir: string;
  sessionStartedAtMs: number;
  transcriptSegments: TranscriptSegment[];
  audioChunks: AudioChunkMeta[];
  audioRecording: AudioRecordingMeta | null;
  executionsReceived: number;
  screenshotsReceived: number;
  lastLedgerPayload: unknown | null;
  marketCapObservations: MarketCapObservation[];
  incrementalTranscription: IncrementalTranscriptionRun;
}

interface IncrementalTranscriptionRun {
  queue: Promise<void>;
  chunksReceived: number;
  failedChunks: number;
  warnings: string[];
  results: IncrementalTranscriptionChunkResult[];
}

interface IncrementalTranscriptionChunkResult {
  index: number;
  segments: TranscriptSegment[];
}

interface NormalizedTrade {
  id: string;
  tokenName: string;
  platform: string;
  chain: string;
  entryMarketCap: number | null;
  exitMarketCap: number | null;
  highMarketCapAfterEntry: number | null;
  highMarketCapAtMs?: number | null;
  lowMarketCapAfterEntry: number | null;
  lowMarketCapAtMs?: number | null;
  ohlcSampleCount?: number | null;
  ohlcSampleIntervalMs?: number | null;
  ohlcRangeSource?: string | null;
  solInvested: number | null;
  solReceived: number | null;
  buyFeesNative: number | null;
  sellFeesNative: number | null;
  pnlSol: number | null;
  pnlPercentage: number | null;
  timestampMs: number | null;
  entryTimestampMs: number | null;
  timeInTradeSeconds: number | null;
  tokenAddress: string | null;
  executions?: TradeExecutionPoint[];
  ohlcMc?: TradeOhlc | null;
  ohlcPct?: TradeOhlc | null;
  ohlcSol?: TradeOhlc | null;
  ohlcSource?: string | null;
  enrichmentSource?: 'ledger' | 'llm';
  entryCommentaryOffsetMs?: number | null;
  exitCommentaryOffsetMs?: number | null;
  targetLowMc?: number | null;
  targetHighMc?: number | null;
  stopLossMc?: number | null;
  rationale?: string | null;
  preTranscriptExcerpt?: string | null;
  postTranscriptExcerpt?: string | null;
  adherenceSelfAssessment?: string | null;
  needsReview?: boolean | null;
  notes?: string | null;
  metaClusterId?: string | null;
  metaName?: string | null;
  nScore?: number | null;
  nWhy?: string | null;
  iScore?: number | null;
  iWhy?: string | null;
  cScore?: number | null;
  cWhy?: string | null;
  sScore?: number | null;
  sWhy?: string | null;
  nicsScore?: number | null;
  sizeOk?: boolean | null;
  zoneOk?: boolean | null;
  cooldownOk?: boolean | null;
  tradeType?: string | null;
  countsToward50?: boolean | null;
  hardReset?: boolean | null;
  runningCount?: number | null;
  nonNicsPnlPct?: number | null;
  clusterPnlPct?: number | null;
  llmGradeNotes?: string | null;
}

interface TradeExecutionPoint {
  id: string | null;
  side: string | null;
  timestampMs: number | null;
  marketCapUsd: number | null;
  unitPriceNative: number | null;
  requestedSellPct: number | null;
  tokenAmount: number | null;
  grossNative: number | null;
  netNative: number | null;
  feeNative: number | null;
  costBasisNative: number | null;
  pnlNative: number | null;
  pnlPct: number | null;
  screenshotPath?: string | null;
}

interface TradeScreenshotCandidate {
  path: string;
  side: string | null;
  executionId: string | null;
  tokenName: string | null;
  tokenAddress: string | null;
  timestampMs: number | null;
  rank: number;
}

type XlsxStyleKey = 'integer' | 'sol3' | 'percent1' | 'nativePrice' | 'date';

type XlsxCell = string | number | {
  text: string;
  hyperlink?: string;
  formula?: string;
  tooltip?: string;
  style?: XlsxStyleKey;
};

interface XlsxHyperlink {
  ref: string;
  target: string;
  tooltip?: string;
}

interface TradeOhlc {
  open: number;
  high: number;
  low: number;
  close: number;
}

interface MarketCapObservation {
  tokenAddress: string | null;
  tokenName: string | null;
  timestampMs: number;
  marketCapUsd: number;
  source: string;
}

interface LlmTradeExtraction {
  mockape_trade_id: string | null;
  token_name: string | null;
  pre_call_offset_ms: number | null;
  post_call_offset_ms: number | null;
  target_low_mc: number | null;
  target_high_mc: number | null;
  stop_loss_mc: number | null;
  rationale: string | null;
  pre_transcript_excerpt: string | null;
  post_transcript_excerpt: string | null;
  adherence_self_assessment: string | null;
  needs_review: boolean | null;
  notes: string | null;
  meta_name: string | null;
  N_score: number | null;
  N_why: string | null;
  I_score: number | null;
  I_why: string | null;
  C_score: number | null;
  C_why: string | null;
  S_score: number | null;
  S_why: string | null;
  NICS_score: number | null;
  size_ok: boolean | null;
  zone_ok: boolean | null;
  cooldown_ok: boolean | null;
  trade_type: string | null;
  counts_toward_50: boolean | null;
  hard_reset: boolean | null;
  running_count: number | null;
  non_nics_pnl_pct: number | null;
  cluster_pnl_pct: number | null;
  llm_grade_notes: string | null;
}

interface TradeEnrichmentResult {
  trades: NormalizedTrade[];
  promptPath: string | null;
  responsePath: string | null;
  warnings: string[];
}

interface FinalizingTradeSession {
  sessionDir: string;
  sessionStartedAtMs: number;
  stoppedAtMs: number;
  executionsReceived: number;
  screenshotsReceived: number;
  finalization: WilyTraderSessionFinalization;
}

let mainWindow: BrowserWindow | null = null;
let activeSession: ActiveTradeSession | null = null;
let finalizingSession: FinalizingTradeSession | null = null;
let bridgeServer: http.Server | null = null;
let settings: WilyTraderDesktopSettings = fallbackSettings();
let extensionStatus: WilyTraderExtensionStatus = defaultExtensionStatus();
let desktopUpdateStatus: WilyTraderDesktopUpdateStatus = defaultDesktopUpdateStatus();
let updateCheckTimer: NodeJS.Timeout | null = null;
let registeredTradeSessionHotkey: string | null = null;
let activeGeminiSigninChild: ReturnType<typeof spawn> | null = null;
let lastCompletedSessionDir: string | null = null;

function createWindow(): void {
  const preloadPath = path.join(__dirname, '..', 'preload.js');
  debugLog('main', 'creating window', {
    appPath: app.getAppPath(),
    cwd: process.cwd(),
    preloadPath,
    preloadExists: fs.existsSync(preloadPath),
    userData: app.getPath('userData'),
  });
  mainWindow = new BrowserWindow({
    width: 920,
    height: 680,
    minWidth: 760,
    minHeight: 540,
    title: 'WilyTrader Desktop',
    show: false,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    mainWindow?.focus();
    console.log(`[WilyTrader Desktop] window ready: ${mainWindow?.getTitle() ?? 'untitled'}`);
  });
  mainWindow.webContents.on('console-message', (_event, level, message) => {
    debugLog('renderer-console', 'console-message', { level, message });
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.log(`[WilyTrader Desktop] renderer exited: ${details.reason}`);
  });
  void mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
}

app.whenReady().then(() => {
  settings = loadSettings();
  lastCompletedSessionDir = findLastCompletedSessionDir(settings.outputDir);
  extensionStatus = {
    ...extensionStatus,
    ...detectLocalExtensionManifest(),
  };
  registerIpc();
  registerTradeSessionHotkey();
  createWindow();
  console.log(`[WilyTrader Desktop] started. Bridge port ${BRIDGE_PORT}. Output: ${settings.outputDir}`);
  scheduleUpdateChecks();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopBridge('window closed');
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (updateCheckTimer) clearInterval(updateCheckTimer);
  globalShortcut.unregisterAll();
});

function registerIpc(): void {
  debugLog('ipc', 'registering handlers');
  ipcMain.handle('debug:log', async (_event, payload) => {
    const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
    debugLog(String(record.scope ?? 'renderer'), String(record.message ?? 'debug'), record.details);
    return { ok: true };
  });
  ipcMain.handle('app:info', async () => ({
    name: app.getName(),
    version: app.getVersion(),
  }));
  ipcMain.handle('session:start', async () => startSession());
  ipcMain.handle('session:stop', async () => stopSession());
  ipcMain.handle('session:abandon', async () => abandonSession());
  ipcMain.handle('session:open-active-folder', async () => openActiveSessionFolder());
  ipcMain.handle('session:copy-active-folder-link', async () => copyActiveSessionFolderLink());
  ipcMain.handle('session:open-last-completed-folder', async () => openLastCompletedSessionFolder());
  ipcMain.handle('session:copy-last-completed-folder-link', async () => copyLastCompletedSessionFolderLink());
  ipcMain.handle('session:sync-master-trading-log', async () => syncMasterTradingLog());
  ipcMain.handle('session:status', async () => getStatus());
  ipcMain.handle('session:audio-chunk', async (_event, payload) => saveAudioChunk(payload));
  ipcMain.handle('session:audio-recording', async (_event, payload) => saveAudioRecording(payload));
  ipcMain.handle('session:transcript-segment', async (_event, payload) => addTranscriptSegment(payload));
  ipcMain.handle('settings:get', async () => settings);
  ipcMain.handle('settings:save', async (_event, payload) => saveSettings(payload));
  ipcMain.handle('settings:check-dependencies', async (_event, payload) => {
    debugLog('ipc', 'settings:check-dependencies received', { payload });
    try {
      const result = await checkDependencies(payload);
      debugLog('ipc', 'settings:check-dependencies completed', summarizeDependencyResult(result));
      return result;
    } catch (err) {
      debugLog('ipc', 'settings:check-dependencies failed', errorDetails(err));
      throw err;
    }
  });
  ipcMain.handle('settings:install-whisper', async () => {
    debugLog('ipc', 'settings:install-whisper received');
    return installWhisperDependency();
  });
  ipcMain.handle('settings:install-gemini-cli', async () => {
    debugLog('ipc', 'settings:install-gemini-cli received');
    return installGeminiCli();
  });
  ipcMain.handle('settings:install-node', async () => {
    debugLog('ipc', 'settings:install-node received');
    return installNodeLts();
  });
  ipcMain.handle('settings:test-llm-connection', async (_event, payload) => {
    debugLog('ipc', 'settings:test-llm-connection received', sanitizeLlmPayload(payload));
    return testLlmConnection(payload);
  });
  ipcMain.handle('settings:list-openrouter-models', async () => {
    debugLog('ipc', 'settings:list-openrouter-models received');
    return listOpenRouterModelsWithCache();
  });
  ipcMain.handle('settings:list-gemini-cli-models', async () => {
    debugLog('ipc', 'settings:list-gemini-cli-models received');
    return listGeminiCliModels();
  });
  ipcMain.handle('settings:gemini-cli-signin-status', async () => {
    debugLog('ipc', 'settings:gemini-cli-signin-status received');
    const result = geminiCliSigninStatus();
    debugLog('ipc', 'settings:gemini-cli-signin-status completed', result);
    return result;
  });
  ipcMain.handle('settings:gemini-cli-signin', async (_event, payload) => {
    debugLog('ipc', 'settings:gemini-cli-signin received', { payload });
    const result = await geminiCliSignin(payload);
    debugLog('ipc', 'settings:gemini-cli-signin completed', result);
    return result;
  });
  ipcMain.handle('settings:gemini-cli-signin-cancel', async () => {
    debugLog('ipc', 'settings:gemini-cli-signin-cancel received');
    return geminiCliSigninCancel();
  });
  ipcMain.handle('settings:gemini-cli-signout', async () => {
    debugLog('ipc', 'settings:gemini-cli-signout received');
    return geminiCliSignout();
  });
  ipcMain.handle('extension:check-updates', async () => {
    await checkExtensionUpdates(true);
    return getStatus();
  });
  ipcMain.handle('extension:open-folder', async () => openWilyTraderExtensionFolder());
  ipcMain.handle('extension:open-chrome-extensions', async () => openChromeExtensionsPage());
  ipcMain.handle('extension:open-latest-release', async () => openLatestExtensionReleasePage());
  ipcMain.handle('extension:download-latest-release', async () => openLatestExtensionDownload());
  ipcMain.handle('extension:update-latest-release', async () => updateLatestExtensionFiles());
  ipcMain.handle('extension:move-location', async () => moveWilyTraderExtensionLocation());
  ipcMain.handle('desktop:check-updates', async () => {
    await checkDesktopUpdates(true);
    return getStatus();
  });
  ipcMain.handle('desktop:open-latest-release', async () => openLatestDesktopReleasePage());
  ipcMain.handle('desktop:download-latest-release', async () => openLatestDesktopDownload());
  ipcMain.handle('desktop:install-latest-release', async () => installLatestDesktopRelease());
}

function debugLog(scope: string, message: string, details?: unknown): void {
  const entry = {
    at: new Date().toISOString(),
    pid: process.pid,
    scope,
    message,
    details: details ?? null,
  };
  const line = JSON.stringify(entry);
  try {
    const userData = app.isReady() ? app.getPath('userData') : path.join(os.homedir(), 'AppData', 'Roaming', 'wilytrader-desktop');
    fs.mkdirSync(userData, { recursive: true });
    fs.appendFileSync(path.join(userData, 'debug.log'), `${line}${os.EOL}`, 'utf-8');
  } catch {
    // Keep debug logging non-fatal.
  }
  console.log(`[WilyTrader Desktop][${scope}] ${message}`, details ?? '');
}

function errorDetails(err: unknown): Record<string, unknown> {
  return err instanceof Error
    ? { name: err.name, message: err.message, stack: err.stack }
    : { message: String(err) };
}

function tail(value: string, max = 500): string {
  return value.length > max ? value.slice(-max) : value;
}

function sanitizeForLog(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object') {
    return typeof value === 'string' && value.length > 1000 ? tail(value, 1000) : value;
  }
  if (depth > 4) return '[MaxDepth]';
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeForLog(item, depth + 1));
  const redacted: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    redacted[key] = /(api[-_]?key|authorization|bearer|credential|oauth|password|secret|token)/i.test(key)
      ? '[REDACTED]'
      : sanitizeForLog(raw, depth + 1);
  }
  return redacted;
}

function sanitizeLlmPayload(payload: unknown): unknown {
  return sanitizeForLog(payload);
}

function dependencyProbeSummary(result: DependencyProbeResult): Record<string, unknown> {
  return {
    ok: result.ok,
    code: result.code,
    timedOut: result.timedOut,
    error: result.error,
    stdoutTail: tail(result.stdout.trim(), 500),
    stderrTail: tail(cleanCliStderr(result.stderr), 500),
  };
}

function summarizeDependencyResult(result: Awaited<ReturnType<typeof checkDependencies>>): Record<string, unknown> {
  return {
    whisper: {
      ok: result.whisper.ok,
      message: result.whisper.message,
      exePath: result.whisper.exePath,
      modelPath: result.whisper.modelPath,
    },
    node: {
      ok: result.node.ok,
      optional: result.node.optional,
      version: result.node.version,
      message: result.node.message,
    },
    geminiCli: {
      ok: result.geminiCli.ok,
      version: result.geminiCli.version,
      command: result.geminiCli.command,
      message: result.geminiCli.message,
    },
  };
}

function registerTradeSessionHotkey(): void {
  if (!app.isReady()) return;
  if (registeredTradeSessionHotkey) {
    globalShortcut.unregister(registeredTradeSessionHotkey);
    registeredTradeSessionHotkey = null;
  }
  const hotkey = settings.tradeSessionHotkey.trim();
  if (!hotkey) return;
  const registered = globalShortcut.register(hotkey, () => {
    void toggleTradeSessionFromHotkey();
  });
  if (registered) {
    registeredTradeSessionHotkey = hotkey;
    console.log(`[WilyTrader Desktop] registered trade-session hotkey ${hotkey}`);
  } else {
    console.log(`[WilyTrader Desktop] failed to register trade-session hotkey ${hotkey}`);
  }
}

async function toggleTradeSessionFromHotkey(): Promise<void> {
  try {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('session:toggle-requested');
      mainWindow.show();
      return;
    }
    if (finalizingSession) return;
    if (activeSession) {
      await stopSession();
      return;
    }
    startSession();
  } catch (err) {
    console.log(`[WilyTrader Desktop] hotkey toggle failed: ${(err as Error).message}`);
    broadcastStatus();
  }
}

function startSession(): WilyTraderDesktopStatus {
  if (activeSession) return getStatus();
  if (finalizingSession) return getStatus();

  const sessionStartedAtMs = Date.now();
  const sessionDir = nextSessionDir(settings.outputDir, new Date(sessionStartedAtMs));
  const inputsDir = path.join(sessionDir, 'Inputs');
  const audioDir = path.join(inputsDir, 'audio');
  const screenshotDir = path.join(inputsDir, 'trade-screenshots');
  const screenshotMetadataDir = path.join(inputsDir, 'trade-screenshot-metadata');
  fs.mkdirSync(audioDir, { recursive: true });
  fs.mkdirSync(screenshotDir, { recursive: true });
  fs.mkdirSync(screenshotMetadataDir, { recursive: true });

  activeSession = {
    sessionDir,
    inputsDir,
    audioDir,
    screenshotDir,
    screenshotMetadataDir,
    sessionStartedAtMs,
    transcriptSegments: [],
    audioChunks: [],
    audioRecording: null,
    executionsReceived: 0,
    screenshotsReceived: 0,
    lastLedgerPayload: null,
    marketCapObservations: [],
    incrementalTranscription: createIncrementalTranscriptionRun(),
  };

  writeJson(path.join(sessionDir, 'session_manifest.json'), {
    app: 'WilyTrader Desktop',
    mode: 'trade',
    sessionStartedAt: new Date(sessionStartedAtMs).toISOString(),
    sessionStartedAtMs,
    bridge: {
      endpoint: `http://127.0.0.1:${BRIDGE_PORT}/v1/wilytrader/ledger`,
    },
    artifactBoundary: 'audio-first; browser extension provides DOM ledger events and optional tab screenshots',
  });
  writeStatusFile('recording');
  appendSessionLog('session', 'started', { sessionDir, sessionStartedAtMs }, 'start');
  startBridge();
  broadcastStatus();
  return getStatus();
}

async function stopSession(): Promise<StopSessionResult> {
  const session = activeSession;
  if (!session) throw new Error('No active WilyTrader trade session.');

  activeSession = null;
  stopBridge('session stopped');

  const stoppedAtMs = Date.now();
  startFinalizingSession(session, stoppedAtMs);
  writeJson(path.join(session.sessionDir, 'session_manifest.json'), {
    app: 'WilyTrader Desktop',
    mode: 'trade',
    sessionStartedAt: new Date(session.sessionStartedAtMs).toISOString(),
    sessionStartedAtMs: session.sessionStartedAtMs,
    sessionStoppedAt: new Date(stoppedAtMs).toISOString(),
    sessionStoppedAtMs: stoppedAtMs,
    durationMs: stoppedAtMs - session.sessionStartedAtMs,
    audioChunks: session.audioChunks.length,
    audioRecording: session.audioRecording,
    transcriptSegments: session.transcriptSegments.length,
    executionsReceived: session.executionsReceived,
    screenshotsReceived: session.screenshotsReceived,
  });
  updateFinalizationProgress(session, 'stopping', 'Recording stopped; preparing session artifacts.', 8);

  const warnings = await transcribeSessionAudio(session, (phase, message, percent) => {
    updateFinalizationProgress(session, phase, message, percent);
  });
  updateFinalizationProgress(session, 'artifacts', 'Writing transcript files.', 82);
  const transcriptJsonPath = writeTranscriptJson(session);
  const transcriptMdPath = writeTranscriptMd(session);
  updateFinalizationProgress(session, 'trade-log', 'Building trade log artifacts.', 90);
  const trades = loadTradesFromSession(session, stoppedAtMs);
  const enrichment = settings.generateTradeLogOnStop
    ? await enrichTradesForSession(session, trades, stoppedAtMs, (phase, message, percent) => {
        updateFinalizationProgress(session, phase, message, percent);
      })
    : { trades, promptPath: null, responsePath: null, warnings: [] };
  warnings.push(...enrichment.warnings);
  const sortedTrades = sortTradesByExitDateTime(enrichment.trades);
  const tradeLogMdPath = settings.generateTradeLogOnStop ? writeTradeLogMd(session, sortedTrades) : '';
  const tradeLogXlsxPath = settings.generateTradeLogOnStop ? await writeTradeLogXlsx(session, sortedTrades, stoppedAtMs) : '';
  updateFinalizationProgress(session, 'complete', 'Session finalized.', 100);
  writeStatusFileForSession(session, 'complete', {
    durationMs: stoppedAtMs - session.sessionStartedAtMs,
    tradeLogMdPath,
    tradeLogXlsxPath,
    transcriptJsonPath,
    transcriptMdPath,
    extractionPromptPath: enrichment.promptPath,
    extractionResponsePath: enrichment.responsePath,
  });
  appendSessionLogForSession(session, 'session', 'completed', {
    trades: enrichment.trades.length,
    tradeLogMdPath,
    tradeLogXlsxPath,
    extractionPromptPath: enrichment.promptPath,
    extractionResponsePath: enrichment.responsePath,
  }, 'success');
  lastCompletedSessionDir = session.sessionDir;
  broadcastStatus();
  finalizingSession = null;
  broadcastStatus();
  return {
    ok: true,
    sessionDir: session.sessionDir,
    transcriptJsonPath,
    transcriptMdPath,
    tradeLogXlsxPath,
    tradeLogMdPath,
    warnings,
  };
}

async function abandonSession(): Promise<AbandonSessionResult> {
  const session = activeSession;
  if (!session) throw new Error('No active WilyTrader trade session.');

  activeSession = null;
  stopBridge('session abandoned');

  const abandonedAtMs = Date.now();
  appendSessionLogForSession(session, 'session', 'abandoned', {
    sessionDir: session.sessionDir,
    sessionStartedAtMs: session.sessionStartedAtMs,
    sessionAbandonedAtMs: abandonedAtMs,
    durationMs: abandonedAtMs - session.sessionStartedAtMs,
    audioChunks: session.audioChunks.length,
    executionsReceived: session.executionsReceived,
    screenshotsReceived: session.screenshotsReceived,
  }, 'warning');
  writeStatusFileForSession(session, 'abandoned', {
    sessionAbandonedAt: new Date(abandonedAtMs).toISOString(),
    sessionAbandonedAtMs: abandonedAtMs,
    durationMs: abandonedAtMs - session.sessionStartedAtMs,
  });

  let deleted = false;
  let warning: string | undefined;
  try {
    fs.rmSync(session.sessionDir, { recursive: true, force: true });
    deleted = true;
  } catch (err) {
    warning = `Session was abandoned, but the folder could not be deleted: ${(err as Error).message}`;
  }

  broadcastStatus();
  return {
    ok: true,
    sessionDir: session.sessionDir,
    deleted,
    warning,
  };
}

function startFinalizingSession(session: ActiveTradeSession, stoppedAtMs: number): void {
  const startedAtMs = Date.now();
  const estimatedTotalMs = estimateSessionFinalizationMs(session, stoppedAtMs);
  finalizingSession = {
    sessionDir: session.sessionDir,
    sessionStartedAtMs: session.sessionStartedAtMs,
    stoppedAtMs,
    executionsReceived: session.executionsReceived,
    screenshotsReceived: session.screenshotsReceived,
    finalization: {
      phase: 'stopping',
      message: 'Stopping recording and preparing session finalization.',
      percent: 5,
      sessionDir: session.sessionDir,
      startedAtMs,
      updatedAtMs: startedAtMs,
      estimatedTotalMs,
      estimatedRemainingMs: estimatedTotalMs,
    },
  };
  writeStatusFileForSession(session, 'finalizing', {
    finalization: finalizingSession.finalization,
  });
  broadcastStatus();
}

function updateFinalizationProgress(
  session: ActiveTradeSession,
  phase: string,
  message: string,
  percent: number
): void {
  if (!finalizingSession || finalizingSession.sessionDir !== session.sessionDir) return;
  const now = Date.now();
  const clampedPercent = Math.max(0, Math.min(100, Math.round(percent)));
  finalizingSession.finalization = {
    ...finalizingSession.finalization,
    phase,
    message,
    percent: Math.max(finalizingSession.finalization.percent, clampedPercent),
    updatedAtMs: now,
    estimatedRemainingMs: Math.max(
      0,
      finalizingSession.finalization.estimatedTotalMs - (now - finalizingSession.finalization.startedAtMs)
    ),
  };
  writeStatusFileForSession(session, phase === 'complete' ? 'complete' : 'finalizing', {
    finalization: finalizingSession.finalization,
  });
  broadcastStatus();
}

function estimateSessionFinalizationMs(session: ActiveTradeSession, stoppedAtMs: number): number {
  const durationMs = Math.max(0, stoppedAtMs - session.sessionStartedAtMs);
  const hasAudio = Boolean(session.audioRecording || session.audioChunks.length > 0);
  const canTranscribe = hasAudio && canRunLocalTranscription();
  const transcriptionMs = canTranscribe ? Math.min(8 * 60_000, Math.max(12_000, durationMs * 0.35)) : 4_000;
  const tradeLogMs = settings.generateTradeLogOnStop ? 6_000 : 1_500;
  return Math.round(Math.max(8_000, transcriptionMs + tradeLogMs));
}

function getStatus(): WilyTraderDesktopStatus {
  const now = Date.now();
  const finalization = finalizingSession ? {
    ...finalizingSession.finalization,
    estimatedRemainingMs: Math.max(
      0,
      finalizingSession.finalization.estimatedTotalMs - (now - finalizingSession.finalization.startedAtMs)
    ),
  } : null;
  return {
    active: Boolean(activeSession),
    sessionState: activeSession ? 'recording' : finalizingSession ? 'finalizing' : 'idle',
    bridgePort: BRIDGE_PORT,
    sessionDir: activeSession?.sessionDir ?? finalizingSession?.sessionDir ?? null,
    lastCompletedSessionDir,
    sessionStartedAtMs: activeSession?.sessionStartedAtMs ?? finalizingSession?.sessionStartedAtMs ?? null,
    elapsedMs: activeSession
      ? now - activeSession.sessionStartedAtMs
      : finalizingSession
        ? finalizingSession.stoppedAtMs - finalizingSession.sessionStartedAtMs
        : 0,
    transcriptSegments: activeSession?.transcriptSegments.length ?? 0,
    audioChunks: activeSession?.audioChunks.length ?? 0,
    executionsReceived: activeSession?.executionsReceived ?? finalizingSession?.executionsReceived ?? 0,
    screenshotsReceived: activeSession?.screenshotsReceived ?? finalizingSession?.screenshotsReceived ?? 0,
    finalization,
    desktopUpdate: desktopUpdateStatus,
    extension: extensionStatus,
    settings,
  };
}

function createIncrementalTranscriptionRun(): IncrementalTranscriptionRun {
  return {
    queue: Promise.resolve(),
    chunksReceived: 0,
    failedChunks: 0,
    warnings: [],
    results: [],
  };
}

function enqueueIncrementalTranscriptionChunk(session: ActiveTradeSession, chunk: AudioChunkMeta): void {
  if (!canRunLocalTranscription()) return;
  const run = session.incrementalTranscription;
  run.chunksReceived += 1;
  run.queue = run.queue
    .then(async () => {
      const result = await transcribeIncrementalAudioChunk(session, chunk);
      run.results.push(result);
    })
    .catch((err) => {
      const message = (err as Error).message;
      run.failedChunks += 1;
      run.warnings.push(`chunk ${chunk.index}: ${message}`);
      appendSessionLogForSession(session, 'transcript', 'incremental chunk failed', {
        index: chunk.index,
        offsetMs: chunk.offsetMs,
        offsetEndMs: chunk.offsetEndMs,
        bytes: chunk.bytes,
        error: message,
      }, 'warning');
    });
}

async function saveAudioChunk(payload: {
  buffer: ArrayBuffer;
  index: number;
  startedAtMs: number;
  endedAtMs: number;
  mimeType?: string | null;
  final?: boolean;
}): Promise<{ ok: true; filePath: string }> {
  const session = requireActiveSession();
  const buffer = Buffer.from(payload.buffer);
  const index = Number.isInteger(payload.index) ? payload.index : session.audioChunks.length + 1;
  const filePath = path.join(session.audioDir, `chunk-${String(index).padStart(4, '0')}.webm`);
  fs.writeFileSync(filePath, buffer);
  const startedAtMs = normalizeClockMs(payload.startedAtMs, session);
  const endedAtMs = Math.max(startedAtMs, normalizeClockMs(payload.endedAtMs, session));
  const meta: AudioChunkMeta = {
    index,
    startedAtMs,
    endedAtMs,
    offsetMs: startedAtMs - session.sessionStartedAtMs,
    offsetEndMs: endedAtMs - session.sessionStartedAtMs,
    mimeType: payload.mimeType ?? null,
    bytes: buffer.length,
    final: Boolean(payload.final),
    filePath,
  };
  session.audioChunks.push(meta);
  writeJson(path.join(session.audioDir, 'chunks.json'), session.audioChunks);
  appendSessionLog('audio', 'chunk saved', meta, 'info');
  enqueueIncrementalTranscriptionChunk(session, meta);
  broadcastStatus();
  return { ok: true, filePath };
}

async function saveAudioRecording(payload: {
  buffer: ArrayBuffer;
  startedAtMs: number;
  endedAtMs: number;
  mimeType?: string | null;
}): Promise<{ ok: true; filePath: string }> {
  const session = requireActiveSession();
  const buffer = Buffer.from(payload.buffer);
  const filePath = path.join(session.audioDir, 'session-audio.webm');
  fs.writeFileSync(filePath, buffer);
  const startedAtMs = normalizeClockMs(payload.startedAtMs, session);
  const endedAtMs = Math.max(startedAtMs, normalizeClockMs(payload.endedAtMs, session));
  session.audioRecording = {
    startedAtMs,
    endedAtMs,
    offsetMs: startedAtMs - session.sessionStartedAtMs,
    offsetEndMs: endedAtMs - session.sessionStartedAtMs,
    mimeType: payload.mimeType ?? null,
    bytes: buffer.length,
    filePath,
  };
  writeJson(path.join(session.audioDir, 'session-audio.json'), session.audioRecording);
  appendSessionLog('audio', 'full recording saved', session.audioRecording, 'success');
  broadcastStatus();
  return { ok: true, filePath };
}

async function addTranscriptSegment(payload: {
  id?: string;
  text?: string;
  startedAtMs?: number;
  endedAtMs?: number;
  source?: string;
}): Promise<{ ok: true }> {
  const session = requireActiveSession();
  const text = String(payload.text ?? '').trim();
  if (!text) return { ok: true };
  const endedAtMs = normalizeClockMs(payload.endedAtMs, session);
  const startedAtMs = Math.min(endedAtMs, normalizeClockMs(payload.startedAtMs, session));
  session.transcriptSegments.push({
    id: payload.id || `segment-${session.transcriptSegments.length + 1}`,
    text,
    startedAtMs,
    endedAtMs,
    offsetMs: startedAtMs - session.sessionStartedAtMs,
    offsetEndMs: endedAtMs - session.sessionStartedAtMs,
    source: payload.source === 'manual' || payload.source === 'imported'
      ? payload.source
      : 'browser-speech-recognition',
  });
  writeTranscriptJson(session);
  broadcastStatus();
  return { ok: true };
}

function startBridge(): void {
  if (bridgeServer) return;
  bridgeServer = http.createServer((req, res) => {
    void handleBridgeRequest(req, res);
  });
  bridgeServer.on('error', (err) => {
    appendSessionLog('bridge', 'server error', { error: err.message, port: BRIDGE_PORT }, 'error');
  });
  bridgeServer.listen(BRIDGE_PORT, '127.0.0.1', () => {
    appendSessionLog('bridge', 'started', {
      endpoint: `http://127.0.0.1:${BRIDGE_PORT}/v1/wilytrader/ledger`,
    }, 'start');
  });
}

function stopBridge(reason: string): void {
  const server = bridgeServer;
  bridgeServer = null;
  if (!server) return;
  server.close((err) => {
    appendSessionLog('bridge', err ? 'stop failed' : 'stopped', {
      reason,
      error: err?.message,
    }, err ? 'error' : 'success');
  });
}

async function handleBridgeRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host || '127.0.0.1'}`);
  if (req.method === 'GET' && url.pathname === '/v1/wilytrader/status') {
    writeBridgeJson(res, 200, {
      ok: true,
      receiver: 'WilyTrader Desktop',
      supportsTabScreenshotUpload: true,
      ...getStatus(),
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/v1/wilytrader/extension-status') {
    try {
      const payload = await readJsonBody(req);
      receiveExtensionStatus(payload);
      writeBridgeJson(res, 200, {
        ok: true,
        receiver: 'WilyTrader Desktop',
        extension: extensionStatus,
      });
    } catch (err) {
      writeBridgeJson(res, 400, { ok: false, error: (err as Error).message });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/v1/wilytrader/diagnostics') {
    try {
      const payload = await readJsonBody(req);
      receiveExtensionDiagnostic(payload);
      writeBridgeJson(res, 200, {
        ok: true,
        receiver: 'WilyTrader Desktop',
        activeSession: Boolean(activeSession),
      });
    } catch (err) {
      writeBridgeJson(res, 400, { ok: false, error: (err as Error).message });
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/v1/wilytrader/ledger') {
    try {
      const payload = await readJsonBody(req);
      await receiveLedger(payload, res);
    } catch (err) {
      writeBridgeJson(res, 400, { ok: false, error: (err as Error).message });
    }
    return;
  }

  writeBridgeJson(res, 404, { ok: false, error: 'Not found' });
}

async function receiveLedger(payload: unknown, res: http.ServerResponse): Promise<void> {
  const session = activeSession;
  if (!session) {
    writeBridgeJson(res, 409, { ok: false, error: 'No active WilyTrader trade session.' });
    return;
  }

  const receivedAtMs = Date.now();
  const event = extractExecutionEvent(payload);
  const screenshot = extractScreenshotPayload(payload);
  const screenshotRequested = Boolean(event?.captureScreenshot);
  const screenshotDiagnostics: Record<string, unknown> = {
    saveBrowserScreenshots: settings.saveBrowserScreenshots,
    requested: screenshotRequested,
    payloadPresent: Boolean(screenshot),
    payloadHasDataUrl: Boolean(screenshot?.dataUrl),
    payloadSource: screenshot?.source ?? null,
    payloadError: screenshot?.error ?? null,
  };
  let screenshotPath = settings.saveBrowserScreenshots && screenshot
    ? saveBridgeScreenshot(session, screenshot, event, receivedAtMs)
    : null;
  if (settings.saveBrowserScreenshots && screenshotRequested && !screenshotPath) {
    screenshotPath = await saveDesktopTradeScreenshot(session, event, receivedAtMs);
    screenshotDiagnostics.desktopFallbackPath = screenshotPath;
  }
  const eventTimestampMs = parseTimestampMs(event?.timestampMs ?? event?.timestamp) ?? receivedAtMs;
  const enrichedEvent = event
    ? {
        ...event,
        timestampMs: eventTimestampMs,
        executionOffsetMs: eventTimestampMs - session.sessionStartedAtMs,
      }
    : null;

  const enriched = {
    receivedAt: new Date(receivedAtMs).toISOString(),
    receivedAtMs,
    receivedBy: 'wilytrader-desktop-bridge',
    bridge: {
      port: BRIDGE_PORT,
      sessionDir: session.sessionDir,
      sessionStartedAtMs: session.sessionStartedAtMs,
      sessionStartedAt: new Date(session.sessionStartedAtMs).toISOString(),
    },
    event: enrichedEvent,
    screenshotPath,
    screenshotDiagnostics,
    payload,
  };
  session.lastLedgerPayload = payload;
  if (event) session.executionsReceived += 1;
  recordMarketCapObservation(session, payload, enrichedEvent, receivedAtMs);

  writeJson(path.join(session.inputsDir, 'wilytrader.json'), enriched);
  writeWilyTraderSnapshots(session.inputsDir, payload);
  if (enrichedEvent) {
    appendJsonLine(path.join(session.inputsDir, 'wilytrader-executions.jsonl'), {
      receivedAt: enriched.receivedAt,
      event: enrichedEvent,
      screenshotPath,
      screenshotDiagnostics,
    });
  }
  const compatible = extractMockApeCompatibleTrades(payload);
  if (compatible.length > 0) {
    writeJson(path.join(session.inputsDir, 'wilytrader-mockape-compatible.json'), compatible);
  }
  appendSessionLog('bridge', 'ledger received', {
    event: enrichedEvent,
    screenshotPath,
    screenshotDiagnostics,
    compatibleTrades: compatible.length,
  }, 'success');
  broadcastStatus();
  writeBridgeJson(res, 200, {
    ok: true,
    receiver: 'WilyTrader Desktop',
    sessionDir: session.sessionDir,
    ledgerPath: path.join(session.inputsDir, 'wilytrader.json'),
    screenshotPath,
    compatibleTrades: compatible.length,
  });
}

function saveBridgeScreenshot(
  session: ActiveTradeSession,
  screenshot: BridgeScreenshotPayload,
  event: BridgeExecutionEvent | null,
  receivedAtMs: number
): string | null {
  if (!screenshot.dataUrl) return null;
  const match = /^data:image\/png;base64,(.+)$/i.exec(screenshot.dataUrl);
  if (!match) return null;
  const capturedAtMs = parseTimestampMs(screenshot.capturedAtMs ?? screenshot.capturedAt) ?? receivedAtMs;
  const token = sanitizeFilePart(event?.tokenName || event?.tokenAddress || 'token').slice(0, 48);
  const side = sanitizeFilePart(event?.side || 'trade');
  const execution = sanitizeFilePart(event?.executionId || String(receivedAtMs)).slice(0, 64);
  const fileName = `${formatSessionStamp(new Date(capturedAtMs))}-${side}-${token}-${execution}.png`;
  const filePath = path.join(session.screenshotDir, fileName);
  fs.writeFileSync(filePath, Buffer.from(match[1], 'base64'));
  writeJson(path.join(session.screenshotMetadataDir, `${fileName}.json`), {
    capturedAt: new Date(capturedAtMs).toISOString(),
    capturedAtMs,
    capturedOffsetMs: capturedAtMs - session.sessionStartedAtMs,
    screenshotPath: filePath,
    event,
    captureRect: screenshot.captureRect ?? null,
    source: screenshot.source ?? 'chrome-tab-capture',
  });
  session.screenshotsReceived += 1;
  return filePath;
}

async function saveDesktopTradeScreenshot(
  session: ActiveTradeSession,
  event: BridgeExecutionEvent | null,
  receivedAtMs: number
): Promise<string | null> {
  try {
    const source = await selectDesktopScreenshotSource();
    if (!source || source.thumbnail.isEmpty()) {
      appendSessionLogForSession(session, 'screenshot', 'desktop fallback screenshot unavailable', {
        event,
        sourceFound: Boolean(source),
      }, 'warning');
      return null;
    }
    const capturedAtMs = receivedAtMs;
    const token = sanitizeFilePart(event?.tokenName || event?.tokenAddress || 'token').slice(0, 48);
    const side = sanitizeFilePart(event?.side || 'trade');
    const execution = sanitizeFilePart(event?.executionId || String(receivedAtMs)).slice(0, 64);
    const fileName = `${formatSessionStamp(new Date(capturedAtMs))}-${side}-${token}-${execution}-desktop.png`;
    const filePath = path.join(session.screenshotDir, fileName);
    fs.writeFileSync(filePath, source.thumbnail.toPNG());
    writeJson(path.join(session.screenshotMetadataDir, `${fileName}.json`), {
      capturedAt: new Date(capturedAtMs).toISOString(),
      capturedAtMs,
      capturedOffsetMs: capturedAtMs - session.sessionStartedAtMs,
      screenshotPath: filePath,
      event,
      source: 'electron-desktop-capturer',
      desktopSource: {
        id: source.id,
        name: source.name,
        displayId: source.display_id,
      },
      reason: 'Extension screenshot payload was missing or unusable.',
    });
    session.screenshotsReceived += 1;
    appendSessionLogForSession(session, 'screenshot', 'desktop fallback screenshot saved', {
      filePath,
      sourceName: source.name,
      event,
    }, 'success');
    return filePath;
  } catch (err) {
    appendSessionLogForSession(session, 'screenshot', 'desktop fallback screenshot failed', {
      error: (err as Error).message,
      event,
    }, 'error');
    return null;
  }
}

async function selectDesktopScreenshotSource(): Promise<Electron.DesktopCapturerSource | null> {
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 1920, height: 1080 },
    fetchWindowIcons: false,
  });
  return (
    sources.find((source) => /axiom/i.test(source.name)) ??
    sources.find((source) => /(google chrome|chrome|padre)/i.test(source.name)) ??
    sources.find((source) => source.id.startsWith('screen:')) ??
    sources[0] ??
    null
  );
}

function writeWilyTraderSnapshots(inputsDir: string, payload: unknown): void {
  const wilyDir = path.join(inputsDir, 'wilytrader');
  fs.mkdirSync(wilyDir, { recursive: true });
  writeJson(path.join(wilyDir, 'latest-ledger-payload.json'), payload);
  const record = unwrapWilyTraderPayload(payload);
  if (!record || typeof record !== 'object') return;
  const root = record as Record<string, unknown>;
  if (root.currentSessionSummary && typeof root.currentSessionSummary === 'object') {
    writeJson(path.join(wilyDir, 'current-session-summary.json'), root.currentSessionSummary);
  }
  if (Array.isArray(root.previousSessions)) {
    writeJson(path.join(wilyDir, 'previous-sessions.json'), root.previousSessions);
  }
  if (Array.isArray(root.executions)) {
    writeJson(path.join(wilyDir, 'executions.json'), root.executions);
  }
}

function recordMarketCapObservation(
  session: ActiveTradeSession,
  payload: unknown,
  event: BridgeExecutionEvent | null,
  receivedAtMs: number
): void {
  const record = unwrapWilyTraderPayload(payload);
  if (!record || typeof record !== 'object') return;
  const root = record as Record<string, unknown>;
  const sessionRecord = root.session && typeof root.session === 'object' ? root.session as Record<string, unknown> : null;
  const activeToken = sessionRecord?.activeToken && typeof sessionRecord.activeToken === 'object'
    ? sessionRecord.activeToken as Record<string, unknown>
    : null;
  const latestExecution = root.currentSessionSummary && typeof root.currentSessionSummary === 'object'
    ? (root.currentSessionSummary as Record<string, unknown>).latestExecution
    : null;
  const latestExecutionRecord = latestExecution && typeof latestExecution === 'object'
    ? latestExecution as Record<string, unknown>
    : null;
  const latestExecutionMarketCap =
    numberOrNull(latestExecutionRecord?.executionMarketCapUsd) ??
    numberOrNull(latestExecutionRecord?.marketCapUsd) ??
    numberOrNull(latestExecutionRecord?.sourceMarketCapUsd);
  const activeMarketCap = numberOrNull(activeToken?.marketCap);
  const marketCap = event ? latestExecutionMarketCap ?? activeMarketCap : activeMarketCap ?? latestExecutionMarketCap;
  if (marketCap === null || marketCap <= 0) return;
  const timestampMs =
    (event ? parseTimestampMs(event.timestampMs ?? event.timestamp) : null) ??
    parseTimestampMs(activeToken?.capturedAtMs ?? activeToken?.updatedAtMs ?? activeToken?.timestampMs ?? activeToken?.capturedAt) ??
    parseTimestampMs(event?.timestampMs ?? event?.timestamp) ??
    receivedAtMs;
  const observation: MarketCapObservation = {
    tokenAddress: strOrNull(event?.tokenAddress) ?? strOrNull(activeToken?.address) ?? strOrNull(activeToken?.tokenAddress),
    tokenName: strOrNull(event?.tokenName) ?? strOrNull(activeToken?.name) ?? strOrNull(activeToken?.tokenName),
    timestampMs,
    marketCapUsd: marketCap,
    source: event ? 'execution-payload' : 'ledger-payload',
  };
  const last = session.marketCapObservations[session.marketCapObservations.length - 1];
  if (
    last &&
    last.tokenAddress === observation.tokenAddress &&
    last.tokenName === observation.tokenName &&
    last.marketCapUsd === observation.marketCapUsd &&
    Math.abs(last.timestampMs - observation.timestampMs) < 1_000
  ) {
    return;
  }
  session.marketCapObservations.push(observation);
  appendJsonLine(path.join(session.inputsDir, 'wilytrader-market-cap-observations.jsonl'), observation);
}

function writeTranscriptJson(session: ActiveTradeSession): string {
  const transcriptPath = path.join(session.inputsDir, 'transcript.json');
  writeJson(transcriptPath, {
    source: 'WilyTrader Desktop audio-first transcript pipeline',
    sessionStartedAtMs: session.sessionStartedAtMs,
    segments: session.transcriptSegments,
  });
  return transcriptPath;
}

function writeTranscriptMd(session: ActiveTradeSession): string {
  const mdPath = path.join(session.inputsDir, 'transcript.md');
  const lines = [
    '# Transcript',
    '',
    `Generated by WilyTrader Desktop - ${new Date().toLocaleString()}`,
    '',
  ];
  if (session.transcriptSegments.length === 0) {
    lines.push('_No transcript segments were produced._');
  } else {
    for (const segment of session.transcriptSegments) {
      lines.push(`- [${formatOffset(segment.offsetMs)}] ${segment.text}`);
    }
  }
  fs.writeFileSync(mdPath, `${lines.join(os.EOL)}${os.EOL}`, 'utf-8');
  writeRootTranscriptTxt(session);
  return mdPath;
}

function writeRootTranscriptTxt(session: ActiveTradeSession): string {
  const txtPath = path.join(session.sessionDir, 'transcript.txt');
  const lines = [
    `Transcript - ${path.basename(session.sessionDir)}`,
    `Generated by WilyTrader Desktop - ${new Date().toLocaleString()}`,
    '',
  ];
  if (session.transcriptSegments.length === 0) {
    lines.push('No transcript segments were captured.');
  } else {
    for (const segment of session.transcriptSegments) {
      lines.push(`[${formatOffset(segment.offsetMs)} - ${formatOffset(segment.offsetEndMs)}] ${segment.text}`);
    }
  }
  fs.writeFileSync(txtPath, `${lines.join(os.EOL)}${os.EOL}`, 'utf-8');
  return txtPath;
}

async function transcribeSessionAudio(
  session: ActiveTradeSession,
  onProgress?: (phase: string, message: string, percent: number) => void
): Promise<string[]> {
  const warnings: string[] = [];
  if (session.incrementalTranscription.chunksReceived > 0) {
    onProgress?.('transcript', 'Waiting for background transcript chunks.', 32);
  }
  const incremental = await finalizeIncrementalTranscription(session);
  if (incremental && incremental.chunksReceived > 0 && incremental.failedChunks === 0 && incremental.segments.length > 0) {
    session.transcriptSegments = incremental.segments;
    appendSessionLogForSession(session, 'transcript', 'incremental transcript used', {
      chunksReceived: incremental.chunksReceived,
      segments: session.transcriptSegments.length,
      warnings: incremental.warnings,
    }, incremental.warnings.length > 0 ? 'warning' : 'success');
    onProgress?.('transcript', 'Background transcript chunks finished.', 80);
    return incremental.warnings;
  }
  if (incremental && incremental.chunksReceived > 0) {
    const warning = incremental.failedChunks > 0
      ? `incremental transcription had ${incremental.failedChunks} failed chunk(s); falling back to full-session transcription`
      : 'incremental transcription produced no segments; falling back to full-session transcription';
    warnings.push(warning, ...incremental.warnings);
    appendSessionLogForSession(session, 'transcript', 'incremental transcript rejected; falling back to full transcription', {
      chunksReceived: incremental.chunksReceived,
      failedChunks: incremental.failedChunks,
      segments: incremental.segments.length,
      warnings: incremental.warnings,
    }, 'warning');
  }

  const sourceAudio = session.audioRecording ?? rebuildSessionAudioFromChunks(session);
  if (!sourceAudio) {
    onProgress?.('transcript', 'No audio recording was available; skipping transcript.', 70);
    warnings.push('No audio recording was available; transcript is empty.');
    appendSessionLogForSession(session, 'transcript', 'skipped; no audio recording', undefined, 'skipped');
    return warnings;
  }
  const whisper = findWhisperBinary();
  if (!whisper) {
    const message = 'Whisper is not installed; transcript generation skipped.';
    onProgress?.('transcript', message, 70);
    warnings.push(message);
    appendSessionLogForSession(session, 'transcript', message, {
      checked: whisperSearchRoots(),
    }, 'skipped');
    return warnings;
  }
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
    const message = 'ffmpeg-static did not provide a usable ffmpeg binary; transcript generation skipped.';
    onProgress?.('transcript', message, 70);
    warnings.push(message);
    appendSessionLogForSession(session, 'transcript', message, { ffmpegPath }, 'skipped');
    return warnings;
  }

  const transcriptDir = path.join(session.inputsDir, 'transcript-work');
  fs.mkdirSync(transcriptDir, { recursive: true });
  appendSessionLogForSession(session, 'transcript', 'started', {
    chunks: session.audioChunks.length,
    sourceAudio: sourceAudio.filePath,
    whisperExe: whisper.exe,
    whisperModel: whisper.model,
  }, 'start');

  const segments: TranscriptSegment[] = [];
  const base = 'session-audio';
  const wavPath = path.join(transcriptDir, `${base}.wav`);
  const outPrefix = path.join(transcriptDir, base);
  try {
    onProgress?.('audio', 'Converting session audio for transcription.', 22);
    await webmToWav(sourceAudio.filePath, wavPath);
    onProgress?.('transcript', 'Transcribing session audio with local Whisper.', 38);
    await runWhisper(whisper.exe, whisper.model, wavPath, outPrefix);
    onProgress?.('transcript', 'Parsing transcript segments.', 76);
    const srtPath = `${outPrefix}.srt`;
    if (!fs.existsSync(srtPath)) {
      warnings.push('No SRT transcript produced for session audio.');
    } else {
      segments.push(...parseSrtToDesktopSegments(
        fs.readFileSync(srtPath, 'utf-8'),
        session,
        sourceAudio.offsetMs,
        base
      ));
    }
  } catch (err) {
    const message = `session audio: ${(err as Error).message}`;
    warnings.push(message);
    appendSessionLogForSession(session, 'transcript', 'session transcription failed', { error: message }, 'warning');
  }

  session.transcriptSegments = mergeDesktopTranscriptSegments(segments);
  onProgress?.('transcript', 'Transcript processing finished.', 80);
  appendSessionLogForSession(session, 'transcript', 'finished', {
    chunks: session.audioChunks.length,
    segments: session.transcriptSegments.length,
    warnings,
  }, warnings.length > 0 ? 'warning' : 'success');
  return warnings;
}

async function finalizeIncrementalTranscription(session: ActiveTradeSession): Promise<{
  chunksReceived: number;
  failedChunks: number;
  warnings: string[];
  segments: TranscriptSegment[];
} | null> {
  const run = session.incrementalTranscription;
  if (run.chunksReceived === 0) return null;
  await run.queue;
  const ordered = [...run.results].sort((a, b) => a.index - b.index);
  return {
    chunksReceived: run.chunksReceived,
    failedChunks: run.failedChunks,
    warnings: run.warnings,
    segments: mergeDesktopTranscriptSegments(ordered.flatMap((result) => result.segments)),
  };
}

async function transcribeIncrementalAudioChunk(
  session: ActiveTradeSession,
  chunk: AudioChunkMeta
): Promise<IncrementalTranscriptionChunkResult> {
  const whisper = findWhisperBinary();
  if (!whisper) throw new Error('Whisper is not installed; incremental transcription skipped.');
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
    throw new Error('ffmpeg-static did not provide a usable ffmpeg binary; incremental transcription skipped.');
  }
  if (!fs.existsSync(chunk.filePath)) throw new Error(`audio chunk file missing: ${chunk.filePath}`);

  const transcriptDir = path.join(session.inputsDir, 'incremental-transcript');
  fs.mkdirSync(transcriptDir, { recursive: true });
  const base = `chunk-${String(chunk.index).padStart(4, '0')}`;
  const wavPath = path.join(transcriptDir, `${base}.wav`);
  const outPrefix = path.join(transcriptDir, base);
  try {
    await webmToWav(chunk.filePath, wavPath);
    await runWhisper(whisper.exe, whisper.model, wavPath, outPrefix);
    const srtPath = `${outPrefix}.srt`;
    const segments = fs.existsSync(srtPath)
      ? parseSrtToDesktopSegments(fs.readFileSync(srtPath, 'utf-8'), session, chunk.offsetMs, base)
      : [];
    appendSessionLogForSession(session, 'transcript', 'incremental chunk transcribed', {
      index: chunk.index,
      offsetMs: chunk.offsetMs,
      offsetEndMs: chunk.offsetEndMs,
      bytes: chunk.bytes,
      segments: segments.length,
      final: chunk.final,
    }, 'success');
    return { index: chunk.index, segments };
  } finally {
    for (const file of [wavPath, `${outPrefix}.srt`]) {
      try { fs.unlinkSync(file); } catch { /* ignore */ }
    }
  }
}

function rebuildSessionAudioFromChunks(session: ActiveTradeSession): AudioRecordingMeta | null {
  const chunks = [...session.audioChunks].sort((a, b) => a.index - b.index);
  if (chunks.length === 0) return null;
  const filePath = path.join(session.audioDir, 'session-audio-rebuilt.webm');
  const handle = fs.openSync(filePath, 'w');
  let bytes = 0;
  try {
    for (const chunk of chunks) {
      if (!fs.existsSync(chunk.filePath)) continue;
      const buffer = fs.readFileSync(chunk.filePath);
      fs.writeSync(handle, buffer);
      bytes += buffer.length;
    }
  } finally {
    fs.closeSync(handle);
  }
  if (bytes === 0) return null;
  const first = chunks[0];
  const last = chunks[chunks.length - 1];
  const rebuilt: AudioRecordingMeta = {
    startedAtMs: first.startedAtMs,
    endedAtMs: last.endedAtMs,
    offsetMs: first.offsetMs,
    offsetEndMs: last.offsetEndMs,
    mimeType: first.mimeType,
    bytes,
    filePath,
  };
  writeJson(path.join(session.audioDir, 'session-audio-rebuilt.json'), rebuilt);
  appendSessionLogForSession(session, 'audio', 'rebuilt full recording from chunks', rebuilt, 'info');
  return rebuilt;
}

function findWhisperBinary(): { exe: string; model: string } | null {
  for (const root of whisperSearchRoots()) {
    const binDir = path.join(root, 'bin', 'whisper');
    const exe = [
      path.join(binDir, 'whisper-cli.exe'),
      path.join(binDir, 'main.exe'),
      path.join(binDir, 'Release', 'whisper-cli.exe'),
      path.join(binDir, 'Release', 'main.exe'),
    ].find((candidate) => fs.existsSync(candidate));
    const model = path.join(root, 'models', 'ggml-base.en.bin');
    if (exe && fs.existsSync(model)) return { exe, model };
  }
  return null;
}

function whisperSearchRoots(): string[] {
  return [
    path.join(app.getAppPath(), 'resources'),
    path.resolve(app.getAppPath(), '..', 'resources'),
    path.join(app.getPath('userData'), 'resources'),
    path.join(process.resourcesPath || '', 'resources'),
    'E:\\Apps\\snipalot\\resources',
  ].filter((candidate, index, arr) => Boolean(candidate) && arr.indexOf(candidate) === index);
}

function canRunLocalTranscription(): boolean {
  return Boolean(findWhisperBinary()) && Boolean(ffmpegPath && fs.existsSync(ffmpegPath));
}

function webmToWav(webmPath: string, wavPath: string): Promise<void> {
  return runProcess(ffmpegPath as string, [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-i',
    webmPath,
    '-vn',
    '-ac',
    '1',
    '-ar',
    '16000',
    '-c:a',
    'pcm_s16le',
    wavPath,
  ], 'ffmpeg webm-to-wav');
}

function runWhisper(exe: string, modelPath: string, wavPath: string, outPrefix: string): Promise<void> {
  return runProcess(exe, [
    '-m',
    modelPath,
    '-f',
    wavPath,
    '-l',
    'en',
    '--max-context',
    '0',
    '-osrt',
    '-of',
    outPrefix,
  ], 'whisper');
}

function runProcess(exe: string, args: string[], label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(exe, args, { windowsHide: true });
    let stderr = '';
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${label} exited ${code}. stderr tail: ${stderr.slice(-500)}`));
    });
  });
}

function parseSrtToDesktopSegments(
  srtText: string,
  session: ActiveTradeSession,
  chunkOffsetMs: number,
  sourceChunk: string
): TranscriptSegment[] {
  const lines = srtText.split(/\r?\n/);
  const segments: TranscriptSegment[] = [];
  let startMs: number | null = null;
  let endMs: number | null = null;
  let textParts: string[] = [];

  const flush = () => {
    const text = textParts.join(' ').trim();
    if (startMs === null || endMs === null || !text || /^you\.?$/i.test(text)) {
      textParts = [];
      return;
    }
    const offsetMs = chunkOffsetMs + startMs;
    const offsetEndMs = chunkOffsetMs + endMs;
    segments.push({
      id: `${sourceChunk}-${segments.length + 1}`,
      text,
      startedAtMs: session.sessionStartedAtMs + offsetMs,
      endedAtMs: session.sessionStartedAtMs + offsetEndMs,
      offsetMs,
      offsetEndMs,
      source: 'imported',
    });
    textParts = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flush();
      startMs = null;
      endMs = null;
      continue;
    }
    if (/^\d+$/.test(line)) continue;
    const match = line.match(/^(\d{2}):(\d{2}):(\d{2}),(\d+)\s+-->\s+(\d{2}):(\d{2}):(\d{2}),(\d+)/);
    if (match) {
      startMs = srtStampToMs(match[1], match[2], match[3], match[4]);
      endMs = srtStampToMs(match[5], match[6], match[7], match[8]);
      continue;
    }
    textParts.push(line);
  }
  flush();
  return segments;
}

function srtStampToMs(hours: string, minutes: string, seconds: string, millis: string): number {
  return (
    Number(hours) * 60 * 60 * 1000 +
    Number(minutes) * 60 * 1000 +
    Number(seconds) * 1000 +
    Number(millis.padEnd(3, '0').slice(0, 3))
  );
}

function mergeDesktopTranscriptSegments(segments: TranscriptSegment[]): TranscriptSegment[] {
  return [...segments].sort((a, b) => a.offsetMs - b.offsetMs || a.offsetEndMs - b.offsetEndMs);
}

function loadTradesFromSession(session: ActiveTradeSession, stoppedAtMs: number): NormalizedTrade[] {
  const ledgerPath = path.join(session.inputsDir, 'wilytrader.json');
  if (!fs.existsSync(ledgerPath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(ledgerPath, 'utf-8'));
    const allTrades = normalizeWilyTraderTrades(parsed);
    const recordingTrades = filterTradesForRecordingWindow(allTrades, session.sessionStartedAtMs, stoppedAtMs);
    if (recordingTrades.length !== allTrades.length) {
      appendSessionLogForSession(session, 'trade-log', 'filtered trades to recording window', {
        before: allTrades.length,
        after: recordingTrades.length,
        recordingStartedAtMs: session.sessionStartedAtMs,
        recordingStoppedAtMs: stoppedAtMs,
      }, 'info');
    }
    return recordingTrades;
  } catch (err) {
    appendSessionLogForSession(session, 'trade-log', 'ledger parse failed', { error: (err as Error).message }, 'error');
    return [];
  }
}

function filterTradesForRecordingWindow(
  trades: NormalizedTrade[],
  startedAtMs: number,
  stoppedAtMs: number
): NormalizedTrade[] {
  return trades.filter((trade) => {
    const enteredAtMs = trade.entryTimestampMs;
    if (enteredAtMs !== null) return enteredAtMs >= startedAtMs && enteredAtMs <= stoppedAtMs;
    const exitedAtMs = trade.timestampMs;
    return exitedAtMs !== null && exitedAtMs >= startedAtMs && exitedAtMs <= stoppedAtMs;
  });
}

function normalizeWilyTraderTrades(parsed: unknown): NormalizedTrade[] {
  const root = unwrapWilyTraderPayload(parsed);
  if (!root || typeof root !== 'object') return [];
  const record = root as Record<string, unknown>;
  const executions = getObjectArray(record.executions);
  const positions = getObjectArray(record.closedPositions).length > 0
    ? getObjectArray(record.closedPositions)
    : getObjectArray(record.positions).filter((position) => position.status === 'closed');
  const trades: NormalizedTrade[] = [];
  for (const position of positions) {
    const tokenAddress = strOrNull(position.tokenAddress);
    const positionExecutions = filterPositionExecutions(position, executions);
    const timestampMs = parseTimestampMs(position.finalExitAt);
    const entryTimestampMs = parseTimestampMs(position.firstEntryAt) ?? findFirstBuyTimestampMs(positionExecutions);
    const tokenName =
      strOrNull(position.tokenName) ??
      positionExecutions.map((execution) => strOrNull(execution.tokenName)).find(Boolean) ??
      tokenAddress ??
      'Unknown token';
    const solInvested = numberOrNull(position.investedNative);
    const solReceived = coalesceNumber(
      numberOrNull(position.netReceivedNative),
      sumNullable(solInvested, numberOrNull(position.pnlPostFeeNative))
    );
    const pnlSol = computeNetPnl(solReceived, solInvested) ?? numberOrNull(position.pnlPostFeeNative);
    trades.push({
      id: strOrNull(position.id) ?? `wilytrader-${timestampMs ?? Date.now()}-${tokenName}`,
      tokenName,
      platform: strOrNull(position.platform) ?? 'padre',
      chain: strOrNull(position.chain) ?? 'SOL',
      entryMarketCap: numberOrNull(position.entryMarketCapVwapUsd),
      exitMarketCap: numberOrNull(position.exitMarketCapVwapUsd),
      highMarketCapAfterEntry: numberOrNull(position.highMarketCapAfterEntry),
      highMarketCapAtMs: parseTimestampMs(position.highMarketCapAt),
      lowMarketCapAfterEntry: numberOrNull(position.lowMarketCapAfterEntry),
      lowMarketCapAtMs: parseTimestampMs(position.lowMarketCapAt),
      ohlcSampleCount: numberOrNull(position.ohlcSampleCount),
      ohlcSampleIntervalMs: numberOrNull(position.ohlcSampleIntervalMs),
      ohlcRangeSource: strOrNull(position.ohlcSource),
      solInvested,
      solReceived,
      buyFeesNative: numberOrNull(position.buyFeesNative),
      sellFeesNative: numberOrNull(position.sellFeesNative),
      pnlSol,
      pnlPercentage: computeNetPnlPct(pnlSol, solInvested) ?? numberOrNull(position.pnlPct),
      timestampMs,
      entryTimestampMs,
      timeInTradeSeconds: numberOrNull(position.timeInTradeSeconds),
      tokenAddress,
      executions: positionExecutions.map(normalizeTradeExecutionPoint),
    });
  }
  if (trades.length > 0) return trades;
  return normalizeMockApeCompatibleTrades(record.mockapeCompatibleTrades);
}

function normalizeMockApeCompatibleTrades(value: unknown): NormalizedTrade[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((row) => {
      const solInvested = coalesceNumber(numberOrNull(row.investedNative), numberOrNull(row.solInvested));
      const solReceived = coalesceNumber(
        numberOrNull(row.netReceivedNative),
        numberOrNull(row.solReceived),
        sumNullable(solInvested, numberOrNull(row.pnlSol))
      );
      const pnlSol = computeNetPnl(solReceived, solInvested) ?? numberOrNull(row.pnlSol);
      return {
        id: strOrNull(row.id) ?? '',
        tokenName: strOrNull(row.tokenName) ?? 'Unknown token',
        platform: strOrNull(row.platform) ?? '',
        chain: strOrNull(row.chain) ?? 'SOL',
        entryMarketCap: numberOrNull(row.entryMarketCap),
        exitMarketCap: numberOrNull(row.exitMarketCap),
        highMarketCapAfterEntry: numberOrNull(row.highMarketCapAfterEntry),
        highMarketCapAtMs: parseTimestampMs(row.highMarketCapAt),
        lowMarketCapAfterEntry: numberOrNull(row.lowMarketCapAfterEntry),
        lowMarketCapAtMs: parseTimestampMs(row.lowMarketCapAt),
        ohlcSampleCount: numberOrNull(row.ohlcSampleCount),
        ohlcSampleIntervalMs: numberOrNull(row.ohlcSampleIntervalMs),
        ohlcRangeSource: strOrNull(row.ohlcSource),
        solInvested,
        solReceived,
        buyFeesNative: numberOrNull(row.buyFeesNative),
        sellFeesNative: numberOrNull(row.sellFeesNative),
        pnlSol,
        pnlPercentage: computeNetPnlPct(pnlSol, solInvested) ?? numberOrNull(row.pnlPercentage),
        timestampMs: numberOrNull(row.timestamp),
        entryTimestampMs:
          numberOrNull(row.entryTimestamp) ??
          numberOrNull(row.entryTimestampMs) ??
          parseTimestampMs(row.firstEntryAt) ??
          parseTimestampMs(row.entryAt),
        timeInTradeSeconds: numberOrNull(row.timeInTradeSeconds),
        tokenAddress: strOrNull(row.tokenAddress),
        executions: [],
      };
    });
}

async function enrichTradesForSession(
  session: ActiveTradeSession,
  trades: NormalizedTrade[],
  stoppedAtMs: number,
  onProgress?: (phase: string, message: string, percent: number) => void
): Promise<TradeEnrichmentResult> {
  const warnings: string[] = [];
  if (trades.length === 0) {
    return { trades, promptPath: null, responsePath: null, warnings };
  }
  if (session.transcriptSegments.length === 0) {
    warnings.push('No transcript segments were available; trade log uses ledger-only rows.');
    return { trades: reconcileTradeReviewFields(session, trades), promptPath: null, responsePath: null, warnings };
  }

  const prompt = renderTradeExtractionPrompt(session, trades, stoppedAtMs);
  const promptPath = path.join(session.inputsDir, 'trade-extraction-prompt.md');
  const responsePath = path.join(session.inputsDir, 'trade-extraction-response.json');
  fs.writeFileSync(promptPath, prompt, 'utf-8');
  appendSessionLogForSession(session, 'trade-enrichment', 'prompt written', {
    promptPath,
    trades: trades.length,
    transcriptSegments: session.transcriptSegments.length,
  }, 'success');

  onProgress?.('trade-log', 'Extracting trade commentary with LLM.', 92);
  const llm = await runTradeLlmPrompt(prompt, session, 'trade extraction');
  fs.writeFileSync(`${responsePath}.raw.txt`, llm.rawText, 'utf-8');
  if (!llm.ok) {
    warnings.push(llm.message);
    appendSessionLogForSession(session, 'trade-enrichment', 'llm extraction failed; using ledger-only rows', {
      message: llm.message,
      rawPath: `${responsePath}.raw.txt`,
    }, 'warning');
    return { trades, promptPath, responsePath: null, warnings };
  }

  let extracted: LlmTradeExtraction[] = [];
  try {
    extracted = parseTradeExtractionResponse(llm.rawText);
    fs.writeFileSync(responsePath, JSON.stringify(extracted, null, 2), 'utf-8');
  } catch (err) {
    const message = `LLM trade extraction response could not be parsed: ${(err as Error).message}`;
    warnings.push(message);
    appendSessionLogForSession(session, 'trade-enrichment', 'response parse failed; using ledger-only rows', {
      responsePath: `${responsePath}.raw.txt`,
      error: (err as Error).message,
    }, 'error');
    return { trades, promptPath, responsePath: `${responsePath}.raw.txt`, warnings };
  }

  let enriched = mergeTradeExtraction(trades, extracted);
  appendSessionLogForSession(session, 'trade-enrichment', 'response merged', {
    responsePath,
    extracted: extracted.length,
    enriched: enriched.filter((trade) => trade.enrichmentSource === 'llm').length,
  }, 'success');

  if (enriched.some((trade) => !hasCompleteNics(trade))) {
    onProgress?.('trade-log', 'Backfilling NICS classifications.', 94);
    enriched = await backfillNicsForTrades(session, enriched, warnings);
  }

  const clustered = assignSessionMetaClusterIds(enriched, session);
  return { trades: reconcileTradeReviewFields(session, clustered), promptPath, responsePath, warnings };
}

function renderTradeExtractionPrompt(
  session: ActiveTradeSession,
  trades: NormalizedTrade[],
  stoppedAtMs: number
): string {
  const sessionStart = session.sessionStartedAtMs;
  const transcript = session.transcriptSegments
    .map((segment) => `[${formatOffset(segment.offsetMs)}-${formatOffset(segment.offsetEndMs)}] ${segment.text}`)
    .join('\n');
  const tradeList = trades.map((trade, index) => {
    const entryOffset = trade.entryTimestampMs === null ? null : trade.entryTimestampMs - sessionStart;
    const exitOffset = trade.timestampMs === null ? null : trade.timestampMs - sessionStart;
    return {
      index: index + 1,
      trade_id: trade.id,
      token_name: trade.tokenName,
      token_address: trade.tokenAddress,
      entry_offset: entryOffset === null ? null : formatOffset(entryOffset),
      entry_timestamp_ms: trade.entryTimestampMs,
      exit_offset: exitOffset === null ? null : formatOffset(exitOffset),
      exit_timestamp_ms: trade.timestampMs,
      entry_mc_actual: trade.entryMarketCap,
      exit_mc_actual: trade.exitMarketCap,
      sol_invested: trade.solInvested,
      sol_received: normalizedSolReceived(trade),
      pnl_sol: normalizedPnlSol(trade),
      pnl_percentage: normalizedPnlPercentage(trade),
      time_in_trade_seconds: trade.timeInTradeSeconds,
    };
  });

  return `You are extracting a WilyTrader Desktop trade log from a trader's spoken transcript.

Use the actual trades as the source of truth. Return one JSON object for each actual trade only.
Do not invent targets, rationale, excerpts, or scores. Use null when the transcript does not support a field.

Recording window:
- started_at: ${new Date(session.sessionStartedAtMs).toISOString()}
- stopped_at: ${new Date(stoppedAtMs).toISOString()}

Actual trades entered during this recording:
\`\`\`json
${JSON.stringify(tradeList, null, 2)}
\`\`\`

Transcript:
\`\`\`
${transcript}
\`\`\`

Return ONLY a JSON array. No markdown fences. Every object must include:
- mockape_trade_id: exact trade_id from the actual trades list
- token_name
- pre_call_offset_ms: recording-relative ms where entry/setup commentary occurs, or null
- post_call_offset_ms: recording-relative ms where exit/outcome commentary occurs, or null
- target_low_mc, target_high_mc, stop_loss_mc: integer dollars from spoken targets/stops only
- rationale: trader's own stated reason, or null
- pre_transcript_excerpt: near-verbatim transcript evidence around entry/setup, or null
- post_transcript_excerpt: near-verbatim transcript evidence around exit/outcome, or null
- adherence_self_assessment: trader's spoken self-assessment, or null
- needs_review: true when evidence is ambiguous
- notes: compact extraction caveats, or null
- meta_name: concise token/thread meta label, or null
- N_score, I_score, C_score, S_score: each 0 or 1
- N_why, I_why, C_why, S_why: compact evidence for each score
- NICS_score: N_score + I_score + C_score + S_score, 0 through 4
- size_ok, zone_ok, cooldown_ok: use null; Desktop computes these from ledger/session state
- trade_type: "Core NICS++", "Scout", or "Non-NICS"
- counts_toward_50, hard_reset: use null; Desktop computes these from the explicit count rule and ledger size
- running_count, non_nics_pnl_pct, cluster_pnl_pct: use null; Desktop computes these after grading
- llm_grade_notes: one short evidence-based note

NICS scoring:
- N = trader clearly names the narrative/thread/setup being traded. A ticker alone is not enough unless the token name itself carries the narrative.
- I = trader states why this token is the selected ticket or what immediate evidence supports entry.
- C = trader states the cut/close reason.
- S = trader states sell/stay plan, profit target, scale-out, cost recovery, or upside management.
- Core NICS++ requires N=1, I=1, and either C=1 or S=1.
- Scout is only for partial named/intentional setup evidence worth reviewing; do not use generic direction labels such as long or short.
- Count-to-50 eligibility is separate from NICS_score and requires N=1, I=1, and either C=1 or S=1 plus Desktop-computed size/zone checks.
- Desktop will assign session-local meta_cluster_id values from meta_name after extraction.
- meta_name must be tied to the token/thread/narrative. Do not use entry mechanics, buttons, signals, or generic reasons such as pulse buy, momentum, volume, interest, activity, first one, scroll and click, testing, scaling, target, or people as meta names.
- If the transcript only describes why the button was clicked or why the trade was entered, put that in rationale/I_why and set meta_name to null.
- Prefer labels like "<ticker> <thread/narrative>" when the token name plus transcript gives real context. If no token-specific thread is available, use null.

Anti-fabrication:
- Targets and stops must come from spoken words. "2x" may be converted from actual entry market cap.
- Transcript excerpts must be near-verbatim evidence.
- If the transcript has no evidence, use null and set needs_review when useful.
`;
}

function parseTradeExtractionResponse(raw: string): LlmTradeExtraction[] {
  const arr = parseJsonArrayFromLlmOutput(raw);
  return arr
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((row) => ({
      mockape_trade_id: strOrNull(row.mockape_trade_id),
      token_name: strOrNull(row.token_name),
      pre_call_offset_ms: numberOrNull(row.pre_call_offset_ms),
      post_call_offset_ms: numberOrNull(row.post_call_offset_ms),
      target_low_mc: numberOrNull(row.target_low_mc),
      target_high_mc: numberOrNull(row.target_high_mc),
      stop_loss_mc: numberOrNull(row.stop_loss_mc),
      rationale: strOrNull(row.rationale),
      pre_transcript_excerpt: strOrNull(row.pre_transcript_excerpt),
      post_transcript_excerpt: strOrNull(row.post_transcript_excerpt),
      adherence_self_assessment: strOrNull(row.adherence_self_assessment),
      needs_review: boolOrNull(row.needs_review),
      notes: strOrNull(row.notes),
      meta_name: strOrNull(row.meta_name),
      N_score: binaryOrNull(row.N_score),
      N_why: strOrNull(row.N_why),
      I_score: binaryOrNull(row.I_score),
      I_why: strOrNull(row.I_why),
      C_score: binaryOrNull(row.C_score),
      C_why: strOrNull(row.C_why),
      S_score: binaryOrNull(row.S_score),
      S_why: strOrNull(row.S_why),
      NICS_score: numberOrNull(row.NICS_score),
      size_ok: boolOrNull(row.size_ok),
      zone_ok: boolOrNull(row.zone_ok),
      cooldown_ok: boolOrNull(row.cooldown_ok),
      trade_type: strOrNull(row.trade_type),
      counts_toward_50: boolOrNull(row.counts_toward_50),
      hard_reset: boolOrNull(row.hard_reset),
      running_count: numberOrNull(row.running_count),
      non_nics_pnl_pct: numberOrNull(row.non_nics_pnl_pct),
      cluster_pnl_pct: numberOrNull(row.cluster_pnl_pct),
      llm_grade_notes: strOrNull(row.llm_grade_notes),
    }));
}

function mergeTradeExtraction(trades: NormalizedTrade[], extracted: LlmTradeExtraction[]): NormalizedTrade[] {
  const byId = new Map(extracted.filter((row) => row.mockape_trade_id).map((row) => [row.mockape_trade_id as string, row]));
  return trades.map((trade) => {
    const row = byId.get(trade.id);
    if (!row) return { ...trade, enrichmentSource: 'ledger' };
    return applyTradeExtraction(trade, row);
  });
}

function applyTradeExtraction(trade: NormalizedTrade, row: LlmTradeExtraction): NormalizedTrade {
  const nicsScore = row.NICS_score ?? computeNicsScore(row.N_score, row.I_score, row.C_score, row.S_score);
  return {
    ...trade,
    tokenName: row.token_name ?? trade.tokenName,
    enrichmentSource: 'llm',
    entryCommentaryOffsetMs: row.pre_call_offset_ms,
    exitCommentaryOffsetMs: row.post_call_offset_ms,
    targetLowMc: row.target_low_mc,
    targetHighMc: row.target_high_mc,
    stopLossMc: row.stop_loss_mc,
    rationale: row.rationale,
    preTranscriptExcerpt: row.pre_transcript_excerpt,
    postTranscriptExcerpt: row.post_transcript_excerpt,
    adherenceSelfAssessment: row.adherence_self_assessment,
    needsReview: row.needs_review,
    notes: row.notes,
    metaName: row.meta_name,
    nScore: row.N_score,
    nWhy: row.N_why,
    iScore: row.I_score,
    iWhy: row.I_why,
    cScore: row.C_score,
    cWhy: row.C_why,
    sScore: row.S_score,
    sWhy: row.S_why,
    nicsScore,
    sizeOk: row.size_ok,
    zoneOk: row.zone_ok,
    cooldownOk: row.cooldown_ok,
    tradeType: row.trade_type,
    countsToward50: row.counts_toward_50,
    hardReset: row.hard_reset,
    runningCount: row.running_count,
    nonNicsPnlPct: row.non_nics_pnl_pct,
    clusterPnlPct: row.cluster_pnl_pct,
    llmGradeNotes: row.llm_grade_notes,
  };
}

function assignSessionMetaClusterIds(trades: NormalizedTrade[], session: ActiveTradeSession): NormalizedTrade[] {
  const clusterIds = new Map<string, string>();
  const stamp = formatClusterDateStamp(new Date(session.sessionStartedAtMs));
  let next = 1;
  return trades.map((trade) => {
    const metaName = normalizeTradeMetaName(trade.metaName);
    const key = metaName === 'unknown' ? '' : metaName.toLowerCase();
    let clusterId = key ? clusterIds.get(key) : undefined;
    if (!clusterId) {
      clusterId = `WT.${stamp}.${next}`;
      if (key) clusterIds.set(key, clusterId);
      next += 1;
    }
    return { ...trade, metaName, metaClusterId: clusterId };
  });
}

function normalizeTradeMetaName(value: string | null | undefined): string {
  const text = value?.trim() ?? '';
  if (!text || /^(none|null|n\/?a|unknown|unclear|missing)$/i.test(text)) return 'unknown';
  return isGenericTradeMechanicMetaName(text) ? 'unknown' : text;
}

function isGenericTradeMechanicMetaName(value: string): boolean {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (!normalized) return true;
  const exact = new Set([
    'pulse',
    'pulse buy',
    'pulse trade',
    'momentum',
    'volume',
    'interest',
    'activity',
    'people',
    'lots of people',
    'first one',
    'first token',
    'scroll and click',
    'testing',
    'system test',
    'scaling',
    'scaling out',
    'target',
    'quick target',
    'quick exit',
  ]);
  if (exact.has(normalized)) return true;
  const words = normalized.split(/\s+/).filter(Boolean);
  const genericWords = new Set([
    'pulse',
    'buy',
    'trade',
    'trading',
    'momentum',
    'volume',
    'interest',
    'activity',
    'people',
    'lot',
    'lots',
    'first',
    'one',
    'token',
    'scroll',
    'click',
    'test',
    'testing',
    'system',
    'scale',
    'scaling',
    'out',
    'target',
    'exit',
    'entry',
    'signal',
    'reason',
  ]);
  return words.length > 0 && words.every((word) => genericWords.has(word));
}

function reconcileTradeReviewFields(session: ActiveTradeSession, trades: NormalizedTrade[]): NormalizedTrade[] {
  const rows = trades.map((trade) => {
    const nicsScore = computeNicsScore(
      trade.nScore ?? null,
      trade.iScore ?? null,
      trade.cScore ?? null,
      trade.sScore ?? null
    );
    return {
      ...trade,
      nicsScore: nicsScore ?? trade.nicsScore ?? null,
      sizeOk: trade.sizeOk ?? isHalfSol(trade.solInvested),
      zoneOk: trade.zoneOk ?? isNicsMarketCapZone(trade.entryMarketCap),
      hardReset: trade.hardReset ?? isAboveHalfSol(trade.solInvested),
    };
  });

  const sortedIndexes = rows
    .map((trade, index) => ({ trade, index }))
    .sort((a, b) => (rowDateTimeMs(a.trade) ?? Number.MAX_SAFE_INTEGER) - (rowDateTimeMs(b.trade) ?? Number.MAX_SAFE_INTEGER));

  let runningCount = 0;
  let cumulativeSol = 0;
  for (const item of sortedIndexes) {
    const trade = rows[item.index];
    const evidenceOk = hasCountedNicsEvidence(trade) === true;
    const hardReset = trade.hardReset === true;
    const counts = evidenceOk && trade.sizeOk === true && trade.zoneOk === true && !hardReset;
    if (hardReset) runningCount = 0;
    else if (counts) runningCount += 1;
    const marketCapSeries = buildTradeMarketCapSeries(trade, session.marketCapObservations);
    const ohlcMc = computeNumberOhlc(marketCapSeries.map((point) => point.marketCapUsd));
    const ohlcSol = computeTradeSolOhlc(trade, ohlcMc, cumulativeSol);
    rows[item.index] = {
      ...trade,
      countsToward50: counts,
      runningCount,
      nonNicsPnlPct: counts ? null : normalizedPnlPercentage(trade),
      tradeType: normalizeTradeType(trade),
      ohlcMc,
      ohlcPct: computeTradePctOhlc(trade, ohlcMc),
      ohlcSol,
      ohlcSource: marketCapSeries.some((point) => point.source === 'rolling-sampler')
        ? `rolling-sampler:${trade.ohlcRangeSource ?? 'detected-market-cap'}`
        : marketCapSeries.some((point) => point.source === 'position-summary-range')
        ? 'position-summary-range'
        : marketCapSeries.some((point) => point.source === 'ledger-payload')
        ? 'market-cap-observations'
        : 'execution-ledger',
    };
    cumulativeSol = ohlcSol?.close ?? cumulativeSol;
  }

  const clusterPnl = new Map<string, number>();
  for (const trade of rows) {
    const clusterId = trade.metaClusterId?.trim();
    if (!clusterId || trade.pnlPercentage === null) continue;
    clusterPnl.set(clusterId, (clusterPnl.get(clusterId) ?? 0) + trade.pnlPercentage);
  }

  const losingClusters = completedLosingClusters(rows);
  return rows.map((trade) => {
    const clusterId = trade.metaClusterId?.trim();
    const cooldownOk = computeCooldownOk(trade, losingClusters);
    return {
      ...trade,
      cooldownOk: trade.cooldownOk ?? cooldownOk,
      clusterPnlPct: trade.clusterPnlPct ?? (clusterId ? clusterPnl.get(clusterId) ?? null : null),
    };
  });
}

function hasCountedNicsEvidence(trade: NormalizedTrade): boolean | null {
  const n = binaryOrNull(trade.nScore);
  const i = binaryOrNull(trade.iScore);
  const c = binaryOrNull(trade.cScore);
  const s = binaryOrNull(trade.sScore);
  if (n === null || i === null || (c === null && s === null)) return null;
  return n === 1 && i === 1 && (c === 1 || s === 1);
}

function normalizeTradeType(trade: NormalizedTrade): string {
  const raw = trade.tradeType?.trim();
  if (raw && /^(Core NICS\+\+|Scout|Non-NICS)$/i.test(raw)) {
    if (/^core/i.test(raw)) return 'Core NICS++';
    if (/^scout/i.test(raw)) return 'Scout';
    return 'Non-NICS';
  }
  if (hasCountedNicsEvidence(trade) === true) return 'Core NICS++';
  if ((trade.nScore ?? 0) === 1 || (trade.iScore ?? 0) === 1 || Boolean(trade.metaName)) return 'Scout';
  return 'Non-NICS';
}

function isHalfSol(value: number | null | undefined): boolean | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return Math.abs(value - 0.5) < 0.0001;
}

function isAboveHalfSol(value: number | null | undefined): boolean | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return value > 0.5 + 0.0001;
}

function isNicsMarketCapZone(value: number | null | undefined): boolean | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  return value >= 2000 && value <= 20000;
}

function rowDateTimeMs(trade: NormalizedTrade): number | null {
  return trade.entryTimestampMs ?? trade.timestampMs ?? null;
}

function completedLosingClusters(trades: NormalizedTrade[]): Array<{ clusterId: string; completedAtMs: number }> {
  const groups = new Map<string, { completedAtMs: number | null; pnlSol: number; pnlPct: number; rows: number }>();
  for (const trade of trades) {
    const clusterId = trade.metaClusterId?.trim();
    if (!clusterId) continue;
    const group = groups.get(clusterId) ?? { completedAtMs: null, pnlSol: 0, pnlPct: 0, rows: 0 };
    group.rows += 1;
    if (trade.timestampMs !== null) group.completedAtMs = Math.max(group.completedAtMs ?? trade.timestampMs, trade.timestampMs);
    if (trade.pnlSol !== null) group.pnlSol += trade.pnlSol;
    if (trade.pnlPercentage !== null) group.pnlPct += trade.pnlPercentage;
    groups.set(clusterId, group);
  }
  return [...groups.entries()]
    .filter(([, group]) => group.completedAtMs !== null && (group.pnlSol < 0 || (group.pnlSol === 0 && group.pnlPct < 0)))
    .map(([clusterId, group]) => ({ clusterId, completedAtMs: group.completedAtMs as number }));
}

function computeCooldownOk(
  trade: NormalizedTrade,
  losingClusters: Array<{ clusterId: string; completedAtMs: number }>
): boolean | null {
  const currentTime = rowDateTimeMs(trade);
  if (currentTime === null) return null;
  const currentClusterId = trade.metaClusterId?.trim() ?? '';
  const violates = losingClusters.some((cluster) => {
    if (cluster.clusterId === currentClusterId) return false;
    if (currentTime < cluster.completedAtMs) return false;
    return currentTime - cluster.completedAtMs < 5 * 60 * 1000;
  });
  return !violates;
}

function buildTradeMarketCapSeries(
  trade: NormalizedTrade,
  observations: MarketCapObservation[]
): Array<{ timestampMs: number; marketCapUsd: number; source: string }> {
  const entryMs = trade.entryTimestampMs;
  const exitMs = trade.timestampMs;
  const tokenAddress = trade.tokenAddress?.toLowerCase() ?? null;
  const tokenName = trade.tokenName.toLowerCase();
  const points: Array<{ timestampMs: number; marketCapUsd: number; source: string }> = [];
  for (const execution of trade.executions ?? []) {
    if (execution.timestampMs === null || execution.marketCapUsd === null) continue;
    points.push({
      timestampMs: execution.timestampMs,
      marketCapUsd: execution.marketCapUsd,
      source: 'execution-ledger',
    });
  }
  for (const observation of observations) {
    if (entryMs !== null && observation.timestampMs < entryMs) continue;
    if (exitMs !== null && observation.timestampMs > exitMs) continue;
    const observationAddress = observation.tokenAddress?.toLowerCase() ?? null;
    const observationName = observation.tokenName?.toLowerCase() ?? '';
    const tokenMatches = tokenAddress
      ? observationAddress === tokenAddress
      : observationName === tokenName;
    if (!tokenMatches) continue;
    points.push({
      timestampMs: observation.timestampMs,
      marketCapUsd: observation.marketCapUsd,
      source: observation.source,
    });
  }
  if (entryMs !== null && trade.entryMarketCap !== null) {
    points.push({ timestampMs: entryMs, marketCapUsd: trade.entryMarketCap, source: 'position-summary' });
  }
  const rangeSource = (trade.ohlcSampleCount ?? 0) > 0 ? 'rolling-sampler' : 'position-summary-range';
  const highMarketCapAtMs = trade.highMarketCapAtMs ?? entryMs;
  if (entryMs !== null && trade.highMarketCapAfterEntry !== null && isWithinTradeWindow(highMarketCapAtMs, entryMs, exitMs)) {
    points.push({ timestampMs: highMarketCapAtMs, marketCapUsd: trade.highMarketCapAfterEntry, source: rangeSource });
  }
  const lowMarketCapAtMs = trade.lowMarketCapAtMs ?? entryMs;
  if (entryMs !== null && trade.lowMarketCapAfterEntry !== null && isWithinTradeWindow(lowMarketCapAtMs, entryMs, exitMs)) {
    points.push({ timestampMs: lowMarketCapAtMs, marketCapUsd: trade.lowMarketCapAfterEntry, source: rangeSource });
  }
  if (exitMs !== null && trade.exitMarketCap !== null) {
    points.push({ timestampMs: exitMs, marketCapUsd: trade.exitMarketCap, source: 'position-summary' });
  }
  const seen = new Set<string>();
  return points
    .sort((a, b) => a.timestampMs - b.timestampMs)
    .filter((point) => {
      const key = `${point.timestampMs}:${point.marketCapUsd}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function isWithinTradeWindow(timestampMs: number | null, entryMs: number, exitMs: number | null): timestampMs is number {
  if (timestampMs === null || !Number.isFinite(timestampMs)) return false;
  if (timestampMs < entryMs) return false;
  return exitMs === null || timestampMs <= exitMs;
}

function computeNumberOhlc(points: number[]): TradeOhlc | null {
  if (points.length === 0) return null;
  return {
    open: points[0],
    high: Math.max(...points),
    low: Math.min(...points),
    close: points[points.length - 1],
  };
}

function computeTradePctOhlc(trade: NormalizedTrade, marketCapOhlc: TradeOhlc | null): TradeOhlc | null {
  const entry = trade.entryMarketCap;
  if (entry !== null && entry > 0 && marketCapOhlc) {
    return {
      open: ((marketCapOhlc.open - entry) / entry) * 100,
      high: ((marketCapOhlc.high - entry) / entry) * 100,
      low: ((marketCapOhlc.low - entry) / entry) * 100,
      close: ((marketCapOhlc.close - entry) / entry) * 100,
    };
  }
  const points = [0];
  if (trade.pnlPercentage !== null) points.push(trade.pnlPercentage);
  const close = points[points.length - 1] ?? 0;
  return {
    open: 0,
    high: Math.max(...points, close),
    low: Math.min(...points, close),
    close,
  };
}

function computeTradeSolOhlc(
  trade: NormalizedTrade,
  marketCapOhlc: TradeOhlc | null,
  cumulativeOpen: number
): TradeOhlc | null {
  const openingFeeHole = Math.max(0, trade.buyFeesNative ?? 0) * 2;
  const open = cumulativeOpen - openingFeeHole;
  const points = [open];
  const entryMarketCap = trade.entryMarketCap;
  const solInvested = trade.solInvested;
  if (
    marketCapOhlc &&
    entryMarketCap !== null &&
    entryMarketCap > 0 &&
    solInvested !== null &&
    Number.isFinite(solInvested)
  ) {
    points.push(
      solAtMarketCap(open, solInvested, entryMarketCap, marketCapOhlc.high),
      solAtMarketCap(open, solInvested, entryMarketCap, marketCapOhlc.low),
      solAtMarketCap(open, solInvested, entryMarketCap, marketCapOhlc.close)
    );
  } else {
    let realized = 0;
    for (const execution of trade.executions ?? []) {
      if (execution.side !== 'sell' || execution.pnlNative === null) continue;
      realized += execution.pnlNative;
      points.push(open + realized);
    }
  }
  const close = cumulativeOpen + (normalizedPnlSol(trade) ?? 0);
  points.push(close);
  return {
    open,
    high: Math.max(...points),
    low: Math.min(...points),
    close,
  };
}

function solAtMarketCap(open: number, solInvested: number, entryMarketCap: number, marketCap: number): number {
  return open + solInvested * ((marketCap - entryMarketCap) / entryMarketCap);
}

function normalizedSolReceived(trade: NormalizedTrade): number | null {
  return coalesceNumber(trade.solReceived, sumNullable(trade.solInvested, trade.pnlSol));
}

function normalizedPnlSol(trade: NormalizedTrade): number | null {
  const received = normalizedSolReceived(trade);
  if (received !== null && trade.solInvested !== null) return received - trade.solInvested;
  return trade.pnlSol;
}

function normalizedPnlPercentage(trade: NormalizedTrade): number | null {
  const pnlSol = normalizedPnlSol(trade);
  if (pnlSol !== null && trade.solInvested !== null && trade.solInvested > 0) {
    return (pnlSol / trade.solInvested) * 100;
  }
  return trade.pnlPercentage;
}

function computeNetPnl(solReceived: number | null, solInvested: number | null): number | null {
  if (solReceived === null || solInvested === null) return null;
  return solReceived - solInvested;
}

function computeNetPnlPct(pnlSol: number | null, solInvested: number | null): number | null {
  if (pnlSol === null || solInvested === null || solInvested <= 0) return null;
  return (pnlSol / solInvested) * 100;
}

function coalesceNumber(...values: Array<number | null>): number | null {
  return values.find((value): value is number => value !== null && Number.isFinite(value)) ?? null;
}

function sumNullable(...values: Array<number | null>): number | null {
  let total = 0;
  let hasValue = false;
  for (const value of values) {
    if (value === null || !Number.isFinite(value)) continue;
    total += value;
    hasValue = true;
  }
  return hasValue ? total : null;
}

async function backfillNicsForTrades(
  session: ActiveTradeSession,
  trades: NormalizedTrade[],
  warnings: string[]
): Promise<NormalizedTrade[]> {
  const prompt = renderNicsBackfillPrompt(session, trades);
  const responsePath = path.join(session.inputsDir, 'nics-response.json');
  fs.writeFileSync(path.join(session.inputsDir, 'nics-prompt.md'), prompt, 'utf-8');
  const llm = await runTradeLlmPrompt(prompt, session, 'NICS backfill');
  fs.writeFileSync(`${responsePath}.raw.txt`, llm.rawText, 'utf-8');
  if (!llm.ok) {
    warnings.push(llm.message);
    appendSessionLogForSession(session, 'trade-enrichment', 'nics backfill failed', { message: llm.message }, 'warning');
    return trades;
  }
  try {
    const rows = parseTradeExtractionResponse(llm.rawText);
    fs.writeFileSync(responsePath, JSON.stringify(rows, null, 2), 'utf-8');
    const merged = mergeNicsBackfill(trades, rows);
    appendSessionLogForSession(session, 'trade-enrichment', 'nics backfill merged', {
      responsePath,
      rows: rows.length,
    }, 'success');
    return merged;
  } catch (err) {
    const message = `NICS backfill response could not be parsed: ${(err as Error).message}`;
    warnings.push(message);
    appendSessionLogForSession(session, 'trade-enrichment', 'nics backfill parse failed', {
      responsePath: `${responsePath}.raw.txt`,
      error: (err as Error).message,
    }, 'error');
    return trades;
  }
}

function renderNicsBackfillPrompt(session: ActiveTradeSession, trades: NormalizedTrade[]): string {
  const rows = trades.map((trade, index) => ({
    trade_id: index + 1,
    mockape_trade_id: trade.id,
    token_name: trade.tokenName,
    rationale: trade.rationale,
    pre_transcript_excerpt: trade.preTranscriptExcerpt,
    post_transcript_excerpt: trade.postTranscriptExcerpt,
    adherence_self_assessment: trade.adherenceSelfAssessment,
    notes: trade.notes,
  }));
  const transcript = session.transcriptSegments.map((segment) => `[${formatOffset(segment.offsetMs)}] ${segment.text}`).join('\n');
  return `Grade these WilyTrader trade rows for NICS/meta classification.

Return ONLY a JSON array. Each object must include mockape_trade_id, token_name, meta_name, N_score, N_why, I_score, I_why, C_score, C_why, S_score, S_why, NICS_score, trade_type, llm_grade_notes.

Scoring:
- N = narrative/thread/setup named. A ticker alone is not enough unless the token name itself carries the narrative.
- I = why this token or immediate evidence supports entry.
- C = cut/close reason.
- S = sell/stay plan, target, scale-out, cost recovery, or upside management.
- NICS_score = N + I + C + S. Count-to-50 is a separate rule: N=1, I=1, and either C=1 or S=1, plus Desktop-computed size/zone checks.
- trade_type must be "Core NICS++", "Scout", or "Non-NICS"; do not use generic direction labels like long or short.
- Do not populate size_ok, zone_ok, cooldown_ok, counts_toward_50, hard_reset, running_count, non_nics_pnl_pct, or cluster_pnl_pct. Desktop computes those from ledger/session state.
- Use 0 and explain missing evidence when absent.
- meta_name must identify the token/thread/narrative, not the button clicked or entry mechanic. Do not use pulse buy, momentum, volume, interest, activity, first one, scroll and click, testing, scaling, target, or people as meta names. Put those in I_why or notes instead. Use null when no token-specific narrative/thread is available.

Rows:
\`\`\`json
${JSON.stringify(rows, null, 2)}
\`\`\`

Transcript:
\`\`\`
${transcript}
\`\`\`
`;
}

function mergeNicsBackfill(trades: NormalizedTrade[], rows: LlmTradeExtraction[]): NormalizedTrade[] {
  const byId = new Map(rows.filter((row) => row.mockape_trade_id).map((row) => [row.mockape_trade_id as string, row]));
  return trades.map((trade) => {
    if (hasCompleteNics(trade)) return trade;
    const row = byId.get(trade.id);
    if (!row) return trade;
    return {
      ...trade,
      metaName: row.meta_name ?? trade.metaName,
      nScore: row.N_score ?? trade.nScore,
      nWhy: row.N_why ?? trade.nWhy,
      iScore: row.I_score ?? trade.iScore,
      iWhy: row.I_why ?? trade.iWhy,
      cScore: row.C_score ?? trade.cScore,
      cWhy: row.C_why ?? trade.cWhy,
      sScore: row.S_score ?? trade.sScore,
      sWhy: row.S_why ?? trade.sWhy,
      nicsScore: row.NICS_score ?? computeNicsScore(row.N_score, row.I_score, row.C_score, row.S_score) ?? trade.nicsScore,
      tradeType: row.trade_type ?? trade.tradeType,
      llmGradeNotes: row.llm_grade_notes ?? trade.llmGradeNotes,
      enrichmentSource: 'llm',
    };
  });
}

function hasCompleteNics(trade: NormalizedTrade): boolean {
  return Boolean(
    trade.metaName &&
    trade.nScore !== null && trade.nScore !== undefined &&
    trade.iScore !== null && trade.iScore !== undefined &&
    trade.cScore !== null && trade.cScore !== undefined &&
    trade.sScore !== null && trade.sScore !== undefined &&
    trade.nWhy &&
    trade.iWhy &&
    trade.cWhy &&
    trade.sWhy
  );
}

function writeTradeLogMd(session: ActiveTradeSession, trades: NormalizedTrade[]): string {
  const mdPath = path.join(session.sessionDir, 'trade_log.md');
  const lines = [
    '# Trade Log',
    '',
    `Generated by WilyTrader Desktop - ${new Date().toLocaleString()}`,
    `Session started: ${new Date(session.sessionStartedAtMs).toLocaleString()}`,
    `Total trades: ${trades.length}`,
    '',
  ];
  if (trades.length === 0) {
    lines.push('_No closed WilyTrader trades were available when the session stopped._', '');
  }
  for (const trade of trades) {
    lines.push('---', '', `## ${trade.tokenName}`, '');
    lines.push(`- **Entry time actual:** ${formatTradeTime(trade.entryTimestampMs) || 'unknown'}`);
    lines.push(`- **Exit time actual:** ${formatTradeTime(trade.timestampMs) || 'unknown'}`);
    lines.push(`- **Time in trade seconds:** ${trade.timeInTradeSeconds ?? 'unknown'}`);
    lines.push(`- **Market cap:** entry ${formatDollars(trade.entryMarketCap)} -> exit ${formatDollars(trade.exitMarketCap)}`);
    lines.push(`- **P&L:** ${formatSol(normalizedPnlSol(trade))} (${formatPercent(normalizedPnlPercentage(trade))})`);
    lines.push(`- **SOL:** in ${formatSol(trade.solInvested)} / out ${formatSol(normalizedSolReceived(trade))}`);
    if (trade.rationale) lines.push(`- **Rationale:** ${trade.rationale}`);
    if (trade.targetLowMc || trade.targetHighMc || trade.stopLossMc) {
      lines.push(`- **Plan:** target ${formatDollars(trade.targetLowMc ?? null)} -> ${formatDollars(trade.targetHighMc ?? null)}, stop ${formatDollars(trade.stopLossMc ?? null)}`);
    }
    if (trade.nicsScore !== undefined && trade.nicsScore !== null) lines.push(`- **NICS:** ${trade.nicsScore}/4${trade.tradeType ? ` (${trade.tradeType})` : ''}`);
    if (trade.preTranscriptExcerpt) lines.push(`- **Pre excerpt:** ${trade.preTranscriptExcerpt}`);
    if (trade.postTranscriptExcerpt) lines.push(`- **Post excerpt:** ${trade.postTranscriptExcerpt}`);
    const screenshots = findTradeScreenshots(session, trade);
    if (screenshots.length > 0) {
      lines.push('', '**Trade screenshots:**', '');
      for (const screenshot of screenshots) {
        lines.push(`![Trade screenshot](${markdownPath(path.relative(session.sessionDir, screenshot))})`, '');
      }
    }
    lines.push('');
  }
  fs.writeFileSync(mdPath, `${lines.join(os.EOL)}${os.EOL}`, 'utf-8');
  return mdPath;
}

const XLSX_COLUMNS = [
  'source_session',
  'source_log_type',
  'source_folder_archived_path',
  'processed_at',
  'trade_id',
  'token_name',
  'entry_date',
  'exit_date',
  'video_start_time',
  'entry_commentary_time',
  'exit_commentary_time',
  'exit_time_actual',
  'time_in_trade_seconds',
  'video_end_time',
  'entry_mc_actual',
  'target_exit_low_mc',
  'target_exit_high_mc',
  'stop_loss_mc',
  'exit_mc_actual',
  'sol_invested',
  'sol_received',
  'pnl_sol',
  'pnl_percentage',
  'rationale',
  'pre_transcript_excerpt',
  'post_transcript_excerpt',
  'adherence_self_assessment',
  'notes',
  'needs_review',
  'mockape_trade_id',
  'Hour',
  'Weekday',
  'WeekdayNum',
  'TimeBucket',
  'meta_cluster_id',
  'meta_name',
  'N_score',
  'N_why',
  'I_score',
  'I_why',
  'C_score',
  'C_why',
  'S_score',
  'S_why',
  'NICS_score',
  'size_ok',
  'zone_ok',
  'cooldown_ok',
  'trade_type',
  'counts_toward_50',
  'hard_reset',
  'running_count',
  'non_nics_pnl_pct',
  'cluster_pnl_pct',
  'llm_grade_notes',
  'ohlc_mc_open',
  'ohlc_mc_high',
  'ohlc_mc_low',
  'ohlc_mc_close',
  'ohlc_sol_open',
  'ohlc_sol_high',
  'ohlc_sol_low',
  'ohlc_sol_close',
  'ohlc_pct_high',
  'ohlc_pct_low',
  'ohlc_pct_close',
  'ohlc_screenshot',
  'is_new_cluster_start',
  'prior_cluster_id',
  'prior_cluster_last_exit_dt',
  'this_trade_entry_dt',
  'cooldown_minutes',
  'prior_cluster_outcome',
  'cooldown_bucket',
  'cluster_group_id',
  'cluster_total_pnl_sol',
  'cluster_avg_pnl_pct',
  'cluster_win',
  'trade_num_in_session',
] as const;

const EXIT_LEG_COLUMNS = [
  'source_session',
  'trade_id',
  'mockape_trade_id',
  'token_name',
  'exit_leg_number',
  'execution_id',
  'exit_time',
  'requested_sell_pct_of_remaining',
  'sell_pct_of_original_position',
  'tokens_sold',
  'exit_mc',
  'exit_price_native',
  'gross_received',
  'exit_fee',
  'net_received',
  'allocated_entry_cost',
  'allocated_entry_fee',
  'leg_total_cost_basis',
  'leg_pnl_before_allocated_entry_fee',
  'leg_pnl_after_allocated_entry_fee',
  'leg_pnl_pct_after_allocated_entry_fee',
] as const;

const XLSX_STYLE_IDS: Record<XlsxStyleKey, number> = {
  integer: 1,
  sol3: 2,
  percent1: 3,
  nativePrice: 4,
  date: 5,
};

const TRADE_LOG_COLUMN_STYLES: Partial<Record<typeof XLSX_COLUMNS[number], XlsxStyleKey>> = {
  trade_id: 'integer',
  entry_date: 'date',
  exit_date: 'date',
  time_in_trade_seconds: 'integer',
  entry_mc_actual: 'integer',
  target_exit_low_mc: 'integer',
  target_exit_high_mc: 'integer',
  stop_loss_mc: 'integer',
  exit_mc_actual: 'integer',
  sol_invested: 'sol3',
  sol_received: 'sol3',
  pnl_sol: 'sol3',
  pnl_percentage: 'percent1',
  Hour: 'integer',
  WeekdayNum: 'integer',
  N_score: 'integer',
  I_score: 'integer',
  C_score: 'integer',
  S_score: 'integer',
  NICS_score: 'integer',
  counts_toward_50: 'integer',
  hard_reset: 'integer',
  running_count: 'integer',
  non_nics_pnl_pct: 'percent1',
  cluster_pnl_pct: 'percent1',
  ohlc_mc_open: 'integer',
  ohlc_mc_high: 'integer',
  ohlc_mc_low: 'integer',
  ohlc_mc_close: 'integer',
  ohlc_sol_open: 'sol3',
  ohlc_sol_high: 'sol3',
  ohlc_sol_low: 'sol3',
  ohlc_sol_close: 'sol3',
  ohlc_pct_high: 'percent1',
  ohlc_pct_low: 'percent1',
  ohlc_pct_close: 'percent1',
  cluster_avg_pnl_pct: 'percent1',
};

const EXIT_LEG_COLUMN_STYLES: Partial<Record<typeof EXIT_LEG_COLUMNS[number], XlsxStyleKey>> = {
  trade_id: 'integer',
  exit_leg_number: 'integer',
  requested_sell_pct_of_remaining: 'percent1',
  sell_pct_of_original_position: 'percent1',
  tokens_sold: 'nativePrice',
  exit_mc: 'integer',
  exit_price_native: 'nativePrice',
  gross_received: 'sol3',
  exit_fee: 'sol3',
  net_received: 'sol3',
  allocated_entry_cost: 'sol3',
  allocated_entry_fee: 'sol3',
  leg_total_cost_basis: 'sol3',
  leg_pnl_before_allocated_entry_fee: 'sol3',
  leg_pnl_after_allocated_entry_fee: 'sol3',
  leg_pnl_pct_after_allocated_entry_fee: 'percent1',
};

async function writeTradeLogXlsx(session: ActiveTradeSession, trades: NormalizedTrade[], stoppedAtMs: number): Promise<string> {
  const xlsxPath = path.join(session.sessionDir, 'trade_log.xlsx');
  const rows = trades.map((trade, index) => buildTradeRow(session, trade, index + 1, stoppedAtMs));
  const exitLegRows = trades.flatMap((trade, index) => buildExitLegRows(session, trade, index + 1));
  const zip = new JSZip();
  zip.file('[Content_Types].xml', xmlContentTypes());
  zip.folder('_rels')?.file('.rels', xmlRootRels());
  const xl = zip.folder('xl');
  xl?.file('workbook.xml', xmlWorkbook());
  xl?.folder('_rels')?.file('workbook.xml.rels', xmlWorkbookRels());
  const tradeSheet = xmlWorksheet(XLSX_COLUMNS, rows, TRADE_LOG_COLUMN_STYLES);
  const exitLegSheet = xmlWorksheet(EXIT_LEG_COLUMNS, exitLegRows, EXIT_LEG_COLUMN_STYLES);
  const worksheets = xl?.folder('worksheets');
  worksheets?.file('sheet1.xml', tradeSheet.xml);
  worksheets?.file('sheet2.xml', exitLegSheet.xml);
  const worksheetRels = worksheets?.folder('_rels');
  if (tradeSheet.rels) worksheetRels?.file('sheet1.xml.rels', tradeSheet.rels);
  if (exitLegSheet.rels) worksheetRels?.file('sheet2.xml.rels', exitLegSheet.rels);
  xl?.file('styles.xml', xmlStyles());
  zip.folder('docProps')?.file('app.xml', xmlAppProps());
  zip.folder('docProps')?.file('core.xml', xmlCoreProps());
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(xlsxPath, buffer);
  return xlsxPath;
}

function sortTradesByExitDateTime(trades: NormalizedTrade[]): NormalizedTrade[] {
  return [...trades].sort((a, b) =>
    sortableTimestampMs(a.timestampMs) - sortableTimestampMs(b.timestampMs) ||
    sortableTimestampMs(a.entryTimestampMs) - sortableTimestampMs(b.entryTimestampMs) ||
    String(a.id ?? '').localeCompare(String(b.id ?? ''), undefined, { numeric: true }) ||
    String(a.tokenName ?? '').localeCompare(String(b.tokenName ?? ''), undefined, { numeric: true })
  );
}

function sortableTimestampMs(value: number | null | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

function buildTradeRow(
  session: ActiveTradeSession,
  trade: NormalizedTrade,
  index: number,
  stoppedAtMs: number
): Record<string, XlsxCell> {
  const entry = trade.entryTimestampMs ? new Date(trade.entryTimestampMs) : null;
  const exit = trade.timestampMs ? new Date(trade.timestampMs) : null;
  const rowNumber = index + 1;
  const timeInTradeSeconds =
    trade.timeInTradeSeconds ??
    (entry && exit ? Math.max(0, Math.round((exit.getTime() - entry.getTime()) / 1000)) : null);
  const ohlcScreenshot = selectTradeOhlcScreenshot(session, trade);
  const ohlcScreenshotLink = ohlcScreenshot ? filePathToHyperlinkTarget(ohlcScreenshot) : null;
  const ohlcScreenshotName = ohlcScreenshot ? path.basename(ohlcScreenshot) : null;
  return {
    source_session: path.basename(session.sessionDir),
    source_log_type: trade.enrichmentSource === 'llm' ? 'wilytrader-desktop-enriched' : 'wilytrader-desktop-audio',
    source_folder_archived_path: session.sessionDir,
    processed_at: new Date().toISOString(),
    trade_id: xlsxInteger(index),
    token_name: trade.tokenName,
    entry_date: xlsxDate(entry),
    exit_date: xlsxDate(exit),
    video_start_time: formatTradeTime(session.sessionStartedAtMs),
    entry_commentary_time: formatSessionOffsetTime(session, trade.entryCommentaryOffsetMs ?? null),
    exit_commentary_time: formatSessionOffsetTime(session, trade.exitCommentaryOffsetMs ?? null),
    exit_time_actual: formatTradeTime(trade.timestampMs),
    time_in_trade_seconds: xlsxInteger(timeInTradeSeconds),
    video_end_time: formatTradeTime(stoppedAtMs),
    entry_mc_actual: xlsxInteger(trade.entryMarketCap),
    target_exit_low_mc: xlsxInteger(trade.targetLowMc ?? null),
    target_exit_high_mc: xlsxInteger(trade.targetHighMc ?? null),
    stop_loss_mc: xlsxInteger(trade.stopLossMc ?? null),
    exit_mc_actual: xlsxInteger(trade.exitMarketCap),
    sol_invested: xlsxDecimal(trade.solInvested, 3),
    sol_received: xlsxDecimal(normalizedSolReceived(trade), 3),
    pnl_sol: xlsxDecimal(normalizedPnlSol(trade), 3),
    pnl_percentage: xlsxFormula(`IFERROR(V${rowNumber}/T${rowNumber},"")`),
    rationale: trade.rationale ?? '',
    pre_transcript_excerpt: trade.preTranscriptExcerpt ?? '',
    post_transcript_excerpt: trade.postTranscriptExcerpt ?? '',
    adherence_self_assessment: trade.adherenceSelfAssessment ?? '',
    notes: buildTradeNotes(trade, entry, exit),
    needs_review: formatBoolean(trade.needsReview),
    mockape_trade_id: trade.id,
    Hour: xlsxFormula(`IFERROR(HOUR(IFERROR(IFERROR(IFERROR(TIMEVALUE(J${rowNumber}),TIMEVALUE(I${rowNumber})),TIMEVALUE(L${rowNumber})),TIMEVALUE(H${rowNumber}))),"")`),
    Weekday: xlsxFormula(`IFERROR(TEXT(IF(ISNUMBER(G${rowNumber}),G${rowNumber},DATEVALUE(G${rowNumber})),"ddd"),"")`),
    WeekdayNum: xlsxFormula(`IFERROR(WEEKDAY(IF(ISNUMBER(G${rowNumber}),G${rowNumber},DATEVALUE(G${rowNumber})),2),"")`),
    TimeBucket: xlsxFormula(timeBucketFormula(rowNumber)),
    meta_cluster_id: trade.metaClusterId ?? 'unknown',
    meta_name: normalizeTradeMetaName(trade.metaName),
    N_score: xlsxInteger(trade.nScore ?? null),
    N_why: trade.nWhy ?? '',
    I_score: xlsxInteger(trade.iScore ?? null),
    I_why: trade.iWhy ?? '',
    C_score: xlsxInteger(trade.cScore ?? null),
    C_why: trade.cWhy ?? '',
    S_score: xlsxInteger(trade.sScore ?? null),
    S_why: trade.sWhy ?? '',
    NICS_score: xlsxInteger(trade.nicsScore ?? null),
    size_ok: formatBoolean(trade.sizeOk),
    zone_ok: formatBoolean(trade.zoneOk),
    cooldown_ok: formatBoolean(trade.cooldownOk),
    trade_type: trade.tradeType ?? '',
    counts_toward_50: xlsxBooleanCount(trade.countsToward50),
    hard_reset: xlsxBooleanCount(trade.hardReset),
    running_count: xlsxFormula(`IF(AY${rowNumber}=TRUE,0,N(AZ${rowNumber - 1})+AX${rowNumber})`),
    non_nics_pnl_pct: xlsxFormula(`IF(AW${rowNumber}="Non-NICS",W${rowNumber},"")`),
    cluster_pnl_pct: xlsxFormula(`IFERROR(SUMIF(AI:AI,AI${rowNumber},V:V)/SUMIF(AI:AI,AI${rowNumber},T:T),0)`),
    llm_grade_notes: trade.llmGradeNotes ?? '',
    ohlc_mc_open: xlsxInteger(trade.ohlcMc?.open ?? null),
    ohlc_mc_high: xlsxInteger(trade.ohlcMc?.high ?? null),
    ohlc_mc_low: xlsxInteger(trade.ohlcMc?.low ?? null),
    ohlc_mc_close: xlsxInteger(trade.ohlcMc?.close ?? null),
    ohlc_sol_open: xlsxDecimal(trade.ohlcSol?.open ?? null, 3),
    ohlc_sol_high: xlsxDecimal(trade.ohlcSol?.high ?? null, 3),
    ohlc_sol_low: xlsxDecimal(trade.ohlcSol?.low ?? null, 3),
    ohlc_sol_close: xlsxDecimal(trade.ohlcSol?.close ?? null, 3),
    ohlc_pct_high: xlsxFormula(`IFERROR(BE${rowNumber}/BD${rowNumber}-1,"")`),
    ohlc_pct_low: xlsxFormula(`IFERROR(BF${rowNumber}/BD${rowNumber}-1,"")`),
    ohlc_pct_close: xlsxFormula(`IFERROR(BG${rowNumber}/BD${rowNumber}-1,"")`),
    ohlc_screenshot: ohlcScreenshot && ohlcScreenshotName
      ? {
          text: ohlcScreenshotName,
          formula: xlsxHyperlinkFormula(ohlcScreenshotLink ?? ohlcScreenshot, ohlcScreenshotName),
          tooltip: `Open chart screenshot: ${ohlcScreenshot}`,
        }
      : '',
    is_new_cluster_start: xlsxFormula(`IF(AI${rowNumber}<>AI${rowNumber - 1},1,0)`),
    prior_cluster_id: xlsxFormula(`IF(BP${rowNumber}=1,IF(ROW()=2,"",AI${rowNumber - 1}),"")`),
    prior_cluster_last_exit_dt: xlsxFormula(`IF(AND(BP${rowNumber}=1,ROW()>2),G${rowNumber - 1}+IFERROR(TIMEVALUE(L${rowNumber - 1}),0),"")`),
    this_trade_entry_dt: xlsxFormula(`IF(BP${rowNumber}=1,G${rowNumber}+IFERROR(TIMEVALUE(J${rowNumber}),IFERROR(TIMEVALUE(L${rowNumber})-M${rowNumber}/86400,0)),"")`),
    cooldown_minutes: xlsxFormula(`IF(AND(BP${rowNumber}=1,ISNUMBER(BR${rowNumber}),ISNUMBER(BS${rowNumber})),(BS${rowNumber}-BR${rowNumber})*1440,"")`),
    prior_cluster_outcome: xlsxFormula(`IF(BQ${rowNumber}="","",IF(SUMIF(AI:AI,BQ${rowNumber},V:V)>0,"Win","Loss"))`),
    cooldown_bucket: xlsxFormula(`IF(NOT(ISNUMBER(BT${rowNumber})),"",IF(BT${rowNumber}<5,"0"&UNICHAR(8211)&"5 min",IF(BT${rowNumber}<10,"5"&UNICHAR(8211)&"10 min",IF(BT${rowNumber}<15,"10"&UNICHAR(8211)&"15 min",IF(BT${rowNumber}<30,"15"&UNICHAR(8211)&"30 min","30 min+")))))`),
    cluster_group_id: xlsxFormula(`SUM($BP$2:BP${rowNumber})`),
    cluster_total_pnl_sol: xlsxFormula(`IF(AND($BP${rowNumber}=1,NOT(ISBLANK($BV${rowNumber}))),SUMIFS(V:V,BW:BW,$BW${rowNumber}),"")`),
    cluster_avg_pnl_pct: xlsxFormula(`IF(AND($BP${rowNumber}=1,NOT(ISBLANK($BV${rowNumber}))),IFERROR(AVERAGEIFS(W:W,BW:BW,$BW${rowNumber}),""),"")`),
    cluster_win: xlsxFormula(`IF(AND($BP${rowNumber}=1,NOT(ISBLANK($BV${rowNumber}))),IF($BX${rowNumber}>0,1,0),"")`),
    trade_num_in_session: xlsxFormula(`COUNTIFS($A$2:$A${rowNumber},$A${rowNumber})`),
  };
}

function buildExitLegRows(
  session: ActiveTradeSession,
  trade: NormalizedTrade,
  tradeIndex: number
): Array<Record<string, XlsxCell>> {
  const sellExecutions = (trade.executions ?? []).filter((execution) => execution.side === 'sell');
  if (sellExecutions.length === 0) return [];
  const buyExecutions = (trade.executions ?? []).filter((execution) => execution.side === 'buy');
  const totalTokensBought = sumExecutionNumbers(buyExecutions, 'tokenAmount');
  const totalBuyFees = trade.buyFeesNative ?? sumExecutionNumbers(buyExecutions, 'feeNative');
  const totalEntryCost = trade.solInvested === null
    ? sumExecutionNumbers(buyExecutions, 'grossNative')
    : trade.solInvested;

  return sellExecutions.map((execution, legIndex) => {
    const tokenAmount = execution.tokenAmount ?? 0;
    const originalPositionRatio = totalTokensBought > 0 ? tokenAmount / totalTokensBought : 0;
    const allocatedEntryCost = execution.costBasisNative ?? (totalEntryCost * originalPositionRatio);
    const allocatedEntryFee = totalBuyFees * originalPositionRatio;
    const netReceived = execution.netNative ?? null;
    const grossReceived = execution.grossNative ?? null;
    const legPnlBeforeAllocatedEntryFee =
      netReceived === null ? execution.pnlNative : netReceived - allocatedEntryCost;
    const legPnlAfterAllocatedEntryFee =
      legPnlBeforeAllocatedEntryFee === null ? null : legPnlBeforeAllocatedEntryFee - allocatedEntryFee;
    const legTotalCostBasis = allocatedEntryCost + allocatedEntryFee;
    const legPnlPctAfterAllocatedEntryFee = legTotalCostBasis > 0 && legPnlAfterAllocatedEntryFee !== null
      ? (legPnlAfterAllocatedEntryFee / legTotalCostBasis) * 100
      : null;
    return {
      source_session: path.basename(session.sessionDir),
      trade_id: xlsxInteger(tradeIndex),
      mockape_trade_id: trade.id,
      token_name: trade.tokenName,
      exit_leg_number: xlsxInteger(legIndex + 1),
      execution_id: execution.id ?? '',
      exit_time: formatTradeTime(execution.timestampMs),
      requested_sell_pct_of_remaining: xlsxPercent(execution.requestedSellPct),
      sell_pct_of_original_position: xlsxPercent(originalPositionRatio * 100),
      tokens_sold: xlsxDecimal(execution.tokenAmount, 6),
      exit_mc: xlsxInteger(execution.marketCapUsd),
      exit_price_native: xlsxDecimal(execution.unitPriceNative, 12),
      gross_received: xlsxDecimal(grossReceived, 3),
      exit_fee: xlsxDecimal(execution.feeNative, 3),
      net_received: xlsxDecimal(netReceived, 3),
      allocated_entry_cost: xlsxDecimal(allocatedEntryCost, 3),
      allocated_entry_fee: xlsxDecimal(allocatedEntryFee, 3),
      leg_total_cost_basis: xlsxDecimal(legTotalCostBasis, 3),
      leg_pnl_before_allocated_entry_fee: xlsxDecimal(legPnlBeforeAllocatedEntryFee, 3),
      leg_pnl_after_allocated_entry_fee: xlsxDecimal(legPnlAfterAllocatedEntryFee, 3),
      leg_pnl_pct_after_allocated_entry_fee: xlsxPercent(legPnlPctAfterAllocatedEntryFee),
    };
  });
}

function sumExecutionNumbers(executions: TradeExecutionPoint[], key: keyof TradeExecutionPoint): number {
  return executions.reduce((total, execution) => {
    const value = execution[key];
    return typeof value === 'number' && Number.isFinite(value) ? total + value : total;
  }, 0);
}

function xmlWorksheet(
  columns: readonly string[],
  rows: Array<Record<string, XlsxCell>>,
  columnStyles: Partial<Record<string, XlsxStyleKey>> = {}
): { xml: string; rels: string | null } {
  const header = columns.map((column) => xlsxHeaderLabel(column));
  const allRows = [header, ...rows.map((row) => columns.map((column) => row[column] ?? ''))];
  const hyperlinks: XlsxHyperlink[] = [];
  const sheetRows = allRows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row
        .map((value, columnIndex) => {
          const ref = `${columnLetters(columnIndex + 1)}${rowNumber}`;
          const column = columns[columnIndex];
          const style = rowIndex === 0 ? undefined : columnStyles[column];
          const cell = normalizeXlsxCell(value, style);
          if (cell.hyperlink) {
            hyperlinks.push({
              ref,
              target: cell.hyperlink,
              tooltip: cell.tooltip,
            });
          }
          const styleAttr = cell.styleId ? ` s="${cell.styleId}"` : '';
          if (cell.formula) {
            const cachedValue = cell.text ? `<v>${escapeXml(cell.text)}</v>` : '';
            const typeAttr = cell.text ? ' t="str"' : '';
            return `<c r="${ref}"${styleAttr}${typeAttr}><f>${escapeXml(cell.formula)}</f>${cachedValue}</c>`;
          }
          if (cell.number !== undefined) return `<c r="${ref}"${styleAttr}><v>${xlsxNumberValue(cell.number)}</v></c>`;
          return `<c r="${ref}"${styleAttr} t="inlineStr"><is><t>${escapeXml(cell.text)}</t></is></c>`;
        })
        .join('');
      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join('');
  const hyperlinkXml = hyperlinks.length > 0
    ? `<hyperlinks>${hyperlinks.map((link, index) => `<hyperlink ref="${link.ref}" r:id="rId${index + 1}"${link.tooltip ? ` tooltip="${escapeXmlAttribute(link.tooltip)}"` : ''}/>`).join('')}</hyperlinks>`
    : '';
  return {
    xml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetData>${sheetRows}</sheetData>${hyperlinkXml}</worksheet>`,
    rels: hyperlinks.length > 0 ? xmlWorksheetRels(hyperlinks) : null,
  };
}

function normalizeXlsxCell(
  value: XlsxCell,
  columnStyle?: XlsxStyleKey
): { text: string; number?: number; formula?: string; hyperlink?: string; tooltip?: string; styleId?: number } {
  const styleId = valueStyleId(typeof value === 'object' && value !== null ? value.style ?? columnStyle : columnStyle);
  if (typeof value === 'number') return { text: '', number: value, styleId };
  if (typeof value === 'string') return { text: value, styleId };
  return {
    text: value.text,
    formula: value.formula,
    hyperlink: value.hyperlink,
    tooltip: value.tooltip,
    styleId,
  };
}

function valueStyleId(style?: XlsxStyleKey): number | undefined {
  return style ? XLSX_STYLE_IDS[style] : undefined;
}

function xlsxNumberValue(value: number): string {
  return Number.isFinite(value) ? String(value) : '0';
}

function xlsxHeaderLabel(column: string): string {
  if (column === 'mockape_trade_id') return 'source_trade_id';
  return column;
}

function xmlContentTypes(): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>';
}

function xmlRootRels(): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>';
}

function xmlWorkbook(): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Trade Log" sheetId="1" r:id="rId1"/><sheet name="Exit Legs" sheetId="2" r:id="rId2"/></sheets></workbook>';
}

function xmlWorkbookRels(): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
}

function xmlWorksheetRels(hyperlinks: XlsxHyperlink[]): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hyperlinks.map((link, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="${escapeXmlAttribute(link.target)}" TargetMode="External"/>`).join('')}</Relationships>`;
}

function xmlStyles(): string {
  return [
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
    '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">',
    '<numFmts count="3">',
    '<numFmt numFmtId="164" formatCode="0.000"/>',
    '<numFmt numFmtId="165" formatCode="0.0%"/>',
    '<numFmt numFmtId="166" formatCode="0.000000000000"/>',
    '</numFmts>',
    '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>',
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>',
    '<borders count="1"><border/></borders>',
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>',
    '<cellXfs count="6">',
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
    '<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>',
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>',
    '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>',
    '<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>',
    '<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>',
    '</cellXfs>',
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>',
    '</styleSheet>',
  ].join('');
}

function xmlAppProps(): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>WilyTrader Desktop</Application></Properties>';
}

function xmlCoreProps(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:creator>WilyTrader Desktop</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created></cp:coreProperties>`;
}

function extractExecutionEvent(payload: unknown): BridgeExecutionEvent | null {
  const root = unwrapWilyTraderPayload(payload);
  if (!root || typeof root !== 'object') return null;
  const event = (root as Record<string, unknown>).event;
  if (!event || typeof event !== 'object') return null;
  const record = event as Record<string, unknown>;
  const executionId = strOrNull(record.executionId);
  if (!executionId) return null;
  return {
    type: strOrNull(record.type),
    captureScreenshot: Boolean(record.captureScreenshot),
    executionId,
    platform: strOrNull(record.platform),
    side: strOrNull(record.side),
    timestamp: strOrNull(record.timestamp),
    timestampMs: numberOrNull(record.timestampMs),
    tokenName: strOrNull(record.tokenName),
    tokenAddress: strOrNull(record.tokenAddress),
  };
}

function extractScreenshotPayload(payload: unknown): BridgeScreenshotPayload | null {
  const root = unwrapWilyTraderPayload(payload);
  if (!root || typeof root !== 'object') return null;
  const screenshot = (root as Record<string, unknown>).screenshot;
  if (!screenshot || typeof screenshot !== 'object') return null;
  return screenshot as BridgeScreenshotPayload;
}

function extractMockApeCompatibleTrades(payload: unknown): unknown[] {
  const root = unwrapWilyTraderPayload(payload);
  if (!root || typeof root !== 'object') return [];
  const direct = (root as Record<string, unknown>).mockapeCompatibleTrades;
  return Array.isArray(direct) ? direct : [];
}

function receiveExtensionStatus(payload: unknown): void {
  if (!payload || typeof payload !== 'object') return;
  const record = payload as Record<string, unknown>;
  const installedVersion = strOrNull(record.installedVersion);
  const localManifest = detectLocalExtensionManifest();
  extensionStatus = {
    ...extensionStatus,
    ...localManifest,
    runtimeInstalledVersion: installedVersion,
    runtimeExtensionId: strOrNull(record.extensionId),
    runtimeLastSeenAt: new Date().toISOString(),
    runtimePageUrl: strOrNull(record.pageUrl),
    runtimeTokenName: strOrNull(record.tokenName),
    runtimeTokenAddress: strOrNull(record.tokenAddress),
    runtimeTokenChain: strOrNull(record.tokenChain),
  };
  if (extensionStatus.latestVersion && installedVersion) {
    extensionStatus.updateAvailable = isRemoteVersionNewer(installedVersion, extensionStatus.latestVersion);
    extensionStatus.updateMessage = extensionStatus.updateAvailable
      ? `Extension ${extensionStatus.latestVersion} is available; running tab has ${installedVersion}.`
      : `Running extension is up to date (${installedVersion}).`;
  }
  appendSessionLog('extension-status', String(record.reason || 'heartbeat'), {
    installedVersion,
    extensionId: extensionStatus.runtimeExtensionId,
    pageUrl: extensionStatus.runtimePageUrl,
    tokenName: extensionStatus.runtimeTokenName,
    tokenAddress: extensionStatus.runtimeTokenAddress,
    tokenChain: extensionStatus.runtimeTokenChain,
    runtimeLastSeenAt: extensionStatus.runtimeLastSeenAt,
  });
  broadcastStatus();
}

function receiveExtensionDiagnostic(payload: unknown): void {
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  appendSessionLog('extension-diagnostic', String(record.stage || 'diagnostic'), record, 'info');
}

function unwrapWilyTraderPayload(parsed: unknown): unknown {
  if (!parsed || typeof parsed !== 'object') return parsed;
  const record = parsed as Record<string, unknown>;
  return record.payload && typeof record.payload === 'object' ? record.payload : parsed;
}

function filterPositionExecutions(
  position: Record<string, unknown>,
  executions: Array<Record<string, unknown>>
): Array<Record<string, unknown>> {
  const positionId = strOrNull(position.id);
  const tokenAddress = strOrNull(position.tokenAddress);
  const executionIds = new Set(
    Array.isArray(position.executionIds) ? position.executionIds.filter((id): id is string => typeof id === 'string') : []
  );
  return executions
    .filter((execution) => {
      if (executionIds.size > 0 && executionIds.has(strOrNull(execution.id) ?? '')) return true;
      if (positionId && strOrNull(execution.positionId) === positionId) return true;
      if (!positionId && executionIds.size === 0 && tokenAddress && strOrNull(execution.tokenAddress) === tokenAddress) return true;
      return false;
    })
    .sort((a, b) => (parseTimestampMs(a.timestampMs ?? a.timestamp) ?? 0) - (parseTimestampMs(b.timestampMs ?? b.timestamp) ?? 0));
}

function findFirstBuyTimestampMs(executions: Array<Record<string, unknown>>): number | null {
  const buy = executions.find((execution) => strOrNull(execution.side)?.toLowerCase() === 'buy');
  return buy ? parseTimestampMs(buy.timestampMs ?? buy.timestamp) : null;
}

function normalizeTradeExecutionPoint(execution: Record<string, unknown>): TradeExecutionPoint {
  return {
    id: strOrNull(execution.id),
    side: strOrNull(execution.side)?.toLowerCase() ?? null,
    timestampMs: parseTimestampMs(execution.timestampMs ?? execution.timestamp),
    marketCapUsd:
      numberOrNull(execution.executionMarketCapUsd) ??
      numberOrNull(execution.marketCapUsd) ??
      numberOrNull(execution.sourceMarketCapUsd),
    unitPriceNative: numberOrNull(execution.unitPriceNative),
    requestedSellPct: numberOrNull(execution.requestedSellPct),
    tokenAmount: numberOrNull(execution.tokenAmount),
    grossNative: numberOrNull(execution.grossNative),
    netNative: numberOrNull(execution.netNative),
    feeNative: numberOrNull(execution.feeNative),
    costBasisNative: numberOrNull(execution.costBasisNative),
    pnlNative: numberOrNull(execution.pnlNative),
    pnlPct: numberOrNull(execution.pnlPct),
    screenshotPath: strOrNull(execution.screenshotPath),
  };
}

function selectTradeOhlcScreenshot(session: ActiveTradeSession, trade: NormalizedTrade): string | null {
  const executionCandidates = findTradeScreenshotsFromExecutions(session, trade);
  if (executionCandidates.length > 0) return chooseTradeScreenshot(executionCandidates, trade);

  const metadataCandidates = findTradeScreenshotsByMetadata(session, trade);
  if (metadataCandidates.length > 0) return chooseTradeScreenshot(metadataCandidates, trade);

  const tokenCandidates = findTradeScreenshots(session, trade).map((screenshotPath) =>
    ({
      ...screenshotCandidateFromPath(screenshotPath, 3),
      tokenName: trade.tokenName,
      tokenAddress: trade.tokenAddress,
    })
  );
  return chooseTradeScreenshot(tokenCandidates, trade);
}

function findTradeScreenshotsFromExecutions(session: ActiveTradeSession, trade: NormalizedTrade): TradeScreenshotCandidate[] {
  const candidates: TradeScreenshotCandidate[] = [];
  const seen = new Set<string>();
  for (const execution of trade.executions ?? []) {
    const resolved = resolveSessionScreenshotPath(session, execution.screenshotPath ?? null);
    if (resolved && !seen.has(resolved)) {
      seen.add(resolved);
      candidates.push({
        path: resolved,
        side: execution.side,
        executionId: execution.id,
        tokenName: trade.tokenName,
        tokenAddress: trade.tokenAddress,
        timestampMs: execution.timestampMs,
        rank: 0,
      });
    }

    const executionId = execution.id?.toLowerCase();
    if (!executionId || !fs.existsSync(session.screenshotDir)) continue;
    for (const name of fs.readdirSync(session.screenshotDir)) {
      if (!name.toLowerCase().endsWith('.png')) continue;
      if (!name.toLowerCase().includes(executionId)) continue;
      const screenshotPath = path.join(session.screenshotDir, name);
      if (seen.has(screenshotPath)) continue;
      seen.add(screenshotPath);
      const pathCandidate = screenshotCandidateFromPath(screenshotPath, 1);
      candidates.push({
        ...pathCandidate,
        side: execution.side ?? pathCandidate.side,
        executionId: execution.id,
        tokenName: trade.tokenName,
        tokenAddress: trade.tokenAddress,
        timestampMs: execution.timestampMs ?? pathCandidate.timestampMs,
      });
    }
  }
  return candidates;
}

function resolveSessionScreenshotPath(session: ActiveTradeSession, screenshotPath: string | null): string | null {
  if (!screenshotPath) return null;
  if (fs.existsSync(screenshotPath)) return screenshotPath;
  const basename = path.basename(screenshotPath);
  const sessionCandidate = path.join(session.screenshotDir, basename);
  if (fs.existsSync(sessionCandidate)) return sessionCandidate;
  return null;
}

function findTradeScreenshotsByMetadata(session: ActiveTradeSession, trade: NormalizedTrade): TradeScreenshotCandidate[] {
  if (!fs.existsSync(session.screenshotMetadataDir)) return [];
  const candidates: TradeScreenshotCandidate[] = [];
  for (const name of fs.readdirSync(session.screenshotMetadataDir)) {
    if (!name.toLowerCase().endsWith('.json')) continue;
    const metadataPath = path.join(session.screenshotMetadataDir, name);
    try {
      const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8')) as Record<string, unknown>;
      const event = metadata.event && typeof metadata.event === 'object' ? metadata.event as Record<string, unknown> : {};
      const screenshotPath = resolveSessionScreenshotPath(session, strOrNull(metadata.screenshotPath));
      if (!screenshotPath) continue;
      const candidate: TradeScreenshotCandidate = {
        path: screenshotPath,
        side: strOrNull(event.side) ?? screenshotCandidateFromPath(screenshotPath, 2).side,
        executionId: strOrNull(event.executionId),
        tokenName: strOrNull(event.tokenName),
        tokenAddress: strOrNull(event.tokenAddress),
        timestampMs: parseTimestampMs(event.timestampMs ?? event.timestamp) ?? parseTimestampMs(metadata.capturedAtMs ?? metadata.capturedAt),
        rank: 2,
      };
      if (screenshotCandidateMatchesTrade(candidate, trade, true)) candidates.push(candidate);
    } catch {
      continue;
    }
  }
  return candidates;
}

function findTradeScreenshots(session: ActiveTradeSession, trade: NormalizedTrade): string[] {
  if (!fs.existsSync(session.screenshotDir)) return [];
  const tokenCandidates = [trade.tokenName, trade.tokenAddress]
    .map((value) => sanitizeFilePart(value).toLowerCase())
    .filter((value) => value.length >= 2);
  return fs
    .readdirSync(session.screenshotDir)
    .filter((name) => name.toLowerCase().endsWith('.png'))
    .filter((name) => tokenCandidates.length === 0 || tokenCandidates.some((token) => name.toLowerCase().includes(token.slice(0, 24))))
    .map((name) => path.join(session.screenshotDir, name));
}

function screenshotCandidateFromPath(screenshotPath: string, rank: number): TradeScreenshotCandidate {
  const name = path.basename(screenshotPath);
  const timestampMatch = name.match(/^(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})/);
  const timestampMs = timestampMatch
    ? new Date(
        Number(timestampMatch[1]),
        Number(timestampMatch[2]) - 1,
        Number(timestampMatch[3]),
        Number(timestampMatch[4]),
        Number(timestampMatch[5]),
        Number(timestampMatch[6])
      ).getTime()
    : null;
  const side = /(?:^|-)sell(?:-|\.|$)/i.test(name)
    ? 'sell'
    : /(?:^|-)buy(?:-|\.|$)/i.test(name)
      ? 'buy'
      : null;
  const executionId = name.match(/(exec-[A-Za-z0-9-]+)/i)?.[1] ?? null;
  return {
    path: screenshotPath,
    side,
    executionId,
    tokenName: null,
    tokenAddress: null,
    timestampMs,
    rank,
  };
}

function screenshotCandidateMatchesTrade(candidate: TradeScreenshotCandidate, trade: NormalizedTrade, requireTimeWindow: boolean): boolean {
  const candidateExecutionId = candidate.executionId;
  const tokenMatches =
    Boolean(trade.tokenAddress && candidate.tokenAddress && normalizeTokenKey(trade.tokenAddress) === normalizeTokenKey(candidate.tokenAddress)) ||
    Boolean(trade.tokenName && candidate.tokenName && normalizeTokenKey(trade.tokenName) === normalizeTokenKey(candidate.tokenName));
  const executionMatches = Boolean(
    candidateExecutionId &&
    (trade.executions ?? []).some((execution) => execution.id && normalizeTokenKey(execution.id) === normalizeTokenKey(candidateExecutionId))
  );
  const timeMatches = isScreenshotWithinTradeWindow(candidate.timestampMs, trade);
  if (executionMatches) return true;
  if (!tokenMatches) return false;
  return !requireTimeWindow || timeMatches;
}

function chooseTradeScreenshot(candidates: TradeScreenshotCandidate[], trade: NormalizedTrade): string | null {
  const unique = [...new Map(candidates.map((candidate) => [candidate.path, candidate])).values()]
    .filter((candidate) => fs.existsSync(candidate.path))
    .filter((candidate) => candidate.rank < 3 || screenshotCandidateMatchesTrade(candidate, trade, false));
  if (unique.length === 0) return null;
  return unique
    .sort((a, b) =>
      screenshotScore(a, trade) - screenshotScore(b, trade) ||
      String(a.path).localeCompare(String(b.path))
    )[0]?.path ?? null;
}

function screenshotScore(candidate: TradeScreenshotCandidate, trade: NormalizedTrade): number {
  const exitMs = trade.timestampMs;
  const entryMs = trade.entryTimestampMs;
  const timeMs = candidate.timestampMs;
  const outsidePenalty = isScreenshotWithinTradeWindow(timeMs, trade) ? 0 : 1_000_000_000_000;
  const sidePenalty = candidate.side === 'sell' ? 0 : candidate.side === 'buy' ? 25_000_000 : 50_000_000;
  const targetMs = candidate.side === 'buy'
    ? entryMs ?? exitMs
    : exitMs ?? entryMs;
  const distance = targetMs !== null && timeMs !== null ? Math.abs(timeMs - targetMs) : 500_000_000;
  return outsidePenalty + candidate.rank * 100_000_000 + sidePenalty + distance;
}

function isScreenshotWithinTradeWindow(timestampMs: number | null, trade: NormalizedTrade): boolean {
  if (timestampMs === null || !Number.isFinite(timestampMs)) return false;
  const entryMs = trade.entryTimestampMs;
  const exitMs = trade.timestampMs;
  const toleranceMs = 30_000;
  if (entryMs !== null && timestampMs < entryMs - toleranceMs) return false;
  if (exitMs !== null && timestampMs > exitMs + toleranceMs) return false;
  return true;
}

function normalizeTokenKey(value: string): string {
  return value.trim().toLowerCase();
}

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let bytes = 0;
    req.on('data', (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > MAX_BRIDGE_BODY_BYTES) {
        reject(new Error('Payload too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('error', reject);
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf-8');
        resolve(text ? JSON.parse(text) : {});
      } catch (err) {
        reject(err);
      }
    });
  });
}

function requireActiveSession(): ActiveTradeSession {
  if (!activeSession) throw new Error('No active WilyTrader trade session.');
  return activeSession;
}

function getOutputRoot(): string {
  return path.join(app.getPath('documents'), 'WilyTrader Desktop', 'Sessions');
}

function fallbackSettings(): WilyTraderDesktopSettings {
  return {
    outputDir: defaultCapturesRoot(),
    microphoneCaptureEnabled: true,
    saveBrowserScreenshots: true,
    generateTradeLogOnStop: true,
    masterTradingLogPath: defaultMasterTradingLogPath(defaultCapturesRoot()),
    autoCheckExtensionUpdates: true,
    tradeSessionHotkey: 'Ctrl+Alt+T',
    llmMode: 'gemini-cli',
    geminiCliCommand: 'gemini',
    geminiCliModel: 'gemini-3.1-pro-preview',
    openRouterApiKey: '',
    openRouterBaseUrl: 'https://openrouter.ai/api/v1',
    openRouterModel: 'google/gemini-2.5-flash',
    wilyTraderInstallPath: '',
  };
}

function defaultSettings(): WilyTraderDesktopSettings {
  return fallbackSettings();
}

function settingsPath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

function loadSettings(): WilyTraderDesktopSettings {
  const defaults = defaultSettings();
  try {
    const parsed = JSON.parse(fs.readFileSync(settingsPath(), 'utf-8')) as Partial<WilyTraderDesktopSettings>;
    const loaded = sanitizeSettings({ ...defaults, ...parsed });
    if (isOldDefaultOutputDir(loaded.outputDir)) {
      return {
        ...loaded,
        outputDir: defaults.outputDir,
        masterTradingLogPath: loaded.masterTradingLogPath === defaultMasterTradingLogPath(loaded.outputDir)
          ? defaultMasterTradingLogPath(defaults.outputDir)
          : loaded.masterTradingLogPath,
      };
    }
    return loaded;
  } catch {
    return defaults;
  }
}

function saveSettings(payload: Partial<WilyTraderDesktopSettings>): WilyTraderDesktopSettings {
  const previousHotkey = settings.tradeSessionHotkey;
  const previousOutputDir = settings.outputDir;
  const previousMasterTradingLogPath = settings.masterTradingLogPath;
  const previousAutoCheckExtensionUpdates = settings.autoCheckExtensionUpdates;
  const mergedSettings = { ...settings, ...payload };
  const nextOutputDir = strOrNull(mergedSettings.outputDir) ?? previousOutputDir;
  if (
    nextOutputDir !== previousOutputDir &&
    previousMasterTradingLogPath === defaultMasterTradingLogPath(previousOutputDir) &&
    (!strOrNull(payload.masterTradingLogPath) || payload.masterTradingLogPath === previousMasterTradingLogPath)
  ) {
    mergedSettings.masterTradingLogPath = defaultMasterTradingLogPath(nextOutputDir);
  }
  settings = sanitizeSettings(mergedSettings);
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), 'utf-8');
  const seededMaster = ensureDefaultMasterTradingLog(settings.outputDir, settings.masterTradingLogPath);
  if (seededMaster.copied) {
    debugLog('master-sync', 'seeded default master trading log', seededMaster);
  }
  if (settings.tradeSessionHotkey !== previousHotkey) registerTradeSessionHotkey();
  if (settings.outputDir !== previousOutputDir) lastCompletedSessionDir = findLastCompletedSessionDir(settings.outputDir);
  if (settings.autoCheckExtensionUpdates && !previousAutoCheckExtensionUpdates) void checkExtensionUpdates(true);
  broadcastStatus();
  return settings;
}

function sanitizeSettings(value: WilyTraderDesktopSettings): WilyTraderDesktopSettings {
  const defaults = defaultSettings();
  return {
    outputDir: strOrNull(value.outputDir) ?? getOutputRoot(),
    microphoneCaptureEnabled: Boolean(value.microphoneCaptureEnabled),
    saveBrowserScreenshots: Boolean(value.saveBrowserScreenshots),
    generateTradeLogOnStop: Boolean(value.generateTradeLogOnStop),
    masterTradingLogPath: strOrNull(value.masterTradingLogPath) ?? defaultMasterTradingLogPath(strOrNull(value.outputDir) ?? defaults.outputDir),
    autoCheckExtensionUpdates: Boolean(value.autoCheckExtensionUpdates),
    tradeSessionHotkey: isUsableHotkey(value.tradeSessionHotkey) ? value.tradeSessionHotkey.trim() : defaults.tradeSessionHotkey,
    llmMode: value.llmMode === 'api' ? 'api' : 'gemini-cli',
    geminiCliCommand: strOrNull(value.geminiCliCommand) ?? defaults.geminiCliCommand,
    geminiCliModel: strOrNull(value.geminiCliModel) ?? defaults.geminiCliModel,
    openRouterApiKey: typeof value.openRouterApiKey === 'string' ? value.openRouterApiKey.trim() : '',
    openRouterBaseUrl: strOrNull(value.openRouterBaseUrl) ?? defaults.openRouterBaseUrl,
    openRouterModel: strOrNull(value.openRouterModel) ?? defaults.openRouterModel,
    wilyTraderInstallPath: typeof value.wilyTraderInstallPath === 'string' ? value.wilyTraderInstallPath.trim() : '',
  };
}

function isUsableHotkey(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed || trimmed !== value) return false;
  const parts = trimmed.split('+').map((part) => part.trim());
  if (parts.length < 2 || parts.some((part) => !part)) return false;
  const main = parts[parts.length - 1];
  if (['Ctrl', 'Control', 'Shift', 'Alt', 'Meta', 'Command', 'Cmd'].includes(main)) return false;
  return parts.slice(0, -1).some((part) => ['Ctrl', 'Control', 'Shift', 'Alt', 'Meta', 'Command', 'Cmd'].includes(part));
}

function defaultCapturesRoot(): string {
  const appRoot = app.isReady() ? app.getAppPath() : process.cwd();
  const baseDir = path.basename(appRoot).toLowerCase() === 'desktop'
    ? path.resolve(appRoot, '..', '..')
    : path.resolve(appRoot, '..');
  return path.join(baseDir, 'WilyTrader Captures');
}

function defaultMasterTradingLogPath(outputDir: string): string {
  return path.join(outputDir, MASTER_TRADING_LOG_FILE_NAME);
}

function bundledMasterSyncScriptsDir(): string {
  return path.resolve(__dirname, '..', 'trade-sync');
}

function bundledMasterTradingLogTemplatePath(): string {
  return path.join(bundledMasterSyncScriptsDir(), MASTER_TRADING_LOG_TEMPLATE_FILE_NAME);
}

function sameResolvedPath(left: string, right: string): boolean {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}

function ensureDefaultMasterTradingLog(outputDir: string, masterPath: string): { copied: boolean; masterPath: string; templatePath: string | null } {
  const targetMasterPath = path.resolve(masterPath || defaultMasterTradingLogPath(outputDir));
  if (!sameResolvedPath(targetMasterPath, defaultMasterTradingLogPath(outputDir))) {
    return { copied: false, masterPath: targetMasterPath, templatePath: null };
  }
  if (fs.existsSync(targetMasterPath)) {
    return { copied: false, masterPath: targetMasterPath, templatePath: null };
  }

  const templatePath = bundledMasterTradingLogTemplatePath();
  if (!fs.existsSync(templatePath)) {
    throw new Error(`Bundled master trading log template was not found: ${templatePath}`);
  }

  fs.mkdirSync(path.dirname(targetMasterPath), { recursive: true });
  try {
    fs.copyFileSync(templatePath, targetMasterPath, fs.constants.COPYFILE_EXCL);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err;
    return { copied: false, masterPath: targetMasterPath, templatePath };
  }
  return { copied: true, masterPath: targetMasterPath, templatePath };
}

function isOldDefaultOutputDir(outputDir: string): boolean {
  const normalized = path.normalize(outputDir).toLowerCase();
  const oldSuffix = path.normalize(path.join('WilyTrader Desktop', 'Sessions')).toLowerCase();
  return normalized.endsWith(oldSuffix);
}

function defaultExtensionStatus(): WilyTraderExtensionStatus {
  return {
    runtimeInstalledVersion: null,
    runtimeExtensionId: null,
    runtimeLastSeenAt: null,
    runtimePageUrl: null,
    runtimeTokenName: null,
    runtimeTokenAddress: null,
    runtimeTokenChain: null,
    localManifestVersion: null,
    localExtensionPath: null,
    latestVersion: null,
    updateAvailable: false,
    updateMessage: 'No WilyTrader extension heartbeat received yet.',
    checkedAt: null,
  };
}

function defaultDesktopUpdateStatus(): WilyTraderDesktopUpdateStatus {
  const installedVersion = app.getVersion() || '0.0.0';
  return {
    installedVersion,
    latestVersion: null,
    updateAvailable: false,
    updateMessage: `WilyTrader Desktop ${installedVersion}; update status not checked yet.`,
    checkedAt: null,
  };
}

function detectLocalExtensionManifest(): Partial<WilyTraderExtensionStatus> {
  const candidates = [
    settings.wilyTraderInstallPath,
    settings.wilyTraderInstallPath ? path.join(settings.wilyTraderInstallPath, 'extension') : '',
    path.resolve(app.getAppPath(), '..', 'extension'),
    path.resolve(process.cwd(), '..', 'extension'),
    path.resolve(process.cwd(), 'extension'),
    'E:\\Apps\\wilytrader-desktop\\extension',
    'E:\\Apps\\wilytrader\\extension',
  ];
  for (const extensionPath of [...new Set(candidates.filter(Boolean))]) {
    const manifestPath = path.join(extensionPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as { name?: unknown; version?: unknown };
      if (manifest.name !== 'WilyTrader' || typeof manifest.version !== 'string') continue;
      return {
        localManifestVersion: manifest.version,
        localExtensionPath: extensionPath,
      };
    } catch {
      /* keep scanning */
    }
  }
  return {};
}

function scheduleUpdateChecks(): void {
  void refreshUpdateStatuses('startup', true);
  if (updateCheckTimer) clearInterval(updateCheckTimer);
  updateCheckTimer = setInterval(() => {
    void refreshUpdateStatuses('scheduled', true);
  }, UPDATE_CHECK_INTERVAL_MS);
}

async function refreshUpdateStatuses(reason: 'startup' | 'scheduled' | 'manual', force = false): Promise<void> {
  debugLog('updates', 'checking update status', { reason, force });
  const tasks: Array<Promise<void>> = [checkDesktopUpdates(force)];
  if (settings.autoCheckExtensionUpdates || reason === 'manual') {
    tasks.push(checkExtensionUpdates(force));
  }
  await Promise.all(tasks);
}

async function checkExtensionUpdates(force = false): Promise<void> {
  if (!force && extensionStatus.checkedAt) return;
  extensionStatus = {
    ...extensionStatus,
    ...detectLocalExtensionManifest(),
  };
  const installed = extensionStatus.runtimeInstalledVersion ?? extensionStatus.localManifestVersion;
  try {
    const latest = await fetchLatestExtensionVersion();
    const runtime = extensionStatus.runtimeInstalledVersion;
    const local = extensionStatus.localManifestVersion;
    const runtimeBehind = Boolean(runtime && isRemoteVersionNewer(runtime, latest));
    const localBehind = Boolean(local && isRemoteVersionNewer(local, latest));
    extensionStatus = {
      ...extensionStatus,
      latestVersion: latest,
      updateAvailable: installed ? isRemoteVersionNewer(installed, latest) : false,
      updateMessage: installed
        ? runtime && local && runtime !== local
          ? runtimeBehind
            ? `Extension ${latest} is available; running tab has ${runtime}, local files are ${local}.`
            : `Running extension is ${runtime}; local files are ${local}.`
          : isRemoteVersionNewer(installed, latest)
            ? `Extension ${latest} is available; installed ${installed}.`
            : localBehind
              ? `Extension ${latest} is available; local files are ${local}.`
              : `Extension is up to date (${installed}).`
        : `Latest extension version is ${latest}; no installed extension has checked in.`,
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    extensionStatus = {
      ...extensionStatus,
      updateMessage: `Extension update check failed: ${(err as Error).message}`,
      checkedAt: new Date().toISOString(),
    };
  }
  broadcastStatus();
}

async function fetchLatestExtensionVersion(): Promise<string> {
  return fetchLatestWilyTraderVersion();
}

async function checkDesktopUpdates(force = false): Promise<void> {
  if (!force && desktopUpdateStatus.checkedAt) return;
  const installed = app.getVersion() || desktopUpdateStatus.installedVersion || '0.0.0';
  try {
    const latest = await fetchLatestWilyTraderVersion();
    const updateAvailable = isRemoteVersionNewer(installed, latest);
    desktopUpdateStatus = {
      installedVersion: installed,
      latestVersion: latest,
      updateAvailable,
      updateMessage: updateAvailable
        ? `WilyTrader Desktop ${latest} is available; installed ${installed}.`
        : `WilyTrader Desktop is up to date (${installed}).`,
      checkedAt: new Date().toISOString(),
    };
  } catch (err) {
    desktopUpdateStatus = {
      ...desktopUpdateStatus,
      installedVersion: installed,
      updateMessage: `Desktop update check failed: ${(err as Error).message}`,
      checkedAt: new Date().toISOString(),
    };
  }
  broadcastStatus();
}

async function fetchLatestWilyTraderVersion(): Promise<string> {
  const res = await fetch(`${WILYTRADER_TAGS_API_URL}&t=${Date.now()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': `wilytrader-desktop/${app.getVersion() || '0.1.0'}`,
    },
  });
  if (!res.ok) throw new Error(`GitHub tag check failed (HTTP ${res.status}).`);
  const tags = await res.json() as Array<{ name?: string }>;
  const latest = tags
    .map((tag) => normalizeVersionTag(tag.name ?? ''))
    .filter((version) => /^\d+\.\d+\.\d+$/.test(version))
    .sort(compareVersions)
    .pop();
  if (!latest) throw new Error('No semantic WilyTrader tag found.');
  return latest;
}

async function fetchLatestWilyTraderRelease(): Promise<WilyTraderReleaseInfo> {
  const res = await fetch(`${WILYTRADER_LATEST_RELEASE_API_URL}?t=${Date.now()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': `wilytrader-desktop/${app.getVersion() || '0.1.0'}`,
    },
  });
  if (!res.ok) throw new Error(`GitHub release check failed (HTTP ${res.status}).`);
  const release = await res.json() as {
    tag_name?: string;
    name?: string;
    html_url?: string;
    assets?: Array<{ name?: string; browser_download_url?: string }>;
  };
  const tagName = (release.tag_name ?? release.name ?? '').trim();
  const version = normalizeVersionTag(tagName);
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Latest release did not include a semantic version tag.');
  const assets = (release.assets ?? [])
    .map((asset) => ({
      name: asset.name ?? '',
      url: asset.browser_download_url ?? '',
    }))
    .filter((asset) => asset.name && /^https?:\/\//i.test(asset.url));
  return {
    tagName,
    version,
    htmlUrl: release.html_url || `${WILYTRADER_RELEASE_BASE_URL}/tag/v${version}`,
    desktopInstaller: assets.find((asset) => /^wilytrader-\d+\.\d+\.\d+-desktop-setup\.exe$/i.test(asset.name)) ?? null,
    extensionZip: assets.find((asset) => /^wilytrader-\d+\.\d+\.\d+-extension\.zip$/i.test(asset.name)) ?? null,
  };
}

async function latestKnownExtensionVersion(): Promise<string> {
  if (extensionStatus.latestVersion) return extensionStatus.latestVersion;
  const latest = await fetchLatestExtensionVersion();
  extensionStatus = {
    ...extensionStatus,
    latestVersion: latest,
    checkedAt: new Date().toISOString(),
  };
  return latest;
}

async function latestKnownDesktopVersion(): Promise<string> {
  if (desktopUpdateStatus.latestVersion) return desktopUpdateStatus.latestVersion;
  const latest = await fetchLatestWilyTraderVersion();
  desktopUpdateStatus = {
    ...desktopUpdateStatus,
    latestVersion: latest,
    checkedAt: new Date().toISOString(),
  };
  return latest;
}

async function openLatestExtensionReleasePage(): Promise<{ ok: boolean; message: string; url?: string }> {
  const latest = await latestKnownExtensionVersion();
  const url = `${WILYTRADER_RELEASE_BASE_URL}/tag/v${latest}`;
  await shell.openExternal(url);
  return { ok: true, message: `Opened WilyTrader ${latest} release page.`, url };
}

async function openLatestExtensionDownload(): Promise<{ ok: boolean; message: string; url?: string }> {
  const latest = await latestKnownExtensionVersion();
  const url = `${WILYTRADER_RELEASE_BASE_URL}/download/v${latest}/wilytrader-${latest}-${WILYTRADER_EXTENSION_ASSET_SUFFIX}`;
  await shell.openExternal(url);
  return { ok: true, message: `Opened WilyTrader ${latest} extension zip download.`, url };
}

async function updateLatestExtensionFiles(): Promise<{
  ok: boolean;
  message: string;
  version: string | null;
  repoPath: string | null;
  extensionPath: string | null;
  releaseUrl?: string | null;
}> {
  const release = await fetchLatestWilyTraderRelease();
  const install = detectCurrentWilyTraderInstall();
  if (!install) {
    return {
      ok: false,
      message: 'No local WilyTrader extension folder was found. Use Move Location first, or install the extension zip manually once.',
      version: null,
      repoPath: null,
      extensionPath: null,
      releaseUrl: release.htmlUrl,
    };
  }

  try {
    if (fs.existsSync(path.join(install.repoPath, '.git'))) {
      const result = await runProcessProbe('git', ['-C', install.repoPath, 'pull', '--ff-only'], 120_000);
      if (!result.ok) {
        throw new Error(tail(result.stderr || result.stdout || result.error || 'git pull failed', 700));
      }
    } else {
      if (!release.extensionZip) throw new Error(`Release ${release.version} does not include a WilyTrader extension zip asset.`);
      const downloadDir = path.join(os.tmpdir(), 'wilytrader-extension-updates');
      const zipPath = path.join(downloadDir, safeUpdateFileName(release.extensionZip.name));
      const extractDir = path.join(downloadDir, `extract-${release.version}-${Date.now()}`);
      await downloadFile(release.extensionZip.url, zipPath);
      await extractZipFile(zipPath, extractDir);
      const extracted = readWilyTraderManifest(extractDir);
      if (!extracted) throw new Error('Downloaded extension zip did not contain a valid WilyTrader manifest.');
      replaceDirectoryContents(extracted.extensionPath, install.extensionPath);
    }

    const updated = readWilyTraderManifest(install.repoPath) ?? readWilyTraderManifest(install.extensionPath);
    if (!updated) throw new Error('Updated extension files, but the manifest could not be verified.');
    saveSettings({ wilyTraderInstallPath: updated.repoPath });
    extensionStatus = {
      ...extensionStatus,
      ...detectLocalExtensionManifest(),
      latestVersion: release.version,
      updateAvailable: extensionStatus.runtimeInstalledVersion
        ? isRemoteVersionNewer(extensionStatus.runtimeInstalledVersion, release.version)
        : false,
      updateMessage: extensionStatus.runtimeInstalledVersion && isRemoteVersionNewer(extensionStatus.runtimeInstalledVersion, release.version)
        ? `Local files are ${updated.version}; reload WilyTrader in Chrome to update the running tab.`
        : `Extension files are updated to ${updated.version}.`,
      checkedAt: new Date().toISOString(),
    };
    clipboard.writeText(updated.extensionPath);
    await revealExtensionFolder(updated.extensionPath);
    await openChromeExtensionsPage();
    broadcastStatus();
    return {
      ok: true,
      message: `Updated extension files to ${updated.version}. Chrome Extensions is open; press Reload on WilyTrader. The Load unpacked path is copied to the clipboard.`,
      version: updated.version,
      repoPath: updated.repoPath,
      extensionPath: updated.extensionPath,
      releaseUrl: release.htmlUrl,
    };
  } catch (err) {
    return {
      ok: false,
      message: `Extension update failed: ${(err as Error).message}`,
      version: install.version,
      repoPath: install.repoPath,
      extensionPath: install.extensionPath,
      releaseUrl: release.htmlUrl,
    };
  }
}

async function openLatestDesktopReleasePage(): Promise<{ ok: boolean; message: string; url?: string }> {
  const latest = await latestKnownDesktopVersion();
  const url = `${WILYTRADER_RELEASE_BASE_URL}/tag/v${latest}`;
  await shell.openExternal(url);
  return { ok: true, message: `Opened WilyTrader Desktop ${latest} release page.`, url };
}

async function openLatestDesktopDownload(): Promise<{ ok: boolean; message: string; url?: string }> {
  const latest = await latestKnownDesktopVersion();
  const url = `${WILYTRADER_RELEASE_BASE_URL}/download/v${latest}/wilytrader-${latest}-${WILYTRADER_DESKTOP_ASSET_SUFFIX}`;
  await shell.openExternal(url);
  return { ok: true, message: `Opened WilyTrader Desktop ${latest} installer download.`, url };
}

async function installLatestDesktopRelease(): Promise<{ ok: boolean; message: string; installerPath?: string; releaseUrl?: string | null }> {
  const release = await fetchLatestWilyTraderRelease();
  const currentVersion = app.getVersion() || '0.0.0';
  if (!isRemoteVersionNewer(currentVersion, release.version)) {
    return { ok: false, message: `WilyTrader Desktop is already up to date (${currentVersion}).`, releaseUrl: release.htmlUrl };
  }
  if (!release.desktopInstaller) {
    return { ok: false, message: `Desktop ${release.version} is available, but no installer asset was found.`, releaseUrl: release.htmlUrl };
  }

  const updateDir = path.join(os.tmpdir(), 'wilytrader-desktop-updates');
  const installerPath = path.join(updateDir, safeUpdateFileName(release.desktopInstaller.name));
  try {
    await downloadFile(release.desktopInstaller.url, installerPath);
    await launchUpdateInstaller(installerPath);
    setTimeout(() => app.quit(), 750);
    return {
      ok: true,
      message: `Downloaded WilyTrader Desktop ${release.version}. WilyTrader will close and launch the installer.`,
      installerPath,
      releaseUrl: release.htmlUrl,
    };
  } catch (err) {
    if (fs.existsSync(installerPath)) {
      shell.showItemInFolder(installerPath);
      return {
        ok: false,
        message: `Installer downloaded, but Windows did not launch it automatically: ${(err as Error).message}. The installer is shown in File Explorer.`,
        installerPath,
        releaseUrl: release.htmlUrl,
      };
    }
    return {
      ok: false,
      message: `Desktop install failed: ${(err as Error).message}`,
      releaseUrl: release.htmlUrl,
    };
  }
}

interface DependencyProbeResult {
  ok: boolean;
  code: number | null;
  stdout: string;
  stderr: string;
  error?: string;
  timedOut: boolean;
}

interface OpenRouterModelSummary {
  id: string;
  createdAtMs: number;
  inputCostPer1M: number;
}

interface GeminiCliModelSummary {
  id: string;
  createdAtMs: number;
}

interface WilyTraderReleaseAsset {
  name: string;
  url: string;
}

interface WilyTraderReleaseInfo {
  tagName: string;
  version: string;
  htmlUrl: string;
  desktopInstaller: WilyTraderReleaseAsset | null;
  extensionZip: WilyTraderReleaseAsset | null;
}

interface SettingsTestLlmGuidance {
  kind: 'gemini-cli-missing';
  title: string;
  explanation: string;
  installCommand: string;
  docsUrl: string;
}

const GEMINI_CLI_FALLBACK_MODELS: GeminiCliModelSummary[] = [
  { id: 'gemini-3.1-pro-preview', createdAtMs: Date.parse('2026-02-19') || 0 },
  { id: 'gemini-3.1-flash-lite-preview', createdAtMs: Date.parse('2026-03-03') || 0 },
  { id: 'gemini-3.1-flash-image-preview', createdAtMs: Date.parse('2026-03-03') || 0 },
  { id: 'gemini-3-flash-preview', createdAtMs: Date.parse('2025-12-01') || 0 },
  { id: 'gemini-3-pro-preview', createdAtMs: Date.parse('2025-11-01') || 0 },
  { id: 'gemini-3-pro-image-preview', createdAtMs: Date.parse('2025-11-01') || 0 },
  { id: 'gemini-2.5-pro', createdAtMs: Date.parse('2025-03-01') || 0 },
  { id: 'gemini-2.5-flash', createdAtMs: Date.parse('2025-03-01') || 0 },
  { id: 'gemini-2.0-flash', createdAtMs: Date.parse('2024-12-01') || 0 },
  { id: 'gemini-2.0-flash-lite', createdAtMs: Date.parse('2024-12-01') || 0 },
  { id: 'gemini-1.5-pro', createdAtMs: Date.parse('2024-02-01') || 0 },
  { id: 'gemini-1.5-flash', createdAtMs: Date.parse('2024-02-01') || 0 },
];

const WHISPER_RELEASE_TAG = 'v1.8.4';
const WHISPER_ZIP_NAME = 'whisper-blas-bin-x64.zip';
const WHISPER_ZIP_URL = `https://github.com/ggerganov/whisper.cpp/releases/download/${WHISPER_RELEASE_TAG}/${WHISPER_ZIP_NAME}`;
const WHISPER_MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin';
const OAUTH_CREDS_PATH = path.join(os.homedir(), '.gemini', 'oauth_creds.json');

async function checkDependencies(payload?: { geminiCliCommand?: string }): Promise<{
  whisper: { ok: boolean; message: string; exePath?: string; modelPath?: string };
  node: { ok: boolean; message: string; version?: string; optional?: boolean };
  geminiCli: { ok: boolean; message: string; version?: string; command?: string };
}> {
  debugLog('dependencies', 'check started', {
    payload: sanitizeForLog(payload),
    whisperSearchRoots: whisperSearchRoots().map((root) => ({ root, exists: fs.existsSync(root) })),
  });
  const foundWhisper = findWhisperBinary();
  debugLog('dependencies', 'whisper probe completed', foundWhisper ?? { found: false });
  const whisper = foundWhisper
    ? {
        ok: true,
        message: 'Local Whisper transcription engine is installed.',
        exePath: foundWhisper.exe,
        modelPath: foundWhisper.model,
      }
    : {
        ok: false,
        message: 'Whisper files were not found. Use Install Whisper in this setup checklist.',
      };
  const npmProbe = await runNpmDependencyProbe(['--version'], 10_000);
  debugLog('dependencies', 'npm probe completed', dependencyProbeSummary(npmProbe));
  const cliCommand = (payload?.geminiCliCommand || settings.geminiCliCommand || 'gemini').trim() || 'gemini';
  const resolvedCli = resolveGeminiCliExecutable(cliCommand);
  debugLog('dependencies', 'gemini cli resolved', {
    requestedCommand: cliCommand,
    command: resolvedCli.command,
    prefixArgs: resolvedCli.prefixArgs,
  });
  const geminiProbe = await runDependencyProbe(
    resolvedCli.command,
    [...resolvedCli.prefixArgs, '--version'],
    10_000,
    geminiCliEnv()
  );
  debugLog('dependencies', 'gemini cli probe completed', dependencyProbeSummary(geminiProbe));
  const geminiCli = geminiProbe.ok
    ? {
        ok: true,
        message: `${geminiProbe.stdout.trim() || 'Gemini CLI'} is installed.`,
        version: geminiProbe.stdout.trim(),
        command: resolvedCli.command,
      }
    : {
        ok: false,
        message: geminiProbe.error
          ? `Gemini CLI was not found (${geminiProbe.error}).`
          : `Gemini CLI check failed${geminiProbe.timedOut ? ' (timed out)' : ''}.`,
        command: resolvedCli.command,
      };
  const node = npmProbe.ok
    ? {
        ok: true,
        message: `npm ${npmProbe.stdout.trim()} is available.`,
        version: npmProbe.stdout.trim(),
      }
    : geminiCli.ok
      ? {
          ok: true,
          optional: true,
          message: 'Gemini CLI is already installed and working. Node/npm is only needed if WilyTrader Desktop needs to install or update Gemini CLI for you.',
        }
      : {
          ok: false,
          message: npmProbe.error
            ? `npm was not found (${npmProbe.error}). Install Node.js LTS first.`
            : `npm check failed${npmProbe.timedOut ? ' (timed out)' : ''}. Install Node.js LTS first.`,
        };
  debugLog('dependencies', 'check finished', summarizeDependencyResult({ whisper, node, geminiCli }));
  return { whisper, node, geminiCli };
}

async function installWhisperDependency(): Promise<{ ok: boolean; message: string; exePath?: string; modelPath?: string }> {
  const existing = findWhisperBinary();
  if (existing) {
    return {
      ok: true,
      message: 'Local Whisper transcription engine is installed.',
      exePath: existing.exe,
      modelPath: existing.model,
    };
  }
  const root = path.join(app.getPath('userData'), 'resources');
  const binDir = path.join(root, 'bin', 'whisper');
  const modelPath = path.join(root, 'models', 'ggml-base.en.bin');
  const zipPath = path.join(binDir, WHISPER_ZIP_NAME);
  try {
    if (!fs.existsSync(modelPath) || fs.statSync(modelPath).size < 100_000_000) {
      await downloadFile(WHISPER_MODEL_URL, modelPath);
    }
    const exeExists = [
      path.join(binDir, 'whisper-cli.exe'),
      path.join(binDir, 'main.exe'),
      path.join(binDir, 'Release', 'whisper-cli.exe'),
      path.join(binDir, 'Release', 'main.exe'),
    ].some((candidate) => fs.existsSync(candidate));
    if (!exeExists) {
      await downloadFile(WHISPER_ZIP_URL, zipPath);
      await extractZipFile(zipPath, binDir);
    }
    const installed = findWhisperBinary();
    if (!installed) return { ok: false, message: 'Whisper downloaded, but WilyTrader Desktop could not verify the executable and model.' };
    return {
      ok: true,
      message: `Whisper installed under ${root}.`,
      exePath: installed.exe,
      modelPath: installed.model,
    };
  } catch (err) {
    return { ok: false, message: `Whisper install failed: ${(err as Error).message}` };
  }
}

async function downloadFile(url: string, dest: string): Promise<number> {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${url}`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buffer);
  return buffer.length;
}

async function extractZipFile(zipPath: string, destination: string): Promise<number> {
  const zip = await JSZip.loadAsync(fs.readFileSync(zipPath));
  let fileCount = 0;
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of Object.values(zip.files)) {
    if (entry.dir) continue;
    const normalized = path.normalize(entry.name);
    if (!normalized || normalized.startsWith('..') || path.isAbsolute(normalized)) continue;
    const target = path.resolve(destination, normalized);
    const root = path.resolve(destination);
    if (!target.startsWith(root + path.sep)) continue;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, await entry.async('nodebuffer'));
    fileCount += 1;
  }
  return fileCount;
}

async function installGeminiCli(): Promise<{ ok: boolean; message: string; stdoutTail?: string; stderrTail?: string }> {
  const result = await runNpmDependencyProbe(['install', '-g', '@google/gemini-cli'], 5 * 60 * 1000);
  const stdoutTail = result.stdout.slice(-1000);
  const stderrTail = result.stderr.slice(-1000);
  if (!result.ok) {
    return {
      ok: false,
      message: result.error
        ? `Could not start npm: ${result.error}. Install Node.js LTS, then try again.`
        : `Gemini CLI install failed${result.timedOut ? ' (timed out)' : ''}.`,
      stdoutTail,
      stderrTail,
    };
  }
  return {
    ok: true,
    message: 'Gemini CLI installed. Next, click Sign in with Google.',
    stdoutTail,
    stderrTail,
  };
}

async function installNodeLts(): Promise<{ ok: boolean; message: string; stdoutTail?: string; stderrTail?: string }> {
  if (process.platform !== 'win32') {
    return { ok: false, message: 'Automatic Node.js install is only supported on Windows. Open nodejs.org/download to install Node.js LTS.' };
  }
  const result = await runDependencyProbe(
    wingetCommand(),
    [
      'install',
      '--id',
      'OpenJS.NodeJS.LTS',
      '-e',
      '--source',
      'winget',
      '--accept-package-agreements',
      '--accept-source-agreements',
    ],
    10 * 60 * 1000
  );
  const stdoutTail = result.stdout.slice(-1000);
  const stderrTail = result.stderr.slice(-1000);
  if (!result.ok) {
    return {
      ok: false,
      message: result.error
        ? `Could not start winget: ${result.error}. Open nodejs.org/download to install Node.js LTS.`
        : `Node.js install failed${result.timedOut ? ' (timed out)' : ''}. Open nodejs.org/download if needed.`,
      stdoutTail,
      stderrTail,
    };
  }
  return {
    ok: true,
    message: 'Node.js LTS install completed. If npm is still missing, restart WilyTrader Desktop so Windows refreshes PATH.',
    stdoutTail,
    stderrTail,
  };
}

async function testLlmConnection(payload?: {
  llmMode?: 'gemini-cli' | 'api';
  geminiCliCommand?: string;
  geminiCliModel?: string;
  openRouterApiKey?: string;
  openRouterBaseUrl?: string;
  openRouterModel?: string;
}): Promise<{ ok: boolean; mode: 'gemini-cli' | 'api'; message: string; guidance?: SettingsTestLlmGuidance }> {
  const mode = payload?.llmMode === 'api' ? 'api' : 'gemini-cli';
  if (mode === 'gemini-cli') {
    const result = await testGeminiCliConnection(
      payload?.geminiCliCommand ?? settings.geminiCliCommand,
      payload?.geminiCliModel ?? settings.geminiCliModel
    );
    return { ok: result.ok, mode, message: result.message, guidance: result.guidance };
  }
  const apiKey = (payload?.openRouterApiKey ?? settings.openRouterApiKey).trim();
  if (!apiKey) return { ok: false, mode, message: 'API mode: OpenRouter/OpenAI API key is required.' };
  const baseUrl = payload?.openRouterBaseUrl ?? settings.openRouterBaseUrl;
  const model = payload?.openRouterModel ?? settings.openRouterModel;
  const result = await testOpenRouterApi(apiKey, baseUrl, model);
  return {
    ok: result.ok,
    mode,
    message: result.ok
      ? `API connection OK (${baseUrl.toLowerCase().includes('openrouter') ? 'OpenRouter' : 'OpenAI-compatible'}).`
      : result.message,
  };
}

async function testOpenRouterApi(apiKey: string, baseUrl: string, model: string): Promise<{ ok: boolean; message: string }> {
  const normalizedBase = (baseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const url = `${normalizedBase}/chat/completions`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: 'Reply with OK only.' }],
        max_tokens: 6,
        temperature: 0,
      }),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, message: `OpenAI-compatible auth/test failed (HTTP ${res.status}).` };
    return { ok: true, message: 'OpenAI-compatible API key is valid.' };
  } catch (err) {
    return { ok: false, message: `OpenAI-compatible test request failed: ${(err as Error).message}` };
  } finally {
    clearTimeout(timeout);
  }
}

async function runTradeLlmPrompt(
  prompt: string,
  session: ActiveTradeSession,
  label: string
): Promise<{ ok: boolean; rawText: string; message: string; provider: string }> {
  if (settings.llmMode === 'gemini-cli') {
    const gemini = await runGeminiCliPrompt(prompt, label);
    if (gemini.ok) {
      appendSessionLogForSession(session, 'trade-enrichment', `${label} completed with Gemini CLI`, {
        model: settings.geminiCliModel,
      }, 'success');
      return { ...gemini, provider: 'gemini-cli' };
    }
    appendSessionLogForSession(session, 'trade-enrichment', `${label} Gemini CLI failed`, {
      message: gemini.message,
      stderrTail: tail(gemini.rawText, 500),
    }, 'warning');
    if (settings.openRouterApiKey) {
      const fallback = await runOpenRouterPrompt(prompt, label);
      return { ...fallback, provider: 'api' };
    }
    return { ...gemini, provider: 'gemini-cli' };
  }
  const api = await runOpenRouterPrompt(prompt, label);
  return { ...api, provider: 'api' };
}

async function runGeminiCliPrompt(
  prompt: string,
  label: string
): Promise<{ ok: boolean; rawText: string; message: string }> {
  const resolvedCli = resolveGeminiCliExecutable(settings.geminiCliCommand || 'gemini');
  const model = settings.geminiCliModel || 'gemini-3.1-pro-preview';
  const baseArgs = [...resolvedCli.prefixArgs, '--model', model, '--output-format', 'json'];
  const env = geminiCliEnv();
  const timeoutMs = 10 * 60 * 1000;

  if (prompt.length < 18_000) {
    const promptFlag = await runDependencyProbe(
      resolvedCli.command,
      [...baseArgs, '--prompt', prompt],
      timeoutMs,
      env
    );
    if (promptFlag.ok && promptFlag.stdout.trim()) {
      return { ok: true, rawText: promptFlag.stdout, message: `${label} completed with Gemini CLI.` };
    }
    const positionalConflict = /Cannot use both a positional prompt and the --prompt flag together/i.test(promptFlag.stderr);
    if (!positionalConflict) {
      const stderr = cleanCliStderr(promptFlag.stderr || promptFlag.error || '', 1000);
      if (!promptFlag.timedOut && !/unknown option|unrecognized/i.test(stderr)) {
        return {
          ok: false,
          rawText: `${promptFlag.stdout}\n${promptFlag.stderr}`,
          message: `${label} Gemini CLI failed${promptFlag.timedOut ? ' (timed out)' : ''}: ${stderr || promptFlag.error || `exit ${promptFlag.code}`}`,
        };
      }
    }
  }

  const stdinResult = await runProcessWithInput(resolvedCli.command, baseArgs, prompt, timeoutMs, env);
  if (stdinResult.ok && stdinResult.stdout.trim()) {
    return { ok: true, rawText: stdinResult.stdout, message: `${label} completed with Gemini CLI.` };
  }
  return {
    ok: false,
    rawText: `${stdinResult.stdout}\n${stdinResult.stderr}`,
    message: `${label} Gemini CLI failed${stdinResult.timedOut ? ' (timed out)' : ''}: ${cleanCliStderr(stdinResult.stderr || stdinResult.error || '', 1000) || `exit ${stdinResult.code}`}`,
  };
}

async function runOpenRouterPrompt(
  prompt: string,
  label: string
): Promise<{ ok: boolean; rawText: string; message: string }> {
  const apiKey = settings.openRouterApiKey.trim();
  if (!apiKey) {
    return { ok: false, rawText: '', message: `${label} API mode requires an OpenRouter/OpenAI API key.` };
  }
  const normalizedBase = (settings.openRouterBaseUrl || 'https://openrouter.ai/api/v1').replace(/\/$/, '');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10 * 60 * 1000);
  try {
    const res = await fetch(`${normalizedBase}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: settings.openRouterModel || 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
      }),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, rawText: text, message: `${label} API request failed (HTTP ${res.status}).` };
    }
    const parsed = JSON.parse(text) as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = parsed.choices?.map((choice) => choice.message?.content).find((value): value is string => typeof value === 'string' && Boolean(value.trim()));
    return content
      ? { ok: true, rawText: content, message: `${label} completed with API.` }
      : { ok: false, rawText: text, message: `${label} API response did not contain message content.` };
  } catch (err) {
    return { ok: false, rawText: '', message: `${label} API request failed: ${(err as Error).message}` };
  } finally {
    clearTimeout(timeout);
  }
}

function runProcessWithInput(
  command: string,
  args: string[],
  input: string,
  timeoutMs: number,
  env?: NodeJS.ProcessEnv
): Promise<DependencyProbeResult> {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    let child: ReturnType<typeof spawn>;
    const finish = (result: DependencyProbeResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    try {
      child = spawn(command, args, {
        windowsHide: true,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
        env,
      });
    } catch (err) {
      finish({ ok: false, code: -1, stdout, stderr, error: (err as Error).message, timedOut });
      return;
    }
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill();
      } catch {
        // ignore
      }
    }, timeoutMs);
    child.stdout?.on('data', (data) => { stdout += String(data); });
    child.stderr?.on('data', (data) => { stderr += String(data); });
    child.on('error', (err) => {
      clearTimeout(timer);
      finish({ ok: false, code: -1, stdout, stderr, error: err.message, timedOut });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      finish({ ok: code === 0 && !timedOut, code, stdout, stderr, timedOut });
    });
    child.stdin?.end(input);
  });
}

async function testGeminiCliConnection(
  command: string,
  model: string
): Promise<{ ok: boolean; message: string; guidance?: SettingsTestLlmGuidance }> {
  const installCommand = 'npm install -g @google/gemini-cli';
  const guidance = (reason: string): SettingsTestLlmGuidance => ({
    kind: 'gemini-cli-missing',
    title: 'Gemini CLI is not installed yet',
    explanation: reason,
    installCommand,
    docsUrl: 'https://github.com/google-gemini/gemini-cli#installation',
  });
  const missingPattern = /(enoent|not found|is not recognized|cannot find|no such file)/i;
  const resolvedCli = resolveGeminiCliExecutable(command || 'gemini');
  const cliModel = (model || 'gemini-3.1-pro-preview').trim();
  const runGemini = (args: string[], timeoutMs: number) =>
    runDependencyProbe(resolvedCli.command, [...resolvedCli.prefixArgs, ...args], timeoutMs, geminiCliEnv());

  const versionProbe = await runGemini(['--version'], 10_000);
  if (versionProbe.error && missingPattern.test(versionProbe.error)) {
    return {
      ok: false,
      message: 'Gemini CLI was not found on this machine. Install it, then run this test again.',
      guidance: guidance('WilyTrader Desktop could not find the configured Gemini CLI command.'),
    };
  }
  if (!versionProbe.ok) {
    const stderr = cleanCliStderr(versionProbe.stderr || versionProbe.error || '');
    if (missingPattern.test(stderr)) {
      return {
        ok: false,
        message: 'Gemini CLI was not found on this machine. Install it, then run this test again.',
        guidance: guidance('The configured Gemini CLI command is unavailable in your PATH.'),
      };
    }
    return { ok: false, message: `Gemini CLI --version failed (code ${versionProbe.code}). ${stderr}` };
  }

  const promptProbe = await runGemini(
    ['--model', cliModel, '--output-format', 'json', '--prompt', 'Reply with exactly: ok'],
    30_000
  );
  if (promptProbe.timedOut) return { ok: false, message: 'Gemini CLI prompt test timed out after 30s.' };
  if (!promptProbe.ok) {
    const promptErr = cleanCliStderr(promptProbe.stderr);
    const positionalConflict = /Cannot use both a positional prompt and the --prompt flag together/i.test(promptProbe.stderr);
    if (positionalConflict) {
      const positionalProbe = await runGemini(
        ['--model', cliModel, '--output-format', 'json', 'Reply with exactly: ok'],
        30_000
      );
      if (positionalProbe.ok && positionalProbe.stdout.trim()) {
        return { ok: true, message: `Gemini CLI connection OK (command: ${resolvedCli.command}, model: ${cliModel}).` };
      }
      return { ok: false, message: `Gemini CLI prompt test failed (code ${positionalProbe.code}). ${cleanCliStderr(positionalProbe.stderr)}` };
    }
    return { ok: false, message: `Gemini CLI prompt test failed (code ${promptProbe.code}). ${promptErr}` };
  }
  if (!promptProbe.stdout.trim()) return { ok: false, message: 'Gemini CLI prompt test returned empty output.' };
  return { ok: true, message: `Gemini CLI connection OK (command: ${resolvedCli.command}, model: ${cliModel}).` };
}

function cleanCliStderr(stderr: string, max = 500): string {
  return stderr
    .split('\n')
    .filter((line) => !/crashpad/i.test(line))
    .join('\n')
    .trim()
    .slice(0, max);
}

function geminiCliEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...dependencyProbeEnv(),
    GEMINI_CLI_TRUST_WORKSPACE: process.env.GEMINI_CLI_TRUST_WORKSPACE ?? 'true',
    ELECTRON_RUN_AS_NODE: '1',
    GEMINI_CLI_NO_RELAUNCH: 'true',
  };
  delete env.GEMINI_API_KEY;
  return env;
}

async function listOpenRouterModelsWithCache(): Promise<OpenRouterModelSummary[]> {
  const cachePath = path.join(app.getPath('userData'), 'openrouter-models-cache.json');
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.json() as {
      data?: Array<{
        id?: string;
        created_at?: number | string | null;
        createdAt?: number | string | null;
        pricing?: { prompt?: string | number | null; input?: string | number | null } | null;
      }>;
    };
    const models = (raw.data ?? [])
      .filter((item) => typeof item.id === 'string' && item.id.length > 0)
      .map((item) => {
        const createdRaw = item.created_at ?? item.createdAt ?? 0;
        const createdAtMs = typeof createdRaw === 'number'
          ? (createdRaw > 1_000_000_000_000 ? createdRaw : createdRaw * 1000)
          : Date.parse(String(createdRaw)) || 0;
        const inputCostPerToken = Number(item.pricing?.prompt ?? item.pricing?.input ?? 0) || 0;
        return { id: String(item.id), createdAtMs, inputCostPer1M: inputCostPerToken * 1_000_000 };
      })
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
    fs.writeFileSync(cachePath, JSON.stringify({ updatedAtMs: Date.now(), models }, null, 2), 'utf-8');
    return models;
  } catch (err) {
    try {
      const cached = JSON.parse(fs.readFileSync(cachePath, 'utf-8')) as { models?: OpenRouterModelSummary[] };
      if (Array.isArray(cached.models) && cached.models.length > 0) return cached.models;
    } catch {
      // no cache
    }
    throw err;
  }
}

function listGeminiCliModels(): GeminiCliModelSummary[] {
  return [...GEMINI_CLI_FALLBACK_MODELS].sort((a, b) => b.createdAtMs - a.createdAtMs || a.id.localeCompare(b.id));
}

function readOauthCredsSubject(): string | null {
  try {
    if (!fs.existsSync(OAUTH_CREDS_PATH)) return null;
    const parsed = JSON.parse(fs.readFileSync(OAUTH_CREDS_PATH, 'utf-8')) as { id_token?: string; subject?: string };
    if (typeof parsed.subject === 'string' && parsed.subject) return parsed.subject;
    if (typeof parsed.id_token === 'string') {
      const parts = parsed.id_token.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8')) as { email?: string };
        if (payload.email) return payload.email;
      }
    }
    return 'signed-in';
  } catch {
    return null;
  }
}

function geminiCliSigninStatus(): { signedIn: boolean; subject?: string | null } {
  const subject = readOauthCredsSubject();
  debugLog('gemini-signin', 'status checked', {
    oauthCredsPath: OAUTH_CREDS_PATH,
    oauthCredsExists: fs.existsSync(OAUTH_CREDS_PATH),
    signedIn: Boolean(subject),
    subject,
  });
  return { signedIn: Boolean(subject), subject };
}

function geminiCliSignout(): { ok: boolean; message?: string } {
  try {
    if (fs.existsSync(OAUTH_CREDS_PATH)) fs.unlinkSync(OAUTH_CREDS_PATH);
    return { ok: true };
  } catch (err) {
    return { ok: false, message: (err as Error).message };
  }
}

function geminiCliSigninCancel(): { ok: boolean; message?: string } {
  if (!activeGeminiSigninChild) return { ok: false, message: 'No active sign-in to cancel.' };
  try {
    activeGeminiSigninChild.kill();
  } catch {
    // ignore
  }
  activeGeminiSigninChild = null;
  return { ok: true };
}

function geminiCliSignin(payload?: { command?: string }): Promise<{ ok: boolean; message: string; subject?: string }> {
  debugLog('gemini-signin', 'signin requested', {
    payload: sanitizeForLog(payload),
    active: Boolean(activeGeminiSigninChild),
    oauthCredsPath: OAUTH_CREDS_PATH,
    oauthCredsExists: fs.existsSync(OAUTH_CREDS_PATH),
  });
  if (activeGeminiSigninChild) {
    debugLog('gemini-signin', 'signin rejected; already active');
    return Promise.resolve({ ok: false, message: 'Sign-in already in progress. Wait for it to finish or cancel it.' });
  }
  const existingSubject = readOauthCredsSubject();
  if (existingSubject) {
    debugLog('gemini-signin', 'signin skipped; already signed in', { subject: existingSubject });
    return Promise.resolve({
      ok: true,
      message: `Gemini CLI is already signed in as ${existingSubject}.`,
      subject: existingSubject,
    });
  }
  const resolvedCli = resolveGeminiCliExecutable(payload?.command ?? settings.geminiCliCommand ?? 'gemini');
  debugLog('gemini-signin', 'launching gemini cli', {
    command: resolvedCli.command,
    prefixArgs: resolvedCli.prefixArgs,
  });
  const startedAtMs = Date.now();
  return new Promise((resolve) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(resolvedCli.command, [...resolvedCli.prefixArgs], {
        windowsHide: true,
        shell: false,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: geminiCliEnv(),
      });
    } catch (err) {
      debugLog('gemini-signin', 'spawn threw', errorDetails(err));
      resolve({ ok: false, message: `Failed to launch Gemini CLI: ${(err as Error).message}` });
      return;
    }
    activeGeminiSigninChild = child;
    let stdout = '';
    let stderr = '';
    let answered = false;
    let settled = false;
    const finish = (result: { ok: boolean; message: string; subject?: string }) => {
      if (settled) return;
      settled = true;
      clearInterval(pollTimer);
      clearTimeout(timeoutTimer);
      try {
        child.kill();
      } catch {
        // ignore
      }
      if (activeGeminiSigninChild === child) activeGeminiSigninChild = null;
      debugLog('gemini-signin', 'signin finished', {
        result,
        stdoutTail: tail(stdout.trim(), 500),
        stderrTail: tail(cleanCliStderr(stderr), 500),
        durationMs: Date.now() - startedAtMs,
      });
      resolve(result);
    };
    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
      debugLog('gemini-signin', 'stdout chunk', { stdoutTail: tail(stdout.trim(), 300) });
      if (!answered && /continue\?\s*\[Y\/n\]/i.test(stdout)) {
        answered = true;
        try {
          child.stdin?.write('y\n');
          debugLog('gemini-signin', 'answered workspace trust prompt');
        } catch {
          // ignore
        }
      }
    });
    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
      debugLog('gemini-signin', 'stderr chunk', { stderrTail: tail(cleanCliStderr(stderr), 300) });
    });
    child.on('error', (err) => {
      debugLog('gemini-signin', 'process error', errorDetails(err));
      finish({ ok: false, message: `Gemini CLI process error: ${err.message}` });
    });
    child.on('close', (code) => {
      if (settled) return;
      debugLog('gemini-signin', 'process closed', { code });
      setTimeout(() => {
        const subject = readOauthCredsSubject();
        const fresh = Boolean(subject && fs.existsSync(OAUTH_CREDS_PATH) && fs.statSync(OAUTH_CREDS_PATH).mtimeMs >= startedAtMs);
        finish(fresh
          ? { ok: true, message: `Signed in as ${subject}.`, subject: subject ?? undefined }
          : { ok: false, message: `Sign-in did not complete (exit ${code}). Try again or cancel.` });
      }, 500);
    });
    const pollTimer = setInterval(() => {
      if (!fs.existsSync(OAUTH_CREDS_PATH)) return;
      const stat = fs.statSync(OAUTH_CREDS_PATH);
      if (stat.mtimeMs < startedAtMs) return;
      const subject = readOauthCredsSubject();
      debugLog('gemini-signin', 'oauth creds detected', { subject, mtimeMs: stat.mtimeMs, startedAtMs });
      finish({ ok: true, message: subject ? `Signed in as ${subject}.` : 'Signed in successfully.', subject: subject ?? undefined });
    }, 1000);
    const timeoutTimer = setTimeout(() => {
      debugLog('gemini-signin', 'signin timed out');
      finish({ ok: false, message: 'Sign-in timed out after 5 minutes. Try again.' });
    }, 5 * 60 * 1000);
  });
}

function runDependencyProbe(
  command: string,
  args: string[],
  timeoutMs = 15_000,
  env?: NodeJS.ProcessEnv
): Promise<DependencyProbeResult> {
  return new Promise((resolve) => {
    debugLog('dependency-probe', 'starting process', { command, args, timeoutMs });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    let child: ReturnType<typeof spawn>;
    const finish = (result: DependencyProbeResult) => {
      if (settled) return;
      settled = true;
      debugLog('dependency-probe', 'process finished', {
        command,
        args,
        ...dependencyProbeSummary(result),
      });
      resolve(result);
    };
    try {
      child = spawn(command, args, {
        windowsHide: true,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe'],
        env,
      });
    } catch (err) {
      finish({ ok: false, code: -1, stdout, stderr, error: (err as Error).message, timedOut });
      return;
    }
    const timer = setTimeout(() => {
      timedOut = true;
      debugLog('dependency-probe', 'process timed out; killing', { command, args, timeoutMs });
      try {
        child.kill();
      } catch {
        // ignore
      }
    }, timeoutMs);
    child.stdout?.on('data', (data) => { stdout += String(data); });
    child.stderr?.on('data', (data) => { stderr += String(data); });
    child.on('error', (err) => {
      clearTimeout(timer);
      finish({ ok: false, code: -1, stdout, stderr, error: err.message, timedOut });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      finish({ ok: code === 0 && !timedOut, code, stdout, stderr, timedOut });
    });
  });
}

function dependencyPathEntries(): string[] {
  if (process.platform !== 'win32') return [];
  return [
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'nodejs') : '',
    process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)'], 'nodejs') : '',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs', 'nodejs') : '',
    process.env.APPDATA ? path.join(process.env.APPDATA, 'npm') : '',
  ].filter((entry) => Boolean(entry && fs.existsSync(entry)));
}

function dependencyProbeEnv(): NodeJS.ProcessEnv {
  if (process.platform !== 'win32') return { ...process.env };
  const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === 'path') ?? 'Path';
  const existingPath = process.env[pathKey] ?? '';
  const extra = dependencyPathEntries();
  return {
    ...process.env,
    [pathKey]: [...extra, existingPath].filter(Boolean).join(path.delimiter),
  };
}

function resolveNpmExecutable(env: NodeJS.ProcessEnv): string {
  if (process.platform !== 'win32') return 'npm';
  const candidates = [
    process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'nodejs', 'npm.cmd') : '',
    process.env['ProgramFiles(x86)'] ? path.join(process.env['ProgramFiles(x86)'], 'nodejs', 'npm.cmd') : '',
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs', 'nodejs', 'npm.cmd') : '',
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  try {
    const found = execSync('where.exe npm.cmd', {
      env,
      encoding: 'utf-8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => Boolean(line && fs.existsSync(line)));
    if (found) return found;
  } catch {
    // fall through
  }
  return 'npm.cmd';
}

function quoteCmdArg(arg: string): string {
  if (!/[\s&()^|<>"]/g.test(arg)) return arg;
  return `"${arg.replace(/"/g, '""')}"`;
}

function runNpmDependencyProbe(args: string[], timeoutMs = 15_000): Promise<DependencyProbeResult> {
  const env = dependencyProbeEnv();
  if (process.platform !== 'win32') return runDependencyProbe('npm', args, timeoutMs, env);
  const npm = resolveNpmExecutable(env);
  const comspec = process.env.ComSpec || 'cmd.exe';
  const npmCommand = ['call', quoteCmdArg(npm), ...args.map(quoteCmdArg)].join(' ');
  debugLog('dependency-probe', 'resolved npm command', { npm, comspec, args, timeoutMs });
  return runDependencyProbe(comspec, ['/d', '/c', npmCommand], timeoutMs, env);
}

function wingetCommand(): string {
  return process.platform === 'win32' ? 'winget.exe' : 'winget';
}

async function openWilyTraderExtensionFolder(): Promise<{ ok: boolean; message: string; path?: string | null }> {
  const install = detectCurrentWilyTraderInstall();
  if (!install) return { ok: false, message: 'No local WilyTrader extension manifest was found.', path: null };
  await revealExtensionFolder(install.extensionPath);
  return { ok: true, message: `Opened WilyTrader extension folder: ${install.extensionPath}`, path: install.extensionPath };
}

async function openLastCompletedSessionFolder(): Promise<{ ok: boolean; message: string; path?: string | null }> {
  const resolved = resolveLastCompletedSessionFolder();
  if (!resolved.ok) return resolved;
  const sessionDir = resolved.path;
  lastCompletedSessionDir = sessionDir;
  const openError = await shell.openPath(sessionDir);
  if (openError) return { ok: false, message: `Could not open session folder: ${openError}`, path: sessionDir };
  return { ok: true, message: `Opened session folder: ${sessionDir}`, path: sessionDir };
}

async function openActiveSessionFolder(): Promise<{ ok: boolean; message: string; path?: string | null }> {
  const resolved = resolveActiveSessionFolder();
  if (!resolved.ok) return resolved;
  const openError = await shell.openPath(resolved.path);
  if (openError) return { ok: false, message: `Could not open active session folder: ${openError}`, path: resolved.path };
  return { ok: true, message: `Opened active session folder: ${resolved.path}`, path: resolved.path };
}

function copyActiveSessionFolderLink(): { ok: boolean; message: string; path?: string | null } {
  const resolved = resolveActiveSessionFolder();
  if (!resolved.ok) return resolved;
  clipboard.writeText(resolved.path);
  return { ok: true, message: `Copied active session folder link: ${resolved.path}`, path: resolved.path };
}

function resolveActiveSessionFolder(): { ok: true; message: string; path: string } | { ok: false; message: string; path?: string | null } {
  const sessionDir = activeSession?.sessionDir ?? finalizingSession?.sessionDir ?? null;
  if (!sessionDir) return { ok: false, message: 'No active WilyTrader session folder is available.', path: null };
  if (!fs.existsSync(sessionDir)) {
    return { ok: false, message: `Active session folder no longer exists: ${sessionDir}`, path: sessionDir };
  }
  return { ok: true, message: `Found active session folder: ${sessionDir}`, path: sessionDir };
}

function copyLastCompletedSessionFolderLink(): { ok: boolean; message: string; path?: string | null } {
  const resolved = resolveLastCompletedSessionFolder();
  if (!resolved.ok) return resolved;
  lastCompletedSessionDir = resolved.path;
  clipboard.writeText(resolved.path);
  return { ok: true, message: `Copied session folder link: ${resolved.path}`, path: resolved.path };
}

async function syncMasterTradingLog(): Promise<MasterSyncResult> {
  if (activeSession || finalizingSession) {
    return emptyMasterSyncResult(false, 'Wait for the active WilyTrader session to finish before syncing the master trading log.');
  }

  const syncScriptsDir = bundledMasterSyncScriptsDir();
  const scriptPath = path.join(syncScriptsDir, 'run-trade-sync.ps1');
  const masterPath = settings.masterTradingLogPath || defaultMasterTradingLogPath(settings.outputDir);
  try {
    const seededMaster = ensureDefaultMasterTradingLog(settings.outputDir, masterPath);
    if (seededMaster.copied) {
      debugLog('master-sync', 'seeded default master trading log before sync', seededMaster);
    }
  } catch (err) {
    return emptyMasterSyncResult(false, `Could not create the default master trading log: ${(err as Error).message}`, masterPath, syncScriptsDir);
  }
  if (!fs.existsSync(scriptPath)) {
    return emptyMasterSyncResult(false, `Sync script was not found: ${scriptPath}`, masterPath, syncScriptsDir);
  }

  const args = [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath,
    '-CapturesRoot',
    settings.outputDir,
    '-MasterPath',
    masterPath,
  ];
  debugLog('master-sync', 'starting master sync', { scriptPath, masterPath, outputDir: settings.outputDir });
  const result = await runProcessProbe('powershell.exe', args, 300_000);
  const summary = parseMasterSyncSummary(result.stdout);
  if (!result.ok) {
    const message = `Master sync failed${result.timedOut ? ' after timing out' : ''}. ${tail(result.stderr || result.stdout || result.error || '', 700)}`;
    debugLog('master-sync', 'master sync failed', { ...result, stdoutTail: tail(result.stdout), stderrTail: tail(result.stderr) });
    return {
      ok: false,
      message,
      masterPath,
      syncScriptsDir,
      processedFolders: summary.processedFolders,
      rowsAppended: summary.rowsAppended,
      rowsBackfilled: summary.rowsBackfilled,
      backfilledArchivedFolders: summary.backfilledArchivedFolders,
      stdoutTail: tail(result.stdout, 1000),
      stderrTail: tail(result.stderr, 1000),
    };
  }

  if (fs.existsSync(masterPath)) {
    const openError = await shell.openPath(masterPath);
    if (openError) {
      return {
        ok: false,
        message: `Master sync completed, but Excel did not open the workbook: ${openError}`,
        masterPath,
        syncScriptsDir,
        processedFolders: summary.processedFolders,
        rowsAppended: summary.rowsAppended,
        rowsBackfilled: summary.rowsBackfilled,
        backfilledArchivedFolders: summary.backfilledArchivedFolders,
        stdoutTail: tail(result.stdout, 1000),
        stderrTail: tail(result.stderr, 1000),
      };
    }
  }
  debugLog('master-sync', 'master sync completed', { masterPath, summary });
  return {
    ok: true,
    message: fs.existsSync(masterPath)
      ? `Master trading log synced and opened: ${masterPath}`
      : `Master sync completed, but the workbook was not found at ${masterPath}`,
    masterPath: fs.existsSync(masterPath) ? masterPath : null,
    syncScriptsDir,
    processedFolders: summary.processedFolders,
    rowsAppended: summary.rowsAppended,
    rowsBackfilled: summary.rowsBackfilled,
    backfilledArchivedFolders: summary.backfilledArchivedFolders,
    stdoutTail: tail(result.stdout, 1000),
    stderrTail: tail(result.stderr, 1000),
  };
}

function emptyMasterSyncResult(ok: boolean, message: string, masterPath: string | null = null, syncScriptsDir = bundledMasterSyncScriptsDir()): MasterSyncResult {
  return {
    ok,
    message,
    masterPath,
    syncScriptsDir,
    processedFolders: 0,
    rowsAppended: 0,
    rowsBackfilled: 0,
    backfilledArchivedFolders: 0,
  };
}

function parseMasterSyncSummary(stdout: string): Pick<MasterSyncResult, 'processedFolders' | 'rowsAppended' | 'rowsBackfilled' | 'backfilledArchivedFolders'> {
  const fallback = {
    processedFolders: 0,
    rowsAppended: 0,
    rowsBackfilled: 0,
    backfilledArchivedFolders: 0,
  };
  const match = stdout.match(/\{\s*"master"[\s\S]*?\n\}/);
  if (!match) return fallback;
  try {
    const parsed = JSON.parse(match[0]) as Partial<Record<keyof typeof fallback, unknown>>;
    return {
      processedFolders: numberOrZero(parsed.processedFolders),
      rowsAppended: numberOrZero(parsed.rowsAppended),
      rowsBackfilled: numberOrZero(parsed.rowsBackfilled),
      backfilledArchivedFolders: numberOrZero(parsed.backfilledArchivedFolders),
    };
  } catch {
    return fallback;
  }
}

function numberOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function runProcessProbe(command: string, args: string[], timeoutMs: number): Promise<DependencyProbeResult> {
  return runDependencyProbe(command, args, timeoutMs, dependencyProbeEnv());
}

function resolveLastCompletedSessionFolder(): { ok: true; message: string; path: string } | { ok: false; message: string; path?: string | null } {
  let sessionDir = lastCompletedSessionDir;
  if (!sessionDir || !fs.existsSync(sessionDir)) {
    sessionDir = findLastCompletedSessionDir(settings.outputDir);
    lastCompletedSessionDir = sessionDir;
  }
  if (!sessionDir) {
    return { ok: false, message: 'No completed WilyTrader session folder was found.', path: null };
  }
  if (!fs.existsSync(sessionDir)) {
    return {
      ok: false,
      message: `Last completed session folder no longer exists: ${sessionDir}`,
      path: sessionDir,
    };
  }
  return { ok: true, message: `Found session folder: ${sessionDir}`, path: sessionDir };
}

async function openChromeExtensionsPage(): Promise<{ ok: boolean; message: string }> {
  const target = chromeExtensionsTarget();
  if (process.platform === 'win32') {
    try {
      const marker = `WilyTraderChromeHandoff${process.pid}${Date.now()}`;
      const args = [
        ...(target.profileName ? [`--profile-directory=${target.profileName}`] : []),
        createChromeHandoffUrl(marker),
      ];
      debugLog('chrome-handoff', 'opening chrome extensions page', {
        url: target.url,
        profileName: target.profileName,
        extensionId: target.extensionId,
        args,
      });
      startChromeDetached(args);
      await new Promise((resolve) => setTimeout(resolve, 900));
      if (await navigateChromeHandoffWindowWithClipboard(marker, target.url)) {
        return { ok: true, message: 'Opened Chrome Extensions for WilyTrader. Use Reload if needed.' };
      }
      clipboard.writeText(target.url);
      return {
        ok: true,
        message: 'Opened Chrome and copied the Chrome Extensions URL. If it did not navigate, paste into the Chrome address bar.',
      };
    } catch (err) {
      debugLog('chrome-handoff', 'chrome handoff failed, falling back to shell.openExternal', { error: (err as Error).message });
    }
  }
  await shell.openExternal(target.url);
  return { ok: true, message: 'Opened chrome://extensions/. Use Developer mode and Load unpacked for WilyTrader.' };
}

function startChromeDetached(args: string[]): void {
  const chrome = chromeExecutableCandidates()[0];
  const child = chrome
    ? spawn(chrome, args, { detached: true, stdio: 'ignore', windowsHide: true })
    : spawn('cmd.exe', ['/d', '/c', 'start', '""', 'chrome', ...args], { detached: true, stdio: 'ignore', windowsHide: true });
  child.unref();
}

function createChromeHandoffUrl(marker: string): string {
  const html = [
    '<!doctype html>',
    '<html>',
    '<head>',
    `<title>${marker}</title>`,
    '<meta charset="utf-8">',
    '</head>',
    '<body></body>',
    '</html>',
  ].join('');
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

function navigateChromeHandoffWindowWithClipboard(marker: string, url: string): Promise<boolean> {
  const previousClipboardText = clipboard.readText();
  clipboard.writeText(url);
  const script = [
    '$ErrorActionPreference = \'Stop\'',
    'Add-Type -AssemblyName System.Windows.Forms',
    `$marker = '${marker}'`,
    '$ws = New-Object -ComObject WScript.Shell',
    '$deadline = (Get-Date).AddSeconds(6)',
    'do {',
    '  if ($ws.AppActivate($marker) -or $ws.AppActivate("$marker - Google Chrome")) {',
    '    Start-Sleep -Milliseconds 250',
    '    [System.Windows.Forms.SendKeys]::SendWait(\'^l\')',
    '    Start-Sleep -Milliseconds 80',
    '    [System.Windows.Forms.SendKeys]::SendWait(\'^v\')',
    '    Start-Sleep -Milliseconds 80',
    '    [System.Windows.Forms.SendKeys]::SendWait(\'{ENTER}\')',
    '    exit 0',
    '  }',
    '  Start-Sleep -Milliseconds 150',
    '} while ((Get-Date) -lt $deadline)',
    'exit 1',
  ].join('; ');

  return new Promise((resolve) => {
    const child = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      script,
    ], {
      stdio: 'ignore',
      windowsHide: true,
    });
    child.on('error', (err) => {
      debugLog('chrome-handoff', 'navigation process failed to start', { marker, error: err.message });
      clipboard.writeText(previousClipboardText);
      resolve(false);
    });
    child.on('exit', (code) => {
      clipboard.writeText(previousClipboardText);
      if (code !== 0) debugLog('chrome-handoff', 'navigation failed', { marker, code });
      resolve(code === 0);
    });
  });
}

async function moveWilyTraderExtensionLocation(): Promise<{
  ok: boolean;
  message: string;
  version: string | null;
  repoPath: string | null;
  extensionPath: string | null;
}> {
  const install = detectCurrentWilyTraderInstall();
  if (!install) {
    return { ok: false, message: 'No local WilyTrader extension manifest was found.', version: null, repoPath: null, extensionPath: null };
  }
  const selection = mainWindow
    ? await dialog.showOpenDialog(mainWindow, {
        title: 'Choose WilyTrader files folder',
        properties: ['openDirectory', 'createDirectory'],
      })
    : await dialog.showOpenDialog({
        title: 'Choose WilyTrader files folder',
        properties: ['openDirectory', 'createDirectory'],
      });
  if (selection.canceled || selection.filePaths.length === 0) {
    return { ok: false, message: 'WilyTrader location change canceled.', version: install.version, repoPath: install.repoPath, extensionPath: install.extensionPath };
  }

  const destination = path.resolve(selection.filePaths[0]);
  try {
    const existing = readWilyTraderManifest(destination);
    if (existing) {
      saveSettings({ wilyTraderInstallPath: existing.repoPath });
      extensionStatus = { ...extensionStatus, ...detectLocalExtensionManifest() };
      return {
        ok: true,
        message: `Using existing WilyTrader folder: ${existing.extensionPath}`,
        version: existing.version,
        repoPath: existing.repoPath,
        extensionPath: existing.extensionPath,
      };
    }
    if (!isDirectoryEmpty(destination)) {
      throw new Error('Choose an empty folder, or choose an existing WilyTrader folder to use without copying files.');
    }
    const targetExtensionPath = path.join(destination, 'extension');
    fs.cpSync(install.extensionPath, targetExtensionPath, { recursive: true, force: true });
    const copied = readWilyTraderManifest(destination);
    if (!copied) throw new Error('Copied extension files, but the destination manifest could not be verified.');
    saveSettings({ wilyTraderInstallPath: copied.repoPath });
    extensionStatus = { ...extensionStatus, ...detectLocalExtensionManifest() };
    clipboard.writeText(copied.extensionPath);
    await revealExtensionFolder(copied.extensionPath);
    return {
      ok: true,
      message: `Copied WilyTrader extension files to ${copied.extensionPath}. Load unpacked from that folder in Chrome.`,
      version: copied.version,
      repoPath: copied.repoPath,
      extensionPath: copied.extensionPath,
    };
  } catch (err) {
    return {
      ok: false,
      message: `WilyTrader location change failed: ${(err as Error).message}`,
      version: install.version,
      repoPath: install.repoPath,
      extensionPath: install.extensionPath,
    };
  }
}

function readWilyTraderManifest(candidatePath: string): { repoPath: string; extensionPath: string; version: string } | null {
  const possibleExtensionPaths = [candidatePath, path.join(candidatePath, 'extension')];
  for (const extensionPath of possibleExtensionPaths) {
    const manifestPath = path.join(extensionPath, 'manifest.json');
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as { name?: unknown; version?: unknown };
      if (manifest.name !== 'WilyTrader' || typeof manifest.version !== 'string') continue;
      return {
        repoPath: path.basename(extensionPath).toLowerCase() === 'extension' ? path.dirname(extensionPath) : extensionPath,
        extensionPath,
        version: manifest.version,
      };
    } catch {
      // keep scanning
    }
  }
  return null;
}

function detectCurrentWilyTraderInstall(): { repoPath: string; extensionPath: string; version: string } | null {
  const candidates = [
    settings.wilyTraderInstallPath,
    extensionStatus.localExtensionPath,
    path.resolve(app.getAppPath(), '..', 'extension'),
    path.resolve(process.cwd(), '..', 'extension'),
    path.resolve(process.cwd(), 'extension'),
    'E:\\Apps\\wilytrader-desktop\\extension',
    'E:\\Apps\\wilytrader\\extension',
  ].filter((candidate): candidate is string => Boolean(candidate && candidate.trim()));
  for (const candidate of [...new Set(candidates.map((item) => path.resolve(item)))]) {
    const manifest = readWilyTraderManifest(candidate);
    if (manifest) return manifest;
  }
  return null;
}

function isDirectoryEmpty(dir: string): boolean {
  return !fs.existsSync(dir) || fs.readdirSync(dir).length === 0;
}

async function revealExtensionFolder(extensionPath: string): Promise<void> {
  const manifestPath = path.join(extensionPath, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    shell.showItemInFolder(manifestPath);
    return;
  }
  await shell.openPath(extensionPath);
}

function safeUpdateFileName(name: string): string {
  const base = path.basename(name || 'wilytrader-update');
  return base.replace(/[^a-z0-9._-]/gi, '_') || 'wilytrader-update';
}

function replaceDirectoryContents(sourceDir: string, destinationDir: string): void {
  const source = path.resolve(sourceDir);
  const destination = path.resolve(destinationDir);
  if (!fs.existsSync(path.join(source, 'manifest.json'))) {
    throw new Error(`Source extension manifest was not found: ${source}`);
  }
  const destinationManifest = path.join(destination, 'manifest.json');
  if (!fs.existsSync(destinationManifest)) {
    throw new Error(`Destination extension manifest was not found: ${destination}`);
  }
  const current = readWilyTraderManifest(destination);
  if (!current) throw new Error(`Destination is not a WilyTrader extension folder: ${destination}`);

  const destinationRoot = path.parse(destination).root;
  if (destination === destinationRoot || destination.length < destinationRoot.length + 8) {
    throw new Error(`Refusing to replace unsafe extension path: ${destination}`);
  }

  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(destination, { recursive: true });
  fs.cpSync(source, destination, { recursive: true, force: true });
}

async function launchUpdateInstaller(installerPath: string): Promise<void> {
  const resolved = path.resolve(installerPath);
  if (!fs.existsSync(resolved)) throw new Error(`Installer not found: ${resolved}`);
  if (process.platform !== 'win32') {
    const openError = await shell.openPath(resolved);
    if (openError) throw new Error(openError);
    return;
  }

  const psLiteral = "'" + resolved.replace(/'/g, "''") + "'";
  await new Promise<void>((resolve, reject) => {
    const child = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `Start-Process -LiteralPath ${psLiteral}`,
    ], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.once('spawn', () => {
      child.unref();
      resolve();
    });
    child.once('error', reject);
  });
}

function chromeExtensionsTarget(): { url: string; profileName: string | null; extensionId: string | null } {
  const profile = wilyTraderExtensionProfilesFromChromeProfiles()[0] ?? null;
  const extensionId = profile?.id ?? extensionStatus.runtimeExtensionId;
  return {
    url: extensionId ? `chrome://extensions/?id=${extensionId}` : 'chrome://extensions/',
    profileName: profile?.profileName ?? chromeLastUsedProfileName(),
    extensionId: extensionId ?? null,
  };
}

function chromeExecutableCandidates(): string[] {
  if (process.platform !== 'win32') return [];
  return [
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Google', 'Chrome', 'Application', 'chrome.exe') : '',
    process.env.PROGRAMFILES ? path.join(process.env.PROGRAMFILES, 'Google', 'Chrome', 'Application', 'chrome.exe') : '',
    process.env['PROGRAMFILES(X86)'] ? path.join(process.env['PROGRAMFILES(X86)'], 'Google', 'Chrome', 'Application', 'chrome.exe') : '',
  ].filter((candidate) => Boolean(candidate && fs.existsSync(candidate)));
}

function chromeUserDataRoot(): string {
  return path.join(os.homedir(), 'AppData', 'Local', 'Google', 'Chrome', 'User Data');
}

function chromeProfileDirs(): Array<{ name: string; path: string }> {
  const root = chromeUserDataRoot();
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && (entry.name === 'Default' || /^Profile \d+$/i.test(entry.name)))
    .map((entry) => ({ name: entry.name, path: path.join(root, entry.name) }));
}

function chromeLastUsedProfileName(): string | null {
  const localStatePath = path.join(chromeUserDataRoot(), 'Local State');
  if (!fs.existsSync(localStatePath)) return null;
  try {
    const json = JSON.parse(fs.readFileSync(localStatePath, 'utf-8')) as { profile?: { last_used?: unknown; last_active_profiles?: unknown } };
    const lastUsed = typeof json.profile?.last_used === 'string' ? json.profile.last_used : '';
    if (lastUsed) return lastUsed;
    const active = Array.isArray(json.profile?.last_active_profiles)
      ? json.profile.last_active_profiles.filter((item): item is string => typeof item === 'string')
      : [];
    return active[0] ?? null;
  } catch {
    return null;
  }
}

function wilyTraderExtensionProfilesFromChromeProfiles(): Array<{ id: string; profileName: string }> {
  const found: Array<{ id: string; profileName: string }> = [];
  for (const profile of chromeProfileDirs()) {
    const preferencesPath = path.join(profile.path, 'Preferences');
    if (!fs.existsSync(preferencesPath)) continue;
    try {
      const json = JSON.parse(fs.readFileSync(preferencesPath, 'utf-8')) as {
        extensions?: { settings?: Record<string, { path?: unknown; manifest?: { name?: unknown } }> };
      };
      const extensionSettings = json.extensions?.settings ?? {};
      for (const [extensionId, extension] of Object.entries(extensionSettings)) {
        const extensionPath = typeof extension.path === 'string' ? extension.path : '';
        const manifestName = typeof extension.manifest?.name === 'string' ? extension.manifest.name : '';
        if (manifestName === 'WilyTrader' || (extensionPath && readWilyTraderManifest(extensionPath))) {
          found.push({ id: extensionId, profileName: profile.name });
        }
      }
    } catch {
      // keep scanning
    }
  }
  const seen = new Set<string>();
  return found.filter((item) => {
    const key = `${item.profileName}:${item.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeVersionTag(tag: string): string {
  return tag.trim().replace(/^v/i, '');
}

function compareVersions(a: string, b: string): number {
  const left = parseSemverParts(a);
  const right = parseSemverParts(b);
  if (!left || !right) return 0;
  for (let i = 0; i < 3; i += 1) {
    if (left[i] < right[i]) return -1;
    if (left[i] > right[i]) return 1;
  }
  return 0;
}

function parseSemverParts(value: string): number[] | null {
  const match = value.trim().replace(/^v/i, '').match(/^(\d+)\.(\d+)\.(\d+)/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}

function isRemoteVersionNewer(current: string, latest: string): boolean {
  return compareVersions(current, latest) < 0;
}

function normalizeClockMs(value: unknown, session: ActiveTradeSession): number {
  const parsed = parseTimestampMs(value);
  if (parsed !== null) return parsed;
  return Date.now() || session.sessionStartedAtMs;
}

function parseTimestampMs(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && numeric > 10_000) return numeric;
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseJsonArrayFromLlmOutput(raw: string): unknown[] {
  const candidates = candidateJsonTexts(raw);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (Array.isArray(parsed)) return parsed;
      const nested = extractNestedLlmText(parsed);
      if (nested && nested !== candidate) {
        const nestedArray = parseJsonArrayFromLlmOutput(nested);
        if (nestedArray) return nestedArray;
      }
    } catch {
      // try next candidate
    }
  }
  throw new Error('No JSON array found in LLM output.');
}

function candidateJsonTexts(raw: string): string[] {
  const trimmed = raw.trim();
  const candidates = [trimmed];
  const fence = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/i);
  if (fence) candidates.push(fence[1].trim());
  const firstArray = trimmed.indexOf('[');
  const lastArray = trimmed.lastIndexOf(']');
  if (firstArray >= 0 && lastArray > firstArray) candidates.push(trimmed.slice(firstArray, lastArray + 1));
  const firstObject = trimmed.indexOf('{');
  const lastObject = trimmed.lastIndexOf('}');
  if (firstObject >= 0 && lastObject > firstObject) candidates.push(trimmed.slice(firstObject, lastObject + 1));
  return [...new Set(candidates.filter(Boolean))];
}

function extractNestedLlmText(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  for (const key of ['response', 'text', 'content', 'output']) {
    if (typeof record[key] === 'string') return record[key] as string;
  }
  const candidates = record.candidates;
  if (Array.isArray(candidates)) {
    for (const candidate of candidates) {
      if (!candidate || typeof candidate !== 'object') continue;
      const content = (candidate as Record<string, unknown>).content;
      if (content && typeof content === 'object') {
        const parts = (content as Record<string, unknown>).parts;
        if (Array.isArray(parts)) {
          const text = parts
            .map((part) => part && typeof part === 'object' ? (part as Record<string, unknown>).text : null)
            .filter((part): part is string => typeof part === 'string')
            .join('\n')
            .trim();
          if (text) return text;
        }
      }
    }
  }
  return null;
}

function numberOrNull(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
}

function boolOrNull(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (/^(true|yes|1)$/i.test(value.trim())) return true;
    if (/^(false|no|0)$/i.test(value.trim())) return false;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value !== 0;
  return null;
}

function binaryOrNull(value: unknown): number | null {
  const number = numberOrNull(value);
  if (number === null) return null;
  return number === 1 ? 1 : 0;
}

function computeNicsScore(
  n: number | null,
  i: number | null,
  c: number | null,
  s: number | null
): number | null {
  if (n === null || i === null || c === null || s === null) return null;
  return n + i + c + s;
}

function strOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getObjectArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    : [];
}

function formatSessionStamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function nextSessionDir(outputDir: string, startedAt: Date): string {
  const baseName = formatSessionFolderName(startedAt);
  let candidate = path.join(outputDir, baseName);
  let suffix = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(outputDir, `${baseName} ${suffix}`);
    suffix += 1;
  }
  return candidate;
}

function findLastCompletedSessionDir(outputDir: string): string | null {
  if (!fs.existsSync(outputDir)) return null;
  const searchRoots = [outputDir, path.join(outputDir, 'Archive')]
    .filter((dir, index, dirs) => fs.existsSync(dir) && dirs.indexOf(dir) === index);
  const completed = searchRoots
    .flatMap((rootDir) => fs.readdirSync(rootDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
      const sessionDir = path.join(rootDir, entry.name);
      const statusPath = path.join(sessionDir, 'session_status.json');
      if (!fs.existsSync(statusPath)) return null;
      try {
        const status = JSON.parse(fs.readFileSync(statusPath, 'utf-8')) as {
          status?: unknown;
          updatedAt?: unknown;
          sessionDir?: unknown;
          sessionStartedAtMs?: unknown;
        };
        if (status.status !== 'complete') return null;
        const updatedAtMs = typeof status.updatedAt === 'string' ? Date.parse(status.updatedAt) : 0;
        const startedAtMs = typeof status.sessionStartedAtMs === 'number' ? status.sessionStartedAtMs : 0;
        const statMs = fs.statSync(statusPath).mtimeMs;
        const sortMs = Math.max(updatedAtMs || 0, startedAtMs || 0, statMs || 0);
        const recordedDir = typeof status.sessionDir === 'string' && fs.existsSync(status.sessionDir)
          ? status.sessionDir
          : sessionDir;
        return { sessionDir: recordedDir, sortMs };
      } catch {
        return null;
      }
    }))
    .filter((item): item is { sessionDir: string; sortMs: number } => item !== null)
    .sort((a, b) => b.sortMs - a.sortMs);
  return completed[0]?.sessionDir ?? null;
}

function formatSessionFolderName(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}.${pad(date.getHours())}${pad(date.getMinutes())} Trade`;
}

function formatClusterDateStamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(date.getFullYear()).slice(-2)}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
}

function formatOffset(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatTradeDate(date: Date | null): string {
  return date
    ? new Intl.DateTimeFormat('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: '2-digit',
      }).format(date)
    : '';
}

function formatTradeTime(ms: number | null): string {
  return ms
    ? new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(new Date(ms))
    : '';
}

function formatSessionOffsetTime(session: ActiveTradeSession, offsetMs: number | null): string {
  return offsetMs === null || !Number.isFinite(offsetMs)
    ? ''
    : formatTradeTime(session.sessionStartedAtMs + offsetMs);
}

function formatDollars(value: number | null): string {
  return value === null ? 'unknown' : `$${Math.round(value).toLocaleString('en-US')}`;
}

function formatSol(value: number | null): string {
  return value === null ? 'unknown' : `${value >= 0 ? '+' : ''}${value.toFixed(4)} SOL`;
}

function formatPercent(value: number | null): string {
  return value === null ? 'unknown' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function xlsxInteger(value: number | null | undefined): number | '' {
  return Number.isFinite(Number(value)) ? Math.round(Number(value)) : '';
}

function xlsxDecimal(value: number | null | undefined, decimals: number): number | '' {
  if (!Number.isFinite(Number(value))) return '';
  const factor = 10 ** decimals;
  return Math.round(Number(value) * factor) / factor;
}

function xlsxPercent(value: number | null | undefined): number | '' {
  if (!Number.isFinite(Number(value))) return '';
  return xlsxDecimal(Number(value) / 100, 3);
}

function xlsxFormula(formula: string, text = ''): XlsxCell {
  return { text, formula };
}

function xlsxDate(value: Date | null | undefined): number | '' {
  if (!value || Number.isNaN(value.getTime())) return '';
  const localDateUtc = Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
  const excelEpochUtc = Date.UTC(1899, 11, 30);
  return Math.round((localDateUtc - excelEpochUtc) / 86_400_000);
}

function xlsxBooleanCount(value: boolean | null | undefined): number | '' {
  if (value === null || value === undefined) return '';
  return value ? 1 : 0;
}

function formatBoolean(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return '';
  return value ? 'true' : 'false';
}

function buildTradeNotes(trade: NormalizedTrade, entry: Date | null, exit: Date | null): string {
  const notes: string[] = [];
  if (trade.tokenAddress) notes.push(`tokenAddress=${trade.tokenAddress}`);
  if (trade.notes) notes.push(trade.notes);
  return notes.join('; ');
}

function markdownPath(value: string): string {
  return value.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/');
}

function filePathToHyperlinkTarget(filePath: string): string {
  return path.resolve(filePath);
}

function xlsxHyperlinkFormula(target: string, label: string): string {
  return `HYPERLINK(${xlsxFormulaString(target)},${xlsxFormulaString(label)})`;
}

function xlsxFormulaString(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function timeBucketFormula(rowNumber: number): string {
  const hour = `AE${rowNumber}`;
  const weekday = `AG${rowNumber}`;
  return [
    `IF(${hour}="","",`,
    `IF(AND(${weekday}<=4,${hour}<18),"WD 6am-6pm",`,
    `IF(AND(${weekday}=5,${hour}<18),"WD 6am-6pm",`,
    `IF(AND(${weekday}<=4,OR(${hour}=18,${hour}=19)),"WD 6pm-8pm",`,
    `IF(AND(${weekday}<=4,${hour}>=20,${hour}<=23),"WD 8pm-12am",`,
    `IF(AND(${weekday}<=4,OR(${hour}=0,${hour}=1)),"WD 6am-6pm",`,
    `IF(AND(OR(${weekday}=6,${weekday}=7),${hour}>=2,${hour}<=11),"WE 6am-12pm",`,
    `IF(AND(OR(${weekday}=6,${weekday}=7),${hour}>=12,${hour}<=17),"WE 12pm-6pm",`,
    `IF(AND(OR(${weekday}=5,${weekday}=6,${weekday}=7),OR(${hour}=18,${hour}=19)),"WE 6pm-8pm",`,
    `IF(AND(${weekday}=5,${hour}>=20,${hour}<=23),"WE 8pm-2am",`,
    `IF(AND(${weekday}=6,OR(${hour}>=20,${hour}<=1)),"WE 8pm-2am",`,
    `IF(AND(${weekday}=7,${hour}>=20,${hour}<=23),"WE 8pm-2am",`,
    `IF(AND(${weekday}=7,OR(${hour}=0,${hour}=1)),"WE 8pm-2am","")))))))))))))`,
  ].join('');
}

function sanitizeFilePart(value: unknown): string {
  const cleaned = String(value ?? '').trim().replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '');
  return cleaned || 'wilytrader';
}

function columnLetters(index: number): string {
  let value = index;
  let letters = '';
  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }
  return letters;
}

function escapeXml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeXmlAttribute(value: string): string {
  return escapeXml(value);
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf-8');
}

function appendJsonLine(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(value)}${os.EOL}`, 'utf-8');
}

function appendSessionLog(component: string, message: string, details?: unknown, status = 'info'): void {
  if (!activeSession) return;
  appendSessionLogForSession(activeSession, component, message, details, status);
}

function appendSessionLogForSession(
  session: ActiveTradeSession,
  component: string,
  message: string,
  details?: unknown,
  status = 'info'
): void {
  appendJsonLine(path.join(session.inputsDir, 'session_log.jsonl'), {
    at: new Date().toISOString(),
    component,
    message,
    status,
    details: details ?? null,
  });
}

function writeStatusFile(status: string, details: Record<string, unknown> = {}): void {
  if (!activeSession) return;
  writeStatusFileForSession(activeSession, status, details);
}

function writeStatusFileForSession(session: ActiveTradeSession, status: string, details: Record<string, unknown> = {}): void {
  writeJson(path.join(session.sessionDir, 'session_status.json'), {
    status,
    updatedAt: new Date().toISOString(),
    app: 'WilyTrader Desktop',
    sessionDir: session.sessionDir,
    sessionStartedAtMs: session.sessionStartedAtMs,
    ...details,
  });
}

function setCorsHeaders(res: http.ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '600');
}

function writeBridgeJson(res: http.ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function broadcastStatus(): void {
  mainWindow?.webContents.send('session:status-changed', getStatus());
}

import { app, BrowserWindow, clipboard, dialog, globalShortcut, ipcMain, shell } from 'electron';
import * as fs from 'node:fs';
import * as http from 'node:http';
import * as os from 'node:os';
import * as path from 'node:path';
import { execSync, spawn } from 'node:child_process';
import JSZip from 'jszip';
import { resolveGeminiCliExecutable } from './gemini-cli-exec';
import type {
  AudioChunkMeta,
  AudioRecordingMeta,
  BridgeExecutionEvent,
  BridgeScreenshotPayload,
  StopSessionResult,
  TranscriptSegment,
  WilyTraderDesktopSettings,
  WilyTraderDesktopStatus,
  WilyTraderExtensionStatus,
  WilyTraderSessionFinalization,
} from '../shared';

const BRIDGE_PORT = 17365;
const MAX_BRIDGE_BODY_BYTES = 25 * 1024 * 1024;
const WILYTRADER_TAGS_API_URL = 'https://api.github.com/repos/Koprowski/WilyTrader/tags?per_page=10';
const ffmpegPath = require('ffmpeg-static') as string | null;

interface ActiveTradeSession {
  sessionDir: string;
  inputsDir: string;
  audioDir: string;
  screenshotDir: string;
  sessionStartedAtMs: number;
  transcriptSegments: TranscriptSegment[];
  audioChunks: AudioChunkMeta[];
  audioRecording: AudioRecordingMeta | null;
  executionsReceived: number;
  screenshotsReceived: number;
  lastLedgerPayload: unknown | null;
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
  solInvested: number | null;
  solReceived: number | null;
  pnlSol: number | null;
  pnlPercentage: number | null;
  timestampMs: number | null;
  entryTimestampMs: number | null;
  timeInTradeSeconds: number | null;
  tokenAddress: string | null;
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
let registeredTradeSessionHotkey: string | null = null;
let activeGeminiSigninChild: ReturnType<typeof spawn> | null = null;

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
  extensionStatus = {
    ...extensionStatus,
    ...detectLocalExtensionManifest(),
  };
  registerIpc();
  registerTradeSessionHotkey();
  createWindow();
  console.log(`[WilyTrader Desktop] started. Bridge port ${BRIDGE_PORT}. Output: ${settings.outputDir}`);
  if (settings.autoCheckExtensionUpdates) void checkExtensionUpdates();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  stopBridge('window closed');
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
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
  ipcMain.handle('extension:move-location', async () => moveWilyTraderExtensionLocation());
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
  const sessionDir = path.join(settings.outputDir, `${formatSessionStamp(new Date(sessionStartedAtMs))} wilytrader-trade`);
  const inputsDir = path.join(sessionDir, 'Inputs');
  const audioDir = path.join(inputsDir, 'audio');
  const screenshotDir = path.join(inputsDir, 'trade-screenshots');
  fs.mkdirSync(audioDir, { recursive: true });
  fs.mkdirSync(screenshotDir, { recursive: true });

  activeSession = {
    sessionDir,
    inputsDir,
    audioDir,
    screenshotDir,
    sessionStartedAtMs,
    transcriptSegments: [],
    audioChunks: [],
    audioRecording: null,
    executionsReceived: 0,
    screenshotsReceived: 0,
    lastLedgerPayload: null,
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

  const transcriptionWarnings = await transcribeSessionAudio(session, (phase, message, percent) => {
    updateFinalizationProgress(session, phase, message, percent);
  });
  updateFinalizationProgress(session, 'artifacts', 'Writing transcript files.', 82);
  const transcriptJsonPath = writeTranscriptJson(session);
  const transcriptMdPath = writeTranscriptMd(session);
  updateFinalizationProgress(session, 'trade-log', 'Building trade log artifacts.', 90);
  const trades = loadTradesFromSession(session);
  const tradeLogMdPath = settings.generateTradeLogOnStop ? writeTradeLogMd(session, trades) : '';
  const tradeLogXlsxPath = settings.generateTradeLogOnStop ? await writeTradeLogXlsx(session, trades) : '';
  updateFinalizationProgress(session, 'complete', 'Session finalized.', 100);
  writeStatusFileForSession(session, 'complete', {
    durationMs: stoppedAtMs - session.sessionStartedAtMs,
    tradeLogMdPath,
    tradeLogXlsxPath,
    transcriptJsonPath,
    transcriptMdPath,
  });
  appendSessionLogForSession(session, 'session', 'completed', {
    trades: trades.length,
    tradeLogMdPath,
    tradeLogXlsxPath,
  }, 'success');
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
    warnings: transcriptionWarnings,
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

  if (req.method === 'POST' && url.pathname === '/v1/wilytrader/ledger') {
    try {
      const payload = await readJsonBody(req);
      receiveLedger(payload, res);
    } catch (err) {
      writeBridgeJson(res, 400, { ok: false, error: (err as Error).message });
    }
    return;
  }

  writeBridgeJson(res, 404, { ok: false, error: 'Not found' });
}

function receiveLedger(payload: unknown, res: http.ServerResponse): void {
  const session = activeSession;
  if (!session) {
    writeBridgeJson(res, 409, { ok: false, error: 'No active WilyTrader trade session.' });
    return;
  }

  const receivedAtMs = Date.now();
  const event = extractExecutionEvent(payload);
  const screenshot = extractScreenshotPayload(payload);
  const screenshotPath = settings.saveBrowserScreenshots && screenshot
    ? saveBridgeScreenshot(session, screenshot, event, receivedAtMs)
    : null;
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
    payload,
  };
  session.lastLedgerPayload = payload;
  if (event) session.executionsReceived += 1;

  writeJson(path.join(session.inputsDir, 'wilytrader.json'), enriched);
  writeWilyTraderSnapshots(session.inputsDir, payload);
  if (enrichedEvent) {
    appendJsonLine(path.join(session.inputsDir, 'wilytrader-executions.jsonl'), {
      receivedAt: enriched.receivedAt,
      event: enrichedEvent,
      screenshotPath,
    });
  }
  const compatible = extractMockApeCompatibleTrades(payload);
  if (compatible.length > 0) {
    writeJson(path.join(session.inputsDir, 'wilytrader-mockape-compatible.json'), compatible);
  }
  appendSessionLog('bridge', 'ledger received', {
    event: enrichedEvent,
    screenshotPath,
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
  writeJson(`${filePath}.json`, {
    capturedAt: new Date(capturedAtMs).toISOString(),
    capturedAtMs,
    capturedOffsetMs: capturedAtMs - session.sessionStartedAtMs,
    event,
    captureRect: screenshot.captureRect ?? null,
    source: screenshot.source ?? 'chrome-tab-capture',
  });
  session.screenshotsReceived += 1;
  return filePath;
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

function loadTradesFromSession(session: ActiveTradeSession): NormalizedTrade[] {
  const ledgerPath = path.join(session.inputsDir, 'wilytrader.json');
  if (!fs.existsSync(ledgerPath)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(ledgerPath, 'utf-8'));
    return normalizeWilyTraderTrades(parsed);
  } catch (err) {
    appendSessionLogForSession(session, 'trade-log', 'ledger parse failed', { error: (err as Error).message }, 'error');
    return [];
  }
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
    trades.push({
      id: strOrNull(position.id) ?? `wilytrader-${timestampMs ?? Date.now()}-${tokenName}`,
      tokenName,
      platform: strOrNull(position.platform) ?? 'padre',
      chain: strOrNull(position.chain) ?? 'SOL',
      entryMarketCap: numberOrNull(position.entryMarketCapVwapUsd),
      exitMarketCap: numberOrNull(position.exitMarketCapVwapUsd),
      solInvested: numberOrNull(position.investedNative),
      solReceived: numberOrNull(position.netReceivedNative),
      pnlSol: numberOrNull(position.pnlPostFeeNative),
      pnlPercentage: numberOrNull(position.pnlPct),
      timestampMs,
      entryTimestampMs,
      timeInTradeSeconds: numberOrNull(position.timeInTradeSeconds),
      tokenAddress,
    });
  }
  if (trades.length > 0) return trades;
  return normalizeMockApeCompatibleTrades(record.mockapeCompatibleTrades);
}

function normalizeMockApeCompatibleTrades(value: unknown): NormalizedTrade[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((row) => ({
      id: strOrNull(row.id) ?? '',
      tokenName: strOrNull(row.tokenName) ?? 'Unknown token',
      platform: strOrNull(row.platform) ?? '',
      chain: strOrNull(row.chain) ?? 'SOL',
      entryMarketCap: numberOrNull(row.entryMarketCap),
      exitMarketCap: numberOrNull(row.exitMarketCap),
      solInvested: numberOrNull(row.solInvested),
      solReceived: numberOrNull(row.solReceived),
      pnlSol: numberOrNull(row.pnlSol),
      pnlPercentage: numberOrNull(row.pnlPercentage),
      timestampMs: numberOrNull(row.timestamp),
      entryTimestampMs:
        numberOrNull(row.entryTimestamp) ??
        numberOrNull(row.entryTimestampMs) ??
        parseTimestampMs(row.firstEntryAt) ??
        parseTimestampMs(row.entryAt),
      timeInTradeSeconds: numberOrNull(row.timeInTradeSeconds),
      tokenAddress: strOrNull(row.tokenAddress),
    }));
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
    lines.push(`- **P&L:** ${formatSol(trade.pnlSol)} (${formatPercent(trade.pnlPercentage)})`);
    lines.push(`- **SOL:** in ${formatSol(trade.solInvested)} / out ${formatSol(trade.solReceived)}`);
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
  'trade_date',
  'video_start_time',
  'entry_commentary_time',
  'entry_time_inferred',
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
] as const;

async function writeTradeLogXlsx(session: ActiveTradeSession, trades: NormalizedTrade[]): Promise<string> {
  const xlsxPath = path.join(session.sessionDir, 'trade_log.xlsx');
  const rows = trades.map((trade, index) => buildTradeRow(session, trade, index + 1));
  const zip = new JSZip();
  zip.file('[Content_Types].xml', xmlContentTypes());
  zip.folder('_rels')?.file('.rels', xmlRootRels());
  const xl = zip.folder('xl');
  xl?.file('workbook.xml', xmlWorkbook());
  xl?.folder('_rels')?.file('workbook.xml.rels', xmlWorkbookRels());
  xl?.folder('worksheets')?.file('sheet1.xml', xmlWorksheet(rows));
  xl?.file('styles.xml', xmlStyles());
  zip.folder('docProps')?.file('app.xml', xmlAppProps());
  zip.folder('docProps')?.file('core.xml', xmlCoreProps());
  const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(xlsxPath, buffer);
  return xlsxPath;
}

function buildTradeRow(session: ActiveTradeSession, trade: NormalizedTrade, index: number): Record<string, string> {
  const entry = trade.entryTimestampMs ? new Date(trade.entryTimestampMs) : null;
  const exit = trade.timestampMs ? new Date(trade.timestampMs) : null;
  const hour = entry?.getHours();
  return {
    source_session: path.basename(session.sessionDir),
    source_log_type: 'wilytrader-desktop-audio',
    source_folder_archived_path: session.sessionDir,
    processed_at: new Date().toISOString(),
    trade_id: String(index),
    token_name: trade.tokenName,
    trade_date: entry ? entry.toLocaleDateString('en-US') : '',
    video_start_time: formatTradeTime(session.sessionStartedAtMs),
    entry_commentary_time: '',
    entry_time_inferred: formatTradeTime(trade.entryTimestampMs),
    exit_commentary_time: '',
    exit_time_actual: formatTradeTime(trade.timestampMs),
    time_in_trade_seconds: trade.timeInTradeSeconds === null ? '' : String(trade.timeInTradeSeconds),
    video_end_time: '',
    entry_mc_actual: formatNumber(trade.entryMarketCap),
    target_exit_low_mc: '',
    target_exit_high_mc: '',
    stop_loss_mc: '',
    exit_mc_actual: formatNumber(trade.exitMarketCap),
    sol_invested: formatNumber(trade.solInvested),
    sol_received: formatNumber(trade.solReceived),
    pnl_sol: formatNumber(trade.pnlSol),
    pnl_percentage: formatNumber(trade.pnlPercentage),
    rationale: '',
    pre_transcript_excerpt: '',
    post_transcript_excerpt: '',
    adherence_self_assessment: '',
    notes: trade.tokenAddress ? `tokenAddress=${trade.tokenAddress}` : '',
    needs_review: '',
    mockape_trade_id: trade.id,
    Hour: hour === undefined ? '' : String(hour),
    Weekday: entry ? entry.toLocaleDateString('en-US', { weekday: 'long' }) : '',
    WeekdayNum: entry ? String(entry.getDay()) : '',
    TimeBucket: hour === undefined ? '' : hour < 6 ? 'Overnight' : hour < 12 ? 'Morning' : hour < 18 ? 'Afternoon' : 'Evening',
    meta_cluster_id: '',
    meta_name: '',
    N_score: '',
    N_why: '',
    I_score: '',
    I_why: '',
    C_score: '',
    C_why: '',
    S_score: '',
    S_why: '',
    NICS_score: '',
    size_ok: '',
    zone_ok: '',
    cooldown_ok: '',
    trade_type: '',
    counts_toward_50: '',
    hard_reset: '',
    running_count: '',
    non_nics_pnl_pct: '',
    cluster_pnl_pct: '',
    llm_grade_notes: '',
  };
}

function xmlWorksheet(rows: Array<Record<string, string>>): string {
  const header = XLSX_COLUMNS.map((column) => xlsxHeaderLabel(column));
  const allRows = [header, ...rows.map((row) => XLSX_COLUMNS.map((column) => row[column] ?? ''))];
  const sheetRows = allRows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row
        .map((value, columnIndex) => {
          const ref = `${columnLetters(columnIndex + 1)}${rowNumber}`;
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
        })
        .join('');
      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`;
}

function xlsxHeaderLabel(column: string): string {
  return column === 'entry_time_inferred' ? 'entry_time_actual' : column;
}

function xmlContentTypes(): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>';
}

function xmlRootRels(): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>';
}

function xmlWorkbook(): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Trade Log" sheetId="1" r:id="rId1"/></sheets></workbook>';
}

function xmlWorkbookRels(): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
}

function xmlStyles(): string {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="1"><xf xfId="0"/></cellXfs></styleSheet>';
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
  extensionStatus = {
    ...extensionStatus,
    runtimeInstalledVersion: installedVersion,
    runtimeExtensionId: strOrNull(record.extensionId),
    runtimeLastSeenAt: new Date().toISOString(),
  };
  if (extensionStatus.latestVersion && installedVersion) {
    extensionStatus.updateAvailable = isRemoteVersionNewer(installedVersion, extensionStatus.latestVersion);
    extensionStatus.updateMessage = extensionStatus.updateAvailable
      ? `Extension ${extensionStatus.latestVersion} is available; installed ${installedVersion}.`
      : `Extension is up to date (${installedVersion}).`;
  }
  broadcastStatus();
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
      if (tokenAddress && strOrNull(execution.tokenAddress) === tokenAddress) return true;
      return false;
    })
    .sort((a, b) => (parseTimestampMs(a.timestampMs ?? a.timestamp) ?? 0) - (parseTimestampMs(b.timestampMs ?? b.timestamp) ?? 0));
}

function findFirstBuyTimestampMs(executions: Array<Record<string, unknown>>): number | null {
  const buy = executions.find((execution) => strOrNull(execution.side)?.toLowerCase() === 'buy');
  return buy ? parseTimestampMs(buy.timestampMs ?? buy.timestamp) : null;
}

function findTradeScreenshots(session: ActiveTradeSession, trade: NormalizedTrade): string[] {
  if (!fs.existsSync(session.screenshotDir)) return [];
  const token = (trade.tokenAddress || trade.tokenName || '').toLowerCase();
  return fs
    .readdirSync(session.screenshotDir)
    .filter((name) => name.toLowerCase().endsWith('.png'))
    .filter((name) => !token || name.toLowerCase().includes(sanitizeFilePart(token).toLowerCase().slice(0, 24)))
    .map((name) => path.join(session.screenshotDir, name));
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
      return { ...loaded, outputDir: defaults.outputDir };
    }
    return loaded;
  } catch {
    return defaults;
  }
}

function saveSettings(payload: Partial<WilyTraderDesktopSettings>): WilyTraderDesktopSettings {
  const previousHotkey = settings.tradeSessionHotkey;
  settings = sanitizeSettings({ ...settings, ...payload });
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2), 'utf-8');
  if (settings.tradeSessionHotkey !== previousHotkey) registerTradeSessionHotkey();
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
    localManifestVersion: null,
    localExtensionPath: null,
    latestVersion: null,
    updateAvailable: false,
    updateMessage: 'No WilyTrader extension heartbeat received yet.',
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

async function checkExtensionUpdates(force = false): Promise<void> {
  if (!force && extensionStatus.checkedAt) return;
  const installed = extensionStatus.runtimeInstalledVersion ?? extensionStatus.localManifestVersion;
  try {
    const latest = await fetchLatestExtensionVersion();
    extensionStatus = {
      ...extensionStatus,
      latestVersion: latest,
      updateAvailable: installed ? isRemoteVersionNewer(installed, latest) : false,
      updateMessage: installed
        ? isRemoteVersionNewer(installed, latest)
          ? `Extension ${latest} is available; installed ${installed}.`
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

async function openChromeExtensionsPage(): Promise<{ ok: boolean; message: string }> {
  const target = chromeExtensionsTarget();
  if (process.platform === 'win32') {
    try {
      const chrome = chromeExecutableCandidates()[0];
      if (chrome) {
        const args = target.profileName ? [`--profile-directory=${target.profileName}`, target.url] : [target.url];
        const child = spawn(chrome, args, { detached: true, stdio: 'ignore', windowsHide: true });
        child.unref();
        return { ok: true, message: 'Opened Chrome Extensions for WilyTrader. Use Reload if needed.' };
      }
    } catch {
      // fall back to shell.openExternal
    }
  }
  await shell.openExternal(target.url);
  return { ok: true, message: 'Opened chrome://extensions/. Use Developer mode and Load unpacked for WilyTrader.' };
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

function numberOrNull(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(number) ? number : null;
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

function formatOffset(ms: number): string {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function formatTradeTime(ms: number | null): string {
  return ms ? new Date(ms).toLocaleString('en-US') : '';
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

function formatNumber(value: number | null): string {
  return value === null ? '' : String(value);
}

function markdownPath(value: string): string {
  return value.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/');
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

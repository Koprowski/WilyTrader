let mediaRecorder: MediaRecorder | null = null;
let mediaStream: MediaStream | null = null;
let sessionStartedAtMs: number | null = null;
let stopping = false;
let discarding = false;
let audioRecordingBlobs: Blob[] = [];
let audioChunkStream: MediaStream | null = null;
let audioChunkRecorder: MediaRecorder | null = null;
let audioChunkBlobs: Blob[] = [];
let audioChunkIndex = 0;
let audioChunkStartedAtMs = 0;
let audioChunkTimer: number | null = null;
let audioChunkStopResolve: (() => void) | null = null;
let audioChunkStopFinal = false;
let rollingAudioChunksActive = false;
let currentSettings: WilyTraderDesktopSettings | null = null;
let fetchedOpenrouterModels: Array<{ id: string; createdAtMs: number; inputCostPer1M: number }> = [];
let fetchedGeminiCliModels: Array<{ id: string; createdAtMs: number }> = [];
let finalizationTimer: number | null = null;
let latestFinalization: WilyTraderSessionFinalization | null = null;
let latestStatus: WilyTraderDesktopStatus | null = null;
let desktopUpdateInstalling = false;

interface DesktopUpdateProgress {
  stage: 'preparing' | 'downloading' | 'downloaded' | 'launching' | 'launched' | 'failed';
  version: string;
  installerName: string;
  message: string;
  downloadedBytes: number;
  totalBytes: number | null;
  percent: number | null;
}

const INCREMENTAL_AUDIO_CHUNK_MS = 60_000;

interface WilyTraderDesktopSettings {
  outputDir: string;
  microphoneCaptureEnabled: boolean;
  saveBrowserScreenshots: boolean;
  generateTradeLogOnStop: boolean;
  autoSyncMasterTradingLogAfterStop: boolean;
  masterTradingLogPath: string;
  autoCheckExtensionUpdates: boolean;
  tradeSessionHotkey: string;
  llmMode: 'gemini-cli' | 'api';
  geminiCliCommand: string;
  geminiCliModel: string;
  openRouterApiKey: string;
  openRouterBaseUrl: string;
  openRouterModel: string;
  wilyTraderInstallPath: string;
}

interface WilyTraderDesktopStatus {
  active: boolean;
  sessionState: 'idle' | 'recording' | 'finalizing';
  bridgePort: number;
  sessionDir: string | null;
  lastCompletedSessionDir: string | null;
  sessionStartedAtMs: number | null;
  elapsedMs: number;
  transcriptSegments: number;
  audioChunks: number;
  executionsReceived: number;
  screenshotsReceived: number;
  finalization: WilyTraderSessionFinalization | null;
  settings: WilyTraderDesktopSettings;
  extension: {
    runtimeInstalledVersion: string | null;
    localManifestVersion: string | null;
    runtimeLastSeenAt: string | null;
    runtimePageUrl: string | null;
    runtimeTokenName: string | null;
    runtimeTokenAddress: string | null;
    runtimeTokenChain: string | null;
    localExtensionPath: string | null;
    latestVersion: string | null;
    updateAvailable: boolean;
    updateMessage: string;
  };
  desktopUpdate: {
    installedVersion: string;
    latestVersion: string | null;
    updateAvailable: boolean;
    updateMessage: string;
    checkedAt: string | null;
  };
}

interface WilyTraderSessionFinalization {
  phase: string;
  message: string;
  percent: number;
  sessionDir: string;
  startedAtMs: number;
  updatedAtMs: number;
  estimatedTotalMs: number;
  estimatedRemainingMs: number;
}

interface WilyTraderDesktopAppInfo {
  name: string;
  version: string;
}

type WilyTraderDesktopRuntimeApi = typeof window.wilyTraderDesktop & Partial<{
  checkDependencies: (payload: { geminiCliCommand?: string }) => Promise<{
    whisper: { ok: boolean; message: string; exePath?: string; modelPath?: string };
    node: { ok: boolean; message: string; version?: string; optional?: boolean };
    geminiCli: { ok: boolean; message: string; version?: string; command?: string };
  }>;
  chooseOutputFolder: (payload: { currentPath?: string }) => Promise<{ ok: boolean; path: string | null; message: string }>;
  geminiCliSigninStatus: () => Promise<{ signedIn: boolean; subject?: string | null }>;
  geminiCliSignin: (payload: { command?: string }) => Promise<{ ok: boolean; message: string; subject?: string }>;
  logDebug: (scope: string, message: string, details?: unknown) => Promise<{ ok: true }>;
  openActiveSessionFolder: () => Promise<{ ok: boolean; message: string; path?: string | null }>;
  copyActiveSessionFolderLink: () => Promise<{ ok: boolean; message: string; path?: string | null }>;
  copyLastCompletedSessionFolderLink: () => Promise<{ ok: boolean; message: string; path?: string | null }>;
  syncMasterTradingLog: () => Promise<{
    ok: boolean;
    message: string;
    masterPath: string | null;
    syncScriptsDir: string;
    processedFolders: number;
    rowsAppended: number;
    rowsBackfilled: number;
    backfilledArchivedFolders: number;
  }>;
  openLatestExtensionRelease: () => Promise<{ ok: boolean; message: string; url?: string }>;
  downloadLatestExtensionRelease: () => Promise<{ ok: boolean; message: string; url?: string }>;
  updateLatestExtensionFiles: () => Promise<{
    ok: boolean;
    message: string;
    version: string | null;
    repoPath: string | null;
    extensionPath: string | null;
    releaseUrl?: string | null;
  }>;
  checkDesktopUpdates: () => Promise<WilyTraderDesktopStatus>;
  openLatestDesktopRelease: () => Promise<{ ok: boolean; message: string; url?: string }>;
  downloadLatestDesktopRelease: () => Promise<{ ok: boolean; message: string; url?: string }>;
  installLatestDesktopRelease: () => Promise<{ ok: boolean; message: string; installerPath?: string; releaseUrl?: string | null }>;
  onDesktopUpdateProgress: (callback: (progress: DesktopUpdateProgress) => void) => () => void;
}>;

const startButton = document.querySelector<HTMLButtonElement>('[data-action="start"]');
const stopButton = document.querySelector<HTMLButtonElement>('[data-action="stop"]');
const discardButton = document.querySelector<HTMLButtonElement>('[data-action="discard"]');
const openActiveSessionFolderButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action="open-active-session-folder"]'));
const copyActiveSessionFolderButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action="copy-active-session-folder-link"]'));
const openSessionFolderButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action="open-session-folder"]'));
const copySessionFolderButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action="copy-session-folder-link"]'));
const syncMasterButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action="sync-master-trading-log"]'));
const settingsButton = document.querySelector<HTMLButtonElement>('[data-action="settings"]');
const settingsSaveButton = document.querySelector<HTMLButtonElement>('[data-action="settings-save"]');
const updateCheckButton = document.querySelector<HTMLButtonElement>('[data-action="check-extension-update"]');
const statusEl = document.querySelector<HTMLElement>('[data-status]');
const finalizationProgressEl = document.querySelector<HTMLElement>('[data-finalization-progress]');
const finalizationPhaseEl = document.querySelector<HTMLElement>('[data-finalization-phase]');
const finalizationEtaEl = document.querySelector<HTMLElement>('[data-finalization-eta]');
const finalizationTrackEl = document.querySelector<HTMLElement>('[data-finalization-track]');
const finalizationBarEl = document.querySelector<HTMLElement>('[data-finalization-bar]');
const sessionDirEl = document.querySelector<HTMLElement>('[data-session-dir]');
const lastCompletedSessionEl = document.querySelector<HTMLElement>('[data-last-completed-session]');
const lastCompletedDirEl = document.querySelector<HTMLElement>('[data-last-completed-dir]');
const bridgeEl = document.querySelector<HTMLElement>('[data-bridge]');
const countsEl = document.querySelector<HTMLElement>('[data-counts]');
const extensionVersionEl = document.querySelector<HTMLElement>('[data-extension-version]');
const extensionUpdateEl = document.querySelector<HTMLElement>('[data-extension-update]');
const extensionGuidanceEl = document.querySelector<HTMLElement>('[data-extension-guidance]');
const extensionUpdateActionsEl = document.querySelector<HTMLElement>('[data-extension-update-actions]');
const extensionDownloadUpdateButton = document.querySelector<HTMLButtonElement>('[data-action="download-extension-update"]');
const desktopVersionEl = document.querySelector<HTMLElement>('[data-desktop-version]');
const desktopUpdateEl = document.querySelector<HTMLElement>('[data-desktop-update]');
const desktopGuidanceEl = document.querySelector<HTMLElement>('[data-desktop-guidance]');
const desktopUpdateActionsEl = document.querySelector<HTMLElement>('[data-desktop-update-actions]');
const desktopUpdateProgressEl = document.querySelector<HTMLElement>('[data-desktop-update-progress]');
const desktopUpdateProgressLabelEl = document.querySelector<HTMLElement>('[data-desktop-update-progress-label]');
const desktopUpdateProgressSizeEl = document.querySelector<HTMLElement>('[data-desktop-update-progress-size]');
const desktopUpdateProgressFillEl = document.querySelector<HTMLElement>('[data-desktop-update-progress-fill]');
const extensionPathEl = document.querySelector<HTMLElement>('[data-extension-path]');
const settingsExtensionVersionEl = document.querySelector<HTMLElement>('[data-settings-extension-version]');
const dependencyStatusEl = document.querySelector<HTMLElement>('[data-dependency-status]');
const geminiSigninStatusEl = document.querySelector<HTMLElement>('[data-gemini-signin-status]');
const settingsMessageEl = document.querySelector<HTMLElement>('[data-settings-message]');
const settingsModal = document.querySelector<HTMLElement>('[data-settings-modal]');
const appVersionEls = Array.from(document.querySelectorAll<HTMLElement>('[data-app-version]'));

debugLog('renderer', 'renderer loaded', {
  hasRuntimeApi: Boolean(window.wilyTraderDesktop),
  actions: Array.from(document.querySelectorAll<HTMLElement>('[data-action]')).map((item) => item.dataset.action),
});

window.addEventListener('error', (event) => {
  debugLog('renderer', 'window error', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error instanceof Error ? { name: event.error.name, message: event.error.message, stack: event.error.stack } : String(event.error),
  });
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  debugLog('renderer', 'unhandled rejection', reason instanceof Error
    ? { name: reason.name, message: reason.message, stack: reason.stack }
    : { reason: String(reason) });
});

startButton?.addEventListener('click', () => void startAudioFirstSession().catch(showError));
stopButton?.addEventListener('click', () => void stopAudioFirstSession().catch(showError));
discardButton?.addEventListener('click', () => void discardAudioFirstSession().catch(showError));
for (const button of openActiveSessionFolderButtons) {
  button.addEventListener('click', () => void openActiveSessionFolder().catch(showError));
}
for (const button of copyActiveSessionFolderButtons) {
  button.addEventListener('click', () => void copyActiveSessionFolderLink().catch(showError));
}
for (const button of openSessionFolderButtons) {
  button.addEventListener('click', () => void openLastCompletedSessionFolder().catch(showError));
}
for (const button of copySessionFolderButtons) {
  button.addEventListener('click', () => void copyLastCompletedSessionFolderLink().catch(showError));
}
for (const button of syncMasterButtons) {
  button.addEventListener('click', () => void syncMasterTradingLog().catch(showError));
}
settingsButton?.addEventListener('click', () => void openSettings());
for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action="settings-close"]'))) {
  button.addEventListener('click', () => closeSettings());
}
settingsSaveButton?.addEventListener('click', () => void saveSettingsFromForm());
updateCheckButton?.addEventListener('click', () => void checkExtensionUpdates());
settingsModal?.addEventListener('click', (event) => {
  if (event.target === settingsModal) closeSettings();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !settingsModal?.hasAttribute('hidden')) closeSettings();
});

bindAction('check-dependencies', () => void refreshDependencyStatus());
bindAction('choose-output-folder', () => void chooseOutputFolder());
bindAction('install-whisper', () => void runInstaller('Installing Whisper...', () => window.wilyTraderDesktop.installWhisper()));
bindAction('install-gemini-cli', () => void runInstaller('Installing Gemini CLI...', () => window.wilyTraderDesktop.installGeminiCli()));
bindAction('install-node', () => void runInstaller('Installing Node.js LTS...', () => window.wilyTraderDesktop.installNode()));
bindAction('fetch-openrouter-models', () => void fetchOpenrouterModels());
bindAction('fetch-gemini-models', () => void fetchGeminiModels());
bindAction('test-llm-connection', () => void testLlmConnection());
bindAction('toggle-openrouter-key', toggleOpenRouterKey);
bindAction('gemini-signin', () => void signInGemini());
bindAction('gemini-signout', () => void signOutGemini());
bindAction('gemini-signin-cancel', () => void cancelGeminiSignin());
bindAction('open-extension-folder', () => void openExtensionFolder());
bindAction('move-extension-location', () => void moveExtensionLocation());
bindAction('open-extension-release', () => void openLatestExtensionRelease());
bindAction('download-extension-update', () => void updateLatestExtensionFiles());
bindAction('check-desktop-update', () => void checkDesktopUpdates());
bindAction('open-desktop-release', () => void openLatestDesktopRelease());
bindAction('download-desktop-update', () => void installLatestDesktopRelease());
for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action="open-chrome-extensions"]'))) {
  debugLog('renderer', 'binding action', { action: 'open-chrome-extensions', found: true });
  button.addEventListener('click', (event) => {
    event.preventDefault();
    debugLog('renderer', 'action clicked', { action: 'open-chrome-extensions', disabled: button.disabled });
    void openChromeExtensions();
  });
}

getInput('openRouterModelFilter')?.addEventListener('input', renderOpenrouterModelOptions);
getCheckedInput('openRouterFreeOnly')?.addEventListener('change', renderOpenrouterModelOptions);
getInput('openRouterMaxCost')?.addEventListener('input', renderOpenrouterModelOptions);
getSelect('openRouterModels')?.addEventListener('change', () => {
  const chosen = getSelect('openRouterModels')?.value ?? '';
  if (!chosen) return;
  setInputValue('openRouterModel', chosen);
});
getInput('geminiCliModelFilter')?.addEventListener('input', renderGeminiModelOptions);
getSelect('geminiCliModels')?.addEventListener('change', () => {
  const chosen = getSelect('geminiCliModels')?.value ?? '';
  if (!chosen) return;
  setInputValue('geminiCliModel', chosen);
});

window.wilyTraderDesktop.onStatus(renderStatus);
if (typeof (window.wilyTraderDesktop as WilyTraderDesktopRuntimeApi).onDesktopUpdateProgress === 'function') {
  (window.wilyTraderDesktop as WilyTraderDesktopRuntimeApi).onDesktopUpdateProgress(showDesktopUpdateProgress);
}
window.wilyTraderDesktop.onToggleSessionHotkey(() => {
  if (stopping || discarding) return;
  if (sessionStartedAtMs || mediaRecorder) void stopAudioFirstSession().catch(showError);
  else void startAudioFirstSession().catch(showError);
});

void window.wilyTraderDesktop.getSettings().then((settings) => {
  currentSettings = settings;
  populateSettings(settings);
}).catch(showError);
void window.wilyTraderDesktop.getAppInfo().then(renderAppInfo).catch(showError);
void window.wilyTraderDesktop.getStatus()
  .then((status) => {
    renderStatus(status);
    void refreshUpdateStatusOnRendererLoad();
  })
  .catch(showError);

function renderAppInfo(info: WilyTraderDesktopAppInfo): void {
  for (const element of appVersionEls) {
    element.textContent = `v${info.version}`;
    element.title = `${info.name} ${info.version}`;
  }
}

async function startAudioFirstSession(): Promise<void> {
  try {
    setUiBusy(true, 'Starting WilyTrader recording session...');
    const session = await window.wilyTraderDesktop.startSession();
    sessionStartedAtMs = session.sessionStartedAtMs;
    currentSettings = session.settings;
    stopping = false;
    discarding = false;
    audioRecordingBlobs = [];

    if (session.settings.microphoneCaptureEnabled) {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
      mediaRecorder = new MediaRecorder(mediaStream, { mimeType });
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioRecordingBlobs.push(event.data);
      };
      mediaRecorder.onstop = () => void finalizeRecorderStop().catch(showError);
      mediaRecorder.start();
      startRollingAudioChunks();
    }

    renderStatus(session);
    setUiBusy(false, session.settings.microphoneCaptureEnabled ? 'Recording microphone audio.' : 'Recording session running.');
  } catch (error) {
    stopRollingAudioChunksSync();
    sessionStartedAtMs = null;
    stopping = false;
    discarding = false;
    throw error;
  }
}

async function stopAudioFirstSession(): Promise<void> {
  if (stopping || discarding) return;
  stopping = true;
  setUiBusy(true, 'Stopping session...');
  showLocalFinalizationProgress('Stopping recording.', 3);
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.requestData();
    mediaRecorder.stop();
    return;
  }
  await finalizeRecorderStop();
}

async function discardAudioFirstSession(): Promise<void> {
  if (stopping || discarding) return;
  if (!sessionStartedAtMs && !mediaRecorder && !latestStatus?.active) {
    const status = await window.wilyTraderDesktop.getStatus();
    renderStatus(status);
    if (!status.active) return;
  }
  if (!window.confirm('Discard this recording session? This stops recording and permanently deletes the active session folder instead of saving audio, transcript, or trade-log artifacts.')) return;

  discarding = true;
  setUiBusy(true, 'Discarding session...');
  hideFinalizationProgress();
  try {
    await stopRollingAudioChunks(false);
    await stopMediaRecorderForDiscard();
    stopMediaStream();
    audioRecordingBlobs = [];
    mediaRecorder = null;
    const result = await window.wilyTraderDesktop.abandonSession();
    sessionStartedAtMs = null;
    renderStatus(await window.wilyTraderDesktop.getStatus());
    setUiBusy(false, result.deleted ? 'Session discarded.' : result.warning ?? `Session abandoned: ${result.sessionDir}`);
  } finally {
    discarding = false;
  }
}

function stopMediaRecorderForDiscard(): Promise<void> {
  const recorder = mediaRecorder;
  if (!recorder || recorder.state === 'inactive') return Promise.resolve();
  return new Promise((resolve) => {
    recorder.onstop = () => resolve();
    try {
      recorder.stop();
    } catch {
      resolve();
    }
  });
}

function startRollingAudioChunks(): void {
  if (!mediaStream || !sessionStartedAtMs) return;
  const audioTrack = mediaStream.getAudioTracks()[0];
  if (!audioTrack) return;
  stopRollingAudioChunksSync();
  audioChunkStream = new MediaStream([audioTrack.clone()]);
  rollingAudioChunksActive = true;
  audioChunkIndex = 0;
  startNextAudioChunk();
}

function startNextAudioChunk(): void {
  if (!rollingAudioChunksActive || !audioChunkStream) return;
  audioChunkBlobs = [];
  audioChunkIndex += 1;
  audioChunkStartedAtMs = Date.now();
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm';
  try {
    audioChunkRecorder = new MediaRecorder(audioChunkStream, { mimeType });
  } catch (err) {
    debugLog('renderer', 'incremental audio recorder construction failed', errorDetails(err));
    rollingAudioChunksActive = false;
    return;
  }

  const index = audioChunkIndex;
  audioChunkRecorder.ondataavailable = (event) => {
    if (event.data.size > 0) audioChunkBlobs.push(event.data);
  };
  audioChunkRecorder.onstop = async () => {
    const final = audioChunkStopFinal;
    const resolve = audioChunkStopResolve;
    audioChunkStopFinal = false;
    audioChunkStopResolve = null;
    clearAudioChunkTimer();
    const endedAtMs = Math.max(audioChunkStartedAtMs + 1, Date.now());
    const blob = new Blob(audioChunkBlobs, { type: mimeType });
    audioChunkBlobs = [];
    if (blob.size > 0) {
      try {
        await window.wilyTraderDesktop.saveAudioChunk({
          buffer: await blob.arrayBuffer(),
          index,
          startedAtMs: audioChunkStartedAtMs,
          endedAtMs,
          mimeType,
          final,
        });
      } catch (err) {
        debugLog('renderer', 'incremental audio chunk send failed', {
          index,
          error: errorDetails(err),
        });
      }
    }
    audioChunkRecorder = null;
    if (!final && rollingAudioChunksActive && mediaRecorder && mediaRecorder.state !== 'inactive') {
      startNextAudioChunk();
    }
    resolve?.();
  };
  audioChunkRecorder.onerror = (event) => {
    debugLog('renderer', 'incremental audio recorder error', {
      index,
      error: String((event as ErrorEvent).message ?? event.type),
    });
  };
  audioChunkRecorder.start();
  audioChunkTimer = window.setTimeout(() => {
    void stopCurrentAudioChunk(false);
  }, INCREMENTAL_AUDIO_CHUNK_MS);
}

function clearAudioChunkTimer(): void {
  if (audioChunkTimer !== null) {
    window.clearTimeout(audioChunkTimer);
    audioChunkTimer = null;
  }
}

function stopCurrentAudioChunk(final: boolean): Promise<void> {
  clearAudioChunkTimer();
  if (audioChunkStopResolve) {
    if (final) audioChunkStopFinal = true;
    return new Promise((resolve) => {
      const previousResolve = audioChunkStopResolve;
      audioChunkStopResolve = () => {
        previousResolve?.();
        resolve();
      };
    });
  }
  const recorder = audioChunkRecorder;
  if (!recorder || recorder.state === 'inactive') return Promise.resolve();
  return new Promise((resolve) => {
    audioChunkStopResolve = resolve;
    audioChunkStopFinal = final;
    try {
      recorder.stop();
    } catch {
      audioChunkStopResolve = null;
      audioChunkStopFinal = false;
      resolve();
    }
  });
}

async function stopRollingAudioChunks(final: boolean): Promise<void> {
  rollingAudioChunksActive = false;
  await stopCurrentAudioChunk(final);
  stopRollingAudioChunksSync();
}

function stopRollingAudioChunksSync(): void {
  clearAudioChunkTimer();
  rollingAudioChunksActive = false;
  if (audioChunkRecorder && audioChunkRecorder.state !== 'inactive') {
    try { audioChunkRecorder.stop(); } catch { /* ignore */ }
  }
  audioChunkRecorder = null;
  audioChunkBlobs = [];
  if (audioChunkStream) {
    for (const track of audioChunkStream.getTracks()) track.stop();
    audioChunkStream = null;
  }
  audioChunkStopResolve = null;
  audioChunkStopFinal = false;
}

async function finalizeRecorderStop(): Promise<void> {
  await stopRollingAudioChunks(true);
  if (audioRecordingBlobs.length > 0 && sessionStartedAtMs !== null) {
    showLocalFinalizationProgress('Saving session audio.', 6);
    const fullAudio = new Blob(audioRecordingBlobs, { type: audioRecordingBlobs[0]?.type || 'audio/webm' });
    await window.wilyTraderDesktop.saveAudioRecording({
      buffer: await fullAudio.arrayBuffer(),
      startedAtMs: sessionStartedAtMs,
      endedAtMs: Date.now(),
      mimeType: fullAudio.type || null,
    });
  }
  audioRecordingBlobs = [];
  if (mediaStream) {
    stopMediaStream();
  }
  mediaRecorder = null;
  showLocalFinalizationProgress('Processing transcript and trade logs.', 10);
  const result = await window.wilyTraderDesktop.stopSession();
  sessionStartedAtMs = null;
  stopping = false;
  renderStatus(await window.wilyTraderDesktop.getStatus());
  showLocalFinalizationProgress('Session complete.', 100, 0);
  setUiBusy(false, `Session complete: ${result.sessionDir}`);
}

function stopMediaStream(): void {
  if (!mediaStream) return;
  for (const track of mediaStream.getTracks()) track.stop();
  mediaStream = null;
}

function renderStatus(status: WilyTraderDesktopStatus): void {
  latestStatus = status;
  currentSettings = status.settings;
  const finalizing = status.sessionState === 'finalizing' && status.finalization !== null;
  if (startButton) startButton.disabled = status.active || stopping || discarding || finalizing;
  if (stopButton) {
    stopButton.disabled = !status.active || stopping || discarding || finalizing;
    stopButton.textContent = stopping || finalizing ? 'Processing...' : 'Stop';
  }
  if (discardButton) {
    discardButton.disabled = !status.active || stopping || discarding || finalizing;
    discardButton.textContent = discarding ? 'Discarding...' : 'Discard';
  }
  if (statusEl) {
    statusEl.textContent = status.active
      ? `Recording ${formatElapsed(status.elapsedMs)}`
      : finalizing
        ? status.finalization?.message ?? 'Processing session.'
        : 'Idle';
  }
  if (sessionDirEl) sessionDirEl.textContent = status.sessionDir ?? 'No active session';
  const hasActiveSession = Boolean(status.sessionDir);
  for (const button of openActiveSessionFolderButtons) {
    button.hidden = !hasActiveSession;
    button.disabled = !hasActiveSession;
  }
  for (const button of copyActiveSessionFolderButtons) {
    button.hidden = !hasActiveSession;
    button.disabled = !hasActiveSession;
  }
  const hasLastCompletedSession = Boolean(status.lastCompletedSessionDir);
  if (lastCompletedSessionEl) lastCompletedSessionEl.toggleAttribute('hidden', !hasLastCompletedSession);
  if (lastCompletedDirEl) lastCompletedDirEl.textContent = status.lastCompletedSessionDir ?? 'No completed session yet';
  for (const button of openSessionFolderButtons) {
    button.hidden = !hasLastCompletedSession;
    button.disabled = !hasLastCompletedSession;
  }
  for (const button of copySessionFolderButtons) {
    button.hidden = !hasLastCompletedSession;
    button.disabled = !hasLastCompletedSession;
  }
  for (const button of syncMasterButtons) {
    button.hidden = !hasLastCompletedSession;
    button.disabled = !hasLastCompletedSession || status.active || finalizing || stopping || discarding;
  }
  if (bridgeEl) bridgeEl.textContent = `Bridge: http://127.0.0.1:${status.bridgePort}/v1/wilytrader/ledger`;
  if (countsEl) {
    countsEl.textContent =
      `${finalizing ? 'Finalizing transcript and trade log' : status.active ? 'Recording audio file' : 'Audio file saved on stop'}, ${status.executionsReceived} bridge events, ${status.screenshotsReceived} screenshots`;
  }
  if (finalizing && status.finalization) showFinalizationProgress(status.finalization);
  else if (!stopping && !discarding) hideFinalizationProgress();
  const extensionVersionSummary = formatExtensionVersionSummary(status.extension);
  if (extensionVersionEl) extensionVersionEl.textContent = extensionVersionSummary;
  if (settingsExtensionVersionEl) settingsExtensionVersionEl.textContent = extensionVersionSummary;
  if (extensionUpdateEl) {
    const tradingTarget = formatExtensionTradingTarget(status.extension);
    extensionUpdateEl.textContent = tradingTarget
      ? `${status.extension.updateMessage} Trading ${tradingTarget}.`
      : status.extension.updateMessage;
  }
  renderDesktopUpdateStatus(status.desktopUpdate);
  renderExtensionUpdateGuidance(status.extension);
  const extensionPath = status.extension.localExtensionPath ?? 'No local manifest path detected';
  if (extensionPathEl) extensionPathEl.textContent = extensionPath;
  const extensionFolderButton = document.querySelector<HTMLButtonElement>('[data-action="open-extension-folder"]');
  if (extensionFolderButton) extensionFolderButton.textContent = extensionPath;
  populateSettings(status.settings);
}

function renderDesktopUpdateStatus(update: WilyTraderDesktopStatus['desktopUpdate']): void {
  const installed = update.installedVersion || 'unknown';
  if (desktopVersionEl) desktopVersionEl.textContent = `Installed: ${installed}`;
  if (desktopUpdateEl) {
    desktopUpdateEl.hidden = desktopUpdateInstalling;
    if (!desktopUpdateInstalling) desktopUpdateEl.textContent = update.updateMessage;
  }

  if (desktopGuidanceEl) {
    desktopGuidanceEl.hidden = desktopUpdateInstalling || !update.updateAvailable;
    desktopGuidanceEl.textContent = update.updateAvailable && update.latestVersion
        ? `WilyTrader checks automatically at startup. Install Update downloads WilyTrader ${update.latestVersion}, starts the installer, and closes this app.`
        : '';
  }
  if (desktopUpdateActionsEl) desktopUpdateActionsEl.hidden = !update.updateAvailable && !desktopUpdateInstalling;
  setDesktopUpdateButtonsDisabled(desktopUpdateInstalling);
}

function formatExtensionVersionSummary(extension: {
  runtimeInstalledVersion: string | null;
  localManifestVersion: string | null;
  runtimeLastSeenAt: string | null;
}): string {
  const runtime = extension.runtimeInstalledVersion;
  const local = extension.localManifestVersion;
  const heartbeat = extension.runtimeLastSeenAt ? `, last seen ${new Date(extension.runtimeLastSeenAt).toLocaleTimeString()}` : '';
  if (runtime && local && runtime !== local) {
    return `Running tab: ${runtime}${heartbeat}; local files: ${local}`;
  }
  if (runtime) return `Running tab: ${runtime}${heartbeat}`;
  if (local) return `Local files: ${local}`;
  return 'Not detected';
}

function formatExtensionTradingTarget(extension: {
  runtimePageUrl: string | null;
  runtimeTokenName: string | null;
  runtimeTokenAddress: string | null;
  runtimeTokenChain: string | null;
}): string | null {
  if (extension.runtimeTokenName) return extension.runtimeTokenName;
  if (extension.runtimeTokenAddress) {
    return extension.runtimeTokenChain
      ? `${extension.runtimeTokenChain} ${shortenMiddle(extension.runtimeTokenAddress)}`
      : shortenMiddle(extension.runtimeTokenAddress);
  }
  return extension.runtimePageUrl;
}

function shortenMiddle(value: string, left = 6, right = 4): string {
  if (value.length <= left + right + 3) return value;
  return `${value.slice(0, left)}...${value.slice(-right)}`;
}

function setUiBusy(busy: boolean, message: string): void {
  if (startButton) startButton.disabled = busy || Boolean(sessionStartedAtMs);
  if (stopButton) {
    stopButton.disabled = busy || !sessionStartedAtMs || discarding;
    stopButton.textContent = busy && stopping ? 'Processing...' : 'Stop';
  }
  if (discardButton) {
    discardButton.disabled = busy || !sessionStartedAtMs || stopping;
    discardButton.textContent = busy && discarding ? 'Discarding...' : 'Discard';
  }
  if (statusEl) statusEl.textContent = message;
}

function renderExtensionUpdateGuidance(extension: {
  runtimeInstalledVersion: string | null;
  localManifestVersion: string | null;
  localExtensionPath: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
}): void {
  const latest = extension.latestVersion;
  const runtime = extension.runtimeInstalledVersion;
  const local = extension.localManifestVersion;
  const localPath = extension.localExtensionPath;
  const localAlreadyUpdated = Boolean(runtime && local && latest && compareVersions(runtime, latest) < 0 && compareVersions(local, latest) >= 0);
  const needsFiles = Boolean(latest && (!local || compareVersions(local, latest) < 0));
  const shouldShow = Boolean(extension.updateAvailable || localAlreadyUpdated || needsFiles);

  if (extensionGuidanceEl) {
    extensionGuidanceEl.hidden = !shouldShow;
    extensionGuidanceEl.textContent = !shouldShow
      ? ''
      : localAlreadyUpdated
        ? `Local extension files are already ${local}. Open Chrome Extensions, find WilyTrader, then press Reload. No download is needed.`
        : needsFiles
          ? `Update Extension Files installs the WilyTrader ${latest} unpacked-extension files, opens Chrome Extensions, and copies the Load unpacked path. Press Reload on WilyTrader after it finishes.`
          : `Open Chrome Extensions, find WilyTrader, then press Reload. The local folder is already updated.`;
  }
  if (extensionUpdateActionsEl) extensionUpdateActionsEl.hidden = !shouldShow;
  if (extensionDownloadUpdateButton) extensionDownloadUpdateButton.hidden = !needsFiles;
  if (extensionPathEl) {
    extensionPathEl.title = localPath && needsFiles
      ? 'Replace this folder with the downloaded extension files, then reload WilyTrader in Chrome.'
      : '';
  }
}

function compareVersions(current: string | null, latest: string | null): number {
  const left = String(current || '').split('.').map((part) => Number(part) || 0);
  const right = String(latest || '').split('.').map((part) => Number(part) || 0);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const delta = (left[index] || 0) - (right[index] || 0);
    if (delta !== 0) return delta;
  }
  return 0;
}

function showLocalFinalizationProgress(message: string, percent: number, estimatedRemainingMs: number | null = null): void {
  const now = Date.now();
  showFinalizationProgress({
    phase: 'local',
    message,
    percent,
    sessionDir: '',
    startedAtMs: now,
    updatedAtMs: now,
    estimatedTotalMs: 0,
    estimatedRemainingMs: estimatedRemainingMs ?? 0,
  }, estimatedRemainingMs === null);
}

function showFinalizationProgress(progress: WilyTraderSessionFinalization, hideEta = false): void {
  latestFinalization = progress;
  finalizationProgressEl?.removeAttribute('hidden');
  if (finalizationPhaseEl) finalizationPhaseEl.textContent = progress.message;
  if (finalizationBarEl) finalizationBarEl.style.width = `${Math.max(0, Math.min(100, progress.percent))}%`;
  if (finalizationTrackEl) finalizationTrackEl.setAttribute('aria-valuenow', String(Math.max(0, Math.min(100, progress.percent))));
  if (finalizationEtaEl) {
    finalizationEtaEl.textContent = hideEta || progress.percent >= 100
      ? ''
      : `~${formatDuration(progress.estimatedRemainingMs)} left`;
  }
  if (!hideEta && progress.percent < 100) startFinalizationTimer();
  else stopFinalizationTimer();
}

function hideFinalizationProgress(): void {
  latestFinalization = null;
  stopFinalizationTimer();
  finalizationProgressEl?.setAttribute('hidden', 'true');
  if (finalizationBarEl) finalizationBarEl.style.width = '0%';
}

function startFinalizationTimer(): void {
  if (finalizationTimer !== null) return;
  finalizationTimer = window.setInterval(() => {
    if (!latestFinalization || latestFinalization.percent >= 100) {
      stopFinalizationTimer();
      return;
    }
    const elapsedMs = Date.now() - latestFinalization.startedAtMs;
    const remainingMs = Math.max(0, latestFinalization.estimatedTotalMs - elapsedMs);
    if (finalizationEtaEl) finalizationEtaEl.textContent = `~${formatDuration(remainingMs)} left`;
    if (finalizationBarEl && latestFinalization.estimatedTotalMs > 0) {
      const timePercent = Math.min(94, Math.round((elapsedMs / latestFinalization.estimatedTotalMs) * 100));
      finalizationBarEl.style.width = `${Math.max(latestFinalization.percent, timePercent)}%`;
    }
  }, 1000);
}

function stopFinalizationTimer(): void {
  if (finalizationTimer === null) return;
  window.clearInterval(finalizationTimer);
  finalizationTimer = null;
}

async function openSettings(): Promise<void> {
  if (currentSettings) populateSettings(currentSettings);
  settingsModal?.removeAttribute('hidden');
  settingsModal?.querySelector<HTMLElement>('.settings-scroll')?.scrollTo({ top: 0 });
  await refreshGeminiSigninStatus();
  await refreshDependencyStatus();
}

function closeSettings(): void {
  settingsModal?.setAttribute('hidden', 'true');
}

function populateSettings(settings: WilyTraderDesktopSettings): void {
  setInputValue('outputDir', settings.outputDir);
  setInputValue('tradeSessionHotkey', settings.tradeSessionHotkey);
  setChecked('microphoneCaptureEnabled', settings.microphoneCaptureEnabled);
  setChecked('saveBrowserScreenshots', settings.saveBrowserScreenshots);
  setChecked('generateTradeLogOnStop', settings.generateTradeLogOnStop);
  setChecked('autoSyncMasterTradingLogAfterStop', settings.autoSyncMasterTradingLogAfterStop);
  setInputValue('masterTradingLogPath', settings.masterTradingLogPath);
  setChecked('autoCheckExtensionUpdates', settings.autoCheckExtensionUpdates);
  setSelectValue('llmMode', settings.llmMode);
  setInputValue('geminiCliCommand', settings.geminiCliCommand);
  setInputValue('geminiCliModel', settings.geminiCliModel);
  setInputValue('openRouterApiKey', settings.openRouterApiKey);
  setInputValue('openRouterBaseUrl', settings.openRouterBaseUrl);
  setInputValue('openRouterModel', settings.openRouterModel);
}

async function saveSettingsFromForm(): Promise<void> {
  const next = await window.wilyTraderDesktop.saveSettings({
    outputDir: getInputValue('outputDir'),
    tradeSessionHotkey: getInputValue('tradeSessionHotkey'),
    microphoneCaptureEnabled: getChecked('microphoneCaptureEnabled'),
    saveBrowserScreenshots: getChecked('saveBrowserScreenshots'),
    generateTradeLogOnStop: getChecked('generateTradeLogOnStop'),
    autoSyncMasterTradingLogAfterStop: getChecked('autoSyncMasterTradingLogAfterStop'),
    masterTradingLogPath: getInputValue('masterTradingLogPath'),
    autoCheckExtensionUpdates: getChecked('autoCheckExtensionUpdates'),
    llmMode: getSelectValue('llmMode') === 'api' ? 'api' : 'gemini-cli',
    geminiCliCommand: getInputValue('geminiCliCommand'),
    geminiCliModel: getInputValue('geminiCliModel'),
    openRouterApiKey: getInputValue('openRouterApiKey'),
    openRouterBaseUrl: getInputValue('openRouterBaseUrl'),
    openRouterModel: getInputValue('openRouterModel'),
  });
  currentSettings = next;
  closeSettings();
}

async function chooseOutputFolder(): Promise<void> {
  setSettingsMessage('');
  const result = await window.wilyTraderDesktop.chooseOutputFolder({
    currentPath: getInputValue('outputDir'),
  });
  if (!result.ok || !result.path) {
    setSettingsMessage(result.message);
    return;
  }

  setInputValue('outputDir', result.path, true);
  setSettingsMessage('Session output folder selected. Save settings to apply it.');
}

async function checkExtensionUpdates(): Promise<void> {
  setUiBusy(false, 'Checking WilyTrader extension update status...');
  renderStatus(await window.wilyTraderDesktop.checkExtensionUpdates());
}

async function checkDesktopUpdates(): Promise<void> {
  setUiBusy(false, 'Checking WilyTrader update status...');
  const api = window.wilyTraderDesktop as WilyTraderDesktopRuntimeApi;
  if (typeof api.checkDesktopUpdates !== 'function') {
    throw new Error('Desktop update checks are unavailable in this running app. Restart WilyTrader.');
  }
  renderStatus(await api.checkDesktopUpdates());
}

async function refreshUpdateStatusOnRendererLoad(): Promise<void> {
  try {
    const api = window.wilyTraderDesktop as WilyTraderDesktopRuntimeApi;
    if (typeof api.checkDesktopUpdates === 'function') {
      renderStatus(await api.checkDesktopUpdates());
    }
    renderStatus(await window.wilyTraderDesktop.checkExtensionUpdates());
  } catch (err) {
    debugLog('renderer', 'startup update refresh failed', errorDetails(err));
  }
}

async function refreshDependencyStatus(): Promise<void> {
  if (dependencyStatusEl) dependencyStatusEl.textContent = 'Checking dependencies...';
  try {
    const api = window.wilyTraderDesktop as WilyTraderDesktopRuntimeApi;
    debugLog('renderer', 'refreshDependencyStatus started', {
      hasApi: Boolean(api),
      hasCheckDependencies: typeof api.checkDependencies === 'function',
      geminiCliCommand: getInputValue('geminiCliCommand') || 'gemini',
    });
    if (typeof api.checkDependencies !== 'function') {
      throw new Error('Dependency checker is unavailable in the running app. Restart WilyTrader so the updated preload API is loaded.');
    }
    const result = await api.checkDependencies({ geminiCliCommand: getInputValue('geminiCliCommand') || 'gemini' });
    debugLog('renderer', 'refreshDependencyStatus completed', result);
    setDependencyStatus([
      formatDependency('Whisper', result.whisper),
      formatDependency('Node/npm', result.node),
      formatDependency('Gemini CLI', result.geminiCli),
    ].join('\n'));
  } catch (err) {
    debugLog('renderer', 'refreshDependencyStatus failed', errorDetails(err));
    setDependencyStatus(`Dependency check failed: ${(err as Error).message}`);
  }
}

async function runInstaller(
  pendingMessage: string,
  action: () => Promise<{ ok: boolean; message: string }>
): Promise<void> {
  setSettingsMessage(pendingMessage);
  const result = await action();
  setSettingsMessage(result.message, !result.ok);
  await refreshDependencyStatus();
}

async function fetchOpenrouterModels(): Promise<void> {
  setSettingsMessage('Fetching OpenRouter models...');
  try {
    fetchedOpenrouterModels = await window.wilyTraderDesktop.listOpenRouterModels();
    renderOpenrouterModelOptions();
    setSettingsMessage(`Fetched ${fetchedOpenrouterModels.length} OpenRouter models.`);
  } catch (err) {
    setSettingsMessage(`Failed to fetch OpenRouter models: ${(err as Error).message}`, true);
  }
}

async function fetchGeminiModels(): Promise<void> {
  setSettingsMessage('Loading Gemini CLI model list...');
  try {
    fetchedGeminiCliModels = await window.wilyTraderDesktop.listGeminiCliModels();
    renderGeminiModelOptions();
    setSettingsMessage(`Loaded ${fetchedGeminiCliModels.length} Gemini CLI models.`);
  } catch (err) {
    setSettingsMessage(`Failed to load Gemini CLI models: ${(err as Error).message}`, true);
  }
}

async function testLlmConnection(): Promise<void> {
  const llmMode = getSelectValue('llmMode') === 'api' ? 'api' : 'gemini-cli';
  setSettingsMessage(llmMode === 'gemini-cli' ? 'Testing Gemini CLI connection...' : 'Testing API connection...');
  try {
    const result = await window.wilyTraderDesktop.testLlmConnection({
      llmMode,
      geminiCliCommand: getInputValue('geminiCliCommand') || 'gemini',
      geminiCliModel: getInputValue('geminiCliModel') || 'gemini-3.1-pro-preview',
      openRouterApiKey: getInputValue('openRouterApiKey'),
      openRouterBaseUrl: getInputValue('openRouterBaseUrl') || 'https://openrouter.ai/api/v1',
      openRouterModel: getInputValue('openRouterModel') || 'google/gemini-2.5-flash',
    });
    setSettingsMessage(result.guidance ? `${result.message} ${result.guidance.installCommand}` : result.message, !result.ok);
  } catch (err) {
    setSettingsMessage(`LLM connection test failed: ${(err as Error).message}`, true);
  }
}

async function refreshGeminiSigninStatus(): Promise<void> {
  if (!geminiSigninStatusEl) return;
  try {
    const api = window.wilyTraderDesktop as WilyTraderDesktopRuntimeApi;
    debugLog('renderer', 'refreshGeminiSigninStatus started', {
      hasStatusApi: typeof api.geminiCliSigninStatus === 'function',
    });
    if (typeof api.geminiCliSigninStatus !== 'function') {
      throw new Error('Gemini sign-in status is unavailable in the running app. Restart WilyTrader so the updated preload API is loaded.');
    }
    const result = await api.geminiCliSigninStatus();
    debugLog('renderer', 'refreshGeminiSigninStatus completed', result);
    geminiSigninStatusEl.textContent = result.signedIn ? `Signed in as ${result.subject ?? 'Google account'}.` : 'Not signed in.';
  } catch (err) {
    debugLog('renderer', 'refreshGeminiSigninStatus failed', errorDetails(err));
    geminiSigninStatusEl.textContent = `Could not check sign-in status: ${(err as Error).message}`;
  }
}

async function signInGemini(): Promise<void> {
  try {
    const api = window.wilyTraderDesktop as WilyTraderDesktopRuntimeApi;
    debugLog('renderer', 'signInGemini started', {
      hasSigninApi: typeof api.geminiCliSignin === 'function',
      hasStatusApi: typeof api.geminiCliSigninStatus === 'function',
      geminiCliCommand: getInputValue('geminiCliCommand') || 'gemini',
    });
    if (typeof api.geminiCliSignin !== 'function' || typeof api.geminiCliSigninStatus !== 'function') {
      setSettingsMessage('Gemini sign-in is unavailable in the running app. Restart WilyTrader so the updated preload API is loaded.', true);
      return;
    }
    const status = await api.geminiCliSigninStatus();
    debugLog('renderer', 'signInGemini current status', status);
    if (status.signedIn) {
      const subject = status.subject ?? 'Google account';
      setSettingsMessage(`Gemini CLI is already signed in as ${subject}.`);
      if (geminiSigninStatusEl) geminiSigninStatusEl.textContent = `Signed in as ${subject}.`;
      return;
    }
    setSettingsMessage('Starting Gemini CLI Google sign-in...');
    const result = await api.geminiCliSignin({ command: getInputValue('geminiCliCommand') || 'gemini' });
    debugLog('renderer', 'signInGemini completed', result);
    setSettingsMessage(result.message, !result.ok);
    await refreshGeminiSigninStatus();
  } catch (err) {
    debugLog('renderer', 'signInGemini failed', errorDetails(err));
    setSettingsMessage(`Gemini sign-in failed: ${(err as Error).message}`, true);
  }
}

async function signOutGemini(): Promise<void> {
  const result = await window.wilyTraderDesktop.geminiCliSignout();
  setSettingsMessage(result.ok ? 'Signed out of Gemini CLI.' : result.message ?? 'Gemini CLI sign-out failed.', !result.ok);
  await refreshGeminiSigninStatus();
}

async function cancelGeminiSignin(): Promise<void> {
  const result = await window.wilyTraderDesktop.geminiCliSigninCancel();
  setSettingsMessage(result.ok ? 'Gemini CLI sign-in canceled.' : result.message ?? 'No active Gemini CLI sign-in.', !result.ok);
  await refreshGeminiSigninStatus();
}

async function openExtensionFolder(): Promise<void> {
  const result = await window.wilyTraderDesktop.openExtensionFolder();
  setSettingsMessage(result.message, !result.ok);
}

async function openActiveSessionFolder(): Promise<void> {
  const result = await window.wilyTraderDesktop.openActiveSessionFolder();
  setSettingsMessage(result.message, !result.ok);
  if (statusEl) statusEl.textContent = result.message;
}

async function copyActiveSessionFolderLink(): Promise<void> {
  const result = await window.wilyTraderDesktop.copyActiveSessionFolderLink();
  setSettingsMessage(result.message, !result.ok);
  if (statusEl) statusEl.textContent = result.message;
}

async function openLastCompletedSessionFolder(): Promise<void> {
  const result = await window.wilyTraderDesktop.openLastCompletedSessionFolder();
  setSettingsMessage(result.message, !result.ok);
  if (statusEl) statusEl.textContent = result.message;
}

async function copyLastCompletedSessionFolderLink(): Promise<void> {
  const result = await window.wilyTraderDesktop.copyLastCompletedSessionFolderLink();
  setSettingsMessage(result.message, !result.ok);
  if (statusEl) statusEl.textContent = result.message;
}

async function syncMasterTradingLog(): Promise<void> {
  const api = window.wilyTraderDesktop as WilyTraderDesktopRuntimeApi;
  if (typeof api.syncMasterTradingLog !== 'function') {
    throw new Error('Master sync is unavailable in this running app. Restart WilyTrader.');
  }
  for (const button of syncMasterButtons) {
    button.disabled = true;
    button.textContent = 'Syncing...';
  }
  setUiBusy(false, 'Syncing master trading log...');
  try {
    const result = await api.syncMasterTradingLog();
    const countText = `processed ${result.processedFolders}, appended ${result.rowsAppended}, updated ${result.rowsBackfilled}`;
    const message = `${result.message} (${countText})`;
    setSettingsMessage(message, !result.ok);
    if (statusEl) statusEl.textContent = message;
  } finally {
    for (const button of syncMasterButtons) {
      button.textContent = 'Sync Master';
    }
    renderStatus(await window.wilyTraderDesktop.getStatus());
  }
}

async function moveExtensionLocation(): Promise<void> {
  const result = await window.wilyTraderDesktop.moveExtensionLocation();
  setSettingsMessage(result.message, !result.ok);
  renderStatus(await window.wilyTraderDesktop.getStatus());
}

async function openChromeExtensions(): Promise<void> {
  const result = await window.wilyTraderDesktop.openChromeExtensions();
  setSettingsMessage(result.message, !result.ok);
}

async function openLatestExtensionRelease(): Promise<void> {
  const api = window.wilyTraderDesktop as WilyTraderDesktopRuntimeApi;
  if (typeof api.openLatestExtensionRelease !== 'function') {
    throw new Error('Release links are unavailable in this running app. Restart WilyTrader.');
  }
  const result = await api.openLatestExtensionRelease();
  setSettingsMessage(result.message, !result.ok);
}

async function downloadLatestExtensionRelease(): Promise<void> {
  const api = window.wilyTraderDesktop as WilyTraderDesktopRuntimeApi;
  if (typeof api.downloadLatestExtensionRelease !== 'function') {
    throw new Error('Download links are unavailable in this running app. Restart WilyTrader.');
  }
  const result = await api.downloadLatestExtensionRelease();
  setSettingsMessage(result.message, !result.ok);
}

async function updateLatestExtensionFiles(): Promise<void> {
  const api = window.wilyTraderDesktop as WilyTraderDesktopRuntimeApi;
  if (typeof api.updateLatestExtensionFiles !== 'function') {
    throw new Error('Extension file updates are unavailable in this running app. Restart WilyTrader.');
  }
  setSettingsMessage('Updating WilyTrader extension files...');
  const result = await api.updateLatestExtensionFiles();
  setSettingsMessage(result.message, !result.ok);
  renderStatus(await window.wilyTraderDesktop.getStatus());
}

async function openLatestDesktopRelease(): Promise<void> {
  const api = window.wilyTraderDesktop as WilyTraderDesktopRuntimeApi;
  if (typeof api.openLatestDesktopRelease !== 'function') {
    throw new Error('Desktop release links are unavailable in this running app. Restart WilyTrader.');
  }
  const result = await api.openLatestDesktopRelease();
  setSettingsMessage(result.message, !result.ok);
}

async function downloadLatestDesktopRelease(): Promise<void> {
  const api = window.wilyTraderDesktop as WilyTraderDesktopRuntimeApi;
  if (typeof api.downloadLatestDesktopRelease !== 'function') {
    throw new Error('Desktop download links are unavailable in this running app. Restart WilyTrader.');
  }
  const result = await api.downloadLatestDesktopRelease();
  setSettingsMessage(result.message, !result.ok);
}

async function installLatestDesktopRelease(): Promise<void> {
  const api = window.wilyTraderDesktop as WilyTraderDesktopRuntimeApi;
  if (typeof api.installLatestDesktopRelease !== 'function') {
    throw new Error('Desktop update installs are unavailable in this running app. Restart WilyTrader.');
  }
  if (!window.confirm('Download and install the latest WilyTrader update now? WilyTrader will close after starting the installer.')) return;
  desktopUpdateInstalling = true;
  setDesktopUpdateButtonsDisabled(true);
  showDesktopUpdateProgress({
    stage: 'preparing',
    version: latestStatus?.desktopUpdate.latestVersion ?? '',
    installerName: '',
    message: 'Preparing WilyTrader installer download.',
    downloadedBytes: 0,
    totalBytes: null,
    percent: null,
  });
  setSettingsMessage('Preparing WilyTrader installer download...');
  try {
    const result = await api.installLatestDesktopRelease();
    setSettingsMessage(result.message, !result.ok);
    if (!result.ok) {
      desktopUpdateInstalling = false;
      setDesktopUpdateButtonsDisabled(false);
    }
  } catch (err) {
    desktopUpdateInstalling = false;
    setDesktopUpdateButtonsDisabled(false);
    showDesktopUpdateProgress({
      stage: 'failed',
      version: latestStatus?.desktopUpdate.latestVersion ?? '',
      installerName: '',
      message: `Desktop install failed: ${(err as Error).message}`,
      downloadedBytes: 0,
      totalBytes: null,
      percent: null,
    });
    throw err;
  }
}

function setDesktopUpdateButtonsDisabled(disabled: boolean): void {
  for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action="download-desktop-update"]'))) {
    button.disabled = disabled;
    button.textContent = disabled ? 'Installing...' : 'Install Update';
  }
  for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>('[data-action="check-desktop-update"]'))) {
    button.disabled = disabled;
  }
}

function showDesktopUpdateProgress(progress: DesktopUpdateProgress): void {
  if (!desktopUpdateProgressEl) return;
  desktopUpdateProgressEl.hidden = false;
  desktopUpdateProgressEl.dataset.stage = progress.stage;

  const percent = progress.percent ?? (
    progress.totalBytes ? Math.round((progress.downloadedBytes / progress.totalBytes) * 100) : null
  );
  const width = Math.max(0, Math.min(100, percent ?? (progress.stage === 'preparing' ? 8 : 18)));
  if (desktopUpdateProgressFillEl) desktopUpdateProgressFillEl.style.width = `${width}%`;

  const version = progress.version ? ` ${progress.version}` : '';
  const sizeText = formatBytesProgress(progress);
  const percentText = percent === null ? '' : `${percent}%`;
  const detail = [percentText, sizeText].filter(Boolean).join(' - ');
  const label = progress.stage === 'downloading'
    ? `Downloading WilyTrader${version} installer${detail ? `: ${detail}` : ''}`
    : progress.message;

  if (desktopUpdateProgressLabelEl) desktopUpdateProgressLabelEl.textContent = label;
  if (desktopUpdateProgressSizeEl) desktopUpdateProgressSizeEl.textContent = progress.installerName || '';
  if (desktopUpdateEl) desktopUpdateEl.hidden = true;
  if (desktopGuidanceEl) desktopGuidanceEl.hidden = true;
  setSettingsMessage(label, progress.stage === 'failed');
}

function formatBytesProgress(progress: Pick<DesktopUpdateProgress, 'downloadedBytes' | 'totalBytes'>): string {
  if (progress.totalBytes) return `${formatBytes(progress.downloadedBytes)} of ${formatBytes(progress.totalBytes)}`;
  return progress.downloadedBytes > 0 ? formatBytes(progress.downloadedBytes) : '';
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function renderOpenrouterModelOptions(): void {
  const select = getSelect('openRouterModels');
  if (!select) return;
  const q = getInputValue('openRouterModelFilter').toLowerCase();
  const freeOnly = getChecked('openRouterFreeOnly');
  const maxCost = Number(getInputValue('openRouterMaxCost'));
  const hasMaxCost = Number.isFinite(maxCost) && maxCost >= 0;
  const filtered = fetchedOpenrouterModels.filter((model) => {
    if (q && !model.id.toLowerCase().includes(q)) return false;
    if (freeOnly && model.inputCostPer1M > 0) return false;
    if (hasMaxCost && model.inputCostPer1M > maxCost) return false;
    return true;
  });
  select.innerHTML = '';
  for (const model of filtered) {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = `${model.id} (${model.inputCostPer1M <= 0 ? 'free' : `$${model.inputCostPer1M.toFixed(2)}/1M in`})`;
    select.appendChild(option);
  }
  select.size = Math.max(1, Math.min(5, filtered.length));
}

function renderGeminiModelOptions(): void {
  const select = getSelect('geminiCliModels');
  if (!select) return;
  const q = getInputValue('geminiCliModelFilter').toLowerCase();
  const filtered = q ? fetchedGeminiCliModels.filter((model) => model.id.toLowerCase().includes(q)) : fetchedGeminiCliModels;
  select.innerHTML = '';
  for (const model of filtered) {
    const option = document.createElement('option');
    option.value = model.id;
    option.textContent = model.id;
    select.appendChild(option);
  }
  select.size = Math.max(1, Math.min(5, filtered.length));
}

function toggleOpenRouterKey(): void {
  const input = getInput('openRouterApiKey');
  if (!input) return;
  input.type = input.type === 'password' ? 'text' : 'password';
  const button = document.querySelector<HTMLButtonElement>('[data-action="toggle-openrouter-key"]');
  if (button) button.textContent = input.type === 'password' ? 'Show' : 'Hide';
}

function showError(error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  debugLog('renderer', 'showError', errorDetails(error));
  setUiBusy(false, `Error: ${message}`);
  setSettingsMessage(message, true);
}

function bindAction(action: string, listener: () => void): void {
  const button = document.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
  debugLog('renderer', 'binding action', { action, found: Boolean(button) });
  button?.addEventListener('click', (event) => {
    event.preventDefault();
    debugLog('renderer', 'action clicked', { action, disabled: button.disabled });
    try {
      listener();
    } catch (err) {
      debugLog('renderer', 'action listener failed', { action, error: errorDetails(err) });
      showError(err);
    }
  });
}

function debugLog(scope: string, message: string, details?: unknown): void {
  try {
    const api = window.wilyTraderDesktop as WilyTraderDesktopRuntimeApi | undefined;
    if (api && typeof api.logDebug === 'function') {
      void api.logDebug(scope, message, sanitizeForLog(details)).catch((err) => {
        console.warn('[WilyTrader debug log failed]', err);
      });
      return;
    }
  } catch {
    // fall through to console
  }
  console.log(`[WilyTrader][${scope}] ${message}`, details ?? '');
}

function errorDetails(error: unknown): Record<string, unknown> {
  return error instanceof Error
    ? { name: error.name, message: error.message, stack: error.stack }
    : { message: String(error) };
}

function sanitizeForLog(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object') return value;
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

function getInput(name: string): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>(`[data-setting="${name}"]`);
}

function getCheckedInput(name: string): HTMLInputElement | null {
  return getInput(name);
}

function getSelect(name: string): HTMLSelectElement | null {
  return document.querySelector<HTMLSelectElement>(`[data-setting="${name}"]`);
}

function getInputValue(name: string): string {
  return getInput(name)?.value.trim() ?? '';
}

function setInputValue(name: string, value: string, force = false): void {
  const input = getInput(name);
  if (input && (force || document.activeElement !== input)) input.value = value;
}

function getChecked(name: string): boolean {
  return Boolean(getInput(name)?.checked);
}

function setChecked(name: string, value: boolean): void {
  const input = getInput(name);
  if (input) input.checked = value;
}

function getSelectValue(name: string): string {
  return getSelect(name)?.value ?? '';
}

function setSelectValue(name: string, value: string): void {
  const select = getSelect(name);
  if (select) select.value = value;
}

function setDependencyStatus(message: string): void {
  if (dependencyStatusEl) dependencyStatusEl.textContent = message;
}

function setSettingsMessage(message: string, isError = false): void {
  if (!settingsMessageEl) return;
  settingsMessageEl.textContent = message;
  settingsMessageEl.classList.toggle('error', isError);
}

function formatDependency(label: string, value: { ok: boolean; message: string }): string {
  return `${value.ok ? 'OK' : 'Missing'} - ${label}: ${value.message}`;
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  if (total < 60) return `${total}s`;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

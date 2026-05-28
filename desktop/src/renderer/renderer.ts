let mediaRecorder: MediaRecorder | null = null;
let mediaStream: MediaStream | null = null;
let sessionStartedAtMs: number | null = null;
let stopping = false;
let audioRecordingBlobs: Blob[] = [];
let currentSettings: WilyTraderDesktopSettings | null = null;
let fetchedOpenrouterModels: Array<{ id: string; createdAtMs: number; inputCostPer1M: number }> = [];
let fetchedGeminiCliModels: Array<{ id: string; createdAtMs: number }> = [];

interface WilyTraderDesktopSettings {
  outputDir: string;
  microphoneCaptureEnabled: boolean;
  saveBrowserScreenshots: boolean;
  generateTradeLogOnStop: boolean;
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
  bridgePort: number;
  sessionDir: string | null;
  sessionStartedAtMs: number | null;
  elapsedMs: number;
  audioChunks: number;
  executionsReceived: number;
  screenshotsReceived: number;
  settings: WilyTraderDesktopSettings;
  extension: {
    runtimeInstalledVersion: string | null;
    localManifestVersion: string | null;
    runtimeLastSeenAt: string | null;
    localExtensionPath: string | null;
    updateMessage: string;
  };
}

type WilyTraderDesktopRuntimeApi = typeof window.wilyTraderDesktop & Partial<{
  checkDependencies: (payload: { geminiCliCommand?: string }) => Promise<{
    whisper: { ok: boolean; message: string; exePath?: string; modelPath?: string };
    node: { ok: boolean; message: string; version?: string; optional?: boolean };
    geminiCli: { ok: boolean; message: string; version?: string; command?: string };
  }>;
  geminiCliSigninStatus: () => Promise<{ signedIn: boolean; subject?: string | null }>;
  geminiCliSignin: (payload: { command?: string }) => Promise<{ ok: boolean; message: string; subject?: string }>;
  logDebug: (scope: string, message: string, details?: unknown) => Promise<{ ok: true }>;
}>;

const startButton = document.querySelector<HTMLButtonElement>('[data-action="start"]');
const stopButton = document.querySelector<HTMLButtonElement>('[data-action="stop"]');
const settingsButton = document.querySelector<HTMLButtonElement>('[data-action="settings"]');
const settingsSaveButton = document.querySelector<HTMLButtonElement>('[data-action="settings-save"]');
const updateCheckButton = document.querySelector<HTMLButtonElement>('[data-action="check-extension-update"]');
const statusEl = document.querySelector<HTMLElement>('[data-status]');
const sessionDirEl = document.querySelector<HTMLElement>('[data-session-dir]');
const bridgeEl = document.querySelector<HTMLElement>('[data-bridge]');
const countsEl = document.querySelector<HTMLElement>('[data-counts]');
const extensionVersionEl = document.querySelector<HTMLElement>('[data-extension-version]');
const extensionUpdateEl = document.querySelector<HTMLElement>('[data-extension-update]');
const extensionPathEl = document.querySelector<HTMLElement>('[data-extension-path]');
const settingsExtensionVersionEl = document.querySelector<HTMLElement>('[data-settings-extension-version]');
const dependencyStatusEl = document.querySelector<HTMLElement>('[data-dependency-status]');
const geminiSigninStatusEl = document.querySelector<HTMLElement>('[data-gemini-signin-status]');
const settingsMessageEl = document.querySelector<HTMLElement>('[data-settings-message]');
const settingsModal = document.querySelector<HTMLElement>('[data-settings-modal]');

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
window.wilyTraderDesktop.onToggleSessionHotkey(() => {
  if (sessionStartedAtMs || mediaRecorder || stopping) void stopAudioFirstSession().catch(showError);
  else void startAudioFirstSession().catch(showError);
});

void window.wilyTraderDesktop.getSettings().then((settings) => {
  currentSettings = settings;
  populateSettings(settings);
}).catch(showError);
void window.wilyTraderDesktop.getStatus().then(renderStatus).catch(showError);

async function startAudioFirstSession(): Promise<void> {
  try {
    setUiBusy(true, 'Starting WilyTrader trade session...');
    const session = await window.wilyTraderDesktop.startSession();
    sessionStartedAtMs = session.sessionStartedAtMs;
    currentSettings = session.settings;
    stopping = false;
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
    }

    renderStatus(session);
    setUiBusy(false, session.settings.microphoneCaptureEnabled ? 'Recording microphone audio.' : 'Trade session running.');
  } catch (error) {
    sessionStartedAtMs = null;
    stopping = false;
    throw error;
  }
}

async function stopAudioFirstSession(): Promise<void> {
  if (stopping) return;
  stopping = true;
  setUiBusy(true, 'Stopping session...');
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.requestData();
    mediaRecorder.stop();
    return;
  }
  await finalizeRecorderStop();
}

async function finalizeRecorderStop(): Promise<void> {
  if (audioRecordingBlobs.length > 0 && sessionStartedAtMs !== null) {
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
    for (const track of mediaStream.getTracks()) track.stop();
  }
  mediaStream = null;
  mediaRecorder = null;
  const result = await window.wilyTraderDesktop.stopSession();
  sessionStartedAtMs = null;
  stopping = false;
  setUiBusy(false, `Session complete: ${result.sessionDir}`);
  renderStatus(await window.wilyTraderDesktop.getStatus());
}

function renderStatus(status: WilyTraderDesktopStatus): void {
  currentSettings = status.settings;
  if (startButton) startButton.disabled = status.active;
  if (stopButton) stopButton.disabled = !status.active;
  if (statusEl) statusEl.textContent = status.active ? `Recording ${formatElapsed(status.elapsedMs)}` : 'Idle';
  if (sessionDirEl) sessionDirEl.textContent = status.sessionDir ?? 'No active session';
  if (bridgeEl) bridgeEl.textContent = `Bridge: http://127.0.0.1:${status.bridgePort}/v1/wilytrader/ledger`;
  if (countsEl) {
    countsEl.textContent =
      `${status.active ? 'Recording audio file' : 'Audio file saved on stop'}, ${status.executionsReceived} bridge events, ${status.screenshotsReceived} screenshots`;
  }
  const installed = status.extension.runtimeInstalledVersion ?? status.extension.localManifestVersion ?? 'Not detected';
  const heartbeat = status.extension.runtimeLastSeenAt ? `, last seen ${new Date(status.extension.runtimeLastSeenAt).toLocaleTimeString()}` : '';
  if (extensionVersionEl) extensionVersionEl.textContent = `Installed: ${installed}${heartbeat}`;
  if (settingsExtensionVersionEl) settingsExtensionVersionEl.textContent = installed;
  if (extensionUpdateEl) extensionUpdateEl.textContent = status.extension.updateMessage;
  const extensionPath = status.extension.localExtensionPath ?? 'No local manifest path detected';
  if (extensionPathEl) extensionPathEl.textContent = extensionPath;
  const extensionFolderButton = document.querySelector<HTMLButtonElement>('[data-action="open-extension-folder"]');
  if (extensionFolderButton) extensionFolderButton.textContent = extensionPath;
  populateSettings(status.settings);
}

function setUiBusy(busy: boolean, message: string): void {
  if (startButton && !busy) startButton.disabled = Boolean(sessionStartedAtMs);
  if (stopButton && !busy) stopButton.disabled = !sessionStartedAtMs;
  if (statusEl) statusEl.textContent = message;
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

async function checkExtensionUpdates(): Promise<void> {
  setUiBusy(false, 'Checking WilyTrader extension update status...');
  renderStatus(await window.wilyTraderDesktop.checkExtensionUpdates());
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
      throw new Error('Dependency checker is unavailable in the running app. Restart WilyTrader Desktop so the updated preload API is loaded.');
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
      throw new Error('Gemini sign-in status is unavailable in the running app. Restart WilyTrader Desktop so the updated preload API is loaded.');
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
      setSettingsMessage('Gemini sign-in is unavailable in the running app. Restart WilyTrader Desktop so the updated preload API is loaded.', true);
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

async function moveExtensionLocation(): Promise<void> {
  const result = await window.wilyTraderDesktop.moveExtensionLocation();
  setSettingsMessage(result.message, !result.ok);
  renderStatus(await window.wilyTraderDesktop.getStatus());
}

async function openChromeExtensions(): Promise<void> {
  const result = await window.wilyTraderDesktop.openChromeExtensions();
  setSettingsMessage(result.message, !result.ok);
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
        console.warn('[WilyTrader Desktop debug log failed]', err);
      });
      return;
    }
  } catch {
    // fall through to console
  }
  console.log(`[WilyTrader Desktop][${scope}] ${message}`, details ?? '');
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

function setInputValue(name: string, value: string): void {
  const input = getInput(name);
  if (input && document.activeElement !== input) input.value = value;
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

import { contextBridge, ipcRenderer } from 'electron';
import type {
  AbandonSessionResult,
  MasterSyncResult,
  StartSessionResult,
  StopSessionResult,
  WilyTraderDesktopAppInfo,
  WilyTraderDesktopSettings,
  WilyTraderDesktopStatus,
} from './shared';

const api = {
  getAppInfo: () => ipcRenderer.invoke('app:info') as Promise<WilyTraderDesktopAppInfo>,
  startSession: () => ipcRenderer.invoke('session:start') as Promise<StartSessionResult>,
  stopSession: () => ipcRenderer.invoke('session:stop') as Promise<StopSessionResult>,
  abandonSession: () => ipcRenderer.invoke('session:abandon') as Promise<AbandonSessionResult>,
  openActiveSessionFolder: () =>
    ipcRenderer.invoke('session:open-active-folder') as Promise<{ ok: boolean; message: string; path?: string | null }>,
  copyActiveSessionFolderLink: () =>
    ipcRenderer.invoke('session:copy-active-folder-link') as Promise<{ ok: boolean; message: string; path?: string | null }>,
  openLastCompletedSessionFolder: () =>
    ipcRenderer.invoke('session:open-last-completed-folder') as Promise<{ ok: boolean; message: string; path?: string | null }>,
  copyLastCompletedSessionFolderLink: () =>
    ipcRenderer.invoke('session:copy-last-completed-folder-link') as Promise<{ ok: boolean; message: string; path?: string | null }>,
  syncMasterTradingLog: () =>
    ipcRenderer.invoke('session:sync-master-trading-log') as Promise<MasterSyncResult>,
  getStatus: () => ipcRenderer.invoke('session:status') as Promise<WilyTraderDesktopStatus>,
  getSettings: () => ipcRenderer.invoke('settings:get') as Promise<WilyTraderDesktopSettings>,
  saveSettings: (payload: Partial<WilyTraderDesktopSettings>) =>
    ipcRenderer.invoke('settings:save', payload) as Promise<WilyTraderDesktopSettings>,
  checkDependencies: (payload: { geminiCliCommand?: string }) =>
    ipcRenderer.invoke('settings:check-dependencies', payload) as Promise<{
      whisper: { ok: boolean; message: string; exePath?: string; modelPath?: string };
      node: { ok: boolean; message: string; version?: string; optional?: boolean };
      geminiCli: { ok: boolean; message: string; version?: string; command?: string };
    }>,
  installWhisper: () =>
    ipcRenderer.invoke('settings:install-whisper') as Promise<{ ok: boolean; message: string; exePath?: string; modelPath?: string }>,
  installGeminiCli: () =>
    ipcRenderer.invoke('settings:install-gemini-cli') as Promise<{ ok: boolean; message: string; stdoutTail?: string; stderrTail?: string }>,
  installNode: () =>
    ipcRenderer.invoke('settings:install-node') as Promise<{ ok: boolean; message: string; stdoutTail?: string; stderrTail?: string }>,
  testLlmConnection: (payload: unknown) =>
    ipcRenderer.invoke('settings:test-llm-connection', payload) as Promise<{
      ok: boolean;
      mode: 'gemini-cli' | 'api';
      message: string;
      guidance?: {
        kind: 'gemini-cli-missing';
        title: string;
        explanation: string;
        installCommand: string;
        docsUrl: string;
      };
    }>,
  listOpenRouterModels: () =>
    ipcRenderer.invoke('settings:list-openrouter-models') as Promise<Array<{ id: string; createdAtMs: number; inputCostPer1M: number }>>,
  listGeminiCliModels: () =>
    ipcRenderer.invoke('settings:list-gemini-cli-models') as Promise<Array<{ id: string; createdAtMs: number }>>,
  geminiCliSigninStatus: () =>
    ipcRenderer.invoke('settings:gemini-cli-signin-status') as Promise<{ signedIn: boolean; subject?: string | null }>,
  geminiCliSignin: (payload: { command?: string }) =>
    ipcRenderer.invoke('settings:gemini-cli-signin', payload) as Promise<{ ok: boolean; message: string; subject?: string }>,
  geminiCliSigninCancel: () =>
    ipcRenderer.invoke('settings:gemini-cli-signin-cancel') as Promise<{ ok: boolean; message?: string }>,
  geminiCliSignout: () =>
    ipcRenderer.invoke('settings:gemini-cli-signout') as Promise<{ ok: boolean; message?: string }>,
  logDebug: (scope: string, message: string, details?: unknown) =>
    ipcRenderer.invoke('debug:log', { scope, message, details }) as Promise<{ ok: true }>,
  checkExtensionUpdates: () => ipcRenderer.invoke('extension:check-updates') as Promise<WilyTraderDesktopStatus>,
  openExtensionFolder: () =>
    ipcRenderer.invoke('extension:open-folder') as Promise<{ ok: boolean; message: string; path?: string | null }>,
  openChromeExtensions: () =>
    ipcRenderer.invoke('extension:open-chrome-extensions') as Promise<{ ok: boolean; message: string }>,
  openLatestExtensionRelease: () =>
    ipcRenderer.invoke('extension:open-latest-release') as Promise<{ ok: boolean; message: string; url?: string }>,
  downloadLatestExtensionRelease: () =>
    ipcRenderer.invoke('extension:download-latest-release') as Promise<{ ok: boolean; message: string; url?: string }>,
  checkDesktopUpdates: () => ipcRenderer.invoke('desktop:check-updates') as Promise<WilyTraderDesktopStatus>,
  openLatestDesktopRelease: () =>
    ipcRenderer.invoke('desktop:open-latest-release') as Promise<{ ok: boolean; message: string; url?: string }>,
  downloadLatestDesktopRelease: () =>
    ipcRenderer.invoke('desktop:download-latest-release') as Promise<{ ok: boolean; message: string; url?: string }>,
  moveExtensionLocation: () =>
    ipcRenderer.invoke('extension:move-location') as Promise<{
      ok: boolean;
      message: string;
      version: string | null;
      repoPath: string | null;
      extensionPath: string | null;
    }>,
  saveAudioChunk: (payload: {
    buffer: ArrayBuffer;
    index: number;
    startedAtMs: number;
    endedAtMs: number;
    mimeType?: string | null;
    final?: boolean;
  }) => ipcRenderer.invoke('session:audio-chunk', payload) as Promise<{ ok: boolean }>,
  saveAudioRecording: (payload: {
    buffer: ArrayBuffer;
    startedAtMs: number;
    endedAtMs: number;
    mimeType?: string | null;
  }) => ipcRenderer.invoke('session:audio-recording', payload) as Promise<{ ok: boolean }>,
  addTranscriptSegment: (payload: {
    id: string;
    text: string;
    startedAtMs: number;
    endedAtMs: number;
    source?: string;
  }) => ipcRenderer.invoke('session:transcript-segment', payload) as Promise<{ ok: boolean }>,
  onStatus: (callback: (status: WilyTraderDesktopStatus) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: WilyTraderDesktopStatus) => callback(status);
    ipcRenderer.on('session:status-changed', listener);
    return () => ipcRenderer.off('session:status-changed', listener);
  },
  onToggleSessionHotkey: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('session:toggle-requested', listener);
    return () => ipcRenderer.off('session:toggle-requested', listener);
  },
};

contextBridge.exposeInMainWorld('wilyTraderDesktop', api);

export type WilyTraderDesktopApi = typeof api;

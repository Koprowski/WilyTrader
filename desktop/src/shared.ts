export interface TranscriptSegment {
  id: string;
  text: string;
  startedAtMs: number;
  endedAtMs: number;
  offsetMs: number;
  offsetEndMs: number;
  source: 'browser-speech-recognition' | 'manual' | 'imported';
}

export interface AudioChunkMeta {
  index: number;
  startedAtMs: number;
  endedAtMs: number;
  offsetMs: number;
  offsetEndMs: number;
  mimeType: string | null;
  bytes: number;
  final: boolean;
  filePath: string;
}

export interface AudioRecordingMeta {
  startedAtMs: number;
  endedAtMs: number;
  offsetMs: number;
  offsetEndMs: number;
  mimeType: string | null;
  bytes: number;
  filePath: string;
}

export interface WilyTraderDesktopStatus {
  active: boolean;
  bridgePort: number;
  sessionDir: string | null;
  sessionStartedAtMs: number | null;
  elapsedMs: number;
  transcriptSegments: number;
  audioChunks: number;
  executionsReceived: number;
  screenshotsReceived: number;
  extension: WilyTraderExtensionStatus;
  settings: WilyTraderDesktopSettings;
}

export interface WilyTraderDesktopAppInfo {
  name: string;
  version: string;
}

export interface StartSessionResult extends WilyTraderDesktopStatus {
  ok: true;
}

export interface StopSessionResult {
  ok: true;
  sessionDir: string;
  transcriptJsonPath: string;
  transcriptMdPath: string;
  tradeLogXlsxPath: string;
  tradeLogMdPath: string;
  warnings: string[];
}

export interface BridgeExecutionEvent {
  type?: string | null;
  captureScreenshot?: boolean | null;
  executionId?: string | null;
  platform?: string | null;
  side?: string | null;
  timestamp?: string | null;
  timestampMs?: number | null;
  tokenName?: string | null;
  tokenAddress?: string | null;
}

export interface BridgeScreenshotPayload {
  dataUrl?: string | null;
  capturedAt?: string | null;
  capturedAtMs?: number | null;
  captureRect?: Record<string, unknown> | null;
  source?: string | null;
}

export interface WilyTraderExtensionStatus {
  runtimeInstalledVersion: string | null;
  runtimeExtensionId: string | null;
  runtimeLastSeenAt: string | null;
  localManifestVersion: string | null;
  localExtensionPath: string | null;
  latestVersion: string | null;
  updateAvailable: boolean;
  updateMessage: string;
  checkedAt: string | null;
}

export interface WilyTraderDesktopSettings {
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

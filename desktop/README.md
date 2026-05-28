# WilyTrader Desktop

WilyTrader Desktop is the audio-first trade-session app for WilyTrader. It owns the local session folder, microphone recording, transcript artifacts, localhost bridge, browser execution ledger intake, screenshot saving, and `trade_log.xlsx` / `trade_log.md` generation.

The Chrome extension remains the browser adapter. It reads Padre/Axiom DOM state, runs the in-page paper-trading controls, handles chart overlays, intercepts browser-only quick-buy flows, and posts ledger events plus optional tab screenshots to:

```text
http://127.0.0.1:17365/v1/wilytrader/ledger
```

## Run

```powershell
cd E:\Apps\wilytrader-desktop\desktop
npm install
npm run build
npm start
```

Sessions are written under:

```text
..\WilyTrader Captures
```

In development from `E:\Apps\wilytrader-desktop\desktop`, the default is `E:\Apps\WilyTrader Captures`. This intentionally avoids Windows Documents/OneDrive redirection.

## Vertical Slice Scope

Included:

- Electron shell with a minimal session UI.
- Start/stop WilyTrader trade sessions.
- Microphone-only WebM chunk recording.
- One authoritative full-session `session-audio.webm` recording using WebM/Opus, plus post-session Whisper transcription when Whisper resources are available.
- Localhost WilyTrader bridge on port `17365`.
- WilyTrader extension heartbeat and update-status surface.
- Ledger intake from the existing WilyTrader extension.
- Tab-captured trade screenshot saving when the extension sends one.
- Session artifacts under `Inputs/`, including `Inputs/wilytrader.json`, `Inputs/wilytrader/executions.json`, and `Inputs/wilytrader-mockape-compatible.json`.
- Root-level `trade_log.xlsx` and `trade_log.md`.

Intentionally not migrated:

- Generic Snipalot screenshot annotator.
- Generic screen recording or video-first capture mode.
- MP4/GIF conversion for normal trade sessions.
- App-commentary feedback prompt UX.
- Snipalot release/installer machinery.

## Clock Ownership

WilyTrader Desktop is the session clock owner. The session folder records:

- `sessionStartedAtMs`
- transcript segment `offsetMs` / `offsetEndMs`
- bridge event `timestampMs`
- bridge event `executionOffsetMs`
- screenshot `capturedAtMs`
- screenshot `capturedOffsetMs`

The extension may include browser-side capture timestamps, but the desktop bridge normalizes every received event against the desktop session start.

## Transcript Approach

The current slice records one full-session WebM/Opus audio file. It does not display a live transcript and does not call Chromium speech recognition. That avoids noisy renderer/network errors and keeps the session clock clean.

On stop, WilyTrader Desktop tries to transcribe `Inputs/audio/session-audio.webm` with local Whisper resources and writes timestamped `Inputs/transcript.json`, `Inputs/transcript.md`, and root-level `transcript.txt`. The transcript is not gated on trades; sessions with no executions should still transcribe if audio was captured and Whisper is available. Any future live transcript should be a draft-only convenience surface.

# Desktop Architecture

## Boundary

WilyTrader Desktop owns local trade-session artifacts:

- session folder lifecycle
- full-session microphone audio recording
- transcript files
- localhost bridge intake
- execution ledger snapshots
- trade screenshots
- `trade_log.xlsx`
- `trade_log.md`

The Chrome extension owns browser-only work:

- Padre/Axiom DOM reads
- in-page WilyTrader overlay controls
- Axiom chart lines and markers
- Pulse quick-buy interception
- Chrome tab screenshot capture
- posting ledger events to the desktop bridge

## Session Folder Shape

```text
YYYY-MM-DD_HH-mm-ss wilytrader-trade/
  session_manifest.json
  session_status.json
  trade_log.md
  trade_log.xlsx
  Inputs/
    session_log.jsonl
    transcript.json
    transcript.md
    wilytrader.json
    wilytrader-executions.jsonl
    wilytrader-mockape-compatible.json
    audio/
      session-audio.webm
      session-audio.json
    trade-screenshots/
      *.png
      *.png.json
    wilytrader/
      latest-ledger-payload.json
      current-session-summary.json
      previous-sessions.json
      executions.json
```

The `Inputs/wilytrader.json` and `Inputs/wilytrader/executions.json` paths are kept for compatibility with the existing WilyTrader-to-Snipalot trade input shape.

## Transcript Pipeline

This first slice records one full-session microphone file directly from the Electron renderer with `MediaRecorder` using WebM/Opus. The app does not display a live transcript and does not call Chromium speech recognition.

Current path:

1. Record one authoritative `Inputs/audio/session-audio.webm` during the session.
2. Transcribe the full file immediately after the session stops when local Whisper resources are available.
3. Write `Inputs/transcript.json`, `Inputs/transcript.md`, and root `transcript.txt` with desktop-clock offsets.
4. Use the post-session transcript as the authoritative input for trade-log generation.

Live transcription can be added later as a draft-only signal, but it should not be the only transcript source for trade review.

## Screenshot Flow

The old Snipalot bridge depended on the recorder video stream for trade screenshots. WilyTrader Desktop removes that dependency. On buy/sell events, the extension asks its MV3 background service worker for a cropped `chrome.tabs.captureVisibleTab` PNG and includes it in the bridge payload. Desktop saves the PNG plus a metadata sidecar containing the normalized desktop session offset.

## Not Migrated

The first slice avoids generic Snipalot product surfaces that do not belong in WilyTrader Desktop trade sessions: annotator UX, normal screen recording, MP4/GIF generation, and feedback-commentary prompt workflows.

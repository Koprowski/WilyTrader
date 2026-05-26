# WilyTrader Agent Instructions

This repo is the local-only Padre paper-trading overlay that can export an
execution ledger and optionally sync into Snipalot.

## Planning System: Mission Control vs GitHub

`MC` means Mission Control.

Canonical Mission Control repo:

- GitHub: `Koprowski/mission-control`
- Local Windows path: `E:\Apps\mission-control`

Mission Control/WBS is the master portfolio map across projects. It includes
active work, shaped backlog, discovery items, and high-leverage opportunities
that should compete for attention.

GitHub Issues are the canonical source of truth for repo-specific implementation
detail: PRDs, epics, bugs, reviews, acceptance criteria, and engineering
follow-ups.

## Commit Traceability

Before pushing substantive Codex-authored repo changes, make sure there is a
durable trace target:

- GitHub issue or PR for repo-specific implementation detail;
- Mission Control WBS/briefing/logbook when priority, status, scope, re-entry,
  root cause, or portfolio context changed;
- repo-local handoff note when future agents need outcome, verification, or
  gotchas;
- OpenBrain capture when the lesson should be searchable across sessions;
- explicit digest-only note when no planning or follow-up surface needs to
  change.

Canonical policy: `E:\Apps\mission-control\resources\repo-change-traceability.md`.

## Agent Behavior

- Preserve unrelated local changes in this repo and in Mission Control.
- Do not create fallback Mission Control clones. Use `E:\Apps\mission-control`
  whenever Mission Control needs to be updated.
- Keep detailed implementation work in this repo or GitHub Issues; keep Mission
  Control compact and linked to the repo artifact.

# Changelog

All notable changes to Sugukuru WorkClock MCP are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-05-29

### Added

- Initial release of Sugukuru WorkClock MCP.
- Eight focused MCP tools: `timelog.start`, `timelog.pause`, `timelog.resume`,
  `timelog.stop`, `timelog.status`, `timelog.summary`, `timelog.amend`,
  `timelog.export`.
- Append-only JSONL event ledger as the source of truth, with crash-recovery
  checkpoints and regenerated human-readable Markdown daily logs.
- Natural Japanese command coverage (開始 / 休憩 / 再開 / 終了 / まとめ).
- Pomodoro mode that warns at work-interval boundaries without silently
  stopping the work log.
- Multi-format export (CSV, JSON, 日報/standup, 週報/weekly, Obsidian wikilinks)
  with optional safe file output under `exports/`.
- Git context auto-detection (branch → project/ticket) behind
  `WORKCLOCK_ENABLE_GIT_CONTEXT`.
- MCP Apps timer UI (`ui://workclock/timer.html`) bundled as a single HTML file
  with a strict Content-Security-Policy.
- MCP resources: `worklog://daily/{date}`, `worklog://active`,
  `worklog://summary/{period}`, `worklog://export/{format}/{period}`.
- stdio and Streamable HTTP transports; HTTP mode with Origin allow-list,
  authentication gate, rate limiting, and redacting logger.
- Path-safety layer: log-root confinement, symlink-escape rejection,
  absolute-path rejection, Markdown/YAML sanitization.
- Test suite (33 tests) plus an end-to-end stdio JSON-RPC smoke test
  (`npm run smoke`).

### Notes

- Built on the MCP TypeScript SDK v2 (alpha) for the server and the official
  MCP Apps extension (`@modelcontextprotocol/ext-apps`, spec 2026-01-26) for the
  UI. `@cfworker/json-schema` is a required runtime dependency of the v2 server.

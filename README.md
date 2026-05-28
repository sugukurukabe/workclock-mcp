# Sugukuru WorkClock MCP

Sugukuru WorkClock MCP is a local-first Model Context Protocol server that turns natural Japanese work commands into accurate task-level time logs.

Say things like:

- `設計レビュー開始`
- `休憩`
- `再開`
- `終了。OAuthまわりの整理まで完了`
- `今日の稼働まとめ`

The server records append-only JSONL events and regenerates human-readable Markdown daily logs under a safe log root.

> 詳細な設計・データモデル・全ツール仕様・セキュリティ・公開手順は
> [`docs/OVERVIEW.md`](docs/OVERVIEW.md)（日本語の詳細資料）を参照してください。

## Why it exists

Unlike generic Pomodoro apps, WorkClock is optimized for developer workflows:

- Natural Japanese start/stop commands
- Markdown / Obsidian / Git friendly logs
- Task, project, ticket, and tag aggregation
- Structured tool output for daily/weekly reports
- MCP Apps timer card UI in supported hosts
- Local-first storage with strict path safety

## Quick start (Cursor)

```json
{
  "mcpServers": {
    "workclock": {
      "command": "node",
      "args": ["C:/path/to/work-clock-mcp/dist/main.js", "--stdio"],
      "env": {
        "WORKCLOCK_LOG_DIR": "C:/path/to/your-project/.workclock"
      }
    }
  }
}
```

Build first:

```bash
npm install --legacy-peer-deps
npm run build
```

## Quick start (Claude Desktop)

```json
{
  "mcpServers": {
    "workclock": {
      "command": "node",
      "args": ["/absolute/path/to/work-clock-mcp/dist/main.js", "--stdio"],
      "env": {
        "WORKCLOCK_LOG_DIR": "/absolute/path/to/project/.workclock"
      }
    }
  }
}
```

## Quick start (HTTP / remote gateway)

```bash
npm run serve
```

Default endpoint: `http://127.0.0.1:3002/mcp`

Remote mode requires authentication. Configure:

- `WORKCLOCK_MODE=remote`
- `WORKCLOCK_LOG_DIR=/tenant/storage`
- `WORKCLOCK_REMOTE_REQUIRE_AUTH=true`
- `WORKCLOCK_ALLOWED_ORIGINS=https://your-gateway.example`
- `WORKCLOCK_TRUSTED_GATEWAY_HMAC_SECRET=...`

## Tools

| Tool | Purpose |
|---|---|
| `timelog.start` | Start one active work session |
| `timelog.pause` | Pause current session |
| `timelog.resume` | Resume paused session |
| `timelog.stop` | Stop and finalize session |
| `timelog.status` | Read active state + today totals |
| `timelog.summary` | Aggregate reports |
| `timelog.amend` | Append auditable correction event |
| `timelog.export` | Export logs to CSV / JSON / 日報 / 週報 / Obsidian |

## Take your time into other tools

WorkClock stays local-first and never auto-sends data, but it makes your tracked
time easy to move into the tools you already use.

### Export formats (`timelog.export`)

| Format | Use it for |
|---|---|
| `csv` | Spreadsheets (Excel, Google Sheets), invoicing, BI imports |
| `json` | Scripts, dashboards, programmatic re-aggregation |
| `standup` | Paste your 日報 into Slack / Notion / email |
| `weekly` | 週報 with per-group and per-day breakdown |
| `obsidian` | Markdown with `[[wikilinks]]` for your vault |

Examples:

- `今日の稼働をCSVで書き出して` (`format=csv period=today`)
- `今日の日報を作って` (`format=standup period=today`)
- `今週の週報をプロジェクト別で` (`format=weekly period=week groupBy=project`)
- `今週のログをObsidian用に出力して` (`format=obsidian period=week`)

Set `writeToFile: true` to also save the export under a safe `exports/` folder in
your log root (and read it back via the `worklog://export/{format}/{period}`
resource). Nothing leaves your machine unless you copy or sync it yourself.

### Git context auto-detection

Set `WORKCLOCK_ENABLE_GIT_CONTEXT=true` and WorkClock reads your current branch
(read-only) to pre-fill project and ticket when you start a timer:

```
feature/SG-123-auth-flow  ->  ticket: SG-123, project: auth-flow
```

Just say `実装開始` on your branch and the log is already tagged with the right
ticket and project. Explicit `project` / `ticket` arguments always win.

### Obsidian / Git workflow

Point `WORKCLOCK_LOG_DIR` into your Obsidian vault (or a subfolder). Daily
Markdown logs, JSONL events, and exports become normal files you can open, link,
and commit to Git like any other note.

## Natural language examples

- `API実装開始`
- `SG-123の設計レビューをポモドーロで開始`
- `休憩`
- `再開`
- `終了。OAuthまわりの整理まで完了`
- `今日の稼働ログをMarkdownで`
- `今週の作業時間をプロジェクト別に集計して`
- `直近ログのタスク名を認証設計に変えて`
- `今日の日報を作って`
- `今週の稼働をCSVで書き出して`
- `今週のログをObsidian用に出力して`

## Log format

```
logs/
  events.jsonl
  active/<user>.<workspace>.json
  2026/05/2026-05-28.md
```

- `events.jsonl`: append-only machine ledger (source of truth)
- `active/*.json`: crash recovery checkpoint
- daily Markdown: regenerated from events

## Environment variables

See [`.env.example`](.env.example).

## Security model

- All writes stay under resolved log root
- Symlink escape and absolute path input blocked
- Markdown/YAML sanitized
- Remote write requires auth
- HTTP Origin allow-list enforced
- No automatic external posting in v1

## Privacy model

- Work logs stay on local disk in local mode
- Pino logs redact notes, markdown, tokens, and absolute paths by default
- `userKey` in remote mode comes from verified auth context only

## MCP Inspector

```bash
npm run build
npm run inspect:stdio
npm run inspect:http
```

## FAQ

**Does it run in background?**  
The MCP server runs while your host keeps it alive. Active sessions persist via checkpoint files.

**What if I forget to stop?**  
Status warns on stale sessions (`STALE_SESSION`). Stop still works and logs actual elapsed active time.

**Can it write outside the project?**  
No. Writes are restricted to the resolved log root.

**Can I edit logs?**  
Use `timelog.amend` with a required reason. JSONL history remains append-only.

**Does it upload my work data?**  
No automatic upload in v1.

**Obsidian usage?**  
Point `WORKCLOCK_LOG_DIR` into your vault (or a subfolder) and open generated daily Markdown files.

## Troubleshooting

- Build UI bundle: `npm run build:ui`
- If MCP Apps UI shows fallback HTML, rebuild with `npm run build`
- For v2 SDK + ext-apps peer conflicts, install with `npm install --legacy-peer-deps`
- Verify the server boots end-to-end over stdio: `npm run build && npm run smoke`
- `ERR_MODULE_NOT_FOUND: @cfworker/json-schema` on launch means deps are incomplete; run `npm install` again (it is a required runtime dependency)

# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 1.0.x | yes |

## Reporting

Report security issues privately to the Sugukuru maintainers. Do not open public issues for undisclosed vulnerabilities.

## Threat model

WorkClock MCP handles local work logs that may contain task names, ticket IDs, and optional notes.

### Protections implemented

1. **Path confinement**
   - All writes occur under `resolveLogRoot()`
   - Absolute paths and traversal segments rejected
   - Realpath checks block symlink escape

2. **Markdown safety**
   - Table cell escaping
   - YAML frontmatter quoting
   - Control character stripping

3. **Transport safety**
   - stdio mode writes logs to stderr/file only (never stdout)
   - HTTP mode validates Origin and Host (via MCP Express helper)
   - Remote write requires auth (Bearer token or trusted gateway HMAC)

4. **Privacy**
   - Notes and markdown redacted from structured logs by default
   - Absolute local paths hidden unless `WORKCLOCK_EXPOSE_LOCAL_PATHS=true`

5. **Auditability**
   - Corrections append `amended` events; history is not silently rewritten

## Out of scope for v1

- Calendar integrations
- Slack auto-posting
- Cross-tenant log access
- Arbitrary filesystem writes

## Deployment guidance

- Bind HTTP to `127.0.0.1` for local dev
- Never use wildcard CORS in production
- Rotate gateway HMAC secrets regularly
- Set restrictive filesystem permissions on log directories

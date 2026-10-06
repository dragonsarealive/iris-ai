# Changelog

All notable changes to IRIS are recorded here, newest first. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow the npm
`iris-code` package.

This file starts with **1.2.31**, the first release published through npm trusted
publishing. Earlier history is summarised under "Before this changelog" at the
bottom; the detailed per-session log lives in `PROJECT_CONTEXT.md`, and the full
record is in `git log`.

## [1.2.31] - 2026-10-06

### Fixed
- **Session: trailing-assistant 400.** Providers such as Mistral/Devstral rejected
  requests with `Cannot have 2 or more assistant messages at the end of the list`.
  On the last allowed step the max-steps notice was appended as an `assistant`
  prefill; it is now sent as a `user` turn (skipped for `json_schema` output), and
  `mergeTrailingAssistants` in `provider/transform.ts` collapses any remaining
  trailing assistant messages. (`89ca899`)
- **Step limit.** The final step is now terminal (`toolChoice: "none"`).
- **Retries.** A retry drops the parts of the failed attempt instead of replaying them.
- **Cleanup / prune.** Keyed on `time_updated` rather than creation time.
- **Reasoning.** Reasoning parts are merged as part of the same trailing-message hardening.
- **Config docs.** The `steps` option now says it is unset by default (no limit).
- **Tests (Linux CI).** `test/team/repo.test.ts` and `coordination.test.ts` ran
  `DELETE FROM project` before every test, which wiped the project row of instances
  cached by earlier test files and made `Session.list` and `tui.selectSession` fail
  with `FOREIGN KEY constraint failed` on Linux. They now delete only their own
  `proj-1` row. (`86b227c`)

### Changed
- **Publishing now uses npm trusted publishing (OIDC)** for the `iris-code` wrapper and
  all 12 `iris-code-*` platform packages. No `NPM_TOKEN` is used for these; the
  `publish-cli` job has `id-token: write` and installs npm >= 11.5.1 on Node 22.
- Generated platform and wrapper `package.json` files now include `repository`, which
  npm's provenance check requires.
- `publish-cli` publishes `iris-code-windows-x64` first, creates the GitHub release
  for the tag if it does not exist, and fails immediately on npm `E401`/`E403`/`E404`/`E422`
  instead of retrying for half an hour.
- `@iris-ai/sdk` and `@iris-ai/plugin` still publish with `NPM_TOKEN` (no trusted
  publisher is configured for them yet).

### Known issues / not yet verified
- No live run of the step-limit path against Mistral/Devstral with `steps: 3`.
- No tests yet for the cleanup SQL (`json_extract` bash filter) or for retry
  part-removal.
- `step++` still consumes the `steps` budget on subtask and compaction rounds
  (`session/prompt.ts`).

## [1.2.30] - 2026-03-27

### Changed
- Team module migrated to Effect services (`TeamRepo`, `TeamCoordination`); database
  access no longer goes through `Database.use()` in team code, and `completeTask` is a
  single transaction. (`7fc4cde`)

## [1.2.29] - 2026-03-26

### Added
- Agent teams wired into the TUI: `team.*` event sync, `TeamProvider`, panels in the
  session layout, `/team`, `/tasks` and `/lead` commands, team keybinds, footer badge.
  (`85c5fb5`)

### Fixed
- `publish-cli` resilience: assets upload before npm publish, individual package
  failures no longer abort the run, longer delays between publishes. (`1b847a6`)
- 1.2.28 was retracted: its wrapper package was published with source dependencies
  instead of platform `optionalDependencies`.

## [1.2.27] - 2026-03-26

First IRIS release.

### Added
- npm packages `iris-code` (wrapper) and `iris-code-<platform>` binaries,
  plus `@iris-ai/sdk` and `@iris-ai/plugin`.
- Experimental agent teams (lead + teammates, shared tasks, cross-session messaging),
  enabled with `OPENCODE_EXPERIMENTAL_AGENT_TEAMS=1` or `config.team.enabled`.

### Changed
- Fork of OpenCode 1.2.x renamed to IRIS: CLI `iris`, config/data dirs, default theme,
  npm scope `@iris-ai`, repository `dragonsarealive/iris-ai`. The `opencode` binary alias
  and the OpenCode Zen/Go/Black product names are deliberately kept.

## Before this changelog

IRIS began as a fork of OpenCode 1.2.x. Releases before 1.2.27 do not exist under the
IRIS name; upstream history is in the OpenCode repository.

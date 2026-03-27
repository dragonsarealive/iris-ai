# PROJECT_CONTEXT — IRIS / OpenCode fork

## 🎯 PROJECT GOAL

**IRIS** — Open-source AI coding agent (fork of OpenCode 1.2.x). Ship a maintainable CLI/TUI + server with plugins, sessions, multi-model support, and experimental **agent teams** (lead + teammates, shared tasks, cross-session messaging). Default git branch: **`dev`**.

---

## 🚦 PROJECT PULSE

| Area | Status |
|------|--------|
| Core CLI / TUI / server | ✅ Working baseline (upstream-derived) |
| Agent teams (experimental) | ✅ Backend + tools + panel components + **TUI wiring complete** (sync `team.*` events, `TeamProvider` mounted, panels in session layout, `/tasks` `/lead` `/team` commands, team keybinds, bootstrap + live SSE, footer badge) — see `specs/tui-agent-teams-integration-checklist.md` |
| IRIS product rename | ✅ CLI `iris`, package name `iris`, XDG app dir `iris`, USER_AGENT `iris/...`; console app i18n + invite email + billing/core/auth copy → IRIS (Zen/Go/Black + CLI `opencode` + @OpenCode handle preserved); full test run ~1336 pass (some flaky PTY/watcher on Windows) |
| Legal transfer | ✅ Terms/Privacy rewritten for Andrés Bolaños Cano / irislab.dev / Costa Rica; Zen = third-party; billing/Stripe/arbitration removed; `LEGAL_NOTICE.md` at root; all `anoma.ly` / `ANOMALY` refs cleared from console/web/desktop legal surfaces |
| GitHub org URLs | ✅ All `anomalyco/opencode` → `dragonsarealive/iris-ai` across CLI, desktop, web docs, workflows, install script, containers, extensions, READMEs; 3 upstream deps kept (`ghostty-web`, `tree-sitter-clojure`, `models.dev`) |
| `bun typecheck` (packages/iris) | ✅ 0 errors; team Effect migration complete; use package-scoped checks |
| Team Effect migration | ✅ All `Database.use()` eliminated from caller files (`index.ts`, `task.ts`, `message.ts`, `orchestration.ts`). DB access only through `TeamRepo` + `TeamCoordination` Effect services. `completeTask` merged into single transaction (TOCTOU fix). 17/17 team tests pass. See `specs/team-effect-migration-checklist.md` + `specs/team-effect-migration-fixes.md` (all fixes complete). |
| **v1.2.29 release** | 🚧 **Windows x64 + wrapper published to npm ✅** — `npm install -g iris-code@1.2.29` verified working (4s install). **11 remaining platform packages need CI dispatch.** v1.2.28 retracted (broken wrapper published source deps). TUI agent teams wiring committed + pushed to `dev`. **Next:** create GH release v1.2.29, then `gh workflow run publish-cli.yml --ref dev -f version=1.2.29 -f channel=latest` |

---

## ⚡ TECH STACK & CONFIG

| Item | Notes |
|------|--------|
| Runtime | Bun |
| Core package | `packages/iris` (npm name **`iris`**) — CLI **`iris`** (alias **`opencode`** → same bin). Data/config under `~/.config/iris` etc. Legacy `opencode.json` / `.opencode/` still loaded, then **`iris.json` / `.iris/`** override. |
| DB | SQLite + Drizzle; migrations under `packages/iris/migration/` |
| SDK regen | `./packages/sdk/js/script/build.ts` |
| Agent teams flag | `OPENCODE_EXPERIMENTAL_AGENT_TEAMS=1` |
| Cursor rules | `AGENTS.md` (root + package), `.cursor/rules/project-context.mdc` |

---

## 🗺️ CODE MAP

| Path | Purpose |
|------|---------|
| `packages/iris/src/team/` | Teams: lifecycle, tasks, messages, plan approval, runner |
| `packages/iris/src/server/routes/team.ts` | `/team` REST API |
| `packages/iris/src/session/prompt.ts` | Agentic loop; team message injection when flag on |
| `packages/iris/src/session/repair-tools.ts` | Before `validateToolIntegrity`, persists `pending`/`running` assistant tool parts as `error` (crash/interrupt recovery) |
| `packages/iris/src/session/message-v2.ts` | `MessageV2.validateToolIntegrity(msgs)` — throws if any assistant message has tool part in pending/running (orphaned tool_use) |
| `packages/iris/src/cli/cmd/tui/` | TUI; `TeamProvider` in `app.tsx`, panels in `routes/session/index.tsx`, events in `sync.tsx`, keybinds + `/tasks` `/lead` `/team` commands — checklist: `specs/tui-agent-teams-integration-checklist.md` |
| `docs/tui-design-research/TUI_DESIGN_TECHNIQUES.md` | TUI design research: sequential reasoning trace, OpenTUI/IRIS alignment, a11y, OSC8, cross-framework patterns |
| `docs/tui-design-research/TUI_COMPONENT_MAP.md` | TUI component map: routes, panels, dialogs, providers, command registrations, unused exports |
| `docs/tui-design-research/TUI_REDESIGN_PROPOSALS.html` | TUI component gallery (HTML): terminal-faithful frames per `TUI_COMPONENT_MAP.md`, iris theme hex from source |
| `specs/agent-teams.md` | Agent-teams checklist + **Phase 11–12** (visible orchestration, lead checklist loop) |
| `specs/team-improvements-backlog.md` | **Prioritized team backlog** (P0–P4): SDK regen, integration tests, tool UX, TUI, API, docs, governance |
| `specs/iris-branding-migration.md` | Branding migration spec (banner/theme/detail) |
| `specs/iris-branding-checklist.md` | **IRIS vs Zen:** full rename checklist (paths, CI, packages, optional scope/env); Zen-only carve-out in §A |
| `script/dev-setup.ts` | `bun run setup` — install + core typecheck (+ optional `--test`) |
| `packages/iris/script/team-live-test.ts` | Live team E2E: `Server.listen` + real `SessionPrompt` + HTTP (same as `iris web`). From `packages/iris`: `bun run team:e2e`. **PowerShell (isolated `.iris-dev`):** `powershell -NoProfile -ExecutionPolicy Bypass -File .\script\run-local.ps1 team-e2e .` |
| `packages/iris/script/validate-user-issues/` | **March 2026 fix validation:** constants, cleanup, tool integrity, provider, config, worktree. Run: `bun run validate:user-issues` (from package). Worktree test skipped on Windows by default; `VALIDATE_SKIP_WORKTREE=1` to skip elsewhere. |
| `script/run-local.ps1` | Local XDG dirs → `.iris-dev`; forwards args to repo `bun run dev` (iris CLI). Example: `powershell -NoProfile -ExecutionPolicy Bypass -File .\script\run-local.ps1 .` |
| `.cursor/skills/iris-dev-setup/` | Cursor skill: dev bootstrap / update workflow |
| `.cursor/commands/iris-*.md` | Slash commands: `/iris-setup`, `/iris-setup-test`, `/iris-dev`, etc. |

**Gotchas:** Tests from package dirs only. Prefer `dev` / `origin/dev` for diffs. Single-word names for new agent-written locals (see `AGENTS.md`).

---

## 🚨 ACTIVE ISSUES

- **v1.2.29 npm publish: 11 of 12 platform packages pending CI dispatch** — `iris-code-windows-x64@1.2.29` + `iris-code@1.2.29` wrapper published and verified. Remaining 11 platforms need `gh workflow run publish-cli.yml --ref dev -f version=1.2.29 -f channel=latest` (create GH release v1.2.29 first). v1.2.28 retracted (wrapper published with 90+ source deps instead of optionalDependencies-only).
- **`completeTask` TOCTOU** — `coordination.ts` `completeTask()` does separate query/tx calls instead of a single transaction. Low risk (SQLite single-writer) but inconsistent with `claimTask` which uses a single `tx()`. Fix spec in `specs/team-effect-migration-fixes.md` Fix 2. **(FIXED)** — merged into single transaction.
- Agent teams SDK: team client methods not in auto-generated SDK yet (SDK regen needed once server runs to extract OpenAPI spec; team types manually exported in `packages/sdk/js/src/v2/team.ts`).
- Team integration tests: `runner/addMember` lifecycle + orchestration feed order tests not yet added (Phase 9 expansion + Phase 12.5).

**Resolved (drift / gaps):** `Config.update` now writes to the same project config chain as `Config.get` (highest-precedence `iris.*` / `opencode.*`, else new `iris.json`); `team_mark_task_progress` with `blocked` persists via `TaskList.block` + `task_blocked` orchestration step; team tool descriptions state lead-only explicitly. **Orphaned `tool_use` session crash:** `repairInterruptedTools` runs before `MessageV2.validateToolIntegrity` in `prompt.ts` and `compaction.ts` so interrupted runs can reopen sessions.

---

## 🎯 NEXT ACTIONS

1. **Complete remaining tasks** — See **`specs/remaining-tasks-plan.md`** for ordered implementation plan.
2. **Dispatch CI for v1.2.29 remaining platforms** — 11 of 12 packages pending. Windows x64 + wrapper already on npm. Create GH release v1.2.29, then: `gh workflow run publish-cli.yml --repo dragonsarealive/iris-ai --ref dev -f version=1.2.29 -f channel=latest`. Verify: `npm view iris-code-linux-x64@1.2.29`.
3. **Homebrew formula** — Update `dragonsarealive/homebrew-tap` with real URLs + sha256 once v1.2.29 npm publish completes.
4. **Team backlog** — Work from **`specs/team-improvements-backlog.md`** (P0→P4). Treat rows there as the implementation checklist; update that file’s checkboxes when items ship.
5. **P0 next** — Integration tests: runner/addMember lifecycle, orchestration feed order, scripted lead tool flow (no live LLM). Then **SDK regen** for typed `/team` client.
6. **Branding/legal** — Legal transfer complete (`specs/legal-transfer-checklist.md`). GitHub org URLs migrated to `dragonsarealive/iris-ai`. Publish infrastructure checklist at `specs/publish-infrastructure-checklist.md`. **Remaining:** §1c video/poster/zip files when added. §5 Zen smoke test (manual). **Teams cookbook** when P3 doc row is scheduled.

---

## 📋 TEAM IMPROVEMENTS (summary)

| Tier | Focus |
|------|--------|
| **P0** | SDK regen, runner/addMember + orchestration order tests, scripted Phase 12.5 lead flow |
| **P1** | Optional `team_create`, conditional team tools in registry, richer tool errors, task IDs in `teamContext` |
| **P2** | Stuck-task nudge, opt-in auto/suggest `done`, enforce `max_teammates`, idempotent “team for session” API |
| **P3** | TUI teammate activity + bootstrap toast, orchestration-as-progress, event docs, worktree cleanup, usage split, cookbook |
| **P4** | Teammate read boundary (policy), audit export |

**Full numbered list + sequencing:** `specs/team-improvements-backlog.md`

---

## 📚 DETAILED REFERENCES

- `specs/legal-review-checklist.md` — Terms/Privacy review before ship (solo or counsel)
- `specs/legal-transfer-checklist.md` — Full legal entity transfer checklist (Andrés Bolaños Cano / irislab.dev)
- `LEGAL_NOTICE.md` — Repo-root legal notice (owner, Zen third-party disclaimer)
- `specs/remaining-tasks-plan.md` — **ordered implementation plan** for completing all pending work (Effect commit, CI dispatch, Homebrew, P0 backlog)
- `specs/team-improvements-backlog.md` — **implementation checklist** (P0–P4) for agent teams
- `specs/agent-teams.md` — architecture + phased checklist
- `research/opencode-user-issues/opencode-user-issues-march-2026.md` — known user issues + March 2026 fixes; validated by `bun run validate:user-issues`
- `AGENTS.md` — SDK regen, style, testing, branch defaults
- `packages/iris/AGENTS.md` — DB / Effect conventions

---

## 📊 CURRENT STATUS SUMMARY

**~85% core product parity; ~95% agent-teams spec (phases 1-12 done + TUI wiring + Effect migration); v1.2.29 release ~15% complete** (Windows x64 + wrapper on npm, verified working; 11 platform packages pending CI dispatch). Team Effect migration complete: all `Database.use()` calls eliminated from team module callers, 17/17 tests pass. Next priority: commit Effect migration, dispatch CI for remaining platforms, Homebrew formula, then P0 backlog (integration tests + SDK regen).

---

## 📝 SESSION LOG

| Date | Notes |
|------|--------|
| 2026-03-18 | Created `PROJECT_CONTEXT.md`. Agent-teams continuation: plan reject fix, task unblock emits, task tool `async` mode, runner + waitForCompletion, prompt loop team message injection, plan_exit + team approval path, `TeamProvider` + keybinds (`team_next` / `team_prev` / `team_lead` / `team_task_list`). Activated `.cursor/rules/project-context.mdc`. |
| 2026-03-18 | Added executable Bun tests: `test/team/team.test.ts` (team lifecycle, message queue, task dependency claims) and `test/cli/iris-branding.test.ts` (ASCII IRIS banner, CLI logo ANSI colors, IRIS palette invariants). Verified passing locally via package-scoped test run. |
| 2026-03-18 | **IRIS rename:** package `iris`, bins `iris`+`opencode`, `Global.Path` app `iris`, dual config (opencode→iris), `.iris` dirs + plans, managed `/etc/iris` etc., `packages/web` devDep `iris`, root `package.json` name `iris`. Path-traversal tests use OS-safe outside paths on Windows. |
| 2026-03-18 | **Dev setup skill:** `.cursor/skills/iris-dev-setup/SKILL.md` + root scripts `setup` / `setup:test` running `script/dev-setup.ts` (install, `packages/iris` typecheck, optional tests). |
| 2026-03-18 | Fixed typecheck: `getPendingForSession` uses `teamID` const before DB callback (closure narrowing); team tests pass `requirePlanApproval`. |
| 2026-03-18 | Cursor slash commands under `.cursor/commands/` (`/iris-setup`, `/iris-setup-test`, `/iris-setup-typecheck-only`, `/iris-update-repo`, `/iris-dev`, `/iris-sdk-regen`); skill lists them. |
| 2026-03-18 | `specs/agent-teams.md`: completion criteria, status table, **Phase 11** (orchestration visibility), **Phase 12** (lead tools + markdown checklist tasks); architecture layer for observability. |
| 2026-03-18 | Researched OpenCode user pain points (March 2026) + deep codebase analysis via sequential thinking. Produced esearch/opencode-user-issues/iris-fix-plan.md\ (6-sprint fix roadmap). Critical: orphaned tool_use 400 errors (\message-v2.ts\), plugin substring skip (\plugin/index.ts:64\), parallel LSP fix (\pply_patch.ts\), snapshot OOM guard (\snapshot/index.ts\). IRIS-native: watchdog agent, anchored compaction, FTS5 memory layer, safer permission defaults. |

| 2026-03-18 | **Agent teams phases 7-12 completed:** TuiEvent team variants (7.4); team-lead/teammate agent modes (8.1); team config block (8.2); team.orchestration.step event + team_orchestration_step DB table + migration (11.1-11.2); orchestration.ts emitting from all lead-relevant paths; TUI panels team-status/task-list/team-inbox/orchestration (7.7-7.9, 11.3); wired into session layout (7.10); plan events fixed in sync store; team-context system prompt injection (8.5); lead tools team_spawn_teammate/team_prompt_teammate/team_correct_teammate/team_mark_task_progress in tool/team.ts (12); registered in ToolRegistry behind flag (8.4); team bootstrap via raw fetch in sync.tsx; SDK team types in packages/sdk/js/src/v2/team.ts. typecheck passes. |
| 2026-03-18 | **Agent teams toggle via TUI:** Added `Flag.agentTeams()` async helper (env var OR `config.team.enabled`); wired in registry.ts/prompt.ts/system.ts/plan.ts/tool/team.ts. Added `/team` slash command in app.tsx (toggles `team.enabled` in project config via `sdk.client.config.update()`, reactively updates store). Footer now shows `⚡ Teams` badge when enabled. Team nav commands shown when either flag or config enables it. typecheck passes. |
| 2026-03-19 | **Teams indicator persistence + chat validation:** Fixed teamsEnabled reactivity (createSignal + createEffect in team.tsx; explicit set on /team toggle). Footer mounted in `routes/session/index.tsx`. Chat API smoke-tested vs live server. |
| 2026-03-19 | **Teams multi-model run:** GET `/team/:teamID/message` added; message pipeline verified. |
| 2026-03-19 | **Cross-boundary drift fixes:** `Config.update` targets real project config files (not orphan `config.json`); supports `.jsonc` merge. `TaskList.block` + `task_blocked` orchestration; lead-only wording on team tools. Prompt/tool names already aligned (`team_mark_task_progress` in system.ts). |
| 2026-03-19 | **Team tool agent path:** `test/tool/team.test.ts` — registry + spawn/prompt/mark/correct via real `Tool.init`/`execute`; teammate rejects lead tools. All pass. |
| 2026-03-19 | **Live team E2E:** `script/team-live-test.ts` + `bun run team:e2e` — real `Server.listen`, `POST /session` + `/team` + `/session/.../message` on user project; verified 2 team members + worktree on `E:\\opencode` (~3m, user provider). |
| 2026-03-19 | **`script/run-local.ps1`:** `param()` + `@Passthrough`; documents `powershell -NoProfile -ExecutionPolicy Bypass -File .\script\run-local.ps1 .`; adds `team-e2e [.]` using same `.opencode-dev` XDG paths. |
| 2026-03-19 | **Team auto-provision:** First team lead tool call creates `TeamModule` + `session.team_id` if missing (`ensureTeamLead`); system `teamContext` explains this when no team yet. Fixes “not part of a team” when teams are enabled. |
| 2026-03-19 | **`specs/team-improvements-backlog.md`:** P0–P4 implementation list (SDK, tests, tool UX, TUI, API, docs, governance) + suggested sprints; `PROJECT_CONTEXT` NEXT ACTIONS + summary table point to it. |
| 2026-03-20 | **`run-local.ps1`:** Pre-flight `Write-Host` — explains silent window before TUI (migration / plugins / worker); points to `--print-logs`. |
| 2026-03-20 | **Interrupted tool repair:** `session/repair-tools.ts` (`repairInterruptedTools`) — pending/running assistant tool parts → persisted `error` before integrity check; wired in `prompt.ts` + `compaction.ts`. Test: `test/session/repair-tools.test.ts`. |
| 2026-03-20 | **March 2026 user-issues validation:** Added `MessageV2.validateToolIntegrity()` in `message-v2.ts` (fix 3.2). Created `script/validate-user-issues/` (constants, cleanup, tool-integrity, provider, config, worktree) to validate fixes from `research/opencode-user-issues/opencode-user-issues-march-2026.md`. `bun run validate:user-issues` from `packages/iris`; worktree test skipped on Windows by default. |
| 2026-03-20 | **IRIS rename (continued):** Root `package.json` name → `iris`; TUI default theme → `iris` (theme.tsx: import iris, DEFAULT_THEMES.iris, kv/get fallback, error fallback, resolveTheme fallback); tips.tsx user-facing copy → `iris`/`IRIS` and `iris.json`/`iris run`/`iris serve` etc. |
| 2026-03-20 | Added `specs/iris-branding-checklist.md` — actionable IRIS branding checklist with **Zen-only** exceptions (provider id, Zen URLs/headers); covers subfolders, CI paths, web/app/desktop, optional npm scope + env migration. |
| 2026-03-20 | **Branding checklist (batch):** CI/workflows + root scripts + sdk/web/console/desktop/e2e-local → `packages/iris`; dev isolation `.iris-dev` (run-local, skill, code map); OpenAPI **IRIS API**; TUI worker + app basic-auth default `iris`; app persist/theme/E2e `iris.*` + legacy migration; `__iris_e2e`; web Starlight title IRIS; `AGENTS.md` paths. |
| 2026-03-20 | **Branding checklist (execute):** IRIS ASCII banner (`getBanner`, CLI/TUI logo), `mirror-iris-env` + `Flag.OPENCODE_EXPERIMENTAL_AGENT_TEAMS`, `product/links.ts`, workspace pkg **`iris`** + `bun.lock` `packages/iris`, web `iris/session/*` + i18n IRIS strings + `config.mjs` env overrides, `packages/ui/theme/themes/iris.json`, VS Code display/titles, Electron menu/title, README/CONTRIBUTING/research INDEX, CLI serve/thread/attach/pr/web/uninstall copy, `pr` fixes (`argv` shadowing). Checklist file updated; §H scope + §F builder IDs still open. |
| 2026-03-20 | **Console rebrand:** `packages/console/app/src/i18n` (17 locales) OpenCode→IRIS in values; preserved OpenCode Zen/Go/Black, `opencode` CLI/config strings, `go.testimonials.handle` @OpenCode; `InviteEmail.tsx` + `core/user.ts` invite subject; `billing.ts` iris credits; `function/auth.ts` GitHub User-Agent `iris`. `config.ts` URLs unchanged. |
| 2026-03-20 | **CONTRIBUTING.md:** Simplified for fork maintainer workflow — open PRs, optional issues, no upstream issue-first / vouch / template policy; kept dev/build/debug essentials + `AGENTS.md` link. |
| 2026-03-20 | **Desktop Electron i18n:** Rebranded updater + CLI strings (`OpenCode` → `IRIS`, `'opencode'` → `'iris'`) in locales ar, br, bs, da, de, es, fr, ja, ko, no, pl, ru, zh, zht under `packages/desktop-electron/src/renderer/i18n/`. |
| 2026-03-20 | **Root translated READMEs (`README.*.md`):** Rebranded product copy to IRIS; preserved header links/badges, `OpenCode Zen`, registry package names (`opencode-ai`, scoop/brew/choco, etc.), screenshot alt `IRIS Terminal UI`; taglines note fork of OpenCode; per-locale **Environment variables** (`IRIS_*` / `OPENCODE_*`) aligned with English; **Building on OpenCode** section kept upstream naming for third-party disclaimer. |
| 2026-03-20 | **`packages/iris/src` OpenCode→IRIS:** TUI titles/update toast, sidebar/permission copy; OpenAPI route descriptions (session/pty/project/global/experimental/config); Codex + MCP OAuth HTML/provider `client_name`; ACP agent `IRIS Login` / `agentInfo.name`; prompts `anthropic.txt` + `codex_header.txt` (kept `https://opencode.ai/docs`). Left Zen/Go tips, dialog-provider, session index comment, ACP README, ACP file-storage comment unchanged. |
| 2026-03-20 | **Branding batch verify:** Confirmed listed `packages/iris/src` OpenCode→IRIS items (TUI, routes, Codex/MCP OAuth, prompts, ACP labels) already match spec; Zen carve-outs + ACP file-storage comment unchanged. |
| 2026-03-20 | **`packages/app/src/i18n`:** Verified 17 locales — product copy already IRIS; **OpenCode Zen** / **OpenCode Go** / `opencode.json` filenames unchanged. Fixed **pl** `error.chain.mcpFailed` + WSL strings (were English); **da**/**br** WSL titles localized. |
| 2026-03-20 | **Branding session 2 summary:** Completed §F (desktop-electron: appId/protocol/builder/cli/constants/migrate/windows/renderer/i18n), §B (resources folder), §G (console i18n+email+billing+auth), §J (21 translated READMEs). Verification: grep clean (Zen-only remains), build passes, 8/8 tests pass, typecheck 44 pre-existing team errors only. Checklist updated. §H npm scope deferred (large cross-monorepo migration). |
| 2026-03-20 | Added `specs/legal-review-checklist.md` (Terms/Privacy review); `specs/next-steps.md` points to it for legal follow-up. |
| 2026-03-20 | **`specs/branding-remaining-items.md` executed:** §1 Asset renames — brand/lander SVGs → iris-*; Zed icon opencode.svg → iris.svg + extension.toml; all imports + data-page="iris" + Meta iris:auth updated; brand page + index/zen/download routes. §2 Legal — Terms & Privacy product copy → IRIS (OpenCode Zen + opencode.ai URLs kept); Title/Meta updated; **legal sign-off** still required before merge. §4 SDK regen run (`bun run script/build.ts` from packages/sdk/js). §3 npm scope deferred; §5 Zen smoke test manual. |
| 2026-03-20 | **`specs/legal-review-checklist.md`:** Terms/Privacy pre-ship checklist (solo or counsel); `next-steps.md` §3 updated to reference it. |
| 2026-03-20 | **npm scope migration (§H):** Implemented `specs/npm-scope-migration-checklist.md` — `@opencode-ai/*` → `@iris-ai/*` across package.json (name + deps), turbo.json, all source (packages/ + script/), openapi.json, github/ subtree, CONTRIBUTING + specs + research. Root override for `@gitlab/opencode-gitlab-auth` omitted until `@iris-ai/plugin` is published. `bun install` succeeds; typecheck unchanged (pre-existing team/SDK errors). |
| 2026-03-22 | **Legal transfer (full):** Owner: Andrés Bolaños Cano, irislab.dev, Costa Rica. Rewrote Terms of Service (removed ANOMALY INNOVATIONS entity, Stripe/billing/payment sections, US arbitration/JAMS/class-waiver; added Zen as third-party disclaimer, Costa Rica governing law + Heredia venue, MIT License OSS carve-out). Rewrote Privacy Policy (removed 13 US state sections, Google Analytics, payment data, phone/address; narrowed to OSS reality — local data stays local, essential cookies only, third-party provider disclaimer). Created `LEGAL_NOTICE.md` (repo root). Updated footers: `legal.tsx`, `black.tsx`, `black/workspace.tsx`, `temp.tsx`, `Lander.astro`, `Footer.astro` → `© IRIS / irislab.dev`. Swapped `contact@anoma.ly` → `andres.cano@reapstudios.com` in `billing-section.tsx`, `go/index.tsx`, `enterprise.ts`, `aws.ts`, `web/config.mjs`. Updated `Cargo.toml` authors, `appstream.metainfo.xml` developer. Age: 13 (COPPA standard, consistent across both docs). Specs: `specs/legal-transfer-checklist.md` created with full item list. |
| 2026-03-22 | **GitHub org migration:** Fork at `dragonsarealive/iris-ai`. Batch-replaced all `anomalyco/opencode` → `dragonsarealive/iris-ai` across ~120 files: CLI (installation, prompts, tips, github.ts, publish.ts), desktop (Tauri updater, Electron builder, menus, appstream.metainfo.xml), web docs (English + 18 locales × 4 files), containers (Dockerfiles + build script + README), extensions (Zed), console/enterprise routes, GitHub workflows (publish/sign-cli/stats/opencode.yml), `github/` action, `install` script, root + 21 translated READMEs, `.opencode/` tools/glossary/commands, `sdks/vscode`, `infra/console.ts`, `script/` (changelog/stats/sync-zed), `SECURITY.md`, `LEGAL_NOTICE.md`. Also updated brew tap `anomalyco/tap/opencode` → `dragonsarealive/tap/iris`, docker `ghcr.io/anomalyco` → `ghcr.io/dragonsarealive`, electron-builder prod/beta repos. **3 upstream deps kept:** `anomalyco/ghostty-web` (app dep), `anomalyco/tree-sitter-clojure` (parser wasm), `anomalyco/models.dev` (CONTRIBUTING ref). |
| 2026-03-25 | **Publish fixes checklist (§1–§2):** Completed all blocker + recommended items from `specs/publish-fixes-checklist.md`. Root `package.json` repo URL; LICENSE IRIS copyright; SECURITY.md email/product name/env vars; `docs-update.yml` org refs; InviteEmail defaults; auth.ts `@anoma.ly`→`@irislab.dev`; desktop-electron metadata; Zed authors; daily recap wording; console `data-slot` anomaly→iris + CSS selectors; handler.ts workspace comment; SDK `repository` field. §2.6 (web API host) deferred. |
| 2026-03-25 | **Team typecheck (§3) — 44→0 errors:** Added Drizzle table defs (`TeamTable`, `TeamMemberTable`, `TeamMessageTable`, `TaskItemTable`, `TeamOrchestrationStepTable`) + `team_id` column to `SessionTable` in `session.sql.ts`. Added `teamID` to `Session.Info` zod schema + `fromRow`/`toRow`. Added `Flag.agentTeams()` async (env + config). Added `team` config block (`enabled`, `max_teammates`, `teammate_mode`). Added team properties + `OrchestrationStepInfo` to TUI sync store. Wired team tools into `ToolRegistry` behind `Flag.agentTeams()` gate. `bun typecheck` passes clean; 9/9 team tests pass. |
| 2026-03-26 | **CI workflow cleanup (Phase 3):** Deleted 26 unneeded workflows (deploy, sign-cli, stats, containers, publish-vscode, sync-zed-extension, storybook, notify-discord, opencode, review, triage, duplicate-issues, daily-issues-recap, daily-pr-recap, pr-management, docs-update, docs-locale-sync, generate, beta, nix-hashes, vouch-check-issue, vouch-check-pr, vouch-manage-by-issue, publish-github-action, release-github-action, publish). Kept 7: typecheck, test, compliance-close, stale-issues, close-stale-prs, pr-standards, nix-eval. Fixed `blacksmith-*` runners → `ubuntu-latest`/`windows-latest` in typecheck, test, nix-eval. Removed `e2e` job from test.yml (referenced deleted `packages/app`). Updated git identity to `iris`/`bot@irislab.dev`. |
| 2026-03-26 | **Build/publish naming alignment (Phase 4):** Removed `private: true` from `packages/iris/package.json`, added `files` field and `iris-code` bin entry. Wrapper package name changed from `iris-code-ai` → `iris-code` in `publish.ts`. Platform package prefix `opencode-*` → `iris-code-*` in `postinstall.mjs`, `build.ts`, `bin/iris`, `bin/opencode`. Compiled binary `bin/opencode` → `bin/iris-code`. User-agent `iris-code/…`. Release artifact names (`sha256sum`, AUR PKGBUILD, Homebrew formula) updated to `iris-code-*`. Fixed stale `@opencode-ai/script` imports → `@iris-ai/script` in build.ts/publish.ts. Script version registry URL → `iris-code`. `turbo.json` filter `opencode#test` → `iris-code#test`. Created `publish-cli.yml` workflow: 4 jobs (build-cli, publish-cli, publish-sdk, publish-plugin), tag-triggered + manual dispatch with dry_run, uploads release artifacts on tag push; SDK and plugin use their existing `publish.ts` scripts. |
| 2026-03-26 | **First release v1.2.27 (Phase 5):** `bun install` + `bun typecheck` (0 errors) + `bun run build --single` (Windows x64) all pass; binary reports `1.2.27`. Published to npm: `@iris-ai/sdk@1.2.27`, `@iris-ai/plugin@1.2.27`, `iris-code-windows-x64@1.2.27`, `iris-code@1.2.27` (wrapper with 12 platform optional deps). Created GitHub Release `v1.2.27` at `dragonsarealive/iris-ai` with Windows x64 zip. Configured `NPM_TOKEN` as GitHub repo secret for CI. Fresh `npm install iris-code@1.2.27` verified: platform binary `iris-code.exe --version` → `1.2.27`. **Remaining:** push code to GitHub so `publish-cli.yml` can build+publish Linux/macOS binaries; update Homebrew formula with real binary URLs + sha256. |
| 2026-03-26 | **Phased publish — Commit 1:** `chore: remove archived packages, update workspace config` (~3.7k paths): removed archived packages (`packages/app`, `console`, `desktop`, `desktop-electron`, `docs`, `enterprise`, `extensions`, `function`, `identity`, `slack`, `storybook`, `ui`, `web`), `packages/containers`, `infra/`, `sdks/`, root `AGENTS.md`, `specs/project.md`, plus `.gitignore`, `turbo.json`, `package.json`. Cleared a dirty index with `git reset HEAD --` first; force-added `specs/project.md` (`git add -f`). Left later-phase changes (e.g. `.github/workflows/`) unstaged. |
| 2026-03-26 | **Phased publish — Commits 2–5:** Commit 2 `docs: IRIS branding, legal, install script, dev scripts` (READMEs, `LEGAL_NOTICE.md`, `github/`, `.opencode/`, root `script/*.ts`, `run-local.*`). Commit 3 `ci: remove 26 unused workflows, fix runners` (all `.github/workflows/` except new `publish-cli.yml`). Commit 4 `feat: rename opencode to iris, align build naming` (`packages/opencode` removal + `packages/iris` rename tree, `packages/sdk`/`plugin`/`script`/`util`, `bun.lock`, `publish-cli.yml`; unstaged phase-5-only paths before commit). Commit 5 `feat: agent teams, repair-tools, tests` (team module, `/team` route, TUI `team` context + panels, migrations, `repair-tools`, `validate-user-issues`, team/repair tests, `packages/sdk/js/src/v2/team.ts`). `dev` is 5 commits ahead of `origin/dev`; push when ready. |
| 2026-03-26 | **Publish pipeline + CI:** Pushed `dev`; deleted remote `v1.2.27` tag; `gh release edit v1.2.27 --target dev`. Fixed `publish-cli` build (stale `@opencode-ai/*` → `@iris-ai/*`, committed `theme/iris.json`, `.gitignore` only ignore `/iris.json`), npm skip-if-version-exists for SDK/plugin, inter-publish `sleep` + retry backoff for E429, `RELEASE_TAG` + `OPENCODE_RELEASE` for manual dispatch so release assets upload to `v*`. **Test workflow:** `db.test.ts` expected `iris*.db` to match `Database.Path`; `Instance.containsPath` tests use volume-root `__iris_test_outside__/*` paths instead of `/etc/passwd` (Windows-safe). |
| 2026-03-26 | **npm E429 rate limit blocker:** 9/12 platform packages published; 3 stuck on E429 (`iris-code-linux-x64`, `iris-code-windows-arm64`, `iris-code-windows-x64-baseline`). Patched `publish-cli.yml`: moved asset upload before npm publish (release archives now on GitHub), continue-on-failure for individual packages, increased delays (180s between packages, 120s initial retry). Created `script/manual-publish-missing.ps1` (local fallback). Local cross-compile blocked by Bun CDN download failures on Windows. Multiple CI re-dispatches all hit E429. **Status:** waiting for rate limit to clear, then re-dispatch. See `DEFECT_REPORT_publish-cli-e429.md`. |
| 2026-03-26 | **TUI agent teams wiring plan:** Added `specs/tui-agent-teams-integration-checklist.md` — gap analysis (no `TeamProvider` mount, no `team.*` sync events, no keybinds/slash), phased A–F checklist, package bump + publish steps. |
| 2026-03-26 | **TUI exit hint:** Session route exit banner “Continue” line was hardcoded `opencode -s`; now uses invoked binary basename (`iris-code`, `iris`, `opencode`, etc.) via `cliInvokeName()` in `routes/session/index.tsx`. |
| 2026-03-26 | **TUI sidebar brand:** Session sidebar footer used split “Open”/“Code” styling (read as OpenCode); replaced with **IRIS** + version in `routes/session/sidebar.tsx`. |
| 2026-03-26 | **TUI agent teams wiring (complete):** Implemented `specs/tui-agent-teams-integration-checklist.md` phases A-F. `sync.tsx`: `handleTeamEvent()` for all `team.*` bus events + `syncTeams()` bootstrap. `app.tsx`: `TeamProvider` mounted, `/team` `/tasks` `/lead` slash commands, `team.created` toast. `routes/session/index.tsx`: `TeamStatus`/`TaskList`/`TeamInbox`/`OrchestrationPanel` gated behind `teamActive()`. `config.ts`: added `team_next`/`team_prev`/`team_lead`/`team_task_list` keybinds (default `none`). `footer.tsx`: Teams badge. `event.ts`: `TuiEvent.TeamNavigate`. Typecheck clean, 9/9 team tests pass. |
| 2026-03-26 | **v1.2.29 publish (Windows):** v1.2.28 wrapper was broken (published source `package.json` with 90+ hard deps including `workspace:*` and `catalog:` refs instead of CI-generated optionalDependencies-only wrapper). Unpublished; npm 24h cooldown forced bump to v1.2.29. Built Windows x64 (`--single --skip-install`), created correct wrapper (12 optionalDependencies, no hard deps, 5 files / 3.8KB), published both. `npm install -g iris-code@1.2.29` verified working (4s, 2 packages). TUI agent teams + version bump committed + pushed to `dev` (`85c5fb5`). 11 remaining platform packages await CI dispatch. |
| 2026-03-26 | **TUI design research:** Added `docs/tui-design-research/` (`TUI_DESIGN_TECHNIQUES.md`, `README.md`) — sequential-thinking trace, explore-subagent IRIS stack (OpenTUI+Solid), March 2026 terminal capabilities (OSC8, theme mode, live render), a11y/CLI patterns, cross-framework table; linked from `PROJECT_CONTEXT` code map. |
| 2026-03-26 | **TUI component map:** Added `docs/tui-design-research/TUI_COMPONENT_MAP.md` — full inventory of `packages/iris/src/cli/cmd/tui` (routes, panels, `ui/` dialogs, prompt stack, command palette, contexts, utils); notes `DialogSubagent`/`DialogTag` as unused; README + code map updated. |
| 2026-03-26 | **TUI redesign proposals:** Added `docs/tui-design-research/TUI_REDESIGN_PROPOSALS.html` — three proposals (Signal & Rail, Paper Terminal, Focus Stream) grounded in design techniques + component map; color tokens, ASCII wireframes, form/dialog mocks, shared DialogSubagent wiring (`/subagent`, header, tabs, optional DialogMessage); README + code map link. |
| 2026-03-26 | **TUI redesign narrowed:** `TUI_REDESIGN_PROPOSALS.html` now **Signal & Rail only** — removed B/C and comparison matrix; added sequential-thinking refinement, research→improvements table, elevation colors, narrow/overlay rail wireframe, transcript role taxonomy (USER/ASST/TOOL/SYS), enhanced DialogSubagent table + future actions; README + code map updated. |
| 2026-03-26 | **TUI HTML gallery:** Replaced redesign narrative in `TUI_REDESIGN_PROPOSALS.html` with **terminal-faithful** `<pre>` frames for every `TUI_COMPONENT_MAP.md` visual (routes, panels, `ui/` dialogs, command palette, borders, spinner, toast, ErrorComponent dark colors from `app.tsx`, Logo 3-line colors from `logo.tsx`); providers/utils as explicit “no pixels” lines; theme = default **iris** JSON hex. |
| 2026-03-26 | **Interactive TUI mock in HTML:** `TUI_REDESIGN_PROPOSALS.html` — top section with command line: routes (`home`/`session`), `teams`/`permission` toggles, `toast <msg>`, slash commands mapping to dialog mockups, `esc`/`clear`; scrollable command history; modal overlay + toast layer; README updated. |
| 2026-03-26 | **TUI HTML gallery UX:** `TUI_REDESIGN_PROPOSALS.html` — system-ui doc shell, skip link, TOC, guided steps + quick-action buttons (`data-mock-cmd`), labeled Command log / Current screen, `aria-live` announcer, default **Home**, static catalog in collapsed `<details>`, `clear` → Home; README updated. |
| 2026-03-26 | **TUI task tool click → subagent session:** `InlineTool` now attaches `onMouseUp` to inner `<text>` (and spinner wrapper) so OpenTUI hit-tests match `task` rows; `resolveTools` `metadata()` merges into running tool state instead of replacing `time`/fields; `task` tool `await Promise.resolve(ctx.metadata(...))`; `Task` UI resolves child session from `metadata.sessionId` or `task_id:` in output + `createEffect` to sync child messages. |
| 2026-03-26 | **Teams Feature Risk Analysis + Fixes:** Analyzed 3 risks in agent teams (sync DB ops, no coordination, passive orchestration). Created Effect-based services: `TeamRepo` (repo.ts), `TeamCoordination` (coordination.ts). Code review identified dead code + bugs. Migrated callers: `TeamModule` → `TeamRepo`, `TaskList.claim` → `TeamCoordination`. Fixed `updateMemberStatus()` bug (was only filtering by team_id, not team_id+session_id). Deleted `orchestrator.ts` (singleton runtime leak, busy-wait polling, silent error swallowing). Added `TeamCoordination` to `InstanceServices`. 13 tests pass, typecheck clean. Updated `docs/teams-analysis/RISKS_AND_FIXES.md` with resolution notes. |
| 2026-03-26 | **Team Effect migration (complete):** Full migration of all `Database.use()` calls in `src/team/` to Effect services. `index.ts`, `task.ts`, `message.ts`, `orchestration.ts` now delegate to `TeamRepo`/`TeamCoordination` via `runPromiseInstance()`. Fixed test failures from `AsyncLocalStorage` context (local `emitOrchestration` helper in `coordination.ts`). Removed `as any` cast in `repo.ts` (`action` param typed as `OrchestrationAction`). Cleaned dead imports. Merged `completeTask` into single transaction (TOCTOU fix). 17/17 team tests pass, typecheck clean. Created `specs/remaining-tasks-plan.md` implementation plan for next agent. |
| 2026-03-27 | **Team Effect migration post-review fixes:** Removed dead imports from `orchestration.ts` (`eq`, `TeamOrchestrationStepTable`, `SessionID`). Fixed missing `r.addMember(member)` call in `index.ts` (addMember was constructing member but not persisting to DB). Typecheck clean, team tests pass. |

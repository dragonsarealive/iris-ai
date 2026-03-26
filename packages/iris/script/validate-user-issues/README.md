# March 2026 user-issues fix validation

Scripts that validate the fixes from [research/opencode-user-issues/opencode-user-issues-march-2026.md](../../../research/opencode-user-issues/opencode-user-issues-march-2026.md) in real conditions.

## Run

From `packages/iris`:

```bash
bun run validate:user-issues
```

Or directly:

```bash
bun script/validate-user-issues/run.ts
```

## What is validated

| Area | Checks |
|------|--------|
| **Constants (1.1, 2.1, 2.4)** | `DEFAULT_CHUNK_TIMEOUT` 600s, `MAX_FILE_SIZE` 10MB, `MAX_DIFF_SIZE` 1MB, `MAX_SNAPSHOT_SIZE` 256MB, `GIT_SIZE_LIMIT` 50MB |
| **Cleanup (2.2)** | `scheduleCleanup`, `cleanupOldData`, `pruneLargeBashOutputs`, 6h interval, 30-day retention |
| **Tool integrity (3.2)** | `MessageV2.validateToolIntegrity` exists, throws on orphaned `tool_use`; `repairInterruptedTools` exists |
| **Provider (5.1)** | `mergeProvider` uses `match ?? { id, models: {} }` for custom providers |
| **Config (1.3)** | `continue_loop_on_deny` default `true` |
| **Worktree (6.1)** | In a git worktree, `Instance.worktree` / `Instance.repoRoot` point to worktree dir (skipped on Windows by default) |

## Env

- **VALIDATE_SKIP_WORKTREE=1** — Skip worktree test (e.g. when git or Effect causes issues).
- **VALIDATE_SKIP_WORKTREE=0** — On Windows, force running the worktree test (may crash Bun on some setups).

## Exit code

- `0` — All checks passed.
- `1` — One or more checks failed (or script error).

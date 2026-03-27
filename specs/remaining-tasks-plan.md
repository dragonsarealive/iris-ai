# Remaining Tasks — Ordered Implementation Plan

> **Created:** 2026-03-26 | **Context:** Team Effect migration complete, v1.2.29 Windows published.  
> **Read first:** `PROJECT_CONTEXT.md`, then follow tasks in order below.

---

## Phase 1: Commit & Push Effect Migration

**Goal:** Get the Effect migration code onto `dev` so CI builds include it.

### 1.1 Verify tests pass locally

```bash
cd packages/iris
bun test test/team/
```

**Expected:** 17/17 pass (team.test.ts + coordination.test.ts).

### 1.2 Verify typecheck

```bash
cd packages/iris
bun typecheck
```

**Expected:** 0 errors.

### 1.3 Review changed files

Run `git diff --name-only` from repo root. The Effect migration touched:

| File | What changed |
|------|-------------|
| `packages/iris/src/team/index.ts` | `create`, `addMember`, `disband`, `get`, `list`, `members`, `updateMemberStatus` now delegate to `TeamRepo` via `runPromiseInstance()`. No more `Database.use()`. |
| `packages/iris/src/team/task.ts` | `create`, `claim`, `complete`, `block`, `list` delegate to `TeamCoordination` via `runPromiseInstance()`. No more `Database.use()`. |
| `packages/iris/src/team/message.ts` | `send`, `inbox`, `getPendingForSession`, `markDelivered`, `listByTeam` delegate to `TeamRepo`. Dead imports removed (`TeamMessageTable`, `TeamMemberTable`). |
| `packages/iris/src/team/orchestration.ts` | `emit` and `list` delegate to `TeamRepo`. Now async. |
| `packages/iris/src/team/repo.ts` | New Effect service. Methods: `create`, `get`, `list`, `update`, `disband`, `addMember`, `getMembers`, `updateMemberStatus`, `setSessionTeamID`, `sendMessage`, `getInbox`, `getPendingMessages`, `markDelivered`, `listMessagesByTeam`, `getLeadMember`, `emitOrchestrationStep`, `listOrchestrationSteps`. |
| `packages/iris/src/team/coordination.ts` | New Effect service. Methods: `claimTask`, `dispatchTask`, `getPendingTasks`, `getIdleTeammates`, `createTasks`, `completeTask`, `blockTask`, `listTasks`. Local `emitOrchestration` helper avoids `AsyncLocalStorage` context requirement. |
| `packages/iris/src/effect/instances.ts` | Added `TeamCoordination` to `InstanceServices` type union + `LayerMap`. |
| `specs/team-effect-migration-checklist.md` | Migration checklist (reference). |
| `specs/team-effect-migration-fixes.md` | Fix details (reference). |
| `docs/teams-analysis/RISKS_AND_FIXES.md` | Analysis doc with code review comments + responses. |

### 1.4 Stage and commit

```bash
git add packages/iris/src/team/index.ts packages/iris/src/team/task.ts packages/iris/src/team/message.ts packages/iris/src/team/orchestration.ts packages/iris/src/team/repo.ts packages/iris/src/team/coordination.ts packages/iris/src/effect/instances.ts specs/team-effect-migration-checklist.md specs/team-effect-migration-fixes.md docs/teams-analysis/RISKS_AND_FIXES.md
git commit -m "refactor: migrate team module to Effect services (TeamRepo + TeamCoordination)"
```

### 1.5 Push

```bash
git push origin dev
```

---

## Phase 2: Dispatch CI for v1.2.29 (11 remaining platforms)

**Goal:** Publish all remaining platform packages to npm.

### 2.1 Create GitHub Release v1.2.29 (if it doesn't exist)

```bash
gh release view v1.2.29 --repo dragonsarealive/iris-ai 2>$null
# If it doesn't exist:
gh release create v1.2.29 --repo dragonsarealive/iris-ai --target dev --title "v1.2.29" --notes "Agent teams TUI wiring + Effect migration. Windows x64 verified."
```

### 2.2 Dispatch the workflow

```bash
gh workflow run publish-cli.yml --repo dragonsarealive/iris-ai --ref dev -f version=1.2.29 -f channel=latest
```

The workflow will:
- Skip `iris-code-windows-x64@1.2.29` (already on npm)
- Skip `iris-code@1.2.29` wrapper (already on npm)
- Build + publish the other 11 platform binaries

### 2.3 Monitor progress

```bash
gh run list --repo dragonsarealive/iris-ai --workflow publish-cli.yml --limit 3
# Get the run ID, then:
gh run watch <RUN_ID> --repo dragonsarealive/iris-ai
```

### 2.4 Verify

```bash
npm view iris-code-linux-x64@1.2.29
npm view iris-code-darwin-arm64@1.2.29
```

If some packages hit E429 rate limits, wait 15-30 minutes and re-dispatch. The workflow skips already-published packages.

### 2.5 Verify release assets

```bash
gh release view v1.2.29 --repo dragonsarealive/iris-ai --json assets -q '.assets[].name'
```

**Expected:** 12 `.zip` or `.tar.gz` archives (one per platform).

---

## Phase 3: Homebrew Formula

**Goal:** Users can `brew install dragonsarealive/tap/iris`.

### 3.1 Get SHA256 sums from release assets

```bash
gh release download v1.2.29 --repo dragonsarealive/iris-ai --pattern "*.sha256sum" --dir /tmp/iris-sums
```

### 3.2 Update the formula

Clone `dragonsarealive/homebrew-tap`, update `Formula/iris.rb`:
- Download URLs: `https://github.com/dragonsarealive/iris-ai/releases/download/v1.2.29/iris-code-{platform}.{zip,tar.gz}`
- SHA256 per arch (darwin-arm64, darwin-x64, linux-x64, etc.)
- Version string: `1.2.29`

### 3.3 Push and test

```bash
brew update
brew install dragonsarealive/tap/iris
iris-code --version  # → 1.2.29
```

---

## Phase 4: Fix `completeTask` TOCTOU (minor)

**Goal:** Make `completeTask` in `coordination.ts` use a single transaction, consistent with `claimTask`.

**File:** `packages/iris/src/team/coordination.ts`

**Current issue:** `completeTask()` does a separate `query()` to check task status, then a `tx()` to update. This is a Time-Of-Check-Time-Of-Use race. Low risk because SQLite is single-writer, but inconsistent with `claimTask` which does everything in one `tx()`.

**Fix:** Merge the check + update into a single `tx()` block:

```typescript
completeTask: (taskID: string, sessionID: string) =>
  Effect.gen(function* () {
    const db = yield* Database
    return yield* Effect.try(() =>
      db.tx((tx) => {
        const task = tx
          .select()
          .from(TaskItemTable)
          .where(
            and(
              eq(TaskItemTable.id, taskID),
              eq(TaskItemTable.claimed_by, sessionID),
              eq(TaskItemTable.status, "in_progress"),
            ),
          )
          .get()
        if (!task) return null
        tx.update(TaskItemTable)
          .set({ status: "completed" })
          .where(eq(TaskItemTable.id, taskID))
          .run()
        return task
      }),
    )
  })
```

After fixing, run `bun test test/team/coordination.test.ts` — all tests should still pass.

---

## Phase 5: P0 Backlog — Integration Tests

**Goal:** Add the 3 P0 test suites from `specs/team-improvements-backlog.md`.

**Reference:** Items #2, #3, #4 in `specs/team-improvements-backlog.md`.

### 5.1 Runner + addMember lifecycle test

**File:** `packages/iris/test/team/runner.test.ts` (new)

**What to test:**
- `TeamRunner.startAll()` creates worktrees for teammates
- `TeamModule.addMember()` correctly adds members with `role: "teammate"` status
- Member status transitions: `idle` → `busy` → `idle`
- `TeamModule.disband()` tears down cleanly (members removed, worktrees cleaned)

**Touchpoints:** `src/team/runner.ts`, `src/team/index.ts`

**Notes:** Use the test setup pattern from `test/team/team.test.ts` (isolated Effect layer with `TeamRepo` + `Database`). Don't spin up a real server — mock the session/worktree parts if needed. Verify on Windows (long paths, file locks).

### 5.2 Orchestration feed order test

**File:** `packages/iris/test/team/orchestration.test.ts` (new)

**What to test:**
- Emit steps in order: `team_created` → `teammate_spawned` → `task_dispatched` → `task_completed`
- `list()` returns them in insertion order
- Step payloads contain expected fields (`team_id`, `session_id`, `action`, `detail`)

**Touchpoints:** `src/team/orchestration.ts`, `src/team/repo.ts`

### 5.3 Scripted Phase 12.5 lead tool flow

**File:** `packages/iris/test/team/lead-flow.test.ts` (new) or extend `test/tool/team.test.ts`

**What to test (no live LLM):**
- Lead calls `team_spawn_teammate` → member created + orchestration step emitted
- Lead calls `team_prompt_teammate` → message delivered
- Lead calls `team_mark_task_progress` → task status updated + orchestration step
- Full flow in sequence verifying DB state at each step

**Touchpoints:** `src/tool/team.ts`, `src/team/index.ts`, `src/team/task.ts`

---

## Phase 6: P0 Backlog — SDK Regen

**Goal:** Typed `/team` routes in `@iris-ai/sdk`.

### 6.1 Start the server to extract OpenAPI

```bash
cd packages/iris
bun run dev
# In another terminal:
curl http://localhost:3000/openapi.json > /tmp/openapi.json
```

### 6.2 Run SDK generation

```bash
cd packages/sdk/js
bun run script/build.ts
```

### 6.3 Verify team types

Check that `packages/sdk/js/src/v2/` now has team endpoints typed from OpenAPI instead of the hand-maintained `team.ts`.

### 6.4 Update backlog

Mark items #1 (SDK regen) in `specs/team-improvements-backlog.md` as `[x]`.

---

## Checklist Summary

| # | Task | Depends on | Est. |
|---|------|-----------|------|
| 1 | Commit + push Effect migration | — | 5 min |
| 2 | Dispatch CI for v1.2.29 | Phase 1 | 5 min + wait |
| 3 | Homebrew formula update | Phase 2 | 15 min |
| 4 | Fix `completeTask` TOCTOU | — | 10 min |
| 5 | P0 integration tests (3 test files) | Phase 1 | 45 min |
| 6 | SDK regen | Phase 1 | 15 min |

**Phases 1-2 are blocking.** Phases 3-6 can run in parallel after Phase 1.

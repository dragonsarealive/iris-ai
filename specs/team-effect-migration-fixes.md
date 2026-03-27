# Team Effect Migration: Remaining Fixes

## Context

The Effect migration from `specs/team-effect-migration-checklist.md` is 100% complete (all 20 `Database.use()` calls eliminated from caller files). However, 3 tests fail and there are 5 code issues to resolve.

**Current state:**
- Typecheck: PASSES
- Tests: 14 pass, **3 fail** (all in `test/team/coordination.test.ts`)
- `Database.use()` audit: only in `repo.ts` (3) and `coordination.ts` (3), all inside `Effect.try`

---

## Fix 1: Failing Tests (CRITICAL)

**Files:** `packages/iris/src/team/coordination.ts`, `packages/iris/test/team/coordination.test.ts`

**Failing tests:**
- `claimTask atomically claims a task`
- `claimTask returns null for already claimed task`
- `dispatchTask claims and dispatches a task`

**Error:** `AsyncLocalStorage` crash at runtime -- `Instance.directory` is not available.

**Root cause:** `claimAndEmit()` (coordination.ts lines 149-169) calls `Orchestration.emit()`, which now calls `runPromiseInstance(TeamRepo.use(...))`. `runPromiseInstance` requires `Instance.directory` from AsyncLocalStorage. The coordination tests create an isolated Effect layer without Instance ALS context, so `Orchestration.emit()` crashes when invoked inside the test.

**Why this happens:** `Orchestration.emit()` was migrated from sync `Database.use()` to async `runPromiseInstance(TeamRepo.use(...))`. This means it now needs the full app runtime context (Instance ALS), which coordination tests don't provide.

**Fix:** Replace the `Orchestration.emit()` calls inside `coordination.ts` with direct `TeamRepo` calls. Since `coordination.ts` already has `TeamRepo` available as a sibling service in `InstanceServices`, it can call the repo directly without going through `Orchestration.emit()` and its `runPromiseInstance` wrapper. This keeps everything within the same Effect service layer.

### Step 1: Import what's needed

In `packages/iris/src/team/coordination.ts`, add these imports:

```typescript
import { ulid } from "ulid"  // already imported
import { TeamRepo } from "./repo"
import { Team } from "./event"
```

Remove the unused import:
```typescript
// DELETE this line (line 11):
import { runPromiseInstance } from "@/effect/runtime"
```

### Step 2: Replace `Orchestration.emit()` in `claimAndEmit`

**File:** `packages/iris/src/team/coordination.ts`

Replace lines 149-169 (the `claimAndEmit` function):

```
OLD (current):
```
```typescript
const claimAndEmit = Effect.fn("TeamCoordination.claimAndEmit")(
  (teamID: string, sessionID: SessionID, taskID: string) =>
    Effect.gen(function* () {
      const task = yield* claimTask(teamID, sessionID, taskID)
      if (task) {
        emitTaskEvent(teamID, task)
        yield* Effect.flatMap(
          Effect.promise(() =>
            Orchestration.emit({
              teamID,
              actorSessionID: sessionID,
              action: "task_claimed",
              detail: task.title,
            }),
          ),
          () => Effect.succeed(task),
        )
      }
      return task
    }),
)
```

```
NEW:
```
```typescript
const emitOrchestration = (input: {
  teamID: string
  actorSessionID: string
  targetSessionID?: string
  action: string
  detail?: string
}) => {
  const now = Date.now()
  const id = ulid()
  // Write to DB through the TeamRepo layer (same Effect context)
  // and emit bus event synchronously
  return Effect.gen(function* () {
    yield* TeamRepo.use((r) =>
      r.emitOrchestrationStep({
        id,
        teamID: input.teamID,
        time: now,
        actorSessionID: input.actorSessionID,
        targetSessionID: input.targetSessionID,
        action: input.action,
        detail: input.detail,
      }),
    )
    GlobalBus.emit("event", {
      payload: {
        type: Team.OrchestrationStep.type,
        properties: {
          teamID: input.teamID,
          time: now,
          actorSessionID: input.actorSessionID,
          targetSessionID: input.targetSessionID,
          action: input.action,
          detail: input.detail,
        },
      },
    })
  })
}

const claimAndEmit = Effect.fn("TeamCoordination.claimAndEmit")(
  (teamID: string, sessionID: SessionID, taskID: string) =>
    Effect.gen(function* () {
      const task = yield* claimTask(teamID, sessionID, taskID)
      if (task) {
        emitTaskEvent(teamID, task)
        yield* emitOrchestration({
          teamID,
          actorSessionID: sessionID,
          action: "task_claimed",
          detail: task.title,
        })
      }
      return task
    }),
)
```

### Step 3: Replace `Orchestration.emit()` in `dispatchTask`

Replace lines 171-190 (the `dispatchTask` function):

```
OLD (current):
```
```typescript
const dispatchTask = Effect.fn("TeamCoordination.dispatchTask")(
  (teamID: string, teammateId: SessionID, taskID: string, description: string) =>
    Effect.gen(function* () {
      const task = yield* claimAndEmit(teamID, teammateId, taskID)
      if (!task) {
        return yield* new TaskAlreadyClaimedError({ taskID, message: "Task already claimed" })
      }
      yield* Effect.flatMap(
        Effect.promise(() =>
          Orchestration.emit({
            teamID,
            actorSessionID: teammateId,
            action: "prompt_dispatched",
            detail: description,
          }),
        ),
        () => Effect.succeed(undefined),
      )
    }),
)
```

```
NEW:
```
```typescript
const dispatchTask = Effect.fn("TeamCoordination.dispatchTask")(
  (teamID: string, teammateId: SessionID, taskID: string, description: string) =>
    Effect.gen(function* () {
      const task = yield* claimAndEmit(teamID, teammateId, taskID)
      if (!task) {
        return yield* new TaskAlreadyClaimedError({ taskID, message: "Task already claimed" })
      }
      yield* emitOrchestration({
        teamID,
        actorSessionID: teammateId,
        action: "prompt_dispatched",
        detail: description,
      })
    }),
)
```

### Step 4: Replace `Orchestration.emit()` in `completeTask`

In the `completeTask` function (around lines 326-338), replace the `Orchestration.emit` block:

```
OLD:
```
```typescript
if (updated.assignedToSessionID) {
  const actorID = updated.assignedToSessionID
  yield* Effect.flatMap(
    Effect.promise(() =>
      Orchestration.emit({
        teamID: task.team_id,
        actorSessionID: actorID,
        action: "task_completed",
        detail: updated.title,
      }),
    ),
    () => Effect.succeed(undefined),
  )
}
```

```
NEW:
```
```typescript
if (updated.assignedToSessionID) {
  yield* emitOrchestration({
    teamID: task.team_id,
    actorSessionID: updated.assignedToSessionID,
    action: "task_completed",
    detail: updated.title,
  })
}
```

### Step 5: Remove unused import

After all replacements, `Orchestration` is no longer used in `coordination.ts`. Remove the import:

```typescript
// DELETE this line:
import { Orchestration } from "./orchestration"
```

### Step 6: Update test layer to include TeamRepo

The tests in `coordination.test.ts` already provide `TeamRepo.layer` in their layer:

```typescript
const test = testEffect(Layer.mergeAll(TeamRepo.layer, TeamCoordination.layer, truncate))
```

Since `emitOrchestration` now calls `TeamRepo.use(...)` (which is provided by the test layer), this should work without Instance ALS.

**Verify:** The `TeamRepo.use((r) => r.emitOrchestrationStep(...))` call is resolved through the Effect service layer, NOT through `runPromiseInstance`. This means the test's provided `TeamRepo.layer` supplies the implementation. No Instance ALS needed.

---

## Fix 2: `completeTask` TOCTOU Race (LOW PRIORITY)

**File:** `packages/iris/src/team/coordination.ts`

**Problem:** `completeTask()` does 4 separate DB operations (SELECT task, UPDATE task, SELECT all tasks, UPDATE blocked tasks). Between the first SELECT and UPDATE, another caller could modify the task. The checklist recommended wrapping everything in a single `tx()` call.

**Current (lines 295-377):**
```
query() → SELECT task
tx()    → UPDATE task to done
query() → SELECT all team tasks
tx()    → UPDATE blocked tasks to pending
```

**Fix:** Merge into a single `tx()`:

```typescript
const completeTask = Effect.fn("TeamCoordination.completeTask")((taskID: string) =>
  Effect.gen(function* () {
    const result = yield* tx((db) => {
      const task = db.select().from(TaskItemTable).where(eq(TaskItemTable.id, taskID)).get()
      if (!task) return null

      const now = Date.now()
      db.update(TaskItemTable)
        .set({ status: "done", time_updated: now })
        .where(eq(TaskItemTable.id, taskID))
        .run()

      const updated: TaskItemInfo = {
        id: task.id,
        teamID: task.team_id,
        assignedToSessionID: task.assigned_to_session_id ?? undefined,
        title: task.title,
        description: task.description ?? undefined,
        status: "done",
        dependsOnIDs: task.depends_on_ids ? JSON.parse(task.depends_on_ids) : undefined,
        timeCreated: task.time_created,
        timeUpdated: now,
      }

      const allTeamTasks = db
        .select()
        .from(TaskItemTable)
        .where(eq(TaskItemTable.team_id, task.team_id))
        .all()

      const unblockedTasks: TaskItemInfo[] = []
      for (const t of allTeamTasks) {
        if (!t.depends_on_ids) continue
        const deps = JSON.parse(t.depends_on_ids) as string[]
        if (!deps.includes(taskID)) continue
        // Count the task we just completed as done even though the row
        // hasn't been committed yet (it's "done" within this transaction)
        const doneDeps = allTeamTasks.filter(
          (x) => deps.includes(x.id) && (x.status === "done" || x.id === taskID),
        )
        if (doneDeps.length !== deps.length) continue
        if (t.status === "blocked") {
          const timeUpdated = Date.now()
          db.update(TaskItemTable)
            .set({ status: "pending", time_updated: timeUpdated })
            .where(eq(TaskItemTable.id, t.id))
            .run()
          unblockedTasks.push({
            id: t.id,
            teamID: t.team_id,
            assignedToSessionID: t.assigned_to_session_id ?? undefined,
            title: t.title,
            description: t.description ?? undefined,
            status: "pending",
            dependsOnIDs: deps,
            timeCreated: t.time_created,
            timeUpdated,
          })
        }
      }

      return { updated, unblockedTasks }
    })

    if (!result) return null

    // Emit events OUTSIDE the transaction
    emitTaskEvent(result.updated.teamID, result.updated)
    if (result.updated.assignedToSessionID) {
      yield* emitOrchestration({
        teamID: result.updated.teamID,
        actorSessionID: result.updated.assignedToSessionID,
        action: "task_completed",
        detail: result.updated.title,
      })
    }
    for (const unblocked of result.unblockedTasks) {
      emitTaskEvent(unblocked.teamID, unblocked)
    }

    return result.updated
  }),
)
```

**Key difference from current:** The `allTeamTasks` SELECT sees the just-completed task as its old status (the UPDATE hasn't been committed yet in SQLite WAL mode). That's why we check `x.id === taskID` alongside `x.status === "done"` when counting fulfilled dependencies.

---

## Fix 3: Remove `as any` in `repo.ts`

**File:** `packages/iris/src/team/repo.ts`, line 294

**Current:**
```typescript
action: input.action as any,
```

**Fix:** Type the input parameter properly:

```typescript
// In the emitOrchestrationStep method's input type (line 51-59 of the Service interface),
// change:
action: string
// to:
action: import("./orchestration").OrchestrationAction
```

Or simpler -- import `OrchestrationAction` at the top of `repo.ts`:

```typescript
import type { OrchestrationAction } from "./orchestration"
```

Then in both the Service interface AND the implementation, change `action: string` to `action: OrchestrationAction`. Then remove the `as any` cast on line 294.

---

## Fix 4: Dead imports in `message.ts`

**File:** `packages/iris/src/team/message.ts`, lines 3

**Current:**
```typescript
import { TeamMessageTable, TeamMemberTable } from "../session/session.sql"
```

**Fix:** Both `TeamMessageTable` and `TeamMemberTable` are no longer used in this file (all DB access goes through `TeamRepo` now). Delete this import line entirely.

---

## Fix 5: Dead import in `coordination.ts`

**File:** `packages/iris/src/team/coordination.ts`, line 11

**Current:**
```typescript
import { runPromiseInstance } from "@/effect/runtime"
```

**Fix:** This is no longer used after Fix 1 removes the `Orchestration.emit()` calls. Delete this import line.

Also after Fix 1, these imports may become unused:
- `import { Orchestration } from "./orchestration"` (line 8) -- delete if no longer referenced
- `import { TeamMemberTable } from "../session/session.sql"` (line 6) -- check if `getIdleTeammates` still uses it directly (it does via `query()`, so KEEP this one)

---

## Verification

After all fixes:

```bash
# Typecheck
cd packages/iris && bun typecheck

# Tests (expect 17 pass, 0 fail)
cd packages/iris && bun test test/team/

# Database.use audit (only repo.ts and coordination.ts)
# Search for Database.use in src/team/ -- expect 0 hits outside repo.ts and coordination.ts
```

### Expected test results:
```
test/team/repo.test.ts:        7 pass
test/team/coordination.test.ts: 7 pass  (was 4 pass 3 fail)
test/team/team.test.ts:         4 pass  (integration tests, may be slow)
------
Total: 17 pass, 0 fail (was 14 pass, 3 fail)
```

---

## Summary

| Fix | Severity | Files | What |
|-----|----------|-------|------|
| 1 | CRITICAL | `coordination.ts` | Replace `Orchestration.emit()` with direct `TeamRepo` calls to fix 3 test failures |
| 2 | LOW | `coordination.ts` | Merge `completeTask` into single transaction |
| 3 | LOW | `repo.ts` | Remove `as any`, use `OrchestrationAction` type |
| 4 | TRIVIAL | `message.ts` | Remove dead imports |
| 5 | TRIVIAL | `coordination.ts` | Remove dead imports |

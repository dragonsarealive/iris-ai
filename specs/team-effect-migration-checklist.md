# Team Module: Complete Effect Migration Checklist

## Goal

Migrate ALL remaining `Database.use()` calls in `packages/iris/src/team/` to go through Effect services (`TeamRepo`, `TeamCoordination`, or new services). After this, the only `Database.use()` / `Database.transaction()` calls in `src/team/` should be inside `repo.ts` and `coordination.ts` (wrapped in `Effect.try`).

## Current State

| File | Raw `Database.use` calls | Already migrated |
|------|--------------------------|------------------|
| `repo.ts` | 3 (inside `Effect.try` -- these are correct) | N/A -- this IS the Effect layer |
| `coordination.ts` | 3 (inside `Effect.try` -- these are correct) | N/A -- this IS the Effect layer |
| `index.ts` | 4 remaining | `create`, `disband`, `get`, `list`, `members`, `updateMemberStatus` delegated to `TeamRepo` |
| `task.ts` | 8 remaining | Only `claim()` delegated to `TeamCoordination` |
| `message.ts` | 6 remaining | Nothing migrated |
| `orchestration.ts` | 2 remaining | Nothing migrated |

**Total raw `Database.use()` to eliminate: 20 calls across 4 files.**

---

## Phase 1: Extend `TeamRepo` Service Interface

**File:** `packages/iris/src/team/repo.ts`

The `TeamRepo.Service` interface (lines 16-29) needs a new method for updating `SessionTable.team_id`. This covers the two remaining `Database.use()` calls in `index.ts` (lines 66-68 and 118-119).

### 1.1 Add `setSessionTeamID` to `TeamRepo.Service`

Add to the `Service` interface at line 28:

```typescript
readonly setSessionTeamID: (
  sessionID: SessionID,
  teamID: string,
) => Effect.Effect<void, TeamRepoError>
```

### 1.2 Implement `setSessionTeamID` in the layer

Add inside the `Effect.gen` block (after `updateMemberStatus`, around line 169). You need to import `SessionTable` from `../session/session.sql`:

```typescript
const setSessionTeamID = Effect.fn("TeamRepo.setSessionTeamID")(
  (sessionID: SessionID, teamID: string) =>
    query((db) => {
      db.update(SessionTable).set({ team_id: teamID }).where(eq(SessionTable.id, sessionID)).run()
    }).pipe(Effect.asVoid),
)
```

### 1.3 Add to the return object

In `TeamRepo.of({...})` at line 171, add `setSessionTeamID`.

### 1.4 Add `SessionTable` import

Add `SessionTable` to the import on line 5:

```typescript
import { TeamTable, TeamMemberTable, SessionTable } from "../session/session.sql"
```

---

## Phase 2: Extend `TeamCoordination` Service Interface

**File:** `packages/iris/src/team/coordination.ts`

The `TeamCoordination.Service` interface (lines 16-30) needs methods for task CRUD that `task.ts` currently does with raw `Database.use()`.

### 2.1 Add methods to `TeamCoordination.Service`

Add at line 29 (before the closing `}`):

```typescript
readonly createTasks: (
  teamID: string,
  tasks: Array<{ title: string; description?: string; dependsOn?: string[] }>,
) => Effect.Effect<TaskItemInfo[], TaskCoordinationError>
readonly completeTask: (taskID: string) => Effect.Effect<TaskItemInfo | null, TaskCoordinationError>
readonly blockTask: (taskID: string) => Effect.Effect<TaskItemInfo | null, TaskCoordinationError>
readonly listTasks: (teamID: string) => Effect.Effect<TaskItemInfo[], TaskCoordinationError>
```

### 2.2 Implement `createTasks`

Add inside the `Effect.gen` block. This replaces `TaskList.create()` lines 27-63 of `task.ts`. Important: the original emits a `GlobalBus` event per task inside the `Database.use` callback. Move the bus emit outside the DB call:

```typescript
const createTasks = Effect.fn("TeamCoordination.createTasks")(
  (teamID: string, tasks: Array<{ title: string; description?: string; dependsOn?: string[] }>) =>
    Effect.gen(function* () {
      const now = Date.now()
      const items: TaskItemInfo[] = []

      yield* tx((db) => {
        for (const task of tasks) {
          const id = ulid()
          db.insert(TaskItemTable)
            .values({
              id,
              team_id: teamID,
              title: task.title,
              description: task.description ?? null,
              status: "pending",
              depends_on_ids: task.dependsOn ? JSON.stringify(task.dependsOn) : null,
              time_created: now,
              time_updated: now,
            })
            .run()

          items.push({
            id,
            teamID,
            assignedToSessionID: undefined,
            title: task.title,
            description: task.description,
            status: "pending",
            dependsOnIDs: task.dependsOn,
            timeCreated: now,
            timeUpdated: now,
          })
        }
      })

      for (const item of items) {
        GlobalBus.emit("event", {
          payload: {
            type: "team.task.updated",
            properties: { teamID, task: item },
          },
        })
      }

      return items
    }),
)
```

**Import needed:** Add `ulid` import at top of file: `import { ulid } from "ulid"`

### 2.3 Implement `completeTask`

This replaces `TaskList.complete()` lines 76-155 of `task.ts`. This is the most complex function -- it completes a task AND unblocks dependent tasks. Must replicate the unblocking logic:

```typescript
const completeTask = Effect.fn("TeamCoordination.completeTask")((taskID: string) =>
  Effect.gen(function* () {
    const result = yield* tx((db) => {
      const task = db.select().from(TaskItemTable).where(eq(TaskItemTable.id, taskID)).get()
      if (!task) return null

      const now = Date.now()
      db.update(TaskItemTable).set({ status: "done", time_updated: now }).where(eq(TaskItemTable.id, taskID)).run()

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

      // Unblock dependent tasks within the same transaction
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
        const doneDeps = allTeamTasks.filter((x) => deps.includes(x.id) && (x.status === "done" || x.id === taskID))
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

    // Emit events outside the transaction
    emitTaskEvent(result.updated.teamID, result.updated)
    if (result.updated.assignedToSessionID) {
      Orchestration.emit({
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

**Note:** The `emitTaskEvent` helper already exists in `coordination.ts` (lines 131-138). Reuse it.

### 2.4 Implement `blockTask`

Replaces `TaskList.block()` lines 157-198 of `task.ts`:

```typescript
const blockTask = Effect.fn("TeamCoordination.blockTask")((taskID: string) =>
  Effect.gen(function* () {
    const result = yield* tx((db) => {
      const task = db.select().from(TaskItemTable).where(eq(TaskItemTable.id, taskID)).get()
      if (!task) return null
      if (task.status === "done") return null

      const now = Date.now()
      db.update(TaskItemTable)
        .set({ status: "blocked", time_updated: now })
        .where(eq(TaskItemTable.id, taskID))
        .run()

      return {
        id: task.id,
        teamID: task.team_id,
        assignedToSessionID: task.assigned_to_session_id ?? undefined,
        title: task.title,
        description: task.description ?? undefined,
        status: "blocked" as const,
        dependsOnIDs: task.depends_on_ids ? JSON.parse(task.depends_on_ids) : undefined,
        timeCreated: task.time_created,
        timeUpdated: now,
      } satisfies TaskItemInfo
    })

    if (result) {
      emitTaskEvent(result.teamID, result)
    }

    return result
  }),
)
```

### 2.5 Implement `listTasks`

Replaces `TaskList.list()` lines 200-216 of `task.ts`:

```typescript
const listTasks = Effect.fn("TeamCoordination.listTasks")((teamID: string) =>
  query((db) => {
    const rows = db.select().from(TaskItemTable).where(eq(TaskItemTable.team_id, teamID)).all()
    return rows.map(
      (row) =>
        ({
          id: row.id,
          teamID: row.team_id,
          assignedToSessionID: row.assigned_to_session_id ?? undefined,
          title: row.title,
          description: row.description ?? undefined,
          status: row.status as "pending" | "in_progress" | "done" | "blocked",
          dependsOnIDs: row.depends_on_ids ? JSON.parse(row.depends_on_ids) : undefined,
          timeCreated: row.time_created,
          timeUpdated: row.time_updated,
        }) as TaskItemInfo,
    )
  }),
)
```

### 2.6 Add all new methods to the return object

In `TeamCoordination.of({...})` at line 231, add:

```typescript
return TeamCoordination.of({
  claimTask: claimAndEmit,
  dispatchTask,
  getPendingTasks,
  getIdleTeammates,
  createTasks,
  completeTask,
  blockTask,
  listTasks,
})
```

---

## Phase 3: Create `TeamMessageRepo` Effect Service

**File:** Create logic inside existing `repo.ts` OR a new `message-repo.ts`.

Recommendation: Add to `TeamRepo` since messages are team-scoped data. Add these methods to `TeamRepo.Service`:

### 3.1 Add to `TeamRepo.Service` interface

```typescript
readonly sendMessage: (msg: {
  id: string
  teamID: string
  fromSessionID: string
  toSessionID?: string
  body: string
  timeCreated: number
}) => Effect.Effect<void, TeamRepoError>
readonly getInbox: (sessionID: SessionID) => Effect.Effect<TeamMessageRow[], TeamRepoError>
readonly getPendingMessages: (teamID: string) => Effect.Effect<TeamMessageRow[], TeamRepoError>
readonly markDelivered: (messageID: string) => Effect.Effect<void, TeamRepoError>
readonly listMessagesByTeam: (teamID: string) => Effect.Effect<TeamMessageRow[], TeamRepoError>
readonly getLeadMember: (teamID: string) => Effect.Effect<TeamMemberRow | null, TeamRepoError>
```

**Important:** Import `TeamMessageTable` from `../session/session.sql` in `repo.ts`. Add `export type TeamMessageRow = (typeof TeamMessageTable)["$inferSelect"]` alongside the existing `TeamRow` / `TeamMemberRow` types (line 10-11).

### 3.2 Implement each method in the layer

These are straightforward query wrappers. Follow the same `query((db) => { ... })` pattern used for existing methods. Return raw rows -- let `message.ts` do the `toInfo()` mapping.

### 3.3 Add `getLeadMember`

This is needed because `message.ts:send()` (lines 56-63) queries `TeamMemberTable` to find the lead. Wrap it:

```typescript
const getLeadMember = Effect.fn("TeamRepo.getLeadMember")((teamID: string) =>
  query((db) => {
    return db
      .select()
      .from(TeamMemberTable)
      .where(eq(TeamMemberTable.team_id, teamID))
      .all()
      .find((r) => r.role === "lead") ?? null
  }),
)
```

---

## Phase 4: Create `OrchestrationRepo` Effect Service

**File:** Add to `TeamRepo` in `repo.ts` (it's team-scoped data).

### 4.1 Add to `TeamRepo.Service` interface

```typescript
readonly emitOrchestrationStep: (input: {
  id: string
  teamID: string
  time: number
  actorSessionID: string
  targetSessionID?: string
  action: string
  detail?: string
}) => Effect.Effect<void, TeamRepoError>
readonly listOrchestrationSteps: (teamID: string) => Effect.Effect<OrchestrationRow[], TeamRepoError>
```

Add `export type OrchestrationRow = (typeof TeamOrchestrationStepTable)["$inferSelect"]` at the top.

### 4.2 Implement in the layer

Import `TeamOrchestrationStepTable` from `../session/session.sql`. Standard `query()` wrappers.

**Note:** `orchestration.ts` also emits `GlobalBus` events. Keep the bus emit in `orchestration.ts` and only move the DB write into the repo. Updated `orchestration.ts` to be async:

```typescript
export async function emit(input: {...}) {
  const id = ulid()
  const now = Date.now()
  // DB write through Effect
  await runPromiseInstance(TeamRepo.use((r) => r.emitOrchestrationStep({
    id, teamID: input.teamID, time: now,
    actorSessionID: input.actorSessionID,
    targetSessionID: input.targetSessionID,
    action: input.action, detail: input.detail,
  })))
  // Bus emit stays here (sync, non-DB)
  GlobalBus.emit("event", { payload: { ... } })
}
```

All callers updated to `await` the async `Orchestration.emit()`. Phase 4 complete.

---

## Phase 5: Wire Callers to Effect Services

### 5.1 `packages/iris/src/team/index.ts`

**Remove remaining `Database.use()` calls:**

**Line 66-68** (`create` -- SessionTable update): Replace with:
```typescript
await runPromiseInstance(TeamRepo.use((r) => r.setSessionTeamID(input.leadSessionID, id)))
```

**Lines 81-95** (`addMember` -- team lookup + lead lookup): Replace with:
```typescript
const team = await runPromiseInstance(TeamRepo.use((r) => r.get(input.teamID)))
if (!team) throw new Error(`Team not found: ${input.teamID}`)

const members = await runPromiseInstance(TeamRepo.use((r) => r.getMembers(input.teamID)))
const leadMemberRow = members.find((m) => m.role === "lead")
if (!leadMemberRow) throw new Error(`Lead member not found for team: ${input.teamID}`)
```

**Line 118-119** (`addMember` -- SessionTable update): Replace with:
```typescript
await runPromiseInstance(TeamRepo.use((r) => r.setSessionTeamID(teammateSession.id, input.teamID)))
```

After these changes, remove unused imports: `Database`, `eq`, `TeamTable`, `TeamMemberTable` from `index.ts`. Keep `SessionTable` only if still needed (it shouldn't be after the migration). Keep `SessionID`, `ProjectID` for type casts.

### 5.2 `packages/iris/src/team/task.ts`

**Replace `create()`** (lines 23-66): Delegate to `TeamCoordination`:
```typescript
export async function create(input: CreateInput): Promise<TaskItemInfo[]> {
  return runPromiseInstance(
    TeamCoordination.use((r) => r.createTasks(input.teamID, input.tasks))
  )
}
```

**Replace `complete()`** (lines 76-155): Delegate to `TeamCoordination`:
```typescript
export async function complete(taskID: string): Promise<TaskItemInfo | null> {
  return runPromiseInstance(TeamCoordination.use((r) => r.completeTask(taskID)))
}
```

**Replace `block()`** (lines 157-198): Delegate to `TeamCoordination`:
```typescript
export async function block(taskID: string): Promise<TaskItemInfo | null> {
  return runPromiseInstance(TeamCoordination.use((r) => r.blockTask(taskID)))
}
```

**Replace `list()`** (lines 200-216): Delegate to `TeamCoordination`:
```typescript
export async function list(teamID: string): Promise<TaskItemInfo[]> {
  return runPromiseInstance(TeamCoordination.use((r) => r.listTasks(teamID)))
}
```

After these changes, remove unused imports from `task.ts`: `Database`, `eq`, `and`, `inArray`, `isNull`, `TaskItemTable`. Keep `TeamCoordination` and `runPromiseInstance`.

### 5.3 `packages/iris/src/team/message.ts`

**Replace `send()`** DB calls (lines 24-37, 56-63): Use `TeamRepo`:
```typescript
export async function send(input: SendInput): Promise<TeamMessageInfo> {
  const id = ulid()
  const now = Date.now()

  await runPromiseInstance(TeamRepo.use((r) => r.sendMessage({
    id, teamID: input.teamID, fromSessionID: input.fromSessionID,
    toSessionID: input.toSessionID, body: input.body, timeCreated: now,
  })))

  const msg: TeamMessageInfo = { /* same as current */ }

  GlobalBus.emit("event", { /* same as current */ })

  const leadRow = await runPromiseInstance(TeamRepo.use((r) => r.getLeadMember(input.teamID)))
  if (leadRow && input.fromSessionID === leadRow.session_id) {
    Orchestration.emit({ /* same as current */ })
  }

  return msg
}
```

**Replace `inbox()`** (lines 77-87): Use `TeamRepo`:
```typescript
export async function inbox(sessionID: SessionID): Promise<TeamMessageInfo[]> {
  const rows = await runPromiseInstance(TeamRepo.use((r) => r.getInbox(sessionID)))
  return rows.map((row) => toInfo(row))
}
```

**Replace `getPendingForSession()`** (lines 90-107): Use `TeamRepo`:
```typescript
export async function getPendingForSession(sessionID: SessionID): Promise<TeamMessageInfo[]> {
  const session = await Session.get(sessionID)
  const teamID = session.teamID
  if (!teamID) return []

  const rows = await runPromiseInstance(TeamRepo.use((r) => r.getPendingMessages(teamID)))
  const pending = rows.filter(
    (r) => r.to_session_id === sessionID || r.to_session_id === null,
  )
  pending.sort((a, b) => a.time_created - b.time_created)
  return pending.map(toInfo)
}
```

**Replace `markDelivered()`** (lines 129-132):
```typescript
export async function markDelivered(messageID: string): Promise<void> {
  await runPromiseInstance(TeamRepo.use((r) => r.markDelivered(messageID)))
}
```

**Replace `listByTeam()`** (lines 135-149):
```typescript
export async function listByTeam(teamID: string): Promise<TeamMessageInfo[]> {
  const rows = await runPromiseInstance(TeamRepo.use((r) => r.listMessagesByTeam(teamID)))
  return rows.map((row) => toInfo(row))
}
```

Add imports: `import { TeamRepo } from "./repo"` and `import { runPromiseInstance } from "@/effect/runtime"`.
Remove: `Database`, `eq`, `and` from imports. Keep `TeamMemberTable` and `TeamMessageTable` only if still needed for types.

### 5.4 `packages/iris/src/team/orchestration.ts` (DEFERRED)

Keep as-is for now. `Orchestration.emit()` is called synchronously from many callsites (inside `index.ts`, `task.ts`, `coordination.ts`, `message.ts`). Converting it to async would cascade changes throughout the team module. The 2 `Database.use()` calls here are simple and low-risk.

Mark this as a follow-up task after the main migration lands.

---

## Phase 6: Verification

### 6.1 Typecheck

```bash
cd packages/iris && bun typecheck
```

Must pass with 0 errors. The most likely failure modes:
- Missing imports (`runPromiseInstance`, `TeamRepo`, `TeamCoordination`)
- Return type mismatches (Effect-wrapped vs direct)
- Branded type issues (`SessionID`, `ProjectID` casts)

### 6.2 Grep audit

```bash
# From packages/iris/src/team/, only repo.ts and coordination.ts should have Database.use/transaction
# orchestration.ts is deferred (2 calls expected)
```

Expected result:
- `repo.ts`: 2-3 calls (inside `Effect.try` -- correct)
- `coordination.ts`: 2-3 calls (inside `Effect.try` -- correct)
- `orchestration.ts`: 2 calls (deferred -- acceptable)
- `index.ts`: 0 calls
- `task.ts`: 0 calls
- `message.ts`: 0 calls

### 6.3 Tests

```bash
cd packages/iris && bun test test/team/
```

Existing team tests must still pass. If the agent added `repo.test.ts` and `coordination.test.ts`, those should pass too.

### 6.4 Smoke test

Run IRIS locally and verify team features work:
```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\script\run-local.ps1 .
```

Enable teams (`/team` command), create a team, add a task, claim it, complete it. Verify events appear in the TUI.

---

## Summary

| Phase | Files touched | Methods added/changed | `Database.use` eliminated |
|-------|--------------|----------------------|--------------------------|
| 1 | `repo.ts` | +`setSessionTeamID` | 0 (enables Phase 5) |
| 2 | `coordination.ts` | +`createTasks`, `completeTask`, `blockTask`, `listTasks` | 0 (enables Phase 5) |
| 3 | `repo.ts` | +`sendMessage`, `getInbox`, `getPendingMessages`, `markDelivered`, `listMessagesByTeam`, `getLeadMember` | 0 (enables Phase 5) |
| 4 | `repo.ts`, `orchestration.ts`, `index.ts`, `coordination.ts`, `message.ts`, `plan.ts` | +`emitOrchestrationStep`, `listOrchestrationSteps`, async callers | 2 (Phase 4 complete) |
| 5 | `index.ts`, `task.ts`, `message.ts` | Rewrite callers | **18 calls eliminated** |
| 6 | None | Verify | -- |

After all phases: **20 of 20** raw `Database.use()` calls eliminated. All migrations complete.

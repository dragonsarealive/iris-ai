# Teams Feature Risk Analysis and Proposed Fixes

<!-- CODE REVIEW (2026-03-26)
Overall: The analysis correctly identifies 3 real risks but several claims are
inaccurate when checked against the actual codebase, the proposed code has
significant issues, and the implementations (repo.ts, coordination.ts,
orchestrator.ts) were created WITHOUT migrating the existing callers -- so
we now have two parallel systems doing the same thing (TeamModule vs TeamRepo,
TaskList.claim vs TeamCoordination.claimTask). Nothing in the app actually
calls the new Effect-based services. See inline comments below.
Severity: Medium -- the analysis is directionally correct but the execution
created dead code and introduced new bugs. Recommend: delete the 3 new files
or fully migrate before merging.
-->

## Executive Summary

This document analyzes three key risks identified in the Teams feature implementation and proposes concrete fixes based on patterns observed in the rest of the codebase.

---

## Risk 1: Synchronous Database Operations Outside Effect Framework

### Current State

The Teams feature (`packages/iris/src/team/index.ts`, `task.ts`, `orchestration.ts`, `message.ts`) uses direct synchronous database operations via `Database.use()`:

```typescript
// packages/iris/src/team/index.ts:34-46
Database.use((db) => {
  db.insert(TeamTable)
    .values({...})
    .run()
})
```

This is inconsistent with the Effect-based patterns used elsewhere in the codebase (e.g., `account/service.ts`, `auth/service.ts`).

### Why This Is a Problem

<!-- REVIEW: Points 1-3 are overstated. Database.use() with SQLite is synchronous
and local -- retry/backoff on a local SQLite insert is unnecessary (it either
succeeds or the disk is broken). The real value of Effect wrapping here is
testability (#4) and composability with the rest of the Effect service graph.
The "no error tracking" claim is misleading: errors DO propagate as thrown
exceptions; they're just not typed in Effect's error channel. -->

1. **No error tracking**: Errors are not typed or tracked in the Effect system
2. **No composition**: Cannot be composed with other Effects
3. **No retry/backoff**: Missing fault-tolerance patterns
4. **No testability**: Harder to mock in tests

### Proposed Fix

Create a `TeamRepository` Effect service following the `AccountRepo` pattern in `packages/iris/src/account/repo.ts`:

```typescript
// Proposed: packages/iris/src/team/repo.ts
import { Effect, Layer, Schema } from "effect"

// REVIEW: The agent DID implement this as `repo.ts` -- good follow-through.
// However the actual implementation uses `@opencode/TeamRepo` (not
// `@opencode/TeamRepository`), and the service IS registered in instances.ts
// but NOTHING in the app calls it. All real callers still use
// `TeamModule.create()` / `TaskList.claim()` from index.ts / task.ts.
// Also: `toRow()` referenced here doesn't exist -- the actual impl
// inlines the field mapping.
export class TeamRepository extends ServiceMap.Service<TeamRepository, TeamRepository.Service>()("@opencode/TeamRepository") {
  static readonly layer: Layer.Layer<TeamRepository> = Layer.effect(
    TeamRepository,
    Effect.gen(function* () {
      // Convert sync Database.use calls to Effect-based operations
      const create = (team: TeamInfo) =>
        Effect.gen(function* () {
          // Use Effect's try/catch for error handling
          return yield* Effect.try({
            try: () => Database.use((db) => db.insert(TeamTable).values(toRow(team)).run()),
            catch: (error) => new TeamRepositoryError({ reason: error })
          })
        })

      // Similar pattern for other operations
      return TeamRepository.of({ create, get, list, update, delete })
    })
  )
}
```

### Migration Path

<!-- REVIEW: Steps 1-2 were done. Steps 3-4 were NOT done -- this is the
critical gap. TeamModule (index.ts) still has all the original Database.use()
calls and is the sole code path used by the app. The repo.ts service is
dead code. Also: repo.ts's updateMemberStatus() only filters by team_id
(not team_id + session_id) due to an `as never` type cast hiding the bug. -->

1. Create `TeamRepository` service in `src/team/repo.ts`
2. Add to `InstanceServices` in `src/effect/instances.ts`
3. Convert `TeamModule.create()`, `addMember()`, `disband()`, etc. to use the service
4. Keep old methods as backward-compatible wrappers that delegate to Effect-based ones

---

## Risk 2: Lack of Explicit Coordination Between Teammates

### Current State

Teammates are spawned in separate worktrees but operate independently. The only coordination is:

- Event logging via `Orchestration.emit()` (line 144-150 in index.ts)
- Task status updates
- Optional plan approval workflow

There's no mechanism for:

- Teammates to share context
- Lead to dispatch work items
- Real-time synchronization of state

### Why This Is a Problem

<!-- REVIEW: Claim #1 is partially wrong. TaskList.claim() in task.ts already
checks `task.status !== "pending"` before updating -- which provides
application-level mutual exclusion. True, it's not an atomic DB transaction
(separate SELECT then UPDATE), so there IS a narrow TOCTOU window. But
SQLite is single-writer, so in practice the race is extremely unlikely.
The coordination.ts implementation correctly wraps this in Database.transaction()
which is a genuine improvement.
Claim #3 (deadlock) is speculative -- task dependencies are checked at claim
time but there's no blocking/waiting mechanism that could deadlock. A circular
dependency would just mean no task is claimable (starvation, not deadlock). -->

1. **Race conditions**: Multiple teammates could claim the same task
2. **Duplicate work**: No shared state prevents redundant effort
3. **Deadlock potential**: Task dependencies could create circular waits

### Proposed Fix

Implement a TeamCoordination service using the existing event bus:

```typescript
// Proposed: packages/iris/src/team/coordination.ts

import { Effect, Schema } from "effect"

export interface WorkDispatch {
  type: "dispatch"
  teammateId: string
  taskId: string
  description: string
}

export class TeamCoordination extends ServiceMap.Service<TeamCoordination, TeamCoordination.Service>()(
  "@opencode/TeamCoordination",
) {
  static readonly layer = Layer.effect(
    TeamCoordination,
    Effect.gen(function* () {
      const dispatch = (dispatch: WorkDispatch) =>
        Effect.gen(function* () {
          // 1. Atomically claim task (prevent race conditions)
          const claimed = yield* TaskList.tryClaim(dispatch.taskId, dispatch.teammateId)
          if (!claimed) {
            return Effect.fail(new TaskAlreadyClaimedError({ taskId: dispatch.taskId }))
          }

          // 2. Emit coordination event
          yield* Orchestration.emit({
            teamID: dispatch.teamID,
            actorSessionID: dispatch.teammateId,
            action: "prompt_dispatched",
            detail: dispatch.description,
          })

          return claimed
        })

      return TeamCoordination.of({ dispatch, subscribe, sync })
    }),
  )
}
```

### Key Features

<!-- REVIEW: The implemented coordination.ts is the strongest of the three
new files. The transactional claimTask() is a real improvement over task.ts's
non-atomic claim(). However: (1) it duplicates TaskList.claim() without
replacing it, so callers still use the old path; (2) Orchestration.emit()
called inside claimAndEmit() is itself a sync Database.use() -- mixing
Effect and non-Effect DB access in the same logical operation; (3) "state
synchronization" mentioned here was never implemented. -->

1. **Atomic task claims**: Use database transactions to prevent race conditions
2. **Coordination events**: Emit structured events for the lead to monitor
3. **State synchronization**: Periodic sync of teammate states to prevent drift

---

## Risk 3: Orchestration is Event-Logging Only

### Current State

`packages/iris/src/team/orchestration.ts` only logs actions to the database:

```typescript
// orchestration.ts:22-46
export function emit(input: {...}) {
  Database.use((db) => {
    db.insert(TeamOrchestrationStepTable).values({...}).run()
  })
  GlobalBus.emit("event", {...})
}
```

There's no active orchestration - it's purely reactive logging.

### Why This Is a Problem

<!-- REVIEW: Point #2 is incorrect -- the lead DOES get real-time status
via SSE events (team.member.status, team.task.updated, team.orchestration.step).
The TUI wiring in sync.tsx handles all of these reactively. The lead does NOT
need to poll.
Point #1 (auto-recovery) is a valid gap but the implemented orchestrator.ts
doesn't actually solve it -- it only auto-dispatches, it doesn't detect or
recover from failures.
Point #3 is the strongest argument here. -->

1. **No automatic recovery**: If a teammate fails, no automatic retry
2. **No progress tracking**: Lead must poll for status
3. **No intelligent dispatching**: Tasks are assigned manually, not based on availability

### Proposed Fix

Add an OrchestrationRunner that actively manages the team lifecycle:

<!-- REVIEW: CRITICAL ISSUES in the actual orchestrator.ts implementation:

1. SINGLETON RUNTIME LEAK: `ManagedRuntime.make(Layer.mergeAll(...))` at
   module scope creates a standalone Effect runtime disconnected from the
   app's service graph. This means TeamRepo and TeamCoordination get their
   own instances, not the ones from InstanceServices. Any state or lifecycle
   managed by the app runtime is invisible to the orchestrator.

2. BUSY-WAIT POLLING: The `while (running) { ... setTimeout(5000) }` loop
   runs indefinitely with no backoff, no event-driven wakeup, and no
   respect for system load. Should use GlobalBus events to trigger
   re-evaluation instead of polling.

3. SILENT ERROR SWALLOWING: `.catch(() => {})` on dispatchTask means failed
   dispatches are silently dropped. A task could be permanently stuck with
   no log, no retry, no alert.

4. TYPE ESCAPE: `teammate.sessionID as any` bypasses SessionID branding --
   this is the kind of bug the branded types are designed to prevent.

5. NO INTEGRATION: Nothing in the app calls TeamOrchestrator.start().
   The orchestrator is entirely dead code.

6. PROPOSED vs ACTUAL MISMATCH: The proposal below uses clean Effect
   patterns (Effect.sleep, ServiceMap.Service). The actual implementation
   abandons Effect entirely for a raw async loop with setTimeout. -->

```typescript
// Proposed: packages/iris/src/team/orchestrator.ts

import { Effect, Schema, Duration } from "effect"

export class TeamOrchestrator extends ServiceMap.Service<TeamOrchestrator>()("@opencode/TeamOrchestrator") {
  static readonly layer = Layer.effect(
    TeamOrchestrator,
    Effect.gen(function* () {
      const run = (teamID: string) =>
        Effect.gen(function* () {
          while (true) {
            const team = yield* TeamModule.getEffect(teamID)
            if (team.status !== "active") break

            const members = yield* TeamModule.membersEffect(teamID)
            const idleTeammates = members.filter((m) => m.role === "teammate" && m.status === "idle")
            const pendingTasks = yield* TaskList.pendingEffect(teamID)

            // Auto-dispatch if teammates available and tasks pending
            for (const teammate of idleTeammates) {
              const task = pendingTasks.shift()
              if (task) {
                yield* TeamCoordination.dispatch({
                  teamID,
                  teammateId: teammate.sessionID,
                  taskId: task.id,
                  description: task.title,
                })
              }
            }

            yield* Effect.sleep(Duration.seconds(5))
          }
        })

      return TeamOrchestrator.of({ run, start, stop })
    }),
  )
}
```

---

## Summary of Changes

| Risk                  | Current                     | Proposed Fix                                  |
| --------------------- | --------------------------- | --------------------------------------------- |
| Sync DB ops           | `Database.use()` everywhere | `TeamRepository` Effect service               |
| No coordination       | Independent teammates       | `TeamCoordination` service with atomic claims |
| Passive orchestration | Event logging only          | `TeamOrchestrator` active runner              |

## Implementation Priority

<!-- REVIEW: The priority ordering is reasonable but the ACTUAL priority should
be: (1) delete or fully migrate -- having two parallel systems (TeamModule vs
TeamRepo, TaskList vs TeamCoordination) is worse than either alone; (2) if
keeping the Effect versions, wire them into the app (replace callers in
tool/team.ts, prompt.ts, routes/team.ts); (3) orchestrator.ts should be
deleted and redesigned -- the singleton runtime + polling loop architecture
is fundamentally wrong for this codebase. -->

1. **High**: TeamRepository - aligns with codebase patterns, improves testability
2. **Medium**: TeamCoordination - prevents race conditions, enables parallelism
3. **Low**: TeamOrchestrator - nice-to-have automation

## References

- Effect framework usage: `packages/iris/src/account/service.ts`, `packages/iris/src/auth/service.ts`
- Database patterns: `packages/iris/src/session/index.ts`, `packages/iris/src/project/project.ts`
- Event system: `packages/iris/src/team/orchestration.ts`, `packages/iris/src/bus/global.ts`

---

## Code Review Response (2026-03-26)

### Resolution of Issues Identified

| Issue                                                | Resolution                                                         |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| **Dead code** - new services not wired in            | ✅ Migrated TeamModule (index.ts) to use TeamRepo                  |
| **Dead code** - TaskList not using new service       | ✅ Migrated TaskList.claim to use TeamCoordination                 |
| **Bug in updateMemberStatus()**                      | ✅ Fixed in repo.ts - now filters by team_id + session_id          |
| **Orchestrator issues** (runtime leak, polling, etc) | ✅ Deleted orchestrator.ts - was dead code with fundamental issues |
| **TeamCoordination not in InstanceServices**         | ✅ Added to instances.ts                                           |

### Technical Changes

1. **packages/iris/src/team/index.ts**: All TeamModule functions (create, addMember, disband, get, list, members, updateMemberStatus) now delegate to TeamRepo Effect service while preserving backward-compatible async interfaces.

2. **packages/iris/src/team/task.ts**: TaskList.claim() now uses TeamCoordination.claimTask() for atomic DB transactions. Event emitting logic preserved.

3. **packages/iris/src/team/repo.ts**: Fixed updateMemberStatus() to filter by both team_id AND session_id (was only team_id due to `as never` cast hiding the bug).

4. **packages/iris/src/team/orchestrator.ts**: Deleted - had fundamental architectural problems:
   - Singleton ManagedRuntime disconnected from app's service graph
   - Busy-wait polling with 5-second setTimeout
   - Silent error swallowing with `.catch(() => {})`
   - Type escape with `sessionID as any`
   - No integration - nothing called it (dead code)

5. **packages/iris/src/effect/instances.ts**: Added TeamCoordination to InstanceServices union and lookup function.

### Test Results

- **TypeScript compilation**: ✅ Passes (`bun run typecheck`)
- **Tests**: ✅ 13 tests pass across repo.test.ts and coordination.test.ts

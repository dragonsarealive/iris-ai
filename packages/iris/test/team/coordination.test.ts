import { expect } from "bun:test"
import { Effect, Layer } from "effect"

import { TeamCoordination } from "../../src/team/coordination"
import { TeamRepo } from "../../src/team/repo"
import { Database } from "../../src/storage/db"
import { testEffect } from "../lib/effect"
import { TaskItemTable } from "../../src/session/session.sql"

const truncate = Layer.effectDiscard(
  Effect.sync(() => {
    const db = Database.Client()
    db.run(/*sql*/ `DELETE FROM team_member`)
    db.run(/*sql*/ `DELETE FROM team`)
    db.run(/*sql*/ `DELETE FROM task_item`)
    db.run(/*sql*/ `DELETE FROM project`)
  }),
)

const test = testEffect(Layer.mergeAll(TeamRepo.layer, TeamCoordination.layer, truncate))

const insertTaskSync = (teamID: string, title: string, status: string = "pending"): string => {
  const db = Database.Client()
  const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  db.insert(TaskItemTable)
    .values({
      id,
      team_id: teamID,
      title,
      status,
      time_created: Date.now(),
      time_updated: Date.now(),
    })
    .run()
  return id
}

test.effect("getPendingTasks returns only unassigned pending tasks", () =>
  Effect.gen(function* () {
    const db = Database.Client()
    db.run(
      /*sql*/ `INSERT INTO project (id, worktree, name, sandboxes, time_created, time_updated) VALUES ('proj-1', '/tmp/test', 'Test Project', '[]', ${Date.now()}, ${Date.now()})`,
    )

    const team = {
      id: "team-1",
      projectID: "proj-1" as any,
      leadSessionID: "session-lead",
      title: "Test Team",
      status: "active" as const,
      requirePlanApproval: false,
      timeCreated: Date.now(),
      timeUpdated: Date.now(),
    }
    yield* TeamRepo.use((r) => r.create(team))

    insertTaskSync("team-1", "Task 1")
    insertTaskSync("team-1", "Task 2")
    insertTaskSync("team-1", "Task 3")

    const pending = yield* TeamCoordination.use((r) => r.getPendingTasks("team-1"))
    expect(pending).toHaveLength(3)
  }),
)

test.effect("claimTask atomically claims a task", () =>
  Effect.gen(function* () {
    const db = Database.Client()
    db.run(
      /*sql*/ `INSERT INTO project (id, worktree, name, sandboxes, time_created, time_updated) VALUES ('proj-1', '/tmp/test', 'Test Project', '[]', ${Date.now()}, ${Date.now()})`,
    )

    const team = {
      id: "team-1",
      projectID: "proj-1" as any,
      leadSessionID: "session-lead",
      title: "Test Team",
      status: "active" as const,
      requirePlanApproval: false,
      timeCreated: Date.now(),
      timeUpdated: Date.now(),
    }
    yield* TeamRepo.use((r) => r.create(team))

    const taskId = insertTaskSync("team-1", "Task 1")

    const claimed = yield* TeamCoordination.use((r) => r.claimTask("team-1", "session-teammate" as any, taskId))
    expect(claimed).not.toBeNull()
    expect(claimed?.assignedToSessionID).toBe("session-teammate")
    expect(claimed?.status).toBe("in_progress")
  }),
)

test.effect("claimTask returns null for non-existent task", () =>
  Effect.gen(function* () {
    const result = yield* TeamCoordination.use((r) => r.claimTask("team-1", "session-1" as any, "non-existent"))
    expect(result).toBeNull()
  }),
)

test.effect("claimTask returns null for already claimed task", () =>
  Effect.gen(function* () {
    const db = Database.Client()
    db.run(
      /*sql*/ `INSERT INTO project (id, worktree, name, sandboxes, time_created, time_updated) VALUES ('proj-1', '/tmp/test', 'Test Project', '[]', ${Date.now()}, ${Date.now()})`,
    )

    const team = {
      id: "team-1",
      projectID: "proj-1" as any,
      leadSessionID: "session-lead",
      title: "Test Team",
      status: "active" as const,
      requirePlanApproval: false,
      timeCreated: Date.now(),
      timeUpdated: Date.now(),
    }
    yield* TeamRepo.use((r) => r.create(team))

    const taskId = insertTaskSync("team-1", "Task 1")

    yield* TeamCoordination.use((r) => r.claimTask("team-1", "session-1" as any, taskId))

    const claimedAgain = yield* TeamCoordination.use((r) => r.claimTask("team-1", "session-2" as any, taskId))
    expect(claimedAgain).toBeNull()
  }),
)

test.effect("getIdleTeammates returns only idle teammates", () =>
  Effect.gen(function* () {
    const db = Database.Client()
    db.run(
      /*sql*/ `INSERT INTO project (id, worktree, name, sandboxes, time_created, time_updated) VALUES ('proj-1', '/tmp/test', 'Test Project', '[]', ${Date.now()}, ${Date.now()})`,
    )

    const team = {
      id: "team-1",
      projectID: "proj-1" as any,
      leadSessionID: "session-lead",
      title: "Test Team",
      status: "active" as const,
      requirePlanApproval: false,
      timeCreated: Date.now(),
      timeUpdated: Date.now(),
    }
    yield* TeamRepo.use((r) => r.create(team))

    const leadMember = {
      id: "lead-1",
      teamID: "team-1",
      sessionID: "session-lead" as any,
      role: "lead" as const,
      status: "idle" as const,
      timeCreated: Date.now(),
    }
    const idleTeammate = {
      id: "tm-1",
      teamID: "team-1",
      sessionID: "session-tm-1" as any,
      role: "teammate" as const,
      status: "idle" as const,
      timeCreated: Date.now(),
    }
    const busyTeammate = {
      id: "tm-2",
      teamID: "team-1",
      sessionID: "session-tm-2" as any,
      role: "teammate" as const,
      status: "busy" as const,
      timeCreated: Date.now(),
    }

    yield* TeamRepo.use((r) => r.addMember(leadMember))
    yield* TeamRepo.use((r) => r.addMember(idleTeammate))
    yield* TeamRepo.use((r) => r.addMember(busyTeammate))

    const idle = yield* TeamCoordination.use((r) => r.getIdleTeammates("team-1"))
    expect(idle).toHaveLength(1)
    expect(idle[0].sessionID).toBe("session-tm-1")
  }),
)

test.effect("dispatchTask claims and dispatches a task", () =>
  Effect.gen(function* () {
    const db = Database.Client()
    db.run(
      /*sql*/ `INSERT INTO project (id, worktree, name, sandboxes, time_created, time_updated) VALUES ('proj-1', '/tmp/test', 'Test Project', '[]', ${Date.now()}, ${Date.now()})`,
    )

    const team = {
      id: "team-1",
      projectID: "proj-1" as any,
      leadSessionID: "session-lead",
      title: "Test Team",
      status: "active" as const,
      requirePlanApproval: false,
      timeCreated: Date.now(),
      timeUpdated: Date.now(),
    }
    yield* TeamRepo.use((r) => r.create(team))

    const taskId = insertTaskSync("team-1", "Task 1")

    yield* Effect.asVoid(
      TeamCoordination.use((r) => r.dispatchTask("team-1", "session-tm" as any, taskId, "Do the thing")),
    )

    const pending = yield* TeamCoordination.use((r) => r.getPendingTasks("team-1"))
    expect(pending).toHaveLength(0)
  }),
)

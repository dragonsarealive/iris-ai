import { expect } from "bun:test"
import { Effect, Layer } from "effect"

import { TeamRepo, TeamRepoError } from "../../src/team/repo"
import { Database } from "../../src/storage/db"
import { testEffect } from "../lib/effect"

const truncate = Layer.effectDiscard(
  Effect.sync(() => {
    const db = Database.Client()
    db.run(/*sql*/ `DELETE FROM team_member`)
    db.run(/*sql*/ `DELETE FROM team`)
    db.run(/*sql*/ `DELETE FROM project`)
  }),
)

const test = testEffect(Layer.merge(TeamRepo.layer, truncate))

test.effect("create inserts a team and returns void", () =>
  Effect.gen(function* () {
    const db = Database.Client()
    db.run(
      /*sql*/ `INSERT INTO project (id, worktree, name, sandboxes, time_created, time_updated) VALUES ('proj-1', '/tmp/test', 'Test Project', '[]', ${Date.now()}, ${Date.now()})`,
    )

    const team = {
      id: "team-1",
      projectID: "proj-1" as any,
      leadSessionID: "session-1",
      title: "Test Team",
      status: "active" as const,
      requirePlanApproval: false,
      timeCreated: Date.now(),
      timeUpdated: Date.now(),
    }
    yield* TeamRepo.use((r) => r.create(team))
    const result = yield* TeamRepo.use((r) => r.get("team-1"))
    expect(result?.id).toBe("team-1")
    expect(result?.title).toBe("Test Team")
  }),
)

test.effect("get returns null for non-existent team", () =>
  Effect.gen(function* () {
    const result = yield* TeamRepo.use((r) => r.get("non-existent"))
    expect(result).toBeNull()
  }),
)

test.effect("list returns all teams for a project", () =>
  Effect.gen(function* () {
    const db = Database.Client()
    db.run(
      /*sql*/ `INSERT INTO project (id, worktree, name, sandboxes, time_created, time_updated) VALUES ('proj-1', '/tmp/test', 'Test Project', '[]', ${Date.now()}, ${Date.now()})`,
    )

    const team1 = {
      id: "team-1",
      projectID: "proj-1" as any,
      leadSessionID: "session-1",
      title: "Team One",
      status: "active" as const,
      requirePlanApproval: false,
      timeCreated: Date.now(),
      timeUpdated: Date.now(),
    }
    const team2 = {
      id: "team-2",
      projectID: "proj-1" as any,
      leadSessionID: "session-2",
      title: "Team Two",
      status: "active" as const,
      requirePlanApproval: true,
      timeCreated: Date.now(),
      timeUpdated: Date.now(),
    }
    yield* TeamRepo.use((r) => r.create(team1))
    yield* TeamRepo.use((r) => r.create(team2))
    const result = yield* TeamRepo.use((r) => r.list("proj-1" as any))
    expect(result).toHaveLength(2)
  }),
)

test.effect("update modifies team fields", () =>
  Effect.gen(function* () {
    const db = Database.Client()
    db.run(
      /*sql*/ `INSERT INTO project (id, worktree, name, sandboxes, time_created, time_updated) VALUES ('proj-1', '/tmp/test', 'Test Project', '[]', ${Date.now()}, ${Date.now()})`,
    )

    const team = {
      id: "team-1",
      projectID: "proj-1" as any,
      leadSessionID: "session-1",
      title: "Original",
      status: "active" as const,
      requirePlanApproval: false,
      timeCreated: Date.now(),
      timeUpdated: Date.now(),
    }
    yield* TeamRepo.use((r) => r.create(team))
    yield* TeamRepo.use((r) => r.update("team-1", { title: "Updated", status: "disbanded" as const }))
    const result = yield* TeamRepo.use((r) => r.get("team-1"))
    expect(result?.title).toBe("Updated")
    expect(result?.status).toBe("disbanded")
  }),
)

test.effect("disband sets team status to disbanded", () =>
  Effect.gen(function* () {
    const db = Database.Client()
    db.run(
      /*sql*/ `INSERT INTO project (id, worktree, name, sandboxes, time_created, time_updated) VALUES ('proj-1', '/tmp/test', 'Test Project', '[]', ${Date.now()}, ${Date.now()})`,
    )

    const team = {
      id: "team-1",
      projectID: "proj-1" as any,
      leadSessionID: "session-1",
      title: "Test",
      status: "active" as const,
      requirePlanApproval: false,
      timeCreated: Date.now(),
      timeUpdated: Date.now(),
    }
    yield* TeamRepo.use((r) => r.create(team))
    yield* TeamRepo.use((r) => r.disband("team-1"))
    const result = yield* TeamRepo.use((r) => r.get("team-1"))
    expect(result?.status).toBe("disbanded")
  }),
)

test.effect("addMember adds a team member", () =>
  Effect.gen(function* () {
    const db = Database.Client()
    db.run(
      /*sql*/ `INSERT INTO project (id, worktree, name, sandboxes, time_created, time_updated) VALUES ('proj-1', '/tmp/test', 'Test Project', '[]', ${Date.now()}, ${Date.now()})`,
    )

    const team = {
      id: "team-1",
      projectID: "proj-1" as any,
      leadSessionID: "session-1",
      title: "Test",
      status: "active" as const,
      requirePlanApproval: false,
      timeCreated: Date.now(),
      timeUpdated: Date.now(),
    }
    yield* TeamRepo.use((r) => r.create(team))
    const member = {
      id: "member-1",
      teamID: "team-1",
      sessionID: "session-2" as any,
      role: "teammate" as const,
      status: "idle" as const,
      timeCreated: Date.now(),
    }
    yield* TeamRepo.use((r) => r.addMember(member))
    const members = yield* TeamRepo.use((r) => r.getMembers("team-1"))
    expect(members).toHaveLength(1)
    expect(members[0].sessionID).toBe("session-2")
  }),
)

test.effect("updateMemberStatus changes member status", () =>
  Effect.gen(function* () {
    const db = Database.Client()
    db.run(
      /*sql*/ `INSERT INTO project (id, worktree, name, sandboxes, time_created, time_updated) VALUES ('proj-1', '/tmp/test', 'Test Project', '[]', ${Date.now()}, ${Date.now()})`,
    )

    const team = {
      id: "team-1",
      projectID: "proj-1" as any,
      leadSessionID: "session-1",
      title: "Test",
      status: "active" as const,
      requirePlanApproval: false,
      timeCreated: Date.now(),
      timeUpdated: Date.now(),
    }
    yield* TeamRepo.use((r) => r.create(team))
    const member = {
      id: "member-1",
      teamID: "team-1",
      sessionID: "session-2" as any,
      role: "teammate" as const,
      status: "idle" as const,
      timeCreated: Date.now(),
    }
    yield* TeamRepo.use((r) => r.addMember(member))
    yield* TeamRepo.use((r) => r.updateMemberStatus("team-1", "session-2" as any, "busy"))
    const members = yield* TeamRepo.use((r) => r.getMembers("team-1"))
    expect(members[0].status).toBe("busy")
  }),
)

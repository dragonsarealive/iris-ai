import { ulid } from "ulid"
import { eq, and, inArray, isNull } from "drizzle-orm"
import { Effect, Layer, Schema, ServiceMap } from "effect"

import { Database } from "@/storage/db"
import { TaskItemTable, TeamMemberTable, TeamOrchestrationStepTable } from "../session/session.sql"
import { TaskItemInfo, TeamMemberInfo } from "./event"
import { Team } from "./event"
import { GlobalBus } from "@/bus/global"
import { SessionID } from "../session/schema"
import type { OrchestrationAction } from "./orchestration"

type DbClient = Parameters<typeof Database.use>[0] extends (db: infer T) => unknown ? T : never

export namespace TeamCoordination {
  export type Error = TaskCoordinationError | TaskAlreadyClaimedError

  export interface Service {
    readonly claimTask: (
      teamID: string,
      sessionID: SessionID,
      taskID: string,
    ) => Effect.Effect<TaskItemInfo | null, TaskCoordinationError>
    readonly dispatchTask: (
      teamID: string,
      teammateId: SessionID,
      taskID: string,
      description: string,
    ) => Effect.Effect<void, Error>
    readonly getPendingTasks: (teamID: string) => Effect.Effect<TaskItemInfo[], TaskCoordinationError>
    readonly getIdleTeammates: (teamID: string) => Effect.Effect<TeamMemberInfo[], TaskCoordinationError>
    readonly createTasks: (
      teamID: string,
      tasks: Array<{ title: string; description?: string; dependsOn?: string[] }>,
    ) => Effect.Effect<TaskItemInfo[], TaskCoordinationError>
    readonly completeTask: (taskID: string) => Effect.Effect<TaskItemInfo | null, TaskCoordinationError>
    readonly blockTask: (taskID: string) => Effect.Effect<TaskItemInfo | null, TaskCoordinationError>
    readonly listTasks: (teamID: string) => Effect.Effect<TaskItemInfo[], TaskCoordinationError>
  }
}

export class TaskNotFoundError extends Schema.TaggedErrorClass<TaskNotFoundError>()("TaskNotFoundError", {
  taskID: Schema.String,
  message: Schema.String,
}) {}

export class TaskAlreadyClaimedError extends Schema.TaggedErrorClass<TaskAlreadyClaimedError>()(
  "TaskAlreadyClaimedError",
  {
    taskID: Schema.String,
    message: Schema.String,
  },
) {}

export class TaskBlockedError extends Schema.TaggedErrorClass<TaskBlockedError>()("TaskBlockedError", {
  taskID: Schema.String,
  blockedBy: Schema.Array(Schema.String),
  message: Schema.String,
}) {}

export class TaskCoordinationError extends Schema.TaggedErrorClass<TaskCoordinationError>()("TaskCoordinationError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Defect),
}) {}

export class TeamCoordination extends ServiceMap.Service<TeamCoordination, TeamCoordination.Service>()(
  "@opencode/TeamCoordination",
) {
  static readonly layer: Layer.Layer<TeamCoordination> = Layer.effect(
    TeamCoordination,
    Effect.gen(function* () {
      const tx = <A>(f: (db: DbClient) => A) =>
        Effect.try({
          try: () => Database.transaction(f),
          catch: (cause) => new TaskCoordinationError({ message: "Database transaction failed", cause }),
        })

      const query = <A>(f: (db: DbClient) => A) =>
        Effect.try({
          try: () => Database.use(f),
          catch: (cause) => new TaskCoordinationError({ message: "Database operation failed", cause }),
        })

      const checkDependencies = (db: DbClient, teamID: string, dependsOn: string[]): string[] => {
        const doneDeps = db
          .select()
          .from(TaskItemTable)
          .where(
            and(
              eq(TaskItemTable.team_id, teamID),
              eq(TaskItemTable.status, "done"),
              inArray(TaskItemTable.id, dependsOn),
            ),
          )
          .all()
        const doneIds = new Set(doneDeps.map((t) => t.id))
        return dependsOn.filter((id) => !doneIds.has(id))
      }

      const claimTask = Effect.fn("TeamCoordination.claimTask")(
        (teamID: string, sessionID: SessionID, taskID: string) =>
          tx((db) => {
            const task = db.select().from(TaskItemTable).where(eq(TaskItemTable.id, taskID)).get()
            if (!task || task.team_id !== teamID) {
              return null
            }
            if (task.status !== "pending") {
              return null
            }
            if (task.assigned_to_session_id) {
              return null
            }
            if (task.depends_on_ids) {
              const dependsOn = JSON.parse(task.depends_on_ids) as string[]
              const unfulfilled = checkDependencies(db, teamID, dependsOn)
              if (unfulfilled.length > 0) {
                return null
              }
            }
            const now = Date.now()
            db.update(TaskItemTable)
              .set({ assigned_to_session_id: sessionID as SessionID, status: "in_progress", time_updated: now })
              .where(eq(TaskItemTable.id, taskID))
              .run()
            const updated: TaskItemInfo = {
              id: task.id,
              teamID: task.team_id,
              assignedToSessionID: sessionID,
              title: task.title,
              description: task.description ?? undefined,
              status: "in_progress",
              dependsOnIDs: task.depends_on_ids ? JSON.parse(task.depends_on_ids) : undefined,
              timeCreated: task.time_created,
              timeUpdated: now,
            }
            return updated
          }),
      )

      const emitTaskEvent = (teamID: string, task: TaskItemInfo) => {
        GlobalBus.emit("event", {
          payload: {
            type: "team.task.updated",
            properties: { teamID, task },
          },
        })
      }

      const emitOrchestration = (input: {
        teamID: string
        actorSessionID: string
        targetSessionID?: string
        action: OrchestrationAction
        detail?: string
      }) => {
        const now = Date.now()
        const id = ulid()
        return Effect.gen(function* () {
          yield* query((db) => {
            db.insert(TeamOrchestrationStepTable)
              .values({
                id,
                team_id: input.teamID,
                time: now,
                actor_session_id: input.actorSessionID as SessionID,
                target_session_id: input.targetSessionID as SessionID | undefined,
                action: input.action,
                detail: input.detail ?? null,
                time_created: now,
                time_updated: now,
              })
              .run()
          }).pipe(Effect.asVoid)
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

      const getPendingTasks = Effect.fn("TeamCoordination.getPendingTasks")((teamID: string) =>
        query((db) => {
          const rows = db
            .select()
            .from(TaskItemTable)
            .where(
              and(
                eq(TaskItemTable.team_id, teamID),
                eq(TaskItemTable.status, "pending"),
                isNull(TaskItemTable.assigned_to_session_id),
              ),
            )
            .all()
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

      const getIdleTeammates = Effect.fn("TeamCoordination.getIdleTeammates")((teamID: string) =>
        query((db) => {
          const rows = db
            .select()
            .from(TeamMemberTable)
            .where(
              and(
                eq(TeamMemberTable.team_id, teamID),
                eq(TeamMemberTable.role, "teammate"),
                eq(TeamMemberTable.status, "idle"),
              ),
            )
            .all()
          return rows.map(
            (row) =>
              ({
                id: row.id,
                teamID: row.team_id,
                sessionID: row.session_id,
                worktreeDirectory: row.worktree_directory ?? undefined,
                role: row.role as "lead" | "teammate",
                status: row.status as "idle" | "busy" | "planning" | "waiting_approval" | "done",
                timeCreated: row.time_created,
              }) as TeamMemberInfo,
          )
        }),
      )

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

                const item: TaskItemInfo = {
                  id,
                  teamID,
                  assignedToSessionID: undefined,
                  title: task.title,
                  description: task.description,
                  status: "pending",
                  dependsOnIDs: task.dependsOn,
                  timeCreated: now,
                  timeUpdated: now,
                }
                items.push(item)
              }
            })

            for (const item of items) {
              emitTaskEvent(teamID, item)
            }

            return items
          }),
      )

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

            const allTeamTasks = db.select().from(TaskItemTable).where(eq(TaskItemTable.team_id, task.team_id)).all()

            const unblockedTasks: TaskItemInfo[] = []
            for (const t of allTeamTasks) {
              if (!t.depends_on_ids) continue
              const deps = JSON.parse(t.depends_on_ids) as string[]
              if (!deps.includes(taskID)) continue
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

      const blockTask = Effect.fn("TeamCoordination.blockTask")((taskID: string) =>
        Effect.gen(function* () {
          const task = yield* query((db) => db.select().from(TaskItemTable).where(eq(TaskItemTable.id, taskID)).get())

          if (!task) {
            return null
          }

          if (task.status === "done") {
            return null
          }

          const now = Date.now()

          yield* tx((db) => {
            db.update(TaskItemTable)
              .set({ status: "blocked", time_updated: now })
              .where(eq(TaskItemTable.id, taskID))
              .run()
          })

          const updated: TaskItemInfo = {
            id: task.id,
            teamID: task.team_id,
            assignedToSessionID: task.assigned_to_session_id ?? undefined,
            title: task.title,
            description: task.description ?? undefined,
            status: "blocked",
            dependsOnIDs: task.depends_on_ids ? JSON.parse(task.depends_on_ids) : undefined,
            timeCreated: task.time_created,
            timeUpdated: now,
          }

          emitTaskEvent(task.team_id, updated)

          return updated
        }),
      )

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
    }),
  )
}

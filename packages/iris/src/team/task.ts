import { ulid } from "ulid"
import z from "zod"
import { Database, eq, and, inArray, isNull } from "../storage/db"
import { TaskItemTable, TaskItemTable as Table } from "../session/session.sql"
import { TaskItemInfo } from "./event"
import { GlobalBus } from "@/bus/global"
import { SessionID } from "../session/schema"
import { Orchestration } from "./orchestration"

export namespace TaskList {
  export const CreateInput = z.object({
    teamID: z.string(),
    tasks: z.array(
      z.object({
        title: z.string(),
        description: z.string().optional(),
        dependsOn: z.array(z.string()).optional(),
      }),
    ),
  })
  export type CreateInput = z.infer<typeof CreateInput>

  export async function create(input: CreateInput): Promise<TaskItemInfo[]> {
    const now = Date.now()
    const items: TaskItemInfo[] = []

    Database.use((db) => {
      for (const task of input.tasks) {
        const id = ulid()
        db.insert(TaskItemTable)
          .values({
            id,
            team_id: input.teamID,
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
          teamID: input.teamID,
          assignedToSessionID: undefined,
          title: task.title,
          description: task.description,
          status: "pending",
          dependsOnIDs: task.dependsOn,
          timeCreated: now,
          timeUpdated: now,
        }
        items.push(item)

        GlobalBus.emit("event", {
          payload: {
            type: "team.task.updated",
            properties: { teamID: input.teamID, task: item },
          },
        })
      }
    })

    return items
  }

  export async function claim(teamID: string, sessionID: SessionID, taskID: string): Promise<TaskItemInfo | null> {
    const task = Database.use((db) => {
      return db.select().from(TaskItemTable).where(eq(TaskItemTable.id, taskID)).get()
    })

    if (!task || task.team_id !== teamID) {
      return null
    }

    if (task.status !== "pending") {
      return null
    }

    if (task.depends_on_ids) {
      const dependsOn = JSON.parse(task.depends_on_ids) as string[]
      const doneDeps = Database.use((db) => {
        return db
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
      })

      const doneIds = new Set(doneDeps.map((t) => t.id))
      const unfulfilled = dependsOn.filter((id) => !doneIds.has(id))
      if (unfulfilled.length > 0) {
        return null
      }
    }

    const now = Date.now()
    Database.use((db) => {
      db.update(TaskItemTable)
        .set({
          assigned_to_session_id: sessionID as SessionID,
          status: "in_progress",
          time_updated: now,
        })
        .where(eq(TaskItemTable.id, taskID))
        .run()
    })

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

    GlobalBus.emit("event", {
      payload: {
        type: "team.task.updated",
        properties: { teamID, task: updated },
      },
    })

    Orchestration.emit({
      teamID,
      actorSessionID: sessionID,
      action: "task_claimed",
      detail: updated.title,
    })

    return updated
  }

  export async function complete(taskID: string): Promise<TaskItemInfo | null> {
    const task = Database.use((db) => {
      return db.select().from(TaskItemTable).where(eq(TaskItemTable.id, taskID)).get()
    })

    if (!task) {
      return null
    }

    const now = Date.now()
    Database.use((db) => {
      db.update(TaskItemTable).set({ status: "done", time_updated: now }).where(eq(TaskItemTable.id, taskID)).run()
    })

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

    GlobalBus.emit("event", {
      payload: {
        type: "team.task.updated",
        properties: { teamID: task.team_id, task: updated },
      },
    })

    if (updated.assignedToSessionID) {
      Orchestration.emit({
        teamID: task.team_id,
        actorSessionID: updated.assignedToSessionID,
        action: "task_completed",
        detail: updated.title,
      })
    }

    const allTeamTasks = Database.use((db) =>
      db.select().from(TaskItemTable).where(eq(TaskItemTable.team_id, task.team_id)).all(),
    )
    for (const t of allTeamTasks) {
      if (!t.depends_on_ids) continue
      const deps = JSON.parse(t.depends_on_ids) as string[]
      if (!deps.includes(taskID)) continue
      const doneDeps = allTeamTasks.filter((x) => deps.includes(x.id) && x.status === "done")
      if (doneDeps.length !== deps.length) continue
      const newStatus = t.status === "blocked" ? "pending" : t.status
      const timeUpdated = t.status === "blocked" ? Date.now() : t.time_updated
      if (t.status === "blocked") {
        Database.use((db) => {
          db.update(TaskItemTable).set({ status: "pending", time_updated: timeUpdated }).where(eq(TaskItemTable.id, t.id)).run()
        })
      }
      const unblocked: TaskItemInfo = {
        id: t.id,
        teamID: t.team_id,
        assignedToSessionID: t.assigned_to_session_id ?? undefined,
        title: t.title,
        description: t.description ?? undefined,
        status: newStatus as TaskItemInfo["status"],
        dependsOnIDs: deps,
        timeCreated: t.time_created,
        timeUpdated,
      }
      GlobalBus.emit("event", {
        payload: {
          type: "team.task.updated",
          properties: { teamID: task.team_id, task: unblocked },
        },
      })
    }

    return updated
  }

  export async function block(taskID: string): Promise<TaskItemInfo | null> {
    const task = Database.use((db) => {
      return db.select().from(TaskItemTable).where(eq(TaskItemTable.id, taskID)).get()
    })

    if (!task) {
      return null
    }

    if (task.status === "done") {
      return null
    }

    const now = Date.now()
    Database.use((db) => {
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

    GlobalBus.emit("event", {
      payload: {
        type: "team.task.updated",
        properties: { teamID: task.team_id, task: updated },
      },
    })

    return updated
  }

  export async function list(teamID: string): Promise<TaskItemInfo[]> {
    const rows = Database.use((db) => {
      return db.select().from(TaskItemTable).where(eq(TaskItemTable.team_id, teamID)).all()
    })

    return rows.map((row) => ({
      id: row.id,
      teamID: row.team_id,
      assignedToSessionID: row.assigned_to_session_id ?? undefined,
      title: row.title,
      description: row.description ?? undefined,
      status: row.status as "pending" | "in_progress" | "done" | "blocked",
      dependsOnIDs: row.depends_on_ids ? JSON.parse(row.depends_on_ids) : undefined,
      timeCreated: row.time_created,
      timeUpdated: row.time_updated,
    }))
  }
}

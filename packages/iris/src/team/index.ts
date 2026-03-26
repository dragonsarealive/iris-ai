import z from "zod"
import { ulid } from "ulid"
import { Database, eq, and } from "../storage/db"
import { SessionTable, TeamTable, TeamMemberTable } from "../session/session.sql"
import { Team, TeamInfo, TeamMemberInfo } from "./event"
import { GlobalBus } from "@/bus/global"
import { Worktree } from "@/worktree"
import { Session } from "@/session"
import { SessionID } from "@/session/schema"
import { ProjectID } from "../project/schema"
import { Orchestration } from "./orchestration"

export namespace TeamModule {
  export const CreateInput = z.object({
    title: z.string(),
    leadSessionID: SessionID.zod,
    requirePlanApproval: z.boolean().optional().default(false),
  })
  export type CreateInput = z.infer<typeof CreateInput>

  export const AddMemberInput = z.object({
    teamID: z.string(),
    agentName: z.string(),
    prompt: z.string().optional(),
  })
  export type AddMemberInput = z.infer<typeof AddMemberInput>

  export async function create(input: CreateInput): Promise<TeamInfo> {
    const id = ulid()
    const now = Date.now()

    const leadSession = await Session.get(input.leadSessionID)

    Database.use((db) => {
      db.insert(TeamTable)
        .values({
          id,
          project_id: leadSession.projectID,
          lead_session_id: input.leadSessionID,
          title: input.title,
          status: "active",
          require_plan_approval: input.requirePlanApproval ? 1 : 0,
          time_created: now,
          time_updated: now,
        })
        .run()

      db.insert(TeamMemberTable)
        .values({
          id: ulid(),
          team_id: id,
          session_id: input.leadSessionID,
          role: "lead",
          status: "idle",
          time_created: now,
        })
        .run()

      db.update(SessionTable).set({ team_id: id }).where(eq(SessionTable.id, input.leadSessionID)).run()
    })

    const team: TeamInfo = {
      id,
      projectID: leadSession.projectID,
      leadSessionID: input.leadSessionID,
      title: input.title,
      status: "active",
      requirePlanApproval: input.requirePlanApproval ?? false,
      timeCreated: now,
      timeUpdated: now,
    }

    GlobalBus.emit("event", {
      payload: {
        type: Team.Created.type,
        properties: { team },
      },
    })

    return team
  }

  export async function addMember(input: AddMemberInput): Promise<TeamMemberInfo> {
    const teamRow = Database.use((db) => {
      return db.select().from(TeamTable).where(eq(TeamTable.id, input.teamID)).get()
    })

    if (!teamRow) {
      throw new Error(`Team not found: ${input.teamID}`)
    }

    const leadMemberRow = Database.use((db) => {
      return db.select().from(TeamMemberTable).where(eq(TeamMemberTable.team_id, input.teamID)).get()
    })

    if (!leadMemberRow) {
      throw new Error(`Lead member not found for team: ${input.teamID}`)
    }

    const worktree = await Worktree.create({ name: input.agentName })

    const teammateSession = await Session.createNext({
      parentID: teamRow.lead_session_id as SessionID,
      directory: worktree.directory,
      title: input.agentName,
    })

    const now = Date.now()
    const member: TeamMemberInfo = {
      id: ulid(),
      teamID: input.teamID,
      sessionID: teammateSession.id,
      worktreeDirectory: worktree.directory,
      role: "teammate",
      status: "idle",
      timeCreated: now,
    }

    Database.use((db) => {
      db.insert(TeamMemberTable)
        .values({
          id: member.id,
          team_id: input.teamID,
          session_id: teammateSession.id,
          worktree_directory: worktree.directory,
          role: "teammate",
          status: "idle",
          time_created: now,
        })
        .run()

      db.update(SessionTable).set({ team_id: input.teamID }).where(eq(SessionTable.id, teammateSession.id)).run()
    })

    GlobalBus.emit("event", {
      payload: {
        type: Team.Updated.type,
        properties: {
          team: (await get(input.teamID)) as TeamInfo,
        },
      },
    })

    Orchestration.emit({
      teamID: input.teamID,
      actorSessionID: teamRow.lead_session_id,
      targetSessionID: teammateSession.id,
      action: "teammate_spawned",
      detail: input.agentName,
    })

    return member
  }

  export async function disband(teamID: string): Promise<void> {
    const members = Database.use((db) => {
      return db.select().from(TeamMemberTable).where(eq(TeamMemberTable.team_id, teamID)).all()
    })

    const { SessionPrompt } = await import("@/session/prompt")

    for (const member of members) {
      if (member.role !== "lead") {
        SessionPrompt.cancel(member.session_id as SessionID)

        if (member.worktree_directory) {
          await Worktree.remove({ directory: member.worktree_directory }).catch(() => undefined)
        }
      }
    }

    Database.use((db) => {
      db.update(TeamTable).set({ status: "disbanded", time_updated: Date.now() }).where(eq(TeamTable.id, teamID)).run()
    })

    const leadRow = members.find((m) => m.role === "lead")
    GlobalBus.emit("event", {
      payload: {
        type: Team.Disbanded.type,
        properties: { teamID },
      },
    })

    if (leadRow) {
      Orchestration.emit({
        teamID,
        actorSessionID: leadRow.session_id,
        action: "team_disbanded",
      })
    }
  }

  export async function get(teamID: string): Promise<TeamInfo | null> {
    const row = Database.use((db) => {
      return db.select().from(TeamTable).where(eq(TeamTable.id, teamID)).get()
    })

    if (!row) return null

    return {
      id: row.id,
      projectID: row.project_id,
      leadSessionID: row.lead_session_id,
      title: row.title,
      status: row.status as "active" | "disbanded",
      requirePlanApproval: row.require_plan_approval === 1,
      timeCreated: row.time_created,
      timeUpdated: row.time_updated,
    }
  }

  export async function list(projectID: string): Promise<TeamInfo[]> {
    const rows = Database.use((db) => {
      return db
        .select()
        .from(TeamTable)
        .where(eq(TeamTable.project_id, projectID as ProjectID))
        .all()
    })

    return rows.map((row) => ({
      id: row.id,
      projectID: row.project_id,
      leadSessionID: row.lead_session_id,
      title: row.title,
      status: row.status as "active" | "disbanded",
      requirePlanApproval: row.require_plan_approval === 1,
      timeCreated: row.time_created,
      timeUpdated: row.time_updated,
    }))
  }

  export async function members(teamID: string): Promise<TeamMemberInfo[]> {
    const rows = Database.use((db) => {
      return db.select().from(TeamMemberTable).where(eq(TeamMemberTable.team_id, teamID)).all()
    })

    return rows.map((row) => ({
      id: row.id,
      teamID: row.team_id,
      sessionID: row.session_id,
      worktreeDirectory: row.worktree_directory ?? undefined,
      role: row.role as "lead" | "teammate",
      status: row.status as "idle" | "busy" | "planning" | "waiting_approval" | "done",
      timeCreated: row.time_created,
    }))
  }

  export async function updateMemberStatus(
    teamID: string,
    sessionID: string,
    status: TeamMemberInfo["status"],
  ): Promise<void> {
    Database.use((db) => {
      db.update(TeamMemberTable)
        .set({ status, time_updated: Date.now() })
        .where(
          and(
            eq(TeamMemberTable.team_id, teamID),
            eq(TeamMemberTable.session_id, sessionID as SessionID),
          ),
        )
        .run()
    })

    GlobalBus.emit("event", {
      payload: {
        type: Team.MemberStatus.type,
        properties: { teamID, sessionID, status },
      },
    })
  }
}

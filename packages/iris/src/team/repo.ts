import { eq, and } from "drizzle-orm"
import { Effect, Layer, Schema, ServiceMap } from "effect"

import { Database } from "@/storage/db"
import type { OrchestrationAction } from "./orchestration"
import {
  TeamTable,
  TeamMemberTable,
  SessionTable,
  TeamMessageTable,
  TeamOrchestrationStepTable,
} from "../session/session.sql"
import { TeamInfo, TeamMemberInfo } from "./event"
import { ProjectID } from "../project/schema"
import { SessionID } from "../session/schema"

export type TeamRow = (typeof TeamTable)["$inferSelect"]
export type TeamMemberRow = (typeof TeamMemberTable)["$inferSelect"]
export type TeamMessageRow = (typeof TeamMessageTable)["$inferSelect"]
export type OrchestrationRow = (typeof TeamOrchestrationStepTable)["$inferSelect"]

type DbClient = Parameters<typeof Database.use>[0] extends (db: infer T) => unknown ? T : never

export namespace TeamRepo {
  export interface Service {
    readonly create: (team: TeamInfo) => Effect.Effect<void, TeamRepoError>
    readonly get: (teamID: string) => Effect.Effect<TeamInfo | null, TeamRepoError>
    readonly list: (projectID: ProjectID) => Effect.Effect<TeamInfo[], TeamRepoError>
    readonly update: (teamID: string, updates: Partial<TeamInfo>) => Effect.Effect<void, TeamRepoError>
    readonly disband: (teamID: string) => Effect.Effect<void, TeamRepoError>
    readonly addMember: (member: TeamMemberInfo) => Effect.Effect<void, TeamRepoError>
    readonly getMembers: (teamID: string) => Effect.Effect<TeamMemberInfo[], TeamRepoError>
    readonly updateMemberStatus: (
      teamID: string,
      sessionID: SessionID,
      status: TeamMemberInfo["status"],
    ) => Effect.Effect<void, TeamRepoError>
    readonly setSessionTeamID: (sessionID: SessionID, teamID: string) => Effect.Effect<void, TeamRepoError>
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
    readonly emitOrchestrationStep: (input: {
      id: string
      teamID: string
      time: number
      actorSessionID: string
      targetSessionID?: string
      action: OrchestrationAction
      detail?: string
    }) => Effect.Effect<void, TeamRepoError>
    readonly listOrchestrationSteps: (teamID: string) => Effect.Effect<OrchestrationRow[], TeamRepoError>
  }
}

export class TeamRepoError extends Schema.TaggedErrorClass<TeamRepoError>()("TeamRepoError", {
  message: Schema.String,
  cause: Schema.optional(Schema.Defect),
}) {}

export class TeamRepo extends ServiceMap.Service<TeamRepo, TeamRepo.Service>()("@opencode/TeamRepo") {
  static readonly layer: Layer.Layer<TeamRepo> = Layer.effect(
    TeamRepo,
    Effect.gen(function* () {
      const query = <A>(f: (db: DbClient) => A) =>
        Effect.try({
          try: () => Database.use(f),
          catch: (cause) => new TeamRepoError({ message: "Database operation failed", cause }),
        })

      const tx = <A>(f: (db: DbClient) => A) =>
        Effect.try({
          try: () => Database.transaction(f),
          catch: (cause) => new TeamRepoError({ message: "Database transaction failed", cause }),
        })

      const create = Effect.fn("TeamRepo.create")((team: TeamInfo) =>
        query((db) => {
          db.insert(TeamTable)
            .values({
              id: team.id,
              project_id: team.projectID as ProjectID,
              lead_session_id: team.leadSessionID,
              title: team.title,
              status: team.status,
              require_plan_approval: team.requirePlanApproval ? 1 : 0,
              time_created: team.timeCreated,
              time_updated: team.timeUpdated,
            })
            .run()
        }).pipe(Effect.asVoid),
      )

      const get = Effect.fn("TeamRepo.get")((teamID: string) =>
        query((db) => {
          const row = db.select().from(TeamTable).where(eq(TeamTable.id, teamID)).get()
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
          } as TeamInfo
        }),
      )

      const list = Effect.fn("TeamRepo.list")((projectID: ProjectID) =>
        query((db) => {
          const rows = db.select().from(TeamTable).where(eq(TeamTable.project_id, projectID)).all()
          return rows.map(
            (row) =>
              ({
                id: row.id,
                projectID: row.project_id,
                leadSessionID: row.lead_session_id,
                title: row.title,
                status: row.status as "active" | "disbanded",
                requirePlanApproval: row.require_plan_approval === 1,
                timeCreated: row.time_created,
                timeUpdated: row.time_updated,
              }) as TeamInfo,
          )
        }),
      )

      const update = Effect.fn("TeamRepo.update")((teamID: string, updates: Partial<TeamInfo>) =>
        tx((db) => {
          const setFields: Record<string, unknown> = { time_updated: Date.now() }
          if (updates.status) setFields.status = updates.status
          if (updates.title) setFields.title = updates.title
          if (updates.requirePlanApproval !== undefined) {
            setFields.require_plan_approval = updates.requirePlanApproval ? 1 : 0
          }
          db.update(TeamTable).set(setFields).where(eq(TeamTable.id, teamID)).run()
        }).pipe(Effect.asVoid),
      )

      const disband = Effect.fn("TeamRepo.disband")((teamID: string) =>
        tx((db) => {
          db.update(TeamTable)
            .set({ status: "disbanded", time_updated: Date.now() })
            .where(eq(TeamTable.id, teamID))
            .run()
        }).pipe(Effect.asVoid),
      )

      const addMember = Effect.fn("TeamRepo.addMember")((member: TeamMemberInfo) =>
        query((db) => {
          db.insert(TeamMemberTable)
            .values({
              id: member.id,
              team_id: member.teamID,
              session_id: member.sessionID as SessionID,
              worktree_directory: member.worktreeDirectory,
              role: member.role,
              status: member.status,
              time_created: member.timeCreated,
            })
            .run()
        }).pipe(Effect.asVoid),
      )

      const getMembers = Effect.fn("TeamRepo.getMembers")((teamID: string) =>
        query((db) => {
          const rows = db.select().from(TeamMemberTable).where(eq(TeamMemberTable.team_id, teamID)).all()
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

      const updateMemberStatus = Effect.fn("TeamRepo.updateMemberStatus")(
        (teamID: string, sessionID: SessionID, status: TeamMemberInfo["status"]) =>
          tx((db) => {
            db.update(TeamMemberTable)
              .set({ status, time_updated: Date.now() })
              .where(and(eq(TeamMemberTable.team_id, teamID), eq(TeamMemberTable.session_id, sessionID)))
              .run()
          }).pipe(Effect.asVoid),
      )

      const setSessionTeamID = Effect.fn("TeamRepo.setSessionTeamID")((sessionID: SessionID, teamID: string) =>
        query((db) => {
          db.update(SessionTable).set({ team_id: teamID }).where(eq(SessionTable.id, sessionID)).run()
        }).pipe(Effect.asVoid),
      )

      const sendMessage = Effect.fn("TeamRepo.sendMessage")(
        (msg: {
          id: string
          teamID: string
          fromSessionID: string
          toSessionID?: string
          body: string
          timeCreated: number
        }) =>
          query((db) => {
            db.insert(TeamMessageTable)
              .values({
                id: msg.id,
                team_id: msg.teamID,
                from_session_id: msg.fromSessionID,
                to_session_id: msg.toSessionID ?? null,
                body: msg.body,
                delivered: 0,
                time_created: msg.timeCreated,
                time_updated: msg.timeCreated,
              })
              .run()
          }).pipe(Effect.asVoid),
      )

      const getInbox = Effect.fn("TeamRepo.getInbox")((sessionID: SessionID) =>
        query((db) => {
          const rows = db
            .select()
            .from(TeamMessageTable)
            .where(and(eq(TeamMessageTable.to_session_id, sessionID), eq(TeamMessageTable.delivered, 0)))
            .all()
          return rows
        }),
      )

      const getPendingMessages = Effect.fn("TeamRepo.getPendingMessages")((teamID: string) =>
        query((db) => {
          const rows = db
            .select()
            .from(TeamMessageTable)
            .where(and(eq(TeamMessageTable.team_id, teamID), eq(TeamMessageTable.delivered, 0)))
            .all()
          return rows
        }),
      )

      const markDelivered = Effect.fn("TeamRepo.markDelivered")((messageID: string) =>
        query((db) => {
          db.update(TeamMessageTable).set({ delivered: 1 }).where(eq(TeamMessageTable.id, messageID)).run()
        }).pipe(Effect.asVoid),
      )

      const listMessagesByTeam = Effect.fn("TeamRepo.listMessagesByTeam")((teamID: string) =>
        query((db) => {
          const rows = db.select().from(TeamMessageTable).where(eq(TeamMessageTable.team_id, teamID)).all()
          return rows
        }),
      )

      const getLeadMember = Effect.fn("TeamRepo.getLeadMember")((teamID: string) =>
        query((db) => {
          const rows = db.select().from(TeamMemberTable).where(eq(TeamMemberTable.team_id, teamID)).all()
          return rows.find((r) => r.role === "lead") ?? null
        }),
      )

      const emitOrchestrationStep = Effect.fn("TeamRepo.emitOrchestrationStep")(
        (input: {
          id: string
          teamID: string
          time: number
          actorSessionID: string
          targetSessionID?: string
          action: OrchestrationAction
          detail?: string
        }) =>
          query((db) => {
            db.insert(TeamOrchestrationStepTable)
              .values({
                id: input.id,
                team_id: input.teamID,
                time: input.time,
                actor_session_id: input.actorSessionID as SessionID,
                target_session_id: input.targetSessionID as SessionID | undefined,
                action: input.action,
                detail: input.detail ?? null,
                time_created: input.time,
                time_updated: input.time,
              })
              .run()
          }).pipe(Effect.asVoid),
      )

      const listOrchestrationSteps = Effect.fn("TeamRepo.listOrchestrationSteps")((teamID: string) =>
        query((db) => {
          return db
            .select()
            .from(TeamOrchestrationStepTable)
            .where(eq(TeamOrchestrationStepTable.team_id, teamID))
            .all()
        }),
      )

      return TeamRepo.of({
        create,
        get,
        list,
        update,
        disband,
        addMember,
        getMembers,
        updateMemberStatus,
        setSessionTeamID,
        sendMessage,
        getInbox,
        getPendingMessages,
        markDelivered,
        listMessagesByTeam,
        getLeadMember,
        emitOrchestrationStep,
        listOrchestrationSteps,
      })
    }),
  )
}

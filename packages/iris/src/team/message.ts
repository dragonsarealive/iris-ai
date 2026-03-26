import { ulid } from "ulid"
import z from "zod"
import { Database, eq, and } from "../storage/db"
import { TeamMessageTable, TeamMemberTable } from "../session/session.sql"
import { TeamMessageInfo } from "./event"
import { GlobalBus } from "@/bus/global"
import { SessionID } from "../session/schema"
import { Session } from "@/session"
import { Orchestration } from "./orchestration"

export namespace TeamMessage {
  export const SendInput = z.object({
    teamID: z.string(),
    fromSessionID: SessionID.zod,
    toSessionID: SessionID.zod.optional(),
    body: z.string(),
  })
  export type SendInput = z.infer<typeof SendInput>

  export async function send(input: SendInput): Promise<TeamMessageInfo> {
    const id = ulid()
    const now = Date.now()

    Database.use((db) => {
      db.insert(TeamMessageTable)
        .values({
          id,
          team_id: input.teamID,
          from_session_id: input.fromSessionID,
          to_session_id: input.toSessionID ?? null,
          body: input.body,
          delivered: 0,
          time_created: now,
          time_updated: now,
        })
        .run()
    })

    const msg: TeamMessageInfo = {
      id,
      teamID: input.teamID,
      fromSessionID: input.fromSessionID,
      toSessionID: input.toSessionID,
      body: input.body,
      delivered: false,
      timeCreated: now,
    }

    GlobalBus.emit("event", {
      payload: {
        type: "team.message.sent",
        properties: { teamID: input.teamID, msg },
      },
    })

    const leadRow = Database.use((db) =>
      db
        .select()
        .from(TeamMemberTable)
        .where(eq(TeamMemberTable.team_id, input.teamID))
        .all()
        .find((r) => r.role === "lead"),
    )
    if (leadRow && input.fromSessionID === leadRow.session_id) {
      Orchestration.emit({
        teamID: input.teamID,
        actorSessionID: input.fromSessionID,
        targetSessionID: input.toSessionID,
        action: "prompt_dispatched",
        detail: input.body.slice(0, 200),
      })
    }

    return msg
  }

  export async function inbox(sessionID: SessionID): Promise<TeamMessageInfo[]> {
    const rows = Database.use((db) => {
      return db
        .select()
        .from(TeamMessageTable)
        .where(and(eq(TeamMessageTable.to_session_id, sessionID), eq(TeamMessageTable.delivered, 0)))
        .all()
    })

    return rows.map((row) => toInfo(row))
  }

  /** Pending messages for session (direct + broadcast to session's team). */
  export async function getPendingForSession(sessionID: SessionID): Promise<TeamMessageInfo[]> {
    const session = await Session.get(sessionID)
    const teamID = session.teamID
    if (!teamID) return []

    const rows = Database.use((db) =>
      db
        .select()
        .from(TeamMessageTable)
        .where(and(eq(TeamMessageTable.team_id, teamID), eq(TeamMessageTable.delivered, 0)))
        .all(),
    )
    const pending = rows.filter(
      (r) => r.to_session_id === sessionID || r.to_session_id === null,
    )
    pending.sort((a, b) => a.time_created - b.time_created)
    return pending.map(toInfo)
  }

  function toInfo(row: {
    id: string
    team_id: string
    from_session_id: string
    to_session_id: string | null
    body: string
    delivered: number
    time_created: number
  }): TeamMessageInfo {
    return {
      id: row.id,
      teamID: row.team_id,
      fromSessionID: row.from_session_id,
      toSessionID: row.to_session_id ?? undefined,
      body: row.body,
      delivered: row.delivered === 1,
      timeCreated: row.time_created,
    }
  }

  export async function markDelivered(messageID: string): Promise<void> {
    Database.use((db) => {
      db.update(TeamMessageTable).set({ delivered: 1 }).where(eq(TeamMessageTable.id, messageID)).run()
    })
  }

  export async function listByTeam(teamID: string): Promise<TeamMessageInfo[]> {
    const rows = Database.use((db) => {
      return db.select().from(TeamMessageTable).where(eq(TeamMessageTable.team_id, teamID)).all()
    })

    return rows.map((row) => ({
      id: row.id,
      teamID: row.team_id,
      fromSessionID: row.from_session_id,
      toSessionID: row.to_session_id ?? undefined,
      body: row.body,
      delivered: row.delivered === 1,
      timeCreated: row.time_created,
    }))
  }
}

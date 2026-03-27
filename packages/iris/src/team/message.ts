import { ulid } from "ulid"
import z from "zod"
import { TeamMessageInfo } from "./event"
import { GlobalBus } from "@/bus/global"
import { SessionID } from "../session/schema"
import { Session } from "@/session"
import { Orchestration } from "./orchestration"
import { TeamRepo } from "./repo"
import { runPromiseInstance } from "@/effect/runtime"

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

    await runPromiseInstance(
      TeamRepo.use((r) =>
        r.sendMessage({
          id,
          teamID: input.teamID,
          fromSessionID: input.fromSessionID,
          toSessionID: input.toSessionID,
          body: input.body,
          timeCreated: now,
        }),
      ),
    )

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

    const leadRow = await runPromiseInstance(TeamRepo.use((r) => r.getLeadMember(input.teamID)))
    if (leadRow && input.fromSessionID === leadRow.session_id) {
      await Orchestration.emit({
        teamID: input.teamID,
        actorSessionID: input.fromSessionID,
        targetSessionID: input.toSessionID as string | undefined,
        action: "prompt_dispatched",
        detail: input.body.slice(0, 200),
      })
    }

    return msg
  }

  export async function inbox(sessionID: SessionID): Promise<TeamMessageInfo[]> {
    const rows = await runPromiseInstance(TeamRepo.use((r) => r.getInbox(sessionID)))
    return rows.map((row) => toInfo(row))
  }

  export async function getPendingForSession(sessionID: SessionID): Promise<TeamMessageInfo[]> {
    const session = await Session.get(sessionID)
    const teamID = session.teamID
    if (!teamID) return []

    const rows = await runPromiseInstance(TeamRepo.use((r) => r.getPendingMessages(teamID)))
    const pending = rows.filter((r) => r.to_session_id === sessionID || r.to_session_id === null)
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
    await runPromiseInstance(TeamRepo.use((r) => r.markDelivered(messageID)))
  }

  export async function listByTeam(teamID: string): Promise<TeamMessageInfo[]> {
    const rows = await runPromiseInstance(TeamRepo.use((r) => r.listMessagesByTeam(teamID)))
    return rows.map((row) => toInfo(row))
  }
}

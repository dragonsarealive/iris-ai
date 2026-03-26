import z from "zod"
import { Database, eq } from "../storage/db"
import { TeamMemberTable } from "../session/session.sql"
import { TeamModule } from "./index"
import { TaskList } from "./task"
import { TeamMessage } from "./message"
import { Team, TeamMemberInfo } from "./event"
import { GlobalBus } from "@/bus/global"
import { SessionID } from "../session/schema"
import { Orchestration } from "./orchestration"

const pendingApprovals = new Map<string, { resolve: () => void; reject: (err: Error) => void }>()

export namespace PlanApproval {
  export const SubmitInput = z.object({
    teamID: z.string(),
    sessionID: SessionID.zod,
    planText: z.string(),
  })
  export type SubmitInput = z.infer<typeof SubmitInput>

  export async function submit(input: SubmitInput): Promise<void> {
    await TeamModule.updateMemberStatus(input.teamID, input.sessionID, "waiting_approval")

    GlobalBus.emit("event", {
      payload: {
        type: Team.PlanSubmitted.type,
        properties: {
          teamID: input.teamID,
          sessionID: input.sessionID,
          planText: input.planText,
        },
      },
    })

    Orchestration.emit({
      teamID: input.teamID,
      actorSessionID: input.sessionID,
      action: "plan_submitted",
      detail: input.planText.slice(0, 200),
    })

    const key = `${input.teamID}:${input.sessionID}`

    await new Promise<void>((resolve, reject) => {
      pendingApprovals.set(key, { resolve, reject })
    })
  }

  export async function approve(teamID: string, sessionID: string): Promise<void> {
    await TeamModule.updateMemberStatus(teamID, sessionID, "busy")

    GlobalBus.emit("event", {
      payload: {
        type: Team.PlanApproved.type,
        properties: { teamID, sessionID },
      },
    })

    const team = await TeamModule.get(teamID)
    if (team) {
      Orchestration.emit({
        teamID,
        actorSessionID: team.leadSessionID,
        targetSessionID: sessionID,
        action: "plan_approved",
      })
    }

    const key = `${teamID}:${sessionID}`
    const pending = pendingApprovals.get(key)
    if (pending) {
      pending.resolve()
      pendingApprovals.delete(key)
    }
  }

  export async function reject(teamID: string, sessionID: string, feedback: string): Promise<void> {
    await TeamModule.updateMemberStatus(teamID, sessionID, "planning")

    GlobalBus.emit("event", {
      payload: {
        type: Team.PlanRejected.type,
        properties: { teamID, sessionID, feedback },
      },
    })

    const team = await TeamModule.get(teamID)
    if (team) {
      Orchestration.emit({
        teamID,
        actorSessionID: team.leadSessionID,
        targetSessionID: sessionID,
        action: "plan_rejected",
        detail: feedback,
      })
      await TeamMessage.send({
        teamID,
        fromSessionID: team.leadSessionID as SessionID,
        toSessionID: sessionID as SessionID,
        body: `Plan rejected: ${feedback}`,
      })
    }

    const key = `${teamID}:${sessionID}`
    const pending = pendingApprovals.get(key)
    if (pending) {
      pending.reject(new Error(`Plan rejected: ${feedback}`))
      pendingApprovals.delete(key)
    }
  }
}

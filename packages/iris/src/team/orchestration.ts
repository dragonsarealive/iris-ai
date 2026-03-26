import { ulid } from "ulid"
import { Database, eq } from "../storage/db"
import { TeamOrchestrationStepTable } from "../session/session.sql"
import { Team } from "./event"
import { GlobalBus } from "@/bus/global"
import type { SessionID } from "../session/schema"

export type OrchestrationAction =
  | "teammate_spawned"
  | "prompt_dispatched"
  | "correction_sent"
  | "plan_submitted"
  | "plan_approved"
  | "plan_rejected"
  | "task_claimed"
  | "task_completed"
  | "task_blocked"
  | "checklist_updated"
  | "team_disbanded"

export namespace Orchestration {
  export function emit(input: {
    teamID: string
    actorSessionID: string
    targetSessionID?: string
    action: OrchestrationAction
    detail?: string
  }) {
    const now = Date.now()
    const id = ulid()

    Database.use((db) => {
      db.insert(TeamOrchestrationStepTable)
        .values({
          id,
          team_id: input.teamID,
          time: now,
          actor_session_id: input.actorSessionID as SessionID,
          target_session_id: input.targetSessionID as SessionID | undefined,
          action: input.action,
          detail: input.detail,
          time_created: now,
          time_updated: now,
        })
        .run()
    })

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
  }

  export function list(teamID: string) {
    return Database.use((db) => {
      return db
        .select()
        .from(TeamOrchestrationStepTable)
        .where(eq(TeamOrchestrationStepTable.team_id, teamID))
        .all()
        .map((row) => ({
          id: row.id,
          teamID: row.team_id,
          time: row.time,
          actorSessionID: row.actor_session_id,
          targetSessionID: row.target_session_id ?? undefined,
          action: row.action as OrchestrationAction,
          detail: row.detail ?? undefined,
        }))
    })
  }
}

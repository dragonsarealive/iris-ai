import { ulid } from "ulid"
import { Team } from "./event"
import { GlobalBus } from "@/bus/global"
import { TeamRepo } from "./repo"
import { runPromiseInstance } from "@/effect/runtime"

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
  export async function emit(input: {
    teamID: string
    actorSessionID: string
    targetSessionID?: string
    action: OrchestrationAction
    detail?: string
  }) {
    const now = Date.now()
    const id = ulid()

    await runPromiseInstance(
      TeamRepo.use((r) =>
        r.emitOrchestrationStep({
          id,
          teamID: input.teamID,
          time: now,
          actorSessionID: input.actorSessionID,
          targetSessionID: input.targetSessionID,
          action: input.action,
          detail: input.detail,
        }),
      ),
    )

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

  export async function list(teamID: string) {
    const rows = await runPromiseInstance(TeamRepo.use((r) => r.listOrchestrationSteps(teamID)))
    return rows.map((row) => ({
      id: row.id,
      teamID: row.team_id,
      time: row.time,
      actorSessionID: row.actor_session_id,
      targetSessionID: row.target_session_id ?? undefined,
      action: row.action as OrchestrationAction,
      detail: row.detail ?? undefined,
    }))
  }
}

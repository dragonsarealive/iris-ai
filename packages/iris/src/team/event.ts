import { BusEvent } from "@/bus/bus-event"
import z from "zod"

export const TeamInfo = z
  .object({
    id: z.string(),
    projectID: z.string(),
    leadSessionID: z.string(),
    title: z.string(),
    status: z.enum(["active", "disbanded"]),
    requirePlanApproval: z.boolean(),
    timeCreated: z.number(),
    timeUpdated: z.number(),
  })
  .meta({ ref: "Team" })
export type TeamInfo = z.output<typeof TeamInfo>

export const TeamMemberInfo = z
  .object({
    id: z.string(),
    teamID: z.string(),
    sessionID: z.string(),
    worktreeDirectory: z.string().optional(),
    role: z.enum(["lead", "teammate"]),
    status: z.enum(["idle", "busy", "planning", "waiting_approval", "done"]),
    timeCreated: z.number(),
  })
  .meta({ ref: "TeamMember" })
export type TeamMemberInfo = z.output<typeof TeamMemberInfo>

export const TaskItemInfo = z
  .object({
    id: z.string(),
    teamID: z.string(),
    assignedToSessionID: z.string().optional(),
    title: z.string(),
    description: z.string().optional(),
    status: z.enum(["pending", "in_progress", "done", "blocked"]),
    dependsOnIDs: z.array(z.string()).optional(),
    timeCreated: z.number(),
    timeUpdated: z.number(),
  })
  .meta({ ref: "TaskItem" })
export type TaskItemInfo = z.output<typeof TaskItemInfo>

export const TeamMessageInfo = z
  .object({
    id: z.string(),
    teamID: z.string(),
    fromSessionID: z.string(),
    toSessionID: z.string().optional(),
    body: z.string(),
    delivered: z.boolean(),
    timeCreated: z.number(),
  })
  .meta({ ref: "TeamMessage" })
export type TeamMessageInfo = z.output<typeof TeamMessageInfo>

export const Team = {
  Created: BusEvent.define(
    "team.created",
    z.object({
      team: TeamInfo,
    }),
  ),
  Updated: BusEvent.define(
    "team.updated",
    z.object({
      team: TeamInfo,
    }),
  ),
  Disbanded: BusEvent.define(
    "team.disbanded",
    z.object({
      teamID: z.string(),
    }),
  ),
  MemberStatus: BusEvent.define(
    "team.member.status",
    z.object({
      teamID: z.string(),
      sessionID: z.string(),
      status: TeamMemberInfo.shape.status,
    }),
  ),
  TaskUpdated: BusEvent.define(
    "team.task.updated",
    z.object({
      teamID: z.string(),
      task: TaskItemInfo,
    }),
  ),
  MessageSent: BusEvent.define(
    "team.message.sent",
    z.object({
      teamID: z.string(),
      msg: TeamMessageInfo,
    }),
  ),
  PlanSubmitted: BusEvent.define(
    "team.plan.submitted",
    z.object({
      teamID: z.string(),
      sessionID: z.string(),
      planText: z.string(),
    }),
  ),
  PlanApproved: BusEvent.define(
    "team.plan.approved",
    z.object({
      teamID: z.string(),
      sessionID: z.string(),
    }),
  ),
  PlanRejected: BusEvent.define(
    "team.plan.rejected",
    z.object({
      teamID: z.string(),
      sessionID: z.string(),
      feedback: z.string(),
    }),
  ),
  OrchestrationStep: BusEvent.define(
    "team.orchestration.step",
    z.object({
      teamID: z.string(),
      time: z.number(),
      actorSessionID: z.string(),
      targetSessionID: z.string().optional(),
      action: z.enum([
        "teammate_spawned",
        "prompt_dispatched",
        "correction_sent",
        "plan_submitted",
        "plan_approved",
        "plan_rejected",
        "task_claimed",
        "task_completed",
        "task_blocked",
        "checklist_updated",
        "team_disbanded",
      ]),
      detail: z.string().optional(),
    }),
  ),
}

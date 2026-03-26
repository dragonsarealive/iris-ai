import z from "zod"
import { Tool } from "./tool"
import { Session } from "../session"
import { Flag } from "@/flag/flag"
import type { SessionID } from "@/session/schema"
import { Orchestration } from "@/team/orchestration"

async function ensureTeamLead(sessionID: SessionID) {
  if (!(await Flag.agentTeams())) throw new Error("Agent teams are not enabled")
  const { TeamModule } = await import("@/team")
  let session = await Session.get(sessionID)
  if (!session.teamID) {
    const title = Session.isDefaultTitle(session.title) ? "Team" : session.title.slice(0, 120)
    await TeamModule.create({
      title,
      leadSessionID: sessionID,
      requirePlanApproval: false,
    })
    session = await Session.get(sessionID)
  }
  const team = await TeamModule.get(session.teamID!)
  if (!team) throw new Error("Team not found")
  const members = await TeamModule.members(session.teamID!)
  const self = members.find((m) => m.sessionID === sessionID)
  if (self?.role !== "lead") throw new Error("Only the team lead can use team tools")
  return { team, members, sessionID }
}

export const TeamSpawnTool = Tool.define("team_spawn_teammate", {
  description:
    "Team lead only: spawn a new teammate session in an isolated git worktree. If this chat is not in a team yet, a team is created automatically with you as lead. Returns the new teammate's session ID.",
  parameters: z.object({
    agent_name: z.string().describe("Short identifier for this teammate (used as worktree name)"),
    initial_prompt: z.string().optional().describe("Optional initial task prompt to send after spawning"),
  }),
  async execute(params, ctx) {
    const { team } = await ensureTeamLead(ctx.sessionID as SessionID)
    const { TeamModule } = await import("@/team")
    const member = await TeamModule.addMember({
      teamID: team.id,
      agentName: params.agent_name,
      prompt: params.initial_prompt,
    })

    if (params.initial_prompt) {
      const { TeamMessage } = await import("@/team/message")
      await TeamMessage.send({
        teamID: team.id,
        fromSessionID: ctx.sessionID as SessionID,
        toSessionID: member.sessionID as SessionID,
        body: params.initial_prompt,
      })
    }

    Orchestration.emit({
      teamID: team.id,
      actorSessionID: ctx.sessionID,
      targetSessionID: member.sessionID,
      action: "teammate_spawned",
      detail: params.agent_name,
    })

    return {
      title: `Spawned teammate: ${params.agent_name}`,
      output: `Teammate spawned. Session ID: ${member.sessionID}`,
      metadata: { sessionID: member.sessionID, teamID: team.id },
    }
  },
})

export const TeamPromptTool = Tool.define("team_prompt_teammate", {
  description:
    "Team lead only: send a prompt or instruction to a specific teammate session. Creates a team for this chat first if needed. The teammate receives it in their next loop iteration.",
  parameters: z.object({
    session_id: z.string().describe("The teammate's session ID"),
    message: z.string().describe("The instruction or prompt to send"),
  }),
  async execute(params, ctx) {
    const { team } = await ensureTeamLead(ctx.sessionID as SessionID)
    const { TeamMessage } = await import("@/team/message")

    await TeamMessage.send({
      teamID: team.id,
      fromSessionID: ctx.sessionID as SessionID,
      toSessionID: params.session_id as SessionID,
      body: params.message,
    })

    Orchestration.emit({
      teamID: team.id,
      actorSessionID: ctx.sessionID,
      targetSessionID: params.session_id,
      action: "prompt_dispatched",
      detail: params.message.slice(0, 200),
    })

    return {
      title: `Prompted teammate ${params.session_id.slice(-6)}`,
      output: `Message delivered to teammate ${params.session_id}`,
      metadata: {},
    }
  },
})

export const TeamCorrectTool = Tool.define("team_correct_teammate", {
  description:
    "Team lead only: send a correction to a teammate. Creates a team for this chat first if needed. If they await plan approval, this rejects their plan with the correction as feedback.",
  parameters: z.object({
    session_id: z.string().describe("The teammate's session ID"),
    correction: z.string().describe("The correction or feedback to send"),
  }),
  async execute(params, ctx) {
    const { team, members } = await ensureTeamLead(ctx.sessionID as SessionID)
    const member = members.find((m) => m.sessionID === params.session_id)

    if (member?.status === "waiting_approval") {
      const { PlanApproval } = await import("@/team/plan")
      await PlanApproval.reject(team.id, params.session_id, params.correction)
    } else {
      const { TeamMessage } = await import("@/team/message")
      await TeamMessage.send({
        teamID: team.id,
        fromSessionID: ctx.sessionID as SessionID,
        toSessionID: params.session_id as SessionID,
        body: `[Correction] ${params.correction}`,
      })
    }

    Orchestration.emit({
      teamID: team.id,
      actorSessionID: ctx.sessionID,
      targetSessionID: params.session_id,
      action: "correction_sent",
      detail: params.correction.slice(0, 200),
    })

    return {
      title: `Corrected teammate ${params.session_id.slice(-6)}`,
      output: `Correction sent to teammate ${params.session_id}`,
      metadata: {},
    }
  },
})

export const TeamMarkProgressTool = Tool.define("team_mark_task_progress", {
  description:
    "Team lead only: mark a team task done (status='done') or blocked (status='blocked'). Creates a team for this chat first if needed. Teammates cannot call this tool.",
  parameters: z.object({
    task_id: z.string().describe("The task ID to update"),
    status: z.enum(["done", "blocked"]).describe("The new status for the task"),
    reason: z.string().optional().describe("Optional reason or note for the status change"),
  }),
  async execute(params, ctx) {
    const { team } = await ensureTeamLead(ctx.sessionID as SessionID)
    const { TaskList } = await import("@/team/task")

    const updated =
      params.status === "done"
        ? await TaskList.complete(params.task_id)
        : await TaskList.block(params.task_id)

    const detailSuffix = params.reason ? " — " + params.reason : ""

    if (params.status === "done" && updated) {
      Orchestration.emit({
        teamID: team.id,
        actorSessionID: ctx.sessionID,
        action: "task_completed",
        detail: `${updated.title}${detailSuffix}`,
      })
    }

    if (params.status === "blocked" && updated) {
      Orchestration.emit({
        teamID: team.id,
        actorSessionID: ctx.sessionID,
        action: "task_blocked",
        detail: `${updated.title}${detailSuffix}`,
      })
    }

    return {
      title: updated ? `Task marked ${params.status}` : "Task update skipped",
      output: updated
        ? `Task "${updated.title}" marked as ${params.status}`
        : `Task ${params.task_id} could not be updated (missing, already done, or invalid state).`,
      metadata: {},
    }
  },
})

import z from "zod"
import { ulid } from "ulid"
import { Team, TeamInfo, TeamMemberInfo } from "./event"
import { GlobalBus } from "@/bus/global"
import { Worktree } from "@/worktree"
import { Session } from "@/session"
import { SessionID } from "@/session/schema"
import { ProjectID } from "../project/schema"
import { Orchestration } from "./orchestration"
import { TeamRepo } from "./repo"
import { runPromiseInstance } from "@/effect/runtime"
import { Effect } from "effect"

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

    await runPromiseInstance(
      TeamRepo.use((r) =>
        r.create(team).pipe(
          Effect.flatMap(() =>
            r.addMember({
              id: ulid(),
              teamID: id,
              sessionID: input.leadSessionID,
              worktreeDirectory: undefined,
              role: "lead",
              status: "idle",
              timeCreated: now,
            }),
          ),
        ),
      ),
    )

    await runPromiseInstance(TeamRepo.use((r) => r.setSessionTeamID(input.leadSessionID, id)))

    GlobalBus.emit("event", {
      payload: {
        type: Team.Created.type,
        properties: { team },
      },
    })

    return team
  }

  export async function addMember(input: AddMemberInput): Promise<TeamMemberInfo> {
    const team = await runPromiseInstance(TeamRepo.use((r) => r.get(input.teamID)))
    if (!team) throw new Error(`Team not found: ${input.teamID}`)

    const members = await runPromiseInstance(TeamRepo.use((r) => r.getMembers(input.teamID)))
    const leadMemberRow = members.find((m) => m.role === "lead")
    if (!leadMemberRow) throw new Error(`Lead member not found for team: ${input.teamID}`)

    const worktree = await Worktree.create({ name: input.agentName })

    const teammateSession = await Session.createNext({
      parentID: team.leadSessionID as SessionID,
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

    await runPromiseInstance(TeamRepo.use((r) => r.addMember(member)))
    await runPromiseInstance(TeamRepo.use((r) => r.setSessionTeamID(teammateSession.id as SessionID, input.teamID)))

    GlobalBus.emit("event", {
      payload: {
        type: Team.Updated.type,
        properties: {
          team: (await get(input.teamID)) as TeamInfo,
        },
      },
    })

    await Orchestration.emit({
      teamID: input.teamID,
      actorSessionID: team.leadSessionID,
      targetSessionID: teammateSession.id,
      action: "teammate_spawned",
      detail: input.agentName,
    })

    return member
  }

  export async function disband(teamID: string): Promise<void> {
    const members = await runPromiseInstance(TeamRepo.use((r) => r.getMembers(teamID)))

    const { SessionPrompt } = await import("@/session/prompt")

    for (const member of members) {
      if (member.role !== "lead") {
        SessionPrompt.cancel(member.sessionID as SessionID)

        if (member.worktreeDirectory) {
          await Worktree.remove({ directory: member.worktreeDirectory }).catch(() => undefined)
        }
      }
    }

    await runPromiseInstance(TeamRepo.use((r) => r.disband(teamID)))

    const leadMember = members.find((m) => m.role === "lead")
    GlobalBus.emit("event", {
      payload: {
        type: Team.Disbanded.type,
        properties: { teamID },
      },
    })

    if (leadMember) {
      await Orchestration.emit({
        teamID,
        actorSessionID: leadMember.sessionID,
        action: "team_disbanded",
      })
    }
  }

  export async function get(teamID: string): Promise<TeamInfo | null> {
    return runPromiseInstance(TeamRepo.use((r) => r.get(teamID)))
  }

  export async function list(projectID: string): Promise<TeamInfo[]> {
    return runPromiseInstance(TeamRepo.use((r) => r.list(projectID as ProjectID)))
  }

  export async function members(teamID: string): Promise<TeamMemberInfo[]> {
    return runPromiseInstance(TeamRepo.use((r) => r.getMembers(teamID)))
  }

  export async function updateMemberStatus(
    teamID: string,
    sessionID: string,
    status: TeamMemberInfo["status"],
  ): Promise<void> {
    await runPromiseInstance(TeamRepo.use((r) => r.updateMemberStatus(teamID, sessionID as SessionID, status)))

    GlobalBus.emit("event", {
      payload: {
        type: Team.MemberStatus.type,
        properties: { teamID, sessionID, status },
      },
    })
  }
}

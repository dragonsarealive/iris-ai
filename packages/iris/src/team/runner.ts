import z from "zod"
import { TeamModule } from "./index"
import { TaskList } from "./task"
import { Team, TeamMemberInfo } from "./event"
import { GlobalBus } from "@/bus/global"
import { SessionID } from "../session/schema"
import { SessionPrompt } from "../session/prompt"

export namespace TeamRunner {
  export const StartAllInput = z.object({
    teamID: z.string(),
    tasks: z.array(
      z.object({
        taskID: z.string(),
        sessionID: SessionID.zod,
      }),
    ),
    timeout: z.number().optional(),
  })
  export type StartAllInput = z.infer<typeof StartAllInput>

  export async function startAll(input: StartAllInput): Promise<void> {
    const members = await TeamModule.members(input.teamID)
    const teammates = members.filter((m) => m.role === "teammate")
    const tasksBySession = new Map<string, string>(input.tasks.map((t) => [t.sessionID, t.taskID]))

    for (const member of teammates) {
      const taskID = tasksBySession.get(member.sessionID)
      if (!taskID) continue
      const claimed = await TaskList.claim(input.teamID, member.sessionID as SessionID, taskID)
      if (!claimed) continue
      await TeamModule.updateMemberStatus(input.teamID, member.sessionID, "busy")
      SessionPrompt.prompt({
        sessionID: member.sessionID as SessionID,
        parts: [{ type: "text", text: "You have been assigned a new task. Please begin working on it." }],
      }).catch((err) => {
        console.error(`Teammate ${member.sessionID} failed:`, err)
        TeamModule.updateMemberStatus(input.teamID, member.sessionID, "idle")
      })
    }

    await waitForCompletion(input.teamID, input.timeout)
  }

  export async function waitForCompletion(teamID: string, timeout?: number): Promise<void> {
    const members = await TeamModule.members(teamID)
    const teammates = members.filter((m) => m.role === "teammate")
    const statusBySession = new Map<string, string>(teammates.map((m) => [m.sessionID, m.status]))

    const checkComplete = (): boolean =>
      teammates.length > 0 &&
      teammates.every((m) => (statusBySession.get(m.sessionID) ?? m.status) === "done")

    if (checkComplete()) return

    const timeoutMs = timeout ?? 3600000

    await new Promise<void>((resolve) => {
      let resolved = false

      const handler = (event: {
        payload?: { type?: string; properties?: { teamID?: string; sessionID?: string; status?: string } }
      }) => {
        const payload = event.payload
        if (payload?.type !== Team.MemberStatus.type) return
        const { teamID: eventTeamID, sessionID, status } = payload.properties ?? {}
        if (eventTeamID !== teamID || !sessionID || !status) return
        statusBySession.set(sessionID, status)
        if (checkComplete() && !resolved) {
          resolved = true
          GlobalBus.off("event", handler)
          resolve()
        }
      }

      GlobalBus.on("event", handler)

      setTimeout(() => {
        if (!resolved) {
          resolved = true
          GlobalBus.off("event", handler)
          resolve()
        }
      }, timeoutMs)
    })
  }
}

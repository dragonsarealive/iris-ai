import { describe, expect, test } from "bun:test"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { TeamModule } from "../../src/team"
import { TaskList } from "../../src/team/task"
import { TeamMessage } from "../../src/team/message"
import { ToolRegistry } from "../../src/tool/registry"
import {
  TeamSpawnTool,
  TeamPromptTool,
  TeamCorrectTool,
  TeamMarkProgressTool,
} from "../../src/tool/team"
import { tmpdir } from "../fixture/fixture"
import { MessageID, type SessionID } from "../../src/session/schema"
import type { Tool } from "../../src/tool/tool"

function ctx(sid: SessionID): Tool.Context {
  return {
    sessionID: sid,
    messageID: MessageID.ascending(),
    callID: "",
    agent: "build",
    abort: AbortSignal.any([]),
    messages: [],
    metadata: () => {},
    ask: async () => {},
  }
}

describe("team tools (agent-call path)", () => {
  test("registry exposes team tools when project config enables teams", async () => {
    await using tmp = await tmpdir({
      git: true,
      config: { team: { enabled: true, max_teammates: 4, teammate_mode: "in-process" } },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const ids = await ToolRegistry.ids()
        expect(ids).toContain("team_spawn_teammate")
        expect(ids).toContain("team_prompt_teammate")
        expect(ids).toContain("team_correct_teammate")
        expect(ids).toContain("team_mark_task_progress")
      },
    })
  })

  test("team_spawn auto-creates team when session has no team yet", async () => {
    await using tmp = await tmpdir({
      git: true,
      config: { team: { enabled: true, max_teammates: 4, teammate_mode: "in-process" } },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const lead = await Session.create({})
        expect(lead.teamID).toBeUndefined()

        const spawn = await TeamSpawnTool.init()
        const out = await spawn.execute({ agent_name: "solo" }, ctx(lead.id))
        expect(out.metadata.sessionID).toBeDefined()

        const again = await Session.get(lead.id)
        expect(again.teamID).toBeDefined()
        const { TeamModule } = await import("../../src/team")
        const info = await TeamModule.get(again.teamID!)
        expect(info?.leadSessionID).toBe(lead.id)
      },
    })
  })

  test("lead spawn + prompt deliver messages; mark_task_progress done and blocked", async () => {
    await using tmp = await tmpdir({
      git: true,
      config: { team: { enabled: true, max_teammates: 4, teammate_mode: "in-process" } },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const lead = await Session.create({})
        const team = await TeamModule.create({
          title: "tools",
          leadSessionID: lead.id,
          requirePlanApproval: false,
        })
        const toolCtx = ctx(lead.id)

        const spawn = await TeamSpawnTool.init()
        const spawned = await spawn.execute({ agent_name: "worker", initial_prompt: "do step one" }, toolCtx)
        const mateID = spawned.metadata.sessionID as SessionID
        expect(mateID).toBeDefined()

        const inbox = await TeamMessage.getPendingForSession(mateID)
        expect(inbox.some((m) => m.body.includes("do step one"))).toBe(true)

        const promptTool = await TeamPromptTool.init()
        const sent = await promptTool.execute({ session_id: mateID, message: "phase 2" }, toolCtx)
        expect(sent.output).toContain("delivered")

        const tasks = await TaskList.create({
          teamID: team.id,
          tasks: [{ title: "finish a" }, { title: "finish b" }],
        })
        const mark = await TeamMarkProgressTool.init()
        const done = await mark.execute({ task_id: tasks[0]!.id, status: "done" }, toolCtx)
        expect(done.output).toContain("done")

        const blocked = await mark.execute(
          { task_id: tasks[1]!.id, status: "blocked", reason: "deps" },
          toolCtx,
        )
        expect(blocked.output).toContain("blocked")

        const listed = await TaskList.list(team.id)
        expect(listed.find((t) => t.id === tasks[0]!.id)?.status).toBe("done")
        expect(listed.find((t) => t.id === tasks[1]!.id)?.status).toBe("blocked")
      },
    })
  })

  test("teammate session cannot call lead-only tools", async () => {
    await using tmp = await tmpdir({
      git: true,
      config: { team: { enabled: true, max_teammates: 4, teammate_mode: "in-process" } },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const lead = await Session.create({})
        const team = await TeamModule.create({
          title: "roles",
          leadSessionID: lead.id,
          requirePlanApproval: false,
        })
        const spawn = await TeamSpawnTool.init()
        const spawned = await spawn.execute({ agent_name: "bob" }, ctx(lead.id))
        const mateID = spawned.metadata.sessionID as SessionID

        const tasks = await TaskList.create({
          teamID: team.id,
          tasks: [{ title: "solo" }],
        })
        const mark = await TeamMarkProgressTool.init()
        await expect(mark.execute({ task_id: tasks[0]!.id, status: "done" }, ctx(mateID))).rejects.toThrow(
          /lead/i,
        )

        const correction = await TeamCorrectTool.init()
        await expect(
          correction.execute({ session_id: lead.id, correction: "no" }, ctx(mateID)),
        ).rejects.toThrow(/lead/i)
      },
    })
  })

  test("lead correct_teammate sends message when teammate not awaiting approval", async () => {
    await using tmp = await tmpdir({
      git: true,
      config: { team: { enabled: true, max_teammates: 4, teammate_mode: "in-process" } },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const lead = await Session.create({})
        await TeamModule.create({
          title: "corr",
          leadSessionID: lead.id,
          requirePlanApproval: false,
        })
        const spawn = await TeamSpawnTool.init()
        const spawned = await spawn.execute({ agent_name: "fixer" }, ctx(lead.id))
        const mateID = spawned.metadata.sessionID as SessionID

        const correct = await TeamCorrectTool.init()
        await correct.execute({ session_id: mateID, correction: "use smaller commits" }, ctx(lead.id))

        const inbox = await TeamMessage.getPendingForSession(mateID)
        expect(inbox.some((m) => m.body.includes("[Correction]") && m.body.includes("smaller commits"))).toBe(
          true,
        )
      },
    })
  })
})

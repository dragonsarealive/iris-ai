import { describe, expect, test } from "bun:test"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { TeamModule } from "../../src/team"
import { TeamMessage } from "../../src/team/message"
import { TaskList } from "../../src/team/task"
import { Log } from "../../src/util/log"
import { tmpdir } from "../fixture/fixture"

Log.init({ print: false })

describe("team module", () => {
  test("creates a team, updates member status, and disbands", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const lead = await Session.create({})
        const team = await TeamModule.create({
          title: "alpha",
          leadSessionID: lead.id,
          requirePlanApproval: true,
        })

        expect(team.title).toBe("alpha")
        expect(team.requirePlanApproval).toBe(true)

        const before = await TeamModule.members(team.id)
        expect(before.length).toBe(1)
        expect(before[0]?.role).toBe("lead")

        await TeamModule.updateMemberStatus(team.id, lead.id, "busy")
        const after = await TeamModule.members(team.id)
        const hit = after.find((x) => x.sessionID === lead.id)
        expect(hit?.status).toBe("busy")

        await TeamModule.disband(team.id)
        const info = await TeamModule.get(team.id)
        expect(info?.status).toBe("disbanded")
      },
    })
  })
})

describe("team messaging", () => {
  test("returns pending direct and broadcast messages per session", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const lead = await Session.create({})
        const team = await TeamModule.create({
          title: "chat",
          leadSessionID: lead.id,
          requirePlanApproval: false,
        })
        const one = await TeamMessage.send({
          teamID: team.id,
          fromSessionID: lead.id,
          body: "broadcast",
        })
        await new Promise((r) => setTimeout(r, 2))
        const two = await TeamMessage.send({
          teamID: team.id,
          fromSessionID: lead.id,
          toSessionID: lead.id,
          body: "direct",
        })

        const pending = await TeamMessage.getPendingForSession(lead.id)
        expect(pending.map((x) => x.id)).toEqual([one.id, two.id])

        await TeamMessage.markDelivered(one.id)
        const left = await TeamMessage.getPendingForSession(lead.id)
        expect(left.map((x) => x.id)).toEqual([two.id])
      },
    })
  })
})

describe("team tasks", () => {
  test("enforces dependency completion before claiming blocked task", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const lead = await Session.create({})
        const team = await TeamModule.create({
          title: "tasks",
          leadSessionID: lead.id,
          requirePlanApproval: false,
        })

        const base = await TaskList.create({
          teamID: team.id,
          tasks: [{ title: "base" }],
        })
        const dep = await TaskList.create({
          teamID: team.id,
          tasks: [{ title: "dep", dependsOn: [base[0]!.id] }],
        })

        const miss = await TaskList.claim(team.id, lead.id, dep[0]!.id)
        expect(miss).toBeNull()

        const got = await TaskList.claim(team.id, lead.id, base[0]!.id)
        expect(got?.status).toBe("in_progress")

        await TaskList.complete(base[0]!.id)
        const next = await TaskList.claim(team.id, lead.id, dep[0]!.id)
        expect(next?.status).toBe("in_progress")
      },
    })
  })

  test("block marks task blocked and complete returns null for block on done", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const lead = await Session.create({})
        const team = await TeamModule.create({
          title: "blk",
          leadSessionID: lead.id,
          requirePlanApproval: false,
        })

        const tasks = await TaskList.create({
          teamID: team.id,
          tasks: [{ title: "t1" }],
        })
        const id = tasks[0]!.id

        const b = await TaskList.block(id)
        expect(b?.status).toBe("blocked")

        const list = await TaskList.list(team.id)
        expect(list.find((x) => x.id === id)?.status).toBe("blocked")

        await TaskList.complete(id)
        const again = await TaskList.block(id)
        expect(again).toBeNull()
      },
    })
  })
})

import { describe, expect, test } from "bun:test"
import path from "path"
import { Session } from "../../src/session"
import { MessageV2 } from "../../src/session/message-v2"
import { repairInterruptedTools } from "../../src/session/repair-tools"
import { Instance } from "../../src/project/instance"
import { Log } from "../../src/util/log"
import { MessageID, PartID } from "../../src/session/schema"
import { ModelID, ProviderID } from "../../src/provider/schema"

const projectRoot = path.join(__dirname, "../..")
Log.init({ print: false })

describe("session.repair-tools", () => {
  test("pending assistant tool parts are persisted as error so integrity passes", async () => {
    await Instance.provide({
      directory: projectRoot,
      fn: async () => {
        const session = await Session.create({})
        const sessionID = session.id

        const userMsg = await Session.updateMessage({
          id: MessageID.ascending(),
          role: "user",
          sessionID,
          agent: "default",
          model: {
            providerID: ProviderID.make("openai"),
            modelID: ModelID.make("gpt-4"),
          },
          time: { created: Date.now() },
        })
        await Session.updatePart({
          id: PartID.ascending(),
          messageID: userMsg.id,
          sessionID,
          type: "text",
          text: "run tool",
        })

        const assistantMsg: MessageV2.Assistant = {
          id: MessageID.ascending(),
          role: "assistant",
          sessionID,
          mode: "default",
          agent: "default",
          path: { cwd: projectRoot, root: projectRoot },
          cost: 0,
          tokens: { output: 0, input: 0, reasoning: 0, cache: { read: 0, write: 0 } },
          modelID: ModelID.make("gpt-4"),
          providerID: ProviderID.make("openai"),
          parentID: userMsg.id,
          time: { created: Date.now() },
          finish: "end_turn",
        }
        await Session.updateMessage(assistantMsg)

        const callID = "call_repair_test_1"
        await Session.updatePart({
          id: PartID.ascending(),
          messageID: assistantMsg.id,
          sessionID,
          type: "tool",
          callID,
          tool: "bash",
          state: { status: "pending", input: {}, raw: "{}" },
        })

        const msgs = await Session.messages({ sessionID })
        expect(() => MessageV2.validateToolIntegrity(msgs)).toThrow(/orphaned tool_use/)

        await repairInterruptedTools(msgs, sessionID)
        MessageV2.validateToolIntegrity(msgs)

        const a = msgs.find((m) => m.info.id === assistantMsg.id)
        const tool = a?.parts.find((p) => p.type === "tool" && p.callID === callID) as
          | MessageV2.ToolPart
          | undefined
        expect(tool?.state.status).toBe("error")
        if (tool?.state.status === "error") expect(tool.state.error).toContain("interrupted")

        await Session.remove(sessionID)
      },
    })
  }, 30_000)
})

/**
 * Validates March 2026 tool integrity fix (3.2): validateToolIntegrity + repairInterruptedTools.
 */
import { MessageV2 } from "../../src/session/message-v2"
import { repairInterruptedTools } from "../../src/session/repair-tools"

export async function validateToolIntegrity(): Promise<{ name: string; ok: boolean; detail?: string }[]> {
  const out: { name: string; ok: boolean; detail?: string }[] = []

  out.push({
    name: "MessageV2.validateToolIntegrity exists",
    ok: typeof MessageV2.validateToolIntegrity === "function",
  })
  out.push({
    name: "repairInterruptedTools exists",
    ok: typeof repairInterruptedTools === "function",
  })

  // validateToolIntegrity throws on orphaned tool_use
  const validMsgs: MessageV2.WithParts[] = [
    {
      info: {
        id: "m1" as any,
        role: "assistant",
        sessionID: "s1" as any,
        parentID: "m0" as any,
        modelID: "gpt-4" as any,
        providerID: "openai" as any,
        mode: "default",
        agent: "default",
        path: { cwd: "/", root: "/" },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        time: { created: 0 },
      },
      parts: [
        {
          id: "p1" as any,
          messageID: "m1" as any,
          sessionID: "s1" as any,
          type: "tool",
          callID: "c1",
          tool: "bash",
          state: { status: "completed", input: {}, output: "ok", title: "run", metadata: {}, time: { start: 0, end: 1 } },
        },
      ],
    },
  ]
  try {
    MessageV2.validateToolIntegrity(validMsgs)
    out.push({ name: "validateToolIntegrity passes on valid messages", ok: true })
  } catch (e) {
    out.push({ name: "validateToolIntegrity passes on valid messages", ok: false, detail: String(e) })
  }

  const orphanedMsgs: MessageV2.WithParts[] = [
    {
      info: {
        id: "m1" as any,
        role: "assistant",
        sessionID: "s1" as any,
        parentID: "m0" as any,
        modelID: "gpt-4" as any,
        providerID: "openai" as any,
        mode: "default",
        agent: "default",
        path: { cwd: "/", root: "/" },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        time: { created: 0 },
      },
      parts: [
        {
          id: "p1" as any,
          messageID: "m1" as any,
          sessionID: "s1" as any,
          type: "tool",
          callID: "c1",
          tool: "bash",
          state: { status: "pending", input: {}, raw: "{}" },
        },
      ],
    },
  ]
  try {
    MessageV2.validateToolIntegrity(orphanedMsgs)
    out.push({ name: "validateToolIntegrity throws on orphaned tool_use", ok: false, detail: "did not throw" })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    out.push({
      name: "validateToolIntegrity throws on orphaned tool_use",
      ok: msg.includes("orphaned tool_use"),
      detail: msg.slice(0, 80),
    })
  }

  return out
}

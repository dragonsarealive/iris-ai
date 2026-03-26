import { Log } from "@/util/log"
import { MessageV2 } from "./message-v2"
import { Session } from "."

const log = Log.create({ service: "session.repair-tools" })

const interruptedErr = "Tool call interrupted before a result was stored."

/** Persist pending/running assistant tool parts as error so tool_use / tool_result pairs validate. */
export async function repairInterruptedTools(msgs: MessageV2.WithParts[], sessionID: string) {
  let n = 0
  for (const msg of msgs) {
    if (msg.info.role !== "assistant") continue
    for (const part of msg.parts) {
      if (part.type !== "tool") continue
      if (part.state.status !== "pending" && part.state.status !== "running") continue
      n++
      const start = part.state.status === "running" ? part.state.time.start : Date.now()
      const state: MessageV2.ToolStateError = {
        status: "error",
        input: part.state.input,
        error: interruptedErr,
        metadata: part.state.status === "running" ? part.state.metadata : undefined,
        time: { start, end: Date.now() },
      }
      const next: MessageV2.ToolPart = { ...part, state }
      await Session.updatePart(next)
      part.state = state
    }
  }
  if (n > 0) log.info("repaired interrupted tool parts", { count: n, sessionID })
  return n
}

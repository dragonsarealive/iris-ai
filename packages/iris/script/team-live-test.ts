#!/usr/bin/env bun
/**
 * Live team-agent E2E: starts the real HTTP server (same stack as `iris web`),
 * creates session + team, sends one user message through SessionPrompt (real LLM + tools).
 *
 * Usage (from packages/iris):
 *   IRIS_TEAM_E2E_DIR=E:/opencode IRIS_TEAM_E2E_MODEL=openai/gpt-4o-mini bun script/team-live-test.ts
 *
 * Env:
 *   OPENCODE_EXPERIMENTAL_AGENT_TEAMS — defaults to 1 for this script
 *   IRIS_TEAM_E2E_DIR — project directory (defaults to cwd)
 *   IRIS_TEAM_E2E_PORT — listen port (default 4099)
 *   IRIS_TEAM_E2E_MODEL — optional providerID/modelID for this prompt only
 */

process.env.OPENCODE_EXPERIMENTAL_AGENT_TEAMS ??= "1"

const dir = process.env.IRIS_TEAM_E2E_DIR ?? process.cwd()
const port = Number(process.env.IRIS_TEAM_E2E_PORT ?? "4099")
const hostname = "127.0.0.1"

async function main() {
  const { Server } = await import("../src/server/server")
  const { disposeRuntime } = await import("../src/effect/runtime")

  const srv = Server.listen({ port, hostname, cors: [] })
  const enc = encodeURIComponent(dir)
  const base = `http://${hostname}:${srv.port}`
  const u = (p: string) => `${base}${p}?directory=${enc}`

  try {
    const sessionRes = await fetch(u("/session"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    })
    if (!sessionRes.ok) {
      console.error(await sessionRes.text())
      throw new Error(`session.create failed: ${sessionRes.status}`)
    }
    const session = (await sessionRes.json()) as { id: string; projectID: string }
    const sid = session.id

    const teamRes = await fetch(u("/team"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "live-team-e2e",
        leadSessionID: sid,
        requirePlanApproval: false,
      }),
    })
    if (!teamRes.ok) {
      console.error(await teamRes.text())
      throw new Error(`team.create failed: ${teamRes.status}`)
    }
    const team = (await teamRes.json()) as { id: string }

    const taskPost = await fetch(u(`/team/${team.id}/task`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tasks: [{ title: "Introduce yourself in one short sentence to the team." }],
      }),
    })
    if (!taskPost.ok) {
      console.error(await taskPost.text())
      throw new Error(`team.createTasks failed: ${taskPost.status}`)
    }
    const createdTasks = (await taskPost.json()) as { id: string }[]
    const taskID = createdTasks[0]?.id

    const prompt: Record<string, unknown> = {
      parts: [
        {
          type: "text",
          text:
            "You are the team lead. The team has one pending task. " +
            "Call team_spawn_teammate with agent_name live_e2e_worker and initial_prompt that assigns the task. " +
            "Then call team_prompt_teammate to the new session with session_id from the spawn result and a one-line follow-up. " +
            "Use team_mark_task_progress with status done and the real task_id after you are satisfied. " +
            "Stay brief in natural language after tools.",
        },
      ],
    }
    const modelSpec = process.env.IRIS_TEAM_E2E_MODEL
    if (modelSpec) {
      const idx = modelSpec.indexOf("/")
      if (idx === -1) throw new Error("IRIS_TEAM_E2E_MODEL must be providerID/modelID")
      prompt.model = {
        providerID: modelSpec.slice(0, idx),
        modelID: modelSpec.slice(idx + 1),
      }
    }

    console.log("Sending prompt (real LLM + tools)…")
    const msgRes = await fetch(u(`/session/${sid}/message`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(prompt),
    })
    const raw = await msgRes.text()
    if (!msgRes.ok) {
      console.error(raw)
      throw new Error(`session.prompt failed: ${msgRes.status}`)
    }

    let parsed: { parts?: { type: string; tool?: string; toolName?: string }[] }
    try {
      parsed = JSON.parse(raw) as typeof parsed
    } catch {
      console.log(raw.slice(0, 4000))
      throw new Error("assistant response was not JSON")
    }

    const partSummary =
      parsed.parts?.map((p) => (p.type === "tool" && "tool" in p ? (p as { tool: string }).tool : p.type)) ?? []
    console.log("Assistant parts (tools + types):", partSummary)

    const teamState = await fetch(u(`/team/${team.id}`))
    const detail = (await teamState.json()) as {
      members?: unknown[]
      tasks?: { id: string; status: string }[]
    }
    const memberN = detail.members?.length ?? 0
    const taskRow = detail.tasks?.find((t) => t.id === taskID)
    console.log("Team members after run:", memberN, "| task status:", taskRow?.status)

    if (memberN < 2) {
      throw new Error(
        "E2E failed: expected lead + spawned teammate (members >= 2). Same stack as `iris web` — check LLM actually called team_spawn_teammate.",
      )
    }

    console.log("OK — live team agents: model ran in SessionPrompt, team has", memberN, "members (spawn path worked).")
    if (taskRow?.status !== "done") {
      console.log(
        "Note: task still",
        taskRow?.status ?? "?",
        "— lead may need another turn to call team_mark_task_progress (model-dependent).",
      )
    } else {
      console.log("OK — task marked done via team_mark_task_progress.")
    }
  } finally {
    await srv.stop(true)
    await import("../src/project/instance").then((m) => m.Instance.disposeAll().catch(() => {}))
    await disposeRuntime().catch(() => {})
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

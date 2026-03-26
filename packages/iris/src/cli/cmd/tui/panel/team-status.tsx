import { createMemo, For, Show } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { useSync } from "@tui/context/sync"
import { useTeam } from "@tui/context/team"
import type { TeamMemberInfo } from "@/team/event"

const STATUS_ICON: Record<TeamMemberInfo["status"], string> = {
  idle: "○",
  busy: "●",
  planning: "◐",
  waiting_approval: "◑",
  done: "✓",
}

const STATUS_LABEL: Record<TeamMemberInfo["status"], string> = {
  idle: "idle",
  busy: "working",
  planning: "planning",
  waiting_approval: "awaiting approval",
  done: "done",
}

export function TeamStatus() {
  const { theme } = useTheme()
  const sync = useSync()
  const team = useTeam()

  const teamID = createMemo(() => team.activeTeamID)
  const info = createMemo(() => (teamID() ? sync.data.team[teamID()!] : undefined))
  const members = createMemo(() => team.members)
  const tasks = createMemo(() => (teamID() ? sync.data.task_item[teamID()!] ?? [] : []))

  function statusColor(status: TeamMemberInfo["status"]) {
    switch (status) {
      case "busy":
        return theme.success
      case "planning":
        return theme.warning
      case "waiting_approval":
        return theme.error
      case "done":
        return theme.textMuted
      default:
        return theme.textMuted
    }
  }

  return (
    <Show when={info()}>
      <box
        backgroundColor={theme.backgroundPanel}
        paddingLeft={1}
        paddingRight={1}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="column"
        flexShrink={0}
        gap={1}
      >
        <text fg={theme.text}>
          <span style={{ fg: theme.textMuted }}>Team: </span>
          {info()!.title}
        </text>
        <For each={members()}>
          {(member, i) => {
            const task = createMemo(() =>
              tasks().find((t) => t.assignedToSessionID === member.sessionID && t.status === "in_progress"),
            )
            const active = createMemo(() => i() === team.currentMemberIndex)
            return (
              <box flexDirection="column" gap={0}>
                <text fg={active() ? theme.text : theme.textMuted}>
                  <span style={{ fg: statusColor(member.status) }}>{STATUS_ICON[member.status]} </span>
                  <span style={{ fg: active() ? theme.text : theme.textMuted }}>
                    {member.role === "lead" ? "[lead] " : ""}
                  </span>
                  {member.sessionID.slice(-6)}
                </text>
                <text fg={theme.textMuted} paddingLeft={2}>
                  {STATUS_LABEL[member.status]}
                  <Show when={task()}>
                    {" · "}
                    {task()!.title.slice(0, 20)}
                  </Show>
                </text>
              </box>
            )
          }}
        </For>
      </box>
    </Show>
  )
}

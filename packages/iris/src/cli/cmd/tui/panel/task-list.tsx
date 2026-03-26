import { createMemo, For, Show } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { useSync } from "@tui/context/sync"
import { useTeam } from "@tui/context/team"
import type { TaskItemInfo } from "@/team/event"

const STATUS_BADGE: Record<TaskItemInfo["status"], string> = {
  pending: "🔲",
  in_progress: "🔄",
  done: "✅",
  blocked: "🔴",
}

export function TaskList() {
  const { theme } = useTheme()
  const sync = useSync()
  const team = useTeam()

  const teamID = createMemo(() => team.activeTeamID)
  const tasks = createMemo(() => (teamID() ? sync.data.task_item[teamID()!] ?? [] : []))

  function taskColor(status: TaskItemInfo["status"]) {
    switch (status) {
      case "done":
        return theme.textMuted
      case "blocked":
        return theme.error
      case "in_progress":
        return theme.success
      default:
        return theme.text
    }
  }

  return (
    <Show when={team.taskListVisible && teamID()}>
      <box
        backgroundColor={theme.backgroundPanel}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="column"
        flexShrink={0}
        gap={1}
      >
        <text fg={theme.text}>Tasks ({tasks().length})</text>
        <Show when={tasks().length === 0}>
          <text fg={theme.textMuted}>No tasks yet</text>
        </Show>
        <For each={tasks()}>
          {(task) => {
            const assignee = createMemo(() => {
              if (!task.assignedToSessionID) return undefined
              const members = sync.data.team_member[teamID()!] ?? []
              return members.find((m) => m.sessionID === task.assignedToSessionID)
            })
            return (
              <box flexDirection="column" gap={0}>
                <text fg={taskColor(task.status)}>
                  {STATUS_BADGE[task.status]} {task.title}
                </text>
                <Show when={assignee()}>
                  <text fg={theme.textMuted} paddingLeft={3}>
                    → {assignee()!.sessionID.slice(-6)} ({assignee()!.role})
                  </text>
                </Show>
                <Show when={task.description}>
                  <text fg={theme.textMuted} paddingLeft={3}>
                    {task.description!.slice(0, 60)}
                  </text>
                </Show>
                <Show when={task.dependsOnIDs && task.dependsOnIDs.length > 0}>
                  <text fg={theme.textMuted} paddingLeft={3}>
                    depends on: {task.dependsOnIDs!.length} task(s)
                  </text>
                </Show>
              </box>
            )
          }}
        </For>
      </box>
    </Show>
  )
}

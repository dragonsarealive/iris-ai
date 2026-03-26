import { createMemo, For, Show } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { useSync } from "@tui/context/sync"
import { useTeam } from "@tui/context/team"
import type { OrchestrationStepInfo } from "@tui/context/sync"

const ACTION_ICON: Record<string, string> = {
  teammate_spawned: "⊕",
  prompt_dispatched: "→",
  correction_sent: "⚡",
  plan_submitted: "📋",
  plan_approved: "✓",
  plan_rejected: "✗",
  task_claimed: "⬤",
  task_completed: "✅",
  task_blocked: "⛔",
  checklist_updated: "☑",
  team_disbanded: "⊗",
}

const ACTION_LABEL: Record<string, string> = {
  teammate_spawned: "Spawned",
  prompt_dispatched: "Prompted",
  correction_sent: "Corrected",
  plan_submitted: "Plan submitted",
  plan_approved: "Plan approved",
  plan_rejected: "Plan rejected",
  task_claimed: "Task claimed",
  task_completed: "Task done",
  task_blocked: "Task blocked",
  checklist_updated: "Checklist",
  team_disbanded: "Disbanded",
}

export function OrchestrationPanel() {
  const { theme } = useTheme()
  const sync = useSync()
  const team = useTeam()

  const teamID = createMemo(() => team.activeTeamID)
  const steps = createMemo(() => (teamID() ? (sync.data.orchestration_steps[teamID()!] ?? []).slice().reverse() : []))

  return (
    <Show when={teamID() && steps().length > 0}>
      <box
        backgroundColor={theme.backgroundPanel}
        paddingLeft={2}
        paddingRight={2}
        paddingTop={1}
        paddingBottom={1}
        flexDirection="column"
        flexShrink={0}
        gap={0}
      >
        <text fg={theme.text}>Orchestration</text>
        <For each={steps().slice(0, 10)}>
          {(step) => (
            <box flexDirection="row" gap={1}>
              <text fg={theme.textMuted}>{ACTION_ICON[step.action] ?? "·"}</text>
              <text fg={theme.text}>{ACTION_LABEL[step.action] ?? step.action}</text>
              <Show when={step.targetSessionID}>
                <text fg={theme.textMuted}>→ {step.targetSessionID!.slice(-6)}</text>
              </Show>
              <Show when={step.detail}>
                <text fg={theme.textMuted}>{step.detail!.slice(0, 30)}</text>
              </Show>
            </box>
          )}
        </For>
      </box>
    </Show>
  )
}

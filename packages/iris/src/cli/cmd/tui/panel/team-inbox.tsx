import { createMemo, For, Show } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { useSync } from "@tui/context/sync"
import { useTeam } from "@tui/context/team"
import { useRoute } from "@tui/context/route"
import { useSDK } from "@tui/context/sdk"

export function TeamInbox() {
  const { theme } = useTheme()
  const sync = useSync()
  const team = useTeam()
  const route = useRoute()
  const sdk = useSDK()

  const sessionID = createMemo(() => {
    const data = route.data
    return data.type === "session" ? data.sessionID : undefined
  })

  const teamID = createMemo(() => team.activeTeamID)

  const messages = createMemo(() => {
    const sid = sessionID()
    if (!sid) return []
    return (sync.data.team_message[sid] ?? []).filter((m) => !m.delivered)
  })

  const pendingApprovals = createMemo(() => {
    const tid = teamID()
    if (!tid) return []
    return (sync.data.team_member[tid] ?? []).filter((m) => m.status === "waiting_approval")
  })

  async function approve(approvalSessionID: string) {
    const tid = teamID()
    if (!tid) return
    await sdk
      .fetch(`${sdk.url}/team/${tid}/plan/${approvalSessionID}/approve`, { method: "POST" })
      .catch(() => undefined)
  }

  async function reject(approvalSessionID: string) {
    const tid = teamID()
    if (!tid) return
    await sdk
      .fetch(`${sdk.url}/team/${tid}/plan/${approvalSessionID}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedback: "Revise the plan and try again." }),
      })
      .catch(() => undefined)
  }

  const hasContent = createMemo(() => messages().length > 0 || pendingApprovals().length > 0)

  return (
    <Show when={hasContent()}>
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
        <Show when={pendingApprovals().length > 0}>
          <text fg={theme.warning}>Plan Approvals ({pendingApprovals().length})</text>
          <For each={pendingApprovals()}>
            {(member) => (
              <box flexDirection="column" gap={0}>
                <text fg={theme.text}>
                  Session {member.sessionID.slice(-6)} submitted a plan for review.
                </text>
                <box flexDirection="row" gap={2}>
                  <text fg={theme.success} onMouseUp={() => approve(member.sessionID)}>
                    [Approve]
                  </text>
                  <text fg={theme.error} onMouseUp={() => reject(member.sessionID)}>
                    [Reject]
                  </text>
                </box>
              </box>
            )}
          </For>
        </Show>

        <Show when={messages().length > 0}>
          <text fg={theme.text}>Inbox ({messages().length})</text>
          <For each={messages()}>
            {(msg) => (
              <box flexDirection="column" gap={0}>
                <text fg={theme.textMuted}>
                  from {msg.fromSessionID.slice(-6)}:
                </text>
                <text fg={theme.text} paddingLeft={2}>
                  {msg.body.slice(0, 120)}
                </text>
              </box>
            )}
          </For>
        </Show>
      </box>
    </Show>
  )
}

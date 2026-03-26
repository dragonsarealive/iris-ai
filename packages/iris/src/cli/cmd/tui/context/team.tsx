import { createStore } from "solid-js/store"
import { createEffect, createMemo, createSignal } from "solid-js"
import { useSync } from "@tui/context/sync"
import { useRoute } from "@tui/context/route"
import { createSimpleContext } from "./helper"
import { Flag } from "@/flag/flag"

export const { use: useTeam, provider: TeamProvider } = createSimpleContext({
  name: "Team",
  init: () => {
    const sync = useSync()
    const route = useRoute()

    const [store, setStore] = createStore({
      taskListVisible: false,
    })

    const [enabled, setEnabled] = createSignal(Flag.OPENCODE_EXPERIMENTAL_AGENT_TEAMS)

    // Sync from config once it loads or changes
    createEffect(() => {
      const configEnabled = !!(sync.data.config as { team?: { enabled?: boolean } }).team?.enabled
      if (Flag.OPENCODE_EXPERIMENTAL_AGENT_TEAMS || configEnabled) setEnabled(true)
      else setEnabled(false)
    })

    const activeTeamID = createMemo(() => {
      const data = route.data
      if (data.type !== "session") return undefined
      const sessionID = data.sessionID
      for (const [teamID, members] of Object.entries(sync.data.team_member)) {
        if (members.some((m) => m.sessionID === sessionID)) return teamID
      }
      return undefined
    })

    const members = createMemo(() => {
      const teamID = activeTeamID()
      if (!teamID) return []
      return sync.data.team_member[teamID] ?? []
    })

    const currentMemberIndex = createMemo(() => {
      const teamID = activeTeamID()
      const data = route.data
      const sessionID = data.type === "session" ? data.sessionID : undefined
      if (!teamID || !sessionID) return -1
      const list = members()
      const idx = list.findIndex((m) => m.sessionID === sessionID)
      return idx >= 0 ? idx : -1
    })

    function cycleNext() {
      const list = members()
      if (list.length === 0) return
      const idx = currentMemberIndex()
      const next = idx < 0 ? 0 : (idx + 1) % list.length
      route.navigate({ type: "session", sessionID: list[next].sessionID })
    }

    function cyclePrev() {
      const list = members()
      if (list.length === 0) return
      const idx = currentMemberIndex()
      const next = idx <= 0 ? list.length - 1 : idx - 1
      route.navigate({ type: "session", sessionID: list[next].sessionID })
    }

    function goToLead() {
      const teamID = activeTeamID()
      if (!teamID) return
      const team = sync.data.team[teamID]
      if (!team) return
      route.navigate({ type: "session", sessionID: team.leadSessionID })
    }

    function toggleTaskList() {
      setStore("taskListVisible", (v) => !v)
    }

    return {
      get enabled() {
        return enabled()
      },
      setEnabled,
      get activeTeamID() {
        return activeTeamID()
      },
      get members() {
        return members()
      },
      get currentMemberIndex() {
        return currentMemberIndex()
      },
      get taskListVisible() {
        return store.taskListVisible
      },
      cycleNext,
      cyclePrev,
      goToLead,
      toggleTaskList,
    }
  },
})

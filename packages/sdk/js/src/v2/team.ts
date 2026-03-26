/** Team types for agent teams feature (experimental). */

export type TeamInfo = {
  id: string
  projectID: string
  leadSessionID: string
  title: string
  status: "active" | "disbanded"
  requirePlanApproval: boolean
  timeCreated: number
  timeUpdated: number
}

export type TeamMemberInfo = {
  id: string
  teamID: string
  sessionID: string
  worktreeDirectory?: string
  role: "lead" | "teammate"
  status: "idle" | "busy" | "planning" | "waiting_approval" | "done"
  timeCreated: number
}

export type TaskItemInfo = {
  id: string
  teamID: string
  assignedToSessionID?: string
  title: string
  description?: string
  status: "pending" | "in_progress" | "done" | "blocked"
  dependsOnIDs?: string[]
  timeCreated: number
  timeUpdated: number
}

export type TeamMessageInfo = {
  id: string
  teamID: string
  fromSessionID: string
  toSessionID?: string
  body: string
  delivered: boolean
  timeCreated: number
}

import { sqliteTable, text, integer, index, primaryKey } from "drizzle-orm/sqlite-core"
import { ProjectTable } from "../project/project.sql"
import type { MessageV2 } from "./message-v2"
import type { Snapshot } from "../snapshot"
import type { PermissionNext } from "../permission"
import type { ProjectID } from "../project/schema"
import type { SessionID, MessageID, PartID } from "./schema"
import type { WorkspaceID } from "../control-plane/schema"
import { Timestamps } from "../storage/schema.sql"

// ── Agent Teams tables ──────────────────────────────────────────────

export const TeamTable = sqliteTable(
  "team",
  {
    id: text().primaryKey(),
    project_id: text()
      .$type<ProjectID>()
      .notNull()
      .references(() => ProjectTable.id, { onDelete: "cascade" }),
    lead_session_id: text().notNull(),
    title: text().notNull(),
    status: text().notNull().default("active"),
    require_plan_approval: integer().notNull().default(0),
    ...Timestamps,
  },
  (table) => [
    index("team_project_idx").on(table.project_id),
    index("team_lead_session_idx").on(table.lead_session_id),
  ],
)

export const TeamMemberTable = sqliteTable(
  "team_member",
  {
    id: text().primaryKey(),
    team_id: text().notNull(),
    session_id: text().$type<SessionID>().notNull(),
    worktree_directory: text(),
    role: text().notNull(),
    status: text().notNull().default("idle"),
    ...Timestamps,
  },
  (table) => [
    index("team_member_team_idx").on(table.team_id),
    index("team_member_session_idx").on(table.session_id),
  ],
)

export const TeamMessageTable = sqliteTable(
  "team_message",
  {
    id: text().primaryKey(),
    team_id: text().notNull(),
    from_session_id: text().notNull(),
    to_session_id: text(),
    body: text().notNull(),
    delivered: integer().notNull().default(0),
    ...Timestamps,
  },
  (table) => [
    index("team_message_team_idx").on(table.team_id),
    index("team_message_from_idx").on(table.from_session_id),
    index("team_message_to_idx").on(table.to_session_id, table.delivered),
  ],
)

export const TaskItemTable = sqliteTable(
  "task_item",
  {
    id: text().primaryKey(),
    team_id: text().notNull(),
    assigned_to_session_id: text(),
    title: text().notNull(),
    description: text(),
    status: text().notNull().default("pending"),
    depends_on_ids: text(),
    ...Timestamps,
  },
  (table) => [
    index("task_item_team_idx").on(table.team_id),
    index("task_item_assigned_idx").on(table.assigned_to_session_id),
  ],
)

export const TeamOrchestrationStepTable = sqliteTable(
  "team_orchestration_step",
  {
    id: text().primaryKey(),
    team_id: text().notNull(),
    time: integer().notNull(),
    actor_session_id: text().$type<SessionID>().notNull(),
    target_session_id: text().$type<SessionID>(),
    action: text().notNull(),
    detail: text(),
    ...Timestamps,
  },
  (table) => [
    index("team_orch_team_idx").on(table.team_id),
    index("team_orch_time_idx").on(table.team_id, table.time),
  ],
)

type PartData = Omit<MessageV2.Part, "id" | "sessionID" | "messageID">
type InfoData = Omit<MessageV2.Info, "id" | "sessionID">

export const SessionTable = sqliteTable(
  "session",
  {
    id: text().$type<SessionID>().primaryKey(),
    project_id: text()
      .$type<ProjectID>()
      .notNull()
      .references(() => ProjectTable.id, { onDelete: "cascade" }),
    workspace_id: text().$type<WorkspaceID>(),
    parent_id: text().$type<SessionID>(),
    slug: text().notNull(),
    directory: text().notNull(),
    title: text().notNull(),
    version: text().notNull(),
    share_url: text(),
    summary_additions: integer(),
    summary_deletions: integer(),
    summary_files: integer(),
    summary_diffs: text({ mode: "json" }).$type<Snapshot.FileDiff[]>(),
    revert: text({ mode: "json" }).$type<{ messageID: MessageID; partID?: PartID; snapshot?: string; diff?: string }>(),
    permission: text({ mode: "json" }).$type<PermissionNext.Ruleset>(),
    ...Timestamps,
    team_id: text(),
    time_compacting: integer(),
    time_archived: integer(),
  },
  (table) => [
    index("session_project_idx").on(table.project_id),
    index("session_workspace_idx").on(table.workspace_id),
    index("session_parent_idx").on(table.parent_id),
    index("session_team_idx").on(table.team_id),
  ],
)

export const MessageTable = sqliteTable(
  "message",
  {
    id: text().$type<MessageID>().primaryKey(),
    session_id: text()
      .$type<SessionID>()
      .notNull()
      .references(() => SessionTable.id, { onDelete: "cascade" }),
    ...Timestamps,
    data: text({ mode: "json" }).notNull().$type<InfoData>(),
  },
  (table) => [index("message_session_time_created_id_idx").on(table.session_id, table.time_created, table.id)],
)

export const PartTable = sqliteTable(
  "part",
  {
    id: text().$type<PartID>().primaryKey(),
    message_id: text()
      .$type<MessageID>()
      .notNull()
      .references(() => MessageTable.id, { onDelete: "cascade" }),
    session_id: text().$type<SessionID>().notNull(),
    ...Timestamps,
    data: text({ mode: "json" }).notNull().$type<PartData>(),
  },
  (table) => [
    index("part_message_id_id_idx").on(table.message_id, table.id),
    index("part_session_idx").on(table.session_id),
  ],
)

export const TodoTable = sqliteTable(
  "todo",
  {
    session_id: text()
      .$type<SessionID>()
      .notNull()
      .references(() => SessionTable.id, { onDelete: "cascade" }),
    content: text().notNull(),
    status: text().notNull(),
    priority: text().notNull(),
    position: integer().notNull(),
    ...Timestamps,
  },
  (table) => [
    primaryKey({ columns: [table.session_id, table.position] }),
    index("todo_session_idx").on(table.session_id),
  ],
)

export const PermissionTable = sqliteTable("permission", {
  project_id: text()
    .primaryKey()
    .references(() => ProjectTable.id, { onDelete: "cascade" }),
  ...Timestamps,
  data: text({ mode: "json" }).notNull().$type<PermissionNext.Ruleset>(),
})

CREATE TABLE `task_item` (
	`id` text PRIMARY KEY,
	`team_id` text NOT NULL,
	`assigned_to_session_id` text,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`depends_on_ids` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `team_member` (
	`id` text PRIMARY KEY,
	`team_id` text NOT NULL,
	`session_id` text NOT NULL,
	`worktree_directory` text,
	`role` text NOT NULL,
	`status` text DEFAULT 'idle' NOT NULL,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `team_message` (
	`id` text PRIMARY KEY,
	`team_id` text NOT NULL,
	`from_session_id` text NOT NULL,
	`to_session_id` text,
	`body` text NOT NULL,
	`delivered` integer DEFAULT 0 NOT NULL,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `team` (
	`id` text PRIMARY KEY,
	`project_id` text NOT NULL,
	`lead_session_id` text NOT NULL,
	`title` text NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`require_plan_approval` integer DEFAULT 0 NOT NULL,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL,
	CONSTRAINT `fk_team_project_id_project_id_fk` FOREIGN KEY (`project_id`) REFERENCES `project`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `session` ADD `team_id` text;--> statement-breakpoint
CREATE INDEX `session_team_idx` ON `session` (`team_id`);--> statement-breakpoint
CREATE INDEX `task_item_team_idx` ON `task_item` (`team_id`);--> statement-breakpoint
CREATE INDEX `task_item_assigned_idx` ON `task_item` (`assigned_to_session_id`);--> statement-breakpoint
CREATE INDEX `team_member_team_idx` ON `team_member` (`team_id`);--> statement-breakpoint
CREATE INDEX `team_member_session_idx` ON `team_member` (`session_id`);--> statement-breakpoint
CREATE INDEX `team_message_team_idx` ON `team_message` (`team_id`);--> statement-breakpoint
CREATE INDEX `team_message_from_idx` ON `team_message` (`from_session_id`);--> statement-breakpoint
CREATE INDEX `team_message_to_idx` ON `team_message` (`to_session_id`,`delivered`);--> statement-breakpoint
CREATE INDEX `team_project_idx` ON `team` (`project_id`);--> statement-breakpoint
CREATE INDEX `team_lead_session_idx` ON `team` (`lead_session_id`);
CREATE TABLE `team_orchestration_step` (
	`id` text PRIMARY KEY,
	`team_id` text NOT NULL,
	`time` integer NOT NULL,
	`actor_session_id` text NOT NULL,
	`target_session_id` text,
	`action` text NOT NULL,
	`detail` text,
	`time_created` integer NOT NULL,
	`time_updated` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `team_orch_team_idx` ON `team_orchestration_step` (`team_id`);--> statement-breakpoint
CREATE INDEX `team_orch_time_idx` ON `team_orchestration_step` (`team_id`,`time`);
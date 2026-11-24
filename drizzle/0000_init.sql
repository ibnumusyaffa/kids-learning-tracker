CREATE TABLE `assessment_units` (
	`assessment_id` text NOT NULL,
	`unit_id` text NOT NULL,
	PRIMARY KEY(`assessment_id`, `unit_id`),
	FOREIGN KEY (`assessment_id`) REFERENCES `assessments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `assessments` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` text NOT NULL,
	`date` text NOT NULL,
	`title` text NOT NULL,
	`score_text` text NOT NULL,
	`score_numeric` real,
	`max_score` real,
	`source` text,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `assessments_subject_date_idx` ON `assessments` (`subject_id`,`date`);--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`log_id` text NOT NULL,
	`r2_key` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`log_id`) REFERENCES `logs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `attachments_log_idx` ON `attachments` (`log_id`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `categories_family_idx` ON `categories` (`family_id`);--> statement-breakpoint
CREATE TABLE `children` (
	`id` text PRIMARY KEY NOT NULL,
	`family_id` text NOT NULL,
	`name` text NOT NULL,
	`birth_date` text,
	`grade` text,
	`avatar` text,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`family_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `children_family_idx` ON `children` (`family_id`);--> statement-breakpoint
CREATE TABLE `log_items` (
	`id` text PRIMARY KEY NOT NULL,
	`log_id` text NOT NULL,
	`unit_id` text NOT NULL,
	`range_from` integer,
	`range_to` integer,
	`cycle` integer,
	`mastery_after` text,
	`correct` integer,
	`total` integer,
	FOREIGN KEY (`log_id`) REFERENCES `logs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "log_items_range_pair_chk" CHECK(("log_items"."range_from" IS NULL) = ("log_items"."range_to" IS NULL)),
	CONSTRAINT "log_items_range_order_chk" CHECK("log_items"."range_from" IS NULL OR ("log_items"."range_from" >= 1 AND "log_items"."range_from" <= "log_items"."range_to")),
	CONSTRAINT "log_items_mastery_chk" CHECK("log_items"."mastery_after" IS NULL OR "log_items"."mastery_after" IN ('belum', 'kenal', 'bisa', 'mahir'))
);
--> statement-breakpoint
CREATE INDEX `log_items_unit_idx` ON `log_items` (`unit_id`);--> statement-breakpoint
CREATE INDEX `log_items_log_idx` ON `log_items` (`log_id`);--> statement-breakpoint
CREATE TABLE `logs` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`logged_by` text NOT NULL,
	`date` text NOT NULL,
	`activity_kind` text,
	`duration_min` integer,
	`quality` text,
	`mood` text,
	`note` text,
	`measure_value` real,
	`measure_unit` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`logged_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "logs_quality_chk" CHECK("logs"."quality" IS NULL OR "logs"."quality" IN ('lancar', 'ulang', 'belum'))
);
--> statement-breakpoint
CREATE INDEX `logs_child_date_idx` ON `logs` (`child_id`,`date`);--> statement-breakpoint
CREATE INDEX `logs_subject_date_idx` ON `logs` (`subject_id`,`date`);--> statement-breakpoint
CREATE TABLE `preset_units` (
	`id` text PRIMARY KEY NOT NULL,
	`preset_id` text NOT NULL,
	`parent_id` text,
	`label` text NOT NULL,
	`size` integer,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`preset_id`) REFERENCES `presets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `preset_units`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `preset_units_preset_idx` ON `preset_units` (`preset_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `presets` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`structure` text NOT NULL,
	`unit_label` text,
	CONSTRAINT "presets_structure_chk" CHECK("presets"."structure" IN ('range', 'checklist', 'none'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `presets_code_unique` ON `presets` (`code`);--> statement-breakpoint
CREATE TABLE `subjects` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`category_id` text,
	`preset_id` text,
	`name` text NOT NULL,
	`structure` text NOT NULL,
	`unit_label` text,
	`open_ended` integer DEFAULT false NOT NULL,
	`current_cycle` integer DEFAULT 1 NOT NULL,
	`suggest_order` text DEFAULT 'asc' NOT NULL,
	`activity_kinds` text DEFAULT '[]' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`preset_id`) REFERENCES `presets`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "subjects_structure_chk" CHECK("subjects"."structure" IN ('range', 'checklist', 'none')),
	CONSTRAINT "subjects_suggest_order_chk" CHECK("subjects"."suggest_order" IN ('asc', 'desc', 'manual'))
);
--> statement-breakpoint
CREATE INDEX `subjects_child_idx` ON `subjects` (`child_id`);--> statement-breakpoint
CREATE TABLE `target_units` (
	`target_id` text NOT NULL,
	`unit_id` text NOT NULL,
	PRIMARY KEY(`target_id`, `unit_id`),
	FOREIGN KEY (`target_id`) REFERENCES `targets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `targets` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` text NOT NULL,
	`title` text NOT NULL,
	`metric` text NOT NULL,
	`period` text DEFAULT 'total' NOT NULL,
	`goal` real NOT NULL,
	`min_mastery` text,
	`start_date` text NOT NULL,
	`deadline` text,
	`achieved_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "targets_metric_chk" CHECK("targets"."metric" IN ('units_completed', 'minutes', 'sessions', 'streak', 'score')),
	CONSTRAINT "targets_period_chk" CHECK("targets"."period" IN ('daily', 'weekly', 'monthly', 'total')),
	CONSTRAINT "targets_min_mastery_chk" CHECK("targets"."min_mastery" IS NULL OR "targets"."min_mastery" IN ('belum', 'kenal', 'bisa', 'mahir'))
);
--> statement-breakpoint
CREATE INDEX `targets_subject_idx` ON `targets` (`subject_id`);--> statement-breakpoint
CREATE TABLE `todo_completions` (
	`id` text PRIMARY KEY NOT NULL,
	`todo_id` text NOT NULL,
	`date` text NOT NULL,
	`log_id` text,
	FOREIGN KEY (`todo_id`) REFERENCES `todos`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`log_id`) REFERENCES `logs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `todo_completions_todo_date_uq` ON `todo_completions` (`todo_id`,`date`);--> statement-breakpoint
CREATE TABLE `todos` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`subject_id` text,
	`unit_id` text,
	`title` text NOT NULL,
	`recurrence` text,
	`due_date` text,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `todos_child_idx` ON `todos` (`child_id`);--> statement-breakpoint
CREATE TABLE `units` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` text NOT NULL,
	`parent_id` text,
	`label` text NOT NULL,
	`size` integer,
	`mastery` text,
	`meaning` text,
	`tags` text DEFAULT '[]' NOT NULL,
	`completed_at` integer,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `units`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "units_mastery_chk" CHECK("units"."mastery" IS NULL OR "units"."mastery" IN ('belum', 'kenal', 'bisa', 'mahir')),
	CONSTRAINT "units_size_chk" CHECK("units"."size" IS NULL OR "units"."size" > 0)
);
--> statement-breakpoint
CREATE INDEX `units_subject_idx` ON `units` (`subject_id`,`sort_order`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `invitation` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`email` text NOT NULL,
	`role` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`inviter_id` text NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inviter_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `invitation_organization_id_idx` ON `invitation` (`organization_id`);--> statement-breakpoint
CREATE INDEX `invitation_email_idx` ON `invitation` (`email`);--> statement-breakpoint
CREATE TABLE `member` (
	`id` text PRIMARY KEY NOT NULL,
	`organization_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`organization_id`) REFERENCES `organization`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `member_organization_id_idx` ON `member` (`organization_id`);--> statement-breakpoint
CREATE INDEX `member_user_id_idx` ON `member` (`user_id`);--> statement-breakpoint
CREATE TABLE `organization` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`logo` text,
	`created_at` integer NOT NULL,
	`metadata` text,
	`timezone` text DEFAULT 'Asia/Jakarta' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `organization_slug_unique` ON `organization` (`slug`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`active_organization_id` text,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);
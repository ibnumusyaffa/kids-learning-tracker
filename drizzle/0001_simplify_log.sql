-- Penyederhanaan form catat (24 Nov 2026):
-- hapus jenis kegiatan, kualitas, ukuran, dan fitur nilai (assessment).
--
-- Ditulis manual (bukan hasil drizzle-kit apa adanya) karena:
-- 1. D1 mengabaikan `PRAGMA foreign_keys=OFF`, sehingga `DROP TABLE logs`
--    akan men-cascade log_items/attachments dan me-NULL-kan
--    todo_completions.log_id. Anak-anaknya di-backup lalu dipulihkan.
-- 2. `logs.quality` dipakai CHECK constraint → tidak bisa DROP COLUMN,
--    tabel harus dibangun ulang.
-- 3. CHECK di tabel baru tidak boleh merujuk nama tabel sementara.

-- Nilai --------------------------------------------------------------------
DROP TABLE `assessment_units`;--> statement-breakpoint
DROP TABLE `assessments`;--> statement-breakpoint

-- Jenis kegiatan per pelajaran ------------------------------------------------
ALTER TABLE `subjects` DROP COLUMN `activity_kinds`;--> statement-breakpoint

-- logs: bangun ulang tanpa activity_kind, quality, measure_value, measure_unit --
CREATE TABLE `__bak_log_items` AS SELECT * FROM `log_items`;--> statement-breakpoint
CREATE TABLE `__bak_attachments` AS SELECT * FROM `attachments`;--> statement-breakpoint
CREATE TABLE `__bak_todo_completions` AS
  SELECT `id`, `log_id` FROM `todo_completions` WHERE `log_id` IS NOT NULL;--> statement-breakpoint

CREATE TABLE `__new_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`child_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`logged_by` text NOT NULL,
	`date` text NOT NULL,
	`duration_min` integer,
	`mood` text,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`child_id`) REFERENCES `children`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`logged_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
INSERT INTO `__new_logs` (`id`, `child_id`, `subject_id`, `logged_by`, `date`, `duration_min`, `mood`, `note`, `created_at`)
  SELECT `id`, `child_id`, `subject_id`, `logged_by`, `date`, `duration_min`, `mood`, `note`, `created_at` FROM `logs`;--> statement-breakpoint
DROP TABLE `logs`;--> statement-breakpoint
ALTER TABLE `__new_logs` RENAME TO `logs`;--> statement-breakpoint
CREATE INDEX `logs_child_date_idx` ON `logs` (`child_id`,`date`);--> statement-breakpoint
CREATE INDEX `logs_subject_date_idx` ON `logs` (`subject_id`,`date`);--> statement-breakpoint

INSERT INTO `log_items` (`id`, `log_id`, `unit_id`, `range_from`, `range_to`, `cycle`, `mastery_after`, `correct`, `total`)
  SELECT `id`, `log_id`, `unit_id`, `range_from`, `range_to`, `cycle`, `mastery_after`, `correct`, `total` FROM `__bak_log_items`
  WHERE `id` NOT IN (SELECT `id` FROM `log_items`);--> statement-breakpoint
INSERT INTO `attachments` (`id`, `log_id`, `r2_key`, `content_type`, `size_bytes`, `created_at`)
  SELECT `id`, `log_id`, `r2_key`, `content_type`, `size_bytes`, `created_at` FROM `__bak_attachments`
  WHERE `id` NOT IN (SELECT `id` FROM `attachments`);--> statement-breakpoint
UPDATE `todo_completions`
  SET `log_id` = (SELECT b.`log_id` FROM `__bak_todo_completions` b WHERE b.`id` = `todo_completions`.`id`)
  WHERE `id` IN (SELECT `id` FROM `__bak_todo_completions`);--> statement-breakpoint
DROP TABLE `__bak_log_items`;--> statement-breakpoint
DROP TABLE `__bak_attachments`;--> statement-breakpoint
DROP TABLE `__bak_todo_completions`;--> statement-breakpoint

-- targets: metrik 'score' dihapus (bergantung pada fitur nilai) -------------
DELETE FROM `targets` WHERE `metric` = 'score';--> statement-breakpoint
CREATE TABLE `__bak_target_units` AS SELECT * FROM `target_units`;--> statement-breakpoint
CREATE TABLE `__new_targets` (
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
	CONSTRAINT "targets_metric_chk" CHECK("metric" IN ('units_completed', 'minutes', 'sessions', 'streak')),
	CONSTRAINT "targets_period_chk" CHECK("period" IN ('daily', 'weekly', 'monthly', 'total')),
	CONSTRAINT "targets_min_mastery_chk" CHECK("min_mastery" IS NULL OR "min_mastery" IN ('belum', 'kenal', 'bisa', 'mahir'))
);--> statement-breakpoint
INSERT INTO `__new_targets` (`id`, `subject_id`, `title`, `metric`, `period`, `goal`, `min_mastery`, `start_date`, `deadline`, `achieved_at`, `created_at`)
  SELECT `id`, `subject_id`, `title`, `metric`, `period`, `goal`, `min_mastery`, `start_date`, `deadline`, `achieved_at`, `created_at` FROM `targets`;--> statement-breakpoint
DROP TABLE `targets`;--> statement-breakpoint
ALTER TABLE `__new_targets` RENAME TO `targets`;--> statement-breakpoint
CREATE INDEX `targets_subject_idx` ON `targets` (`subject_id`);--> statement-breakpoint
INSERT INTO `target_units` (`target_id`, `unit_id`)
  SELECT `target_id`, `unit_id` FROM `__bak_target_units`
  WHERE NOT EXISTS (
    SELECT 1 FROM `target_units` t
    WHERE t.`target_id` = `__bak_target_units`.`target_id` AND t.`unit_id` = `__bak_target_units`.`unit_id`
  );--> statement-breakpoint
DROP TABLE `__bak_target_units`;

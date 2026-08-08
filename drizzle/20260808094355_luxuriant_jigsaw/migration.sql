ALTER TABLE `screenshots` ADD `preview_path` text;--> statement-breakpoint
ALTER TABLE `screenshots` ADD `preview_width` integer;--> statement-breakpoint
ALTER TABLE `screenshots` ADD `preview_height` integer;--> statement-breakpoint
ALTER TABLE `screenshots` ADD `content_hash` text;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_screenshots` (
	`id` text PRIMARY KEY,
	`location_id` text NOT NULL,
	`path` text NOT NULL,
	`preview_path` text,
	`alt_text` text NOT NULL,
	`caption` text,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`preview_width` integer,
	`preview_height` integer,
	`content_hash` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	CONSTRAINT `fk_screenshots_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT "screenshots_width_positive" CHECK("width" > 0),
	CONSTRAINT "screenshots_height_positive" CHECK("height" > 0),
	CONSTRAINT "screenshots_preview_width_positive" CHECK("preview_width" IS NULL OR "preview_width" > 0),
	CONSTRAINT "screenshots_preview_height_positive" CHECK("preview_height" IS NULL OR "preview_height" > 0),
	CONSTRAINT "screenshots_preview_fields_complete" CHECK(("preview_path" IS NULL AND "preview_width" IS NULL AND "preview_height" IS NULL) OR ("preview_path" IS NOT NULL AND "preview_width" IS NOT NULL AND "preview_height" IS NOT NULL)),
	CONSTRAINT "screenshots_sort_order_non_negative" CHECK("sort_order" >= 0),
	CONSTRAINT "screenshots_is_active_boolean" CHECK("is_active" IN (0, 1))
);
--> statement-breakpoint
INSERT INTO `__new_screenshots`(`id`, `location_id`, `path`, `alt_text`, `caption`, `width`, `height`, `sort_order`, `is_active`) SELECT `id`, `location_id`, `path`, `alt_text`, `caption`, `width`, `height`, `sort_order`, `is_active` FROM `screenshots`;--> statement-breakpoint
DROP TABLE `screenshots`;--> statement-breakpoint
ALTER TABLE `__new_screenshots` RENAME TO `screenshots`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `screenshots_location_id_idx` ON `screenshots` (`location_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `screenshots_location_content_hash_unique` ON `screenshots` (`location_id`,`content_hash`);
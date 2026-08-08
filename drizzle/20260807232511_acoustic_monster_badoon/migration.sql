ALTER TABLE `map_images` ADD `view_key` text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE `map_images` ADD `name` text DEFAULT 'Main map' NOT NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_map_images` (
	`id` text PRIMARY KEY,
	`map_id` text NOT NULL,
	`view_key` text DEFAULT 'main' NOT NULL,
	`name` text DEFAULT 'Main map' NOT NULL,
	`path` text NOT NULL,
	`alt_text` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`content_hash` text,
	`is_current` integer DEFAULT true NOT NULL,
	CONSTRAINT `fk_map_images_map_id_maps_id_fk` FOREIGN KEY (`map_id`) REFERENCES `maps`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT "map_images_view_key_not_empty" CHECK(length(trim("view_key")) > 0),
	CONSTRAINT "map_images_name_not_empty" CHECK(length(trim("name")) > 0),
	CONSTRAINT "map_images_width_positive" CHECK("width" > 0),
	CONSTRAINT "map_images_height_positive" CHECK("height" > 0),
	CONSTRAINT "map_images_is_current_boolean" CHECK("is_current" IN (0, 1))
);
--> statement-breakpoint
INSERT INTO `__new_map_images`(`id`, `map_id`, `path`, `alt_text`, `width`, `height`, `content_hash`, `is_current`) SELECT `id`, `map_id`, `path`, `alt_text`, `width`, `height`, `content_hash`, `is_current` FROM `map_images`;--> statement-breakpoint
DROP TABLE `map_images`;--> statement-breakpoint
ALTER TABLE `__new_map_images` RENAME TO `map_images`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP INDEX IF EXISTS `map_images_one_current_per_map_idx`;--> statement-breakpoint
CREATE INDEX `map_images_map_id_idx` ON `map_images` (`map_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `map_images_one_current_per_view_idx` ON `map_images` (`map_id`,`view_key`) WHERE "map_images"."is_current" = 1;
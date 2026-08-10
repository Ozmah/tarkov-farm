CREATE TABLE `document_maps` (
	`document_id` text NOT NULL,
	`map_id` text NOT NULL,
	`notes` text,
	CONSTRAINT `document_maps_pk` PRIMARY KEY(`document_id`, `map_id`),
	CONSTRAINT `fk_document_maps_document_id_documents_id_fk` FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `fk_document_maps_map_id_maps_id_fk` FOREIGN KEY (`map_id`) REFERENCES `maps`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `documents` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL UNIQUE,
	`description` text,
	`acquisition_type` text DEFAULT 'raid' NOT NULL,
	`acquisition_source` text,
	`is_filterable` integer DEFAULT true NOT NULL,
	`is_wildcard` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	CONSTRAINT "documents_id_not_null" CHECK("id" IS NOT NULL),
	CONSTRAINT "documents_acquisition_type_allowed" CHECK("acquisition_type" IN ('raid', 'store')),
	CONSTRAINT "documents_store_source_required" CHECK("acquisition_type" != 'store' OR "acquisition_source" IS NOT NULL),
	CONSTRAINT "documents_wildcard_not_filterable" CHECK("is_wildcard" = 0 OR "is_filterable" = 0),
	CONSTRAINT "documents_is_filterable_boolean" CHECK("is_filterable" IN (0, 1)),
	CONSTRAINT "documents_is_wildcard_boolean" CHECK("is_wildcard" IN (0, 1)),
	CONSTRAINT "documents_is_active_boolean" CHECK("is_active" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `location_documents` (
	`location_id` text NOT NULL,
	`document_id` text NOT NULL,
	CONSTRAINT `location_documents_pk` PRIMARY KEY(`location_id`, `document_id`),
	CONSTRAINT `fk_location_documents_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `fk_location_documents_document_id_documents_id_fk` FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY,
	`map_image_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`x_basis_points` integer NOT NULL,
	`y_basis_points` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	CONSTRAINT `fk_locations_map_image_id_map_images_id_fk` FOREIGN KEY (`map_image_id`) REFERENCES `map_images`(`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
	CONSTRAINT "locations_id_not_null" CHECK("id" IS NOT NULL),
	CONSTRAINT "locations_x_basis_points_normalized" CHECK("x_basis_points" BETWEEN 0 AND 10000),
	CONSTRAINT "locations_y_basis_points_normalized" CHECK("y_basis_points" BETWEEN 0 AND 10000),
	CONSTRAINT "locations_is_active_boolean" CHECK("is_active" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `map_images` (
	`id` text PRIMARY KEY,
	`map_id` text NOT NULL,
	`view_key` text DEFAULT 'main' NOT NULL,
	`name` text DEFAULT 'Main map' NOT NULL,
	`path` text NOT NULL,
	`alt_text` text NOT NULL,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`content_hash` text NOT NULL,
	`is_current` integer DEFAULT true NOT NULL,
	CONSTRAINT `fk_map_images_map_id_maps_id_fk` FOREIGN KEY (`map_id`) REFERENCES `maps`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT "map_images_id_not_null" CHECK("id" IS NOT NULL),
	CONSTRAINT "map_images_view_key_not_empty" CHECK(length(trim("view_key")) > 0),
	CONSTRAINT "map_images_name_not_empty" CHECK(length(trim("name")) > 0),
	CONSTRAINT "map_images_width_positive" CHECK("width" > 0),
	CONSTRAINT "map_images_height_positive" CHECK("height" > 0),
	CONSTRAINT "map_images_content_hash_sha256" CHECK(length("content_hash") = 64 AND "content_hash" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "map_images_is_current_boolean" CHECK("is_current" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `maps` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL UNIQUE,
	`description` text,
	`is_active` integer DEFAULT true NOT NULL,
	CONSTRAINT "maps_id_not_null" CHECK("id" IS NOT NULL),
	CONSTRAINT "maps_is_active_boolean" CHECK("is_active" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `screenshots` (
	`id` text PRIMARY KEY,
	`location_id` text NOT NULL,
	`path` text NOT NULL,
	`preview_path` text NOT NULL,
	`alt_text` text NOT NULL,
	`caption` text,
	`width` integer NOT NULL,
	`height` integer NOT NULL,
	`preview_width` integer NOT NULL,
	`preview_height` integer NOT NULL,
	`source_hash` text NOT NULL,
	`full_hash` text NOT NULL,
	`preview_hash` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	CONSTRAINT `fk_screenshots_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT "screenshots_id_not_null" CHECK("id" IS NOT NULL),
	CONSTRAINT "screenshots_width_positive" CHECK("width" > 0),
	CONSTRAINT "screenshots_height_positive" CHECK("height" > 0),
	CONSTRAINT "screenshots_preview_width_positive" CHECK("preview_width" > 0),
	CONSTRAINT "screenshots_preview_height_positive" CHECK("preview_height" > 0),
	CONSTRAINT "screenshots_source_hash_sha256" CHECK(length("source_hash") = 64 AND "source_hash" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "screenshots_full_hash_sha256" CHECK(length("full_hash") = 64 AND "full_hash" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "screenshots_preview_hash_sha256" CHECK(length("preview_hash") = 64 AND "preview_hash" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "screenshots_sort_order_non_negative" CHECK("sort_order" >= 0),
	CONSTRAINT "screenshots_is_active_boolean" CHECK("is_active" IN (0, 1))
);
--> statement-breakpoint
CREATE INDEX `document_maps_map_id_idx` ON `document_maps` (`map_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `location_documents_location_id_unique` ON `location_documents` (`location_id`);--> statement-breakpoint
CREATE INDEX `location_documents_document_id_idx` ON `location_documents` (`document_id`);--> statement-breakpoint
CREATE INDEX `locations_map_image_id_idx` ON `locations` (`map_image_id`);--> statement-breakpoint
CREATE INDEX `map_images_map_id_idx` ON `map_images` (`map_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `map_images_one_current_per_view_idx` ON `map_images` (`map_id`,`view_key`) WHERE "map_images"."is_current" = 1;--> statement-breakpoint
CREATE INDEX `screenshots_location_id_idx` ON `screenshots` (`location_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `screenshots_location_source_hash_unique` ON `screenshots` (`location_id`,`source_hash`);
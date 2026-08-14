CREATE TABLE `key_maps` (
	`key_id` text NOT NULL,
	`map_id` text NOT NULL,
	CONSTRAINT `key_maps_pk` PRIMARY KEY(`key_id`, `map_id`),
	CONSTRAINT `fk_key_maps_key_id_keys_id_fk` FOREIGN KEY (`key_id`) REFERENCES `keys`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `fk_key_maps_map_id_maps_id_fk` FOREIGN KEY (`map_id`) REFERENCES `maps`(`id`) ON UPDATE CASCADE ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `keys` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL UNIQUE,
	`wiki_url` text NOT NULL,
	`image_path` text NOT NULL UNIQUE,
	`image_width` integer NOT NULL,
	`image_height` integer NOT NULL,
	`image_hash` text NOT NULL,
	`used_in_quest` integer DEFAULT false NOT NULL,
	CONSTRAINT "keys_id_safe" CHECK(length("id") BETWEEN 1 AND 100 AND "id" NOT GLOB '*[^a-z0-9-]*'),
	CONSTRAINT "keys_name_canonical" CHECK(length("name") BETWEEN 1 AND 120 AND trim("name") = "name"),
	CONSTRAINT "keys_image_width_positive" CHECK("image_width" BETWEEN 1 AND 128),
	CONSTRAINT "keys_image_height_positive" CHECK("image_height" BETWEEN 1 AND 128),
	CONSTRAINT "keys_image_hash_sha256" CHECK(length("image_hash") = 64 AND "image_hash" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "keys_used_in_quest_boolean" CHECK("used_in_quest" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE `location_required_keys` (
	`location_id` text NOT NULL,
	`key_id` text NOT NULL,
	CONSTRAINT `location_required_keys_pk` PRIMARY KEY(`location_id`, `key_id`),
	CONSTRAINT `fk_location_required_keys_location_id_locations_id_fk` FOREIGN KEY (`location_id`) REFERENCES `locations`(`id`) ON UPDATE CASCADE ON DELETE CASCADE,
	CONSTRAINT `fk_location_required_keys_key_id_keys_id_fk` FOREIGN KEY (`key_id`) REFERENCES `keys`(`id`) ON UPDATE CASCADE ON DELETE RESTRICT
);
--> statement-breakpoint
CREATE INDEX `key_maps_map_id_idx` ON `key_maps` (`map_id`);--> statement-breakpoint
CREATE INDEX `location_required_keys_key_id_idx` ON `location_required_keys` (`key_id`);
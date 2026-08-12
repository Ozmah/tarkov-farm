CREATE TABLE `updates` (
	`id` text PRIMARY KEY,
	`published_at` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`snapshot` text NOT NULL,
	CONSTRAINT "updates_id_safe" CHECK(length("id") BETWEEN 1 AND 100 AND "id" NOT GLOB '*[^a-zA-Z0-9_-]*'),
	CONSTRAINT "updates_published_at_canonical_utc" CHECK(length("published_at") = 24 AND strftime('%Y-%m-%dT%H:%M:%fZ', "published_at") = "published_at"),
	CONSTRAINT "updates_title_canonical" CHECK(length("title") BETWEEN 1 AND 120 AND trim("title") = "title"),
	CONSTRAINT "updates_description_canonical" CHECK(length("description") BETWEEN 1 AND 2000 AND trim("description") = "description"),
	CONSTRAINT "updates_snapshot_json" CHECK(json_valid("snapshot") AND length("snapshot") BETWEEN 1 AND 1048576)
);
--> statement-breakpoint
CREATE INDEX `updates_published_at_desc_id_idx` ON `updates` ("published_at" DESC,`id`);
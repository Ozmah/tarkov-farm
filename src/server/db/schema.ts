import { sql } from "drizzle-orm";
import {
	check,
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const maps = sqliteTable(
	"maps",
	{
		id: text("id").notNull().primaryKey(),
		name: text("name").notNull().unique(),
		description: text("description"),
		isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	},
	(table) => [
		check("maps_id_not_null", sql`${table.id} IS NOT NULL`),
		check("maps_is_active_boolean", sql`${table.isActive} IN (0, 1)`),
	],
);

export const mapImages = sqliteTable(
	"map_images",
	{
		id: text("id").notNull().primaryKey(),
		mapId: text("map_id")
			.notNull()
			.references(() => maps.id, { onDelete: "cascade", onUpdate: "cascade" }),
		viewKey: text("view_key").notNull().default("main"),
		name: text("name").notNull().default("Main map"),
		path: text("path").notNull(),
		altText: text("alt_text").notNull(),
		width: integer("width").notNull(),
		height: integer("height").notNull(),
		contentHash: text("content_hash").notNull(),
		isCurrent: integer("is_current", { mode: "boolean" })
			.notNull()
			.default(true),
	},
	(table) => [
		check("map_images_id_not_null", sql`${table.id} IS NOT NULL`),
		index("map_images_map_id_idx").on(table.mapId),
		uniqueIndex("map_images_one_current_per_view_idx")
			.on(table.mapId, table.viewKey)
			.where(sql`${table.isCurrent} = 1`),
		check(
			"map_images_view_key_not_empty",
			sql`length(trim(${table.viewKey})) > 0`,
		),
		check("map_images_name_not_empty", sql`length(trim(${table.name})) > 0`),
		check("map_images_width_positive", sql`${table.width} > 0`),
		check("map_images_height_positive", sql`${table.height} > 0`),
		check(
			"map_images_content_hash_sha256",
			sql`length(${table.contentHash}) = 64 AND ${table.contentHash} NOT GLOB '*[^0-9a-f]*'`,
		),
		check("map_images_is_current_boolean", sql`${table.isCurrent} IN (0, 1)`),
	],
);

export const documents = sqliteTable(
	"documents",
	{
		id: text("id").notNull().primaryKey(),
		name: text("name").notNull().unique(),
		description: text("description"),
		imagePath: text("image_path").notNull().unique(),
		imageWidth: integer("image_width").notNull(),
		imageHeight: integer("image_height").notNull(),
		imageHash: text("image_hash").notNull(),
		acquisitionType: text("acquisition_type", { enum: ["raid", "store"] })
			.notNull()
			.default("raid"),
		acquisitionSource: text("acquisition_source"),
		isFilterable: integer("is_filterable", { mode: "boolean" })
			.notNull()
			.default(true),
		isWildcard: integer("is_wildcard", { mode: "boolean" })
			.notNull()
			.default(false),
		isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	},
	(table) => [
		check("documents_id_not_null", sql`${table.id} IS NOT NULL`),
		check(
			"documents_image_width_valid",
			sql`${table.imageWidth} BETWEEN 1 AND 768`,
		),
		check(
			"documents_image_height_valid",
			sql`${table.imageHeight} BETWEEN 1 AND 768`,
		),
		check(
			"documents_image_hash_sha256",
			sql`length(${table.imageHash}) = 64 AND ${table.imageHash} NOT GLOB '*[^0-9a-f]*'`,
		),
		check(
			"documents_acquisition_type_allowed",
			sql`${table.acquisitionType} IN ('raid', 'store')`,
		),
		check(
			"documents_store_source_required",
			sql`${table.acquisitionType} != 'store' OR ${table.acquisitionSource} IS NOT NULL`,
		),
		check(
			"documents_wildcard_not_filterable",
			sql`${table.isWildcard} = 0 OR ${table.isFilterable} = 0`,
		),
		check(
			"documents_is_filterable_boolean",
			sql`${table.isFilterable} IN (0, 1)`,
		),
		check("documents_is_wildcard_boolean", sql`${table.isWildcard} IN (0, 1)`),
		check("documents_is_active_boolean", sql`${table.isActive} IN (0, 1)`),
	],
);

export const documentMaps = sqliteTable(
	"document_maps",
	{
		documentId: text("document_id")
			.notNull()
			.references(() => documents.id, {
				onDelete: "cascade",
				onUpdate: "cascade",
			}),
		mapId: text("map_id")
			.notNull()
			.references(() => maps.id, { onDelete: "cascade", onUpdate: "cascade" }),
		notes: text("notes"),
	},
	(table) => [
		primaryKey({ columns: [table.documentId, table.mapId] }),
		index("document_maps_map_id_idx").on(table.mapId),
	],
);

export const keys = sqliteTable(
	"keys",
	{
		id: text("id").notNull().primaryKey(),
		name: text("name").notNull().unique(),
		wikiUrl: text("wiki_url").notNull(),
		imagePath: text("image_path").notNull().unique(),
		imageWidth: integer("image_width").notNull(),
		imageHeight: integer("image_height").notNull(),
		imageHash: text("image_hash").notNull(),
		usedInQuest: integer("used_in_quest", { mode: "boolean" })
			.notNull()
			.default(false),
	},
	(table) => [
		check(
			"keys_id_safe",
			sql`length(${table.id}) BETWEEN 1 AND 100 AND ${table.id} NOT GLOB '*[^a-z0-9-]*'`,
		),
		check(
			"keys_name_canonical",
			sql`length(${table.name}) BETWEEN 1 AND 120 AND trim(${table.name}) = ${table.name}`,
		),
		check(
			"keys_image_width_positive",
			sql`${table.imageWidth} BETWEEN 1 AND 128`,
		),
		check(
			"keys_image_height_positive",
			sql`${table.imageHeight} BETWEEN 1 AND 128`,
		),
		check(
			"keys_image_hash_sha256",
			sql`length(${table.imageHash}) = 64 AND ${table.imageHash} NOT GLOB '*[^0-9a-f]*'`,
		),
		check("keys_used_in_quest_boolean", sql`${table.usedInQuest} IN (0, 1)`),
	],
);

export const keyMaps = sqliteTable(
	"key_maps",
	{
		keyId: text("key_id")
			.notNull()
			.references(() => keys.id, { onDelete: "cascade", onUpdate: "cascade" }),
		mapId: text("map_id")
			.notNull()
			.references(() => maps.id, { onDelete: "cascade", onUpdate: "cascade" }),
	},
	(table) => [
		primaryKey({ columns: [table.keyId, table.mapId] }),
		index("key_maps_map_id_idx").on(table.mapId),
	],
);

export const locations = sqliteTable(
	"locations",
	{
		id: text("id").notNull().primaryKey(),
		mapImageId: text("map_image_id")
			.notNull()
			.references(() => mapImages.id, {
				onDelete: "restrict",
				onUpdate: "cascade",
			}),
		name: text("name").notNull(),
		description: text("description"),
		xBasisPoints: integer("x_basis_points").notNull(),
		yBasisPoints: integer("y_basis_points").notNull(),
		isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	},
	(table) => [
		check("locations_id_not_null", sql`${table.id} IS NOT NULL`),
		index("locations_map_image_id_idx").on(table.mapImageId),
		check(
			"locations_x_basis_points_normalized",
			sql`${table.xBasisPoints} BETWEEN 0 AND 10000`,
		),
		check(
			"locations_y_basis_points_normalized",
			sql`${table.yBasisPoints} BETWEEN 0 AND 10000`,
		),
		check("locations_is_active_boolean", sql`${table.isActive} IN (0, 1)`),
	],
);

export const locationDocuments = sqliteTable(
	"location_documents",
	{
		locationId: text("location_id")
			.notNull()
			.references(() => locations.id, {
				onDelete: "cascade",
				onUpdate: "cascade",
			}),
		documentId: text("document_id")
			.notNull()
			.references(() => documents.id, {
				onDelete: "cascade",
				onUpdate: "cascade",
			}),
	},
	(table) => [
		primaryKey({ columns: [table.locationId, table.documentId] }),
		uniqueIndex("location_documents_location_id_unique").on(table.locationId),
		index("location_documents_document_id_idx").on(table.documentId),
	],
);

export const locationRequiredKeys = sqliteTable(
	"location_required_keys",
	{
		locationId: text("location_id")
			.notNull()
			.references(() => locations.id, {
				onDelete: "cascade",
				onUpdate: "cascade",
			}),
		keyId: text("key_id")
			.notNull()
			.references(() => keys.id, { onDelete: "restrict", onUpdate: "cascade" }),
	},
	(table) => [
		primaryKey({ columns: [table.locationId, table.keyId] }),
		index("location_required_keys_key_id_idx").on(table.keyId),
	],
);

export const screenshots = sqliteTable(
	"screenshots",
	{
		id: text("id").notNull().primaryKey(),
		locationId: text("location_id")
			.notNull()
			.references(() => locations.id, {
				onDelete: "cascade",
				onUpdate: "cascade",
			}),
		path: text("path").notNull(),
		previewPath: text("preview_path").notNull(),
		altText: text("alt_text").notNull(),
		caption: text("caption"),
		width: integer("width").notNull(),
		height: integer("height").notNull(),
		previewWidth: integer("preview_width").notNull(),
		previewHeight: integer("preview_height").notNull(),
		sourceHash: text("source_hash").notNull(),
		fullHash: text("full_hash").notNull(),
		previewHash: text("preview_hash").notNull(),
		sortOrder: integer("sort_order").notNull().default(0),
		isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
	},
	(table) => [
		check("screenshots_id_not_null", sql`${table.id} IS NOT NULL`),
		index("screenshots_location_id_idx").on(table.locationId),
		uniqueIndex("screenshots_location_source_hash_unique").on(
			table.locationId,
			table.sourceHash,
		),
		check("screenshots_width_positive", sql`${table.width} > 0`),
		check("screenshots_height_positive", sql`${table.height} > 0`),
		check("screenshots_preview_width_positive", sql`${table.previewWidth} > 0`),
		check(
			"screenshots_preview_height_positive",
			sql`${table.previewHeight} > 0`,
		),
		check(
			"screenshots_source_hash_sha256",
			sql`length(${table.sourceHash}) = 64 AND ${table.sourceHash} NOT GLOB '*[^0-9a-f]*'`,
		),
		check(
			"screenshots_full_hash_sha256",
			sql`length(${table.fullHash}) = 64 AND ${table.fullHash} NOT GLOB '*[^0-9a-f]*'`,
		),
		check(
			"screenshots_preview_hash_sha256",
			sql`length(${table.previewHash}) = 64 AND ${table.previewHash} NOT GLOB '*[^0-9a-f]*'`,
		),
		check("screenshots_sort_order_non_negative", sql`${table.sortOrder} >= 0`),
		check("screenshots_is_active_boolean", sql`${table.isActive} IN (0, 1)`),
	],
);

export const updates = sqliteTable(
	"updates",
	{
		id: text("id").notNull().primaryKey(),
		publishedAt: text("published_at").notNull(),
		title: text("title").notNull(),
		description: text("description").notNull(),
		snapshot: text("snapshot").notNull(),
	},
	(table) => [
		check(
			"updates_id_safe",
			sql`length(${table.id}) BETWEEN 1 AND 100 AND ${table.id} NOT GLOB '*[^a-zA-Z0-9_-]*'`,
		),
		check(
			"updates_published_at_canonical_utc",
			sql`length(${table.publishedAt}) = 24 AND strftime('%Y-%m-%dT%H:%M:%fZ', ${table.publishedAt}) = ${table.publishedAt}`,
		),
		check(
			"updates_title_canonical",
			sql`length(${table.title}) BETWEEN 1 AND 120 AND trim(${table.title}) = ${table.title}`,
		),
		check(
			"updates_description_canonical",
			sql`length(${table.description}) BETWEEN 1 AND 2000 AND trim(${table.description}) = ${table.description}`,
		),
		check(
			"updates_snapshot_json",
			sql`json_valid(${table.snapshot}) AND length(${table.snapshot}) BETWEEN 1 AND 1048576`,
		),
		index("updates_published_at_desc_id_idx").on(
			sql`${table.publishedAt} DESC`,
			table.id,
		),
	],
);

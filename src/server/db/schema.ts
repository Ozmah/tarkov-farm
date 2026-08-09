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

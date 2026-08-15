CREATE TEMP TABLE `__unsupported_document_ids_require_manual_remediation` (`id` integer PRIMARY KEY);--> statement-breakpoint
INSERT INTO `__unsupported_document_ids_require_manual_remediation` (`id`) SELECT 1 WHERE EXISTS (SELECT 1 FROM `documents` WHERE `id` NOT IN ('blueprints-technical', 'classified', 'financial', 'medical', 'pmc-personnel', 'project', 'technical', 'test', 'user'));--> statement-breakpoint
INSERT INTO `__unsupported_document_ids_require_manual_remediation` (`id`) VALUES (1);--> statement-breakpoint
DROP TABLE `__unsupported_document_ids_require_manual_remediation`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_documents` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL UNIQUE,
	`description` text,
	`image_path` text NOT NULL UNIQUE,
	`image_width` integer NOT NULL,
	`image_height` integer NOT NULL,
	`image_hash` text NOT NULL,
	`acquisition_type` text DEFAULT 'raid' NOT NULL,
	`acquisition_source` text,
	`is_filterable` integer DEFAULT true NOT NULL,
	`is_wildcard` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	CONSTRAINT "documents_id_not_null" CHECK("id" IS NOT NULL),
	CONSTRAINT "documents_image_width_valid" CHECK("image_width" BETWEEN 1 AND 768),
	CONSTRAINT "documents_image_height_valid" CHECK("image_height" BETWEEN 1 AND 768),
	CONSTRAINT "documents_image_hash_sha256" CHECK(length("image_hash") = 64 AND "image_hash" NOT GLOB '*[^0-9a-f]*'),
	CONSTRAINT "documents_acquisition_type_allowed" CHECK("acquisition_type" IN ('raid', 'store')),
	CONSTRAINT "documents_store_source_required" CHECK("acquisition_type" != 'store' OR "acquisition_source" IS NOT NULL),
	CONSTRAINT "documents_wildcard_not_filterable" CHECK("is_wildcard" = 0 OR "is_filterable" = 0),
	CONSTRAINT "documents_is_filterable_boolean" CHECK("is_filterable" IN (0, 1)),
	CONSTRAINT "documents_is_wildcard_boolean" CHECK("is_wildcard" IN (0, 1)),
	CONSTRAINT "documents_is_active_boolean" CHECK("is_active" IN (0, 1))
);
--> statement-breakpoint
INSERT INTO `__new_documents`(
	`id`, `name`, `description`, `image_path`, `image_width`, `image_height`, `image_hash`,
	`acquisition_type`, `acquisition_source`, `is_filterable`, `is_wildcard`, `is_active`
)
SELECT
	`id`,
	`name`,
	`description`,
	CASE `id`
		WHEN 'blueprints-technical' THEN '/documents/blueprints-technical-e5dca5ab7147.webp'
		WHEN 'classified' THEN '/documents/classified-edbfe0cd7107.webp'
		WHEN 'financial' THEN '/documents/financial-f8b5b8dd4b8e.webp'
		WHEN 'medical' THEN '/documents/medical-860662003971.webp'
		WHEN 'pmc-personnel' THEN '/documents/pmc-personnel-ae1a69b11606.webp'
		WHEN 'project' THEN '/documents/project-958d25de7e61.webp'
		WHEN 'technical' THEN '/documents/technical-b63e56fc40f0.webp'
		WHEN 'test' THEN '/documents/test-e923af07aa44.webp'
		WHEN 'user' THEN '/documents/user-9be8f2ab67f8.webp'
	END,
	CASE `id`
		WHEN 'blueprints-technical' THEN 580
		WHEN 'classified' THEN 614
		WHEN 'financial' THEN 689
		WHEN 'medical' THEN 487
		WHEN 'pmc-personnel' THEN 587
		WHEN 'project' THEN 530
		WHEN 'technical' THEN 625
		WHEN 'test' THEN 590
		WHEN 'user' THEN 591
	END,
	CASE `id`
		WHEN 'blueprints-technical' THEN 610
		WHEN 'classified' THEN 569
		WHEN 'financial' THEN 559
		WHEN 'medical' THEN 602
		WHEN 'pmc-personnel' THEN 536
		WHEN 'project' THEN 377
		WHEN 'technical' THEN 522
		WHEN 'test' THEN 531
		WHEN 'user' THEN 555
	END,
	CASE `id`
		WHEN 'blueprints-technical' THEN 'e5dca5ab71473bd6758fcc7dfeb830d8e2e5b142c49314deaeae5f4f955b8824'
		WHEN 'classified' THEN 'edbfe0cd71076977a22848ac7c7b4a561010c593566b1d2bd2dde530ffb89035'
		WHEN 'financial' THEN 'f8b5b8dd4b8e59aca178ed4b806f9fd8cfcd69ca9a21b191d398cde1e0c7e48a'
		WHEN 'medical' THEN '860662003971c03ed7923367205e395d47316a5b9f679d6266ac6ee051fcfa55'
		WHEN 'pmc-personnel' THEN 'ae1a69b116067459ae8a8a78899db8b4a932bd15d26976cfa1da72e62f488175'
		WHEN 'project' THEN '958d25de7e61a085e5cc8e9bf9dbe059e2bf82fbd87315ea4bc65ccf7f07ff60'
		WHEN 'technical' THEN 'b63e56fc40f08e718530db93a1a6c7bcebc2fb3a8162e8dc3c2fba8784480461'
		WHEN 'test' THEN 'e923af07aa4486fc5bcf3efe728b4259dafe189ec139fd662dc2442033faaf8d'
		WHEN 'user' THEN '9be8f2ab67f8c663b79f3cebf17863fad0b44e12ee7bdede313f0d4409eec92f'
	END,
	`acquisition_type`,
	`acquisition_source`,
	`is_filterable`,
	`is_wildcard`,
	`is_active`
FROM `documents`;--> statement-breakpoint
DROP TABLE `documents`;--> statement-breakpoint
ALTER TABLE `__new_documents` RENAME TO `documents`;--> statement-breakpoint
PRAGMA foreign_keys=ON;

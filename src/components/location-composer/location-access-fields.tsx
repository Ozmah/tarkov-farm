import type {
	LocationComposerDraft,
	LocationDraftChange,
} from "@/components/location-composer/location-draft";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Field,
	FieldDescription,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

type LocationAccessFieldsProps = {
	availableDocuments: Array<{ id: string; name: string }>;
	availableKeys: Array<{
		id: string;
		imageHeight: number;
		imagePath: string;
		imageWidth: number;
		name: string;
	}>;
	disabled: boolean;
	draft: LocationComposerDraft;
	onDraftChange: LocationDraftChange;
};

export function LocationAccessFields({
	availableDocuments,
	availableKeys,
	disabled,
	draft,
	onDraftChange,
}: LocationAccessFieldsProps) {
	const selectedRequiredKeyIds = new Set(draft.requiredKeyIds);

	return (
		<>
			<FieldSet>
				<FieldLegend variant="label">Document</FieldLegend>
				<FieldDescription>
					Each location represents one document and keeps its own description
					and screenshots.
				</FieldDescription>
				{availableDocuments.length > 0 ? (
					<RadioGroup
						disabled={disabled}
						name="documentId"
						value={draft.documentId}
						onValueChange={(documentId) =>
							onDraftChange("documentId", documentId)
						}
						required
					>
						{availableDocuments.map((document) => (
							<Field key={document.id} orientation="horizontal">
								<RadioGroupItem
									id={`document-${document.id}`}
									value={document.id}
								/>
								<FieldLabel
									htmlFor={`document-${document.id}`}
									className="cursor-pointer normal-case tracking-normal"
								>
									{document.name}
								</FieldLabel>
							</Field>
						))}
					</RadioGroup>
				) : (
					<FieldDescription>
						No farmable documents are assigned to this map.
					</FieldDescription>
				)}
			</FieldSet>

			<FieldSet>
				<FieldLegend variant="label">Required keys</FieldLegend>
				<FieldDescription>
					Select every key needed to access this location. Leave empty when no
					key is required.
				</FieldDescription>
				{availableKeys.length > 0 ? (
					<div className="grid max-h-72 gap-1 overflow-auto border p-2">
						{availableKeys.map((key) => {
							const checked = selectedRequiredKeyIds.has(key.id);
							return (
								<Field key={key.id} orientation="horizontal" className="p-2">
									<Checkbox
										disabled={disabled}
										id={`required-key-${key.id}`}
										checked={checked}
										onCheckedChange={(nextChecked) =>
											onDraftChange(
												"requiredKeyIds",
												nextChecked
													? [...draft.requiredKeyIds, key.id]
													: draft.requiredKeyIds.filter((id) => id !== key.id),
											)
										}
									/>
									<img
										src={key.imagePath}
										alt=""
										width={key.imageWidth}
										height={key.imageHeight}
										loading="lazy"
										decoding="async"
										className="size-8 object-contain"
									/>
									<FieldLabel
										htmlFor={`required-key-${key.id}`}
										className="cursor-pointer normal-case tracking-normal"
									>
										{key.name}
									</FieldLabel>
								</Field>
							);
						})}
					</div>
				) : (
					<FieldDescription>
						No keys are cataloged for this map.
					</FieldDescription>
				)}
			</FieldSet>
		</>
	);
}

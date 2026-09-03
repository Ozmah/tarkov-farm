import { UploadSimpleIcon } from "@phosphor-icons/react";
import { type ComponentProps, type ReactNode, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FilePickerProps = {
	accept: string;
	buttonAriaLabel?: string;
	buttonLabel: string;
	buttonSize?: ComponentProps<typeof Button>["size"];
	buttonVariant?: ComponentProps<typeof Button>["variant"];
	className?: string;
	describedBy?: string;
	disabled?: boolean;
	dropLabel?: string;
	helpText?: ReactNode;
	icon?: ReactNode;
	inputLabel?: string;
	multiple?: boolean;
	regionLabel?: string;
	variant?: "button" | "dropzone";
	onFilesSelected: (files: File[]) => void;
};

export function FilePicker({
	accept,
	buttonAriaLabel,
	buttonLabel,
	buttonSize,
	buttonVariant,
	className,
	describedBy,
	disabled = false,
	dropLabel,
	helpText,
	icon,
	inputLabel = buttonLabel,
	multiple = false,
	regionLabel = "File upload",
	variant = "dropzone",
	onFilesSelected,
}: FilePickerProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [isDragging, setIsDragging] = useState(false);

	function selectFiles(files: FileList | File[]) {
		if (disabled) return;

		const selectedFiles = Array.from(files);
		const acceptedFiles = multiple ? selectedFiles : selectedFiles.slice(0, 1);
		if (acceptedFiles.length > 0) onFilesSelected(acceptedFiles);
	}

	const input = (
		<input
			ref={inputRef}
			type="file"
			hidden
			accept={accept}
			multiple={multiple}
			aria-label={inputLabel}
			aria-describedby={describedBy}
			disabled={disabled}
			onChange={(event) => {
				const files = Array.from(event.currentTarget.files ?? []);
				event.currentTarget.value = "";
				selectFiles(files);
			}}
		/>
	);
	const button = (
		<Button
			type="button"
			aria-label={buttonAriaLabel}
			variant={buttonVariant}
			size={buttonSize}
			disabled={disabled}
			onClick={() => inputRef.current?.click()}
		>
			<UploadSimpleIcon data-icon="inline-start" aria-hidden="true" />
			{buttonLabel}
		</Button>
	);

	if (variant === "button") {
		return (
			<div className={cn("inline-flex", className)}>
				{input}
				{button}
			</div>
		);
	}

	return (
		<section
			aria-label={regionLabel}
			className={cn(
				"flex min-h-44 flex-col items-center justify-center gap-3 border border-input border-dashed bg-background p-5 text-center transition-colors",
				isDragging && "border-primary bg-primary/10",
				className,
			)}
			onDragEnter={(event) => {
				event.preventDefault();
				if (!disabled) setIsDragging(true);
			}}
			onDragOver={(event) => {
				event.preventDefault();
				event.dataTransfer.dropEffect = disabled ? "none" : "copy";
			}}
			onDragLeave={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
					setIsDragging(false);
				}
			}}
			onDrop={(event) => {
				event.preventDefault();
				setIsDragging(false);
				selectFiles(event.dataTransfer.files);
			}}
		>
			{input}
			{icon}
			{dropLabel ? <p className="font-medium text-sm">{dropLabel}</p> : null}
			{button}
			{helpText ? (
				<p className="text-muted-foreground text-xs">{helpText}</p>
			) : null}
		</section>
	);
}

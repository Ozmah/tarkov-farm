import { FileZipIcon, ShieldCheckIcon } from "@phosphor-icons/react";

import { FilePicker } from "@/components/ui/file-picker";

type ContributionArchivePickerProps = {
	disabled: boolean;
	error?: string;
	onFile: (file: File) => void;
};

export function ContributionArchivePicker({
	disabled,
	error,
	onFile,
}: ContributionArchivePickerProps) {
	return (
		<main className="flex min-h-[70svh] flex-1 items-center justify-center p-5 sm:p-8">
			<div className="w-full max-w-2xl border border-border bg-card p-6 shadow-[0_12px_32px_-20px_color-mix(in_oklch,var(--foreground)_45%,transparent)] sm:p-10">
				<div className="flex size-12 items-center justify-center bg-primary text-primary-foreground">
					<FileZipIcon className="size-6" aria-hidden="true" />
				</div>
				<h2 className="mt-8 text-balance font-heading font-semibold text-2xl uppercase tracking-tight sm:text-3xl">
					Open a contribution bundle
				</h2>
				<p className="mt-3 max-w-[65ch] text-muted-foreground">
					Contribution ZIPs come from other people, so the editor checks the
					file structure, manifest, screenshots, and map references before
					showing anything. If something is missing or out of place, the bundle
					is rejected.
				</p>
				<div className="mt-6 flex items-start gap-3 border-border border-y py-4 text-sm">
					<ShieldCheckIcon
						className="mt-0.5 size-5 shrink-0 text-primary"
						aria-hidden="true"
					/>
					<p>
						Nothing is saved until you inspect and select individual locations.
						Review changes remain in memory until import.
					</p>
				</div>
				{error ? (
					<p role="alert" className="mt-5 text-destructive text-sm">
						{error}
					</p>
				) : null}
				<FilePicker
					accept=".zip,application/zip"
					buttonLabel={disabled ? "Verifying bundle…" : "Choose ZIP bundle"}
					buttonSize="lg"
					className="mt-6"
					disabled={disabled}
					dropLabel="Drop a ZIP bundle here"
					helpText="One contribution ZIP bundle at a time."
					icon={
						<FileZipIcon
							className="size-6 text-muted-foreground"
							aria-hidden="true"
						/>
					}
					regionLabel="Contribution bundle upload"
					onFilesSelected={([file]) => {
						if (file) onFile(file);
					}}
				/>
			</div>
		</main>
	);
}

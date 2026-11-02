import { type ShouldBlockFn, useBlocker } from "@tanstack/react-router";
import { useRef, useState } from "react";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type UnsavedChangesGuardOptions = {
	/** Blocks router navigation and page unload while true. */
	blockNavigation: boolean;
	shouldBlockNavigation?: ShouldBlockFn;
};

/**
 * Asks before discarding work, both for router navigation and for in-page
 * actions that replace the composer without changing the URL.
 */
export function useUnsavedChangesGuard({
	blockNavigation,
	shouldBlockNavigation,
}: UnsavedChangesGuardOptions) {
	const allowedRef = useRef(false);
	const [pendingAction, setPendingAction] = useState<{
		run: () => unknown;
	}>();
	const blocker = useBlocker({
		disabled: !blockNavigation,
		enableBeforeUnload: () => blockNavigation,
		shouldBlockFn: (args) =>
			!allowedRef.current && (shouldBlockNavigation?.(args) ?? true),
		withResolver: true,
	});

	/** Runs work whose navigation discards nothing, such as the refresh after a save. */
	async function allow<Result>(action: () => Result | Promise<Result>) {
		allowedRef.current = true;
		try {
			return await action();
		} finally {
			allowedRef.current = false;
		}
	}

	function confirm(hasChanges: boolean, action: () => unknown) {
		if (hasChanges) setPendingAction({ run: action });
		else void allow(action);
	}

	function discard() {
		if (pendingAction) {
			setPendingAction(undefined);
			void allow(pendingAction.run);
		} else if (blocker.status === "blocked") {
			blocker.proceed();
		}
	}

	function keep() {
		setPendingAction(undefined);
		if (blocker.status === "blocked") blocker.reset();
	}

	return {
		allow,
		confirm,
		discard,
		keep,
		pending: pendingAction
			? ("action" as const)
			: blocker.status === "blocked"
				? ("navigation" as const)
				: undefined,
	};
}

type UnsavedChangesDialogProps = {
	confirmLabel: string;
	description: string;
	open: boolean;
	title: string;
	onDiscard: () => void;
	onKeep: () => void;
};

export function UnsavedChangesDialog({
	confirmLabel,
	description,
	open,
	title,
	onDiscard,
	onKeep,
}: UnsavedChangesDialogProps) {
	return (
		<AlertDialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onKeep();
			}}
		>
			<AlertDialogContent size="sm">
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Keep editing</AlertDialogCancel>
					<AlertDialogAction variant="destructive" onClick={onDiscard}>
						{confirmLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}

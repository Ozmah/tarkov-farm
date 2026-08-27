import type { ReactNode } from "react";

import {
	CatalogShell,
	type CatalogShellProps,
} from "@/components/catalog-shell";

type WorkspaceShellProps = Omit<
	CatalogShellProps,
	| "layoutMode"
	| "layoutModeError"
	| "layoutModePending"
	| "onLayoutModeChange"
	| "sidebarNavigation"
	| "sidebarNavigationLabel"
	| "verticalLocationsControl"
> & {
	navigation: ReactNode;
	navigationLabel: string;
};

export function WorkspaceShell({
	navigation,
	navigationLabel,
	...props
}: WorkspaceShellProps) {
	return (
		<CatalogShell
			{...props}
			sidebarNavigation={navigation}
			sidebarNavigationLabel={navigationLabel}
		/>
	);
}

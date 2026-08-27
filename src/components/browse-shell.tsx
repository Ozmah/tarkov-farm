import {
	CatalogShell,
	type CatalogShellProps,
} from "@/components/catalog-shell";

type BrowseShellProps = Omit<
	CatalogShellProps,
	"sidebarNavigation" | "sidebarNavigationLabel"
>;

export function BrowseShell(props: BrowseShellProps) {
	return <CatalogShell {...props} />;
}

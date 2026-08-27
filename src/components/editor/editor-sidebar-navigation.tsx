import {
	ArrowLeftIcon,
	CrosshairIcon,
	FileZipIcon,
	NewspaperClippingIcon,
} from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";

import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@/components/ui/sidebar";

export type EditorSection = "locations" | "import" | "updates";

type EditorSidebarNavigationProps = {
	activeSection: EditorSection;
	documentSearch?: string;
	onSectionSelect: (section: EditorSection) => void;
	selectedLocationId?: string;
	selectedMap?: { id: string; isActive: boolean };
	selectedViewKey?: string;
};

export function EditorSidebarNavigation({
	activeSection,
	documentSearch,
	onSectionSelect,
	selectedLocationId,
	selectedMap,
	selectedViewKey,
}: EditorSidebarNavigationProps) {
	const { isMobile, setOpenMobile } = useSidebar();

	function closeMobileSidebar() {
		if (isMobile) setOpenMobile(false);
	}

	function selectSection(section: EditorSection) {
		closeMobileSidebar();
		onSectionSelect(section);
	}

	return (
		<SidebarMenu>
			<EditorSectionItem
				activeSection={activeSection}
				icon={CrosshairIcon}
				label="Edit locations"
				section="locations"
				onSelect={selectSection}
			/>
			<EditorSectionItem
				activeSection={activeSection}
				icon={FileZipIcon}
				label="Review contributions"
				section="import"
				onSelect={selectSection}
			/>
			<EditorSectionItem
				activeSection={activeSection}
				icon={NewspaperClippingIcon}
				label="Manage updates"
				section="updates"
				onSelect={selectSection}
			/>
			<SidebarMenuItem className="mt-1 border-sidebar-border border-t pt-2">
				<SidebarMenuButton
					render={
						selectedMap?.isActive ? (
							<Link
								to="/maps/$mapId"
								params={{ mapId: selectedMap.id }}
								search={{
									documents: documentSearch,
									location: selectedLocationId,
									view: selectedViewKey,
								}}
								onClick={closeMobileSidebar}
							/>
						) : (
							<Link
								to="/"
								search={{ documents: documentSearch }}
								onClick={closeMobileSidebar}
							/>
						)
					}
				>
					<ArrowLeftIcon aria-hidden="true" />
					<span>Exit editor</span>
				</SidebarMenuButton>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}

type EditorSectionItemProps = {
	activeSection: EditorSection;
	icon: React.ComponentType<{ "aria-hidden"?: boolean; className?: string }>;
	label: string;
	onSelect: (section: EditorSection) => void;
	section: EditorSection;
};

function EditorSectionItem({
	activeSection,
	icon: Icon,
	label,
	onSelect,
	section,
}: EditorSectionItemProps) {
	const isActive = activeSection === section;

	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				render={<button type="button" onClick={() => onSelect(section)} />}
				isActive={isActive}
				aria-current={isActive ? "page" : undefined}
				className="border-transparent border-l data-active:border-sidebar-primary"
			>
				<Icon aria-hidden={true} />
				<span>{label}</span>
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

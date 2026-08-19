import {
	createContext,
	type ReactNode,
	useContext,
	useEffectEvent,
	useLayoutEffect,
	useMemo,
} from "react";
import type { MapSelectionSource } from "@/lib/analytics";
import type { LayoutMode } from "@/lib/layout-mode";

export type PublicLayoutConfiguration = {
	editorSearch?: {
		documents?: string;
		image?: string;
		location?: string;
		map?: string;
	};
	headerMeta?: string;
	sidebarPanel?: (closePanel: () => void) => ReactNode;
	verticalPanel?: ReactNode;
};

type PublicLayoutContextValue = {
	layoutMode: LayoutMode;
	prepareMapNavigation: (
		map: { id: string; name: string },
		source: MapSelectionSource,
	) => void;
	setConfiguration: (configuration?: PublicLayoutConfiguration) => void;
};

const PublicLayoutContext = createContext<PublicLayoutContextValue | null>(
	null,
);

export function PublicLayoutConfigurationProvider({
	children,
	layoutMode,
	prepareMapNavigation,
	setConfiguration,
}: {
	children: ReactNode;
	layoutMode: LayoutMode;
	prepareMapNavigation: PublicLayoutContextValue["prepareMapNavigation"];
	setConfiguration: PublicLayoutContextValue["setConfiguration"];
}) {
	const value = useMemo(
		() => ({ layoutMode, prepareMapNavigation, setConfiguration }),
		[layoutMode, prepareMapNavigation, setConfiguration],
	);

	return (
		<PublicLayoutContext.Provider value={value}>
			{children}
		</PublicLayoutContext.Provider>
	);
}

export function usePublicLayoutMode() {
	const context = useContext(PublicLayoutContext);

	if (!context) {
		throw new Error(
			"usePublicLayoutMode must be used within PublicLayoutConfigurationProvider",
		);
	}

	return context.layoutMode;
}

export function usePreparePublicMapNavigation() {
	const context = useContext(PublicLayoutContext);

	if (!context) {
		throw new Error(
			"usePreparePublicMapNavigation must be used within PublicLayoutConfigurationProvider",
		);
	}

	return context.prepareMapNavigation;
}

export function usePublicLayoutConfiguration(
	configuration: PublicLayoutConfiguration,
	configurationKey: string,
) {
	const context = useContext(PublicLayoutContext);

	if (!context) {
		throw new Error(
			"usePublicLayoutConfiguration must be used within PublicLayoutConfigurationProvider",
		);
	}

	const applyConfiguration = useEffectEvent(() => {
		context.setConfiguration(configuration);
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: configurationKey controls when the current route configuration is installed.
	useLayoutEffect(() => {
		applyConfiguration();

		return () => context.setConfiguration(undefined);
	}, [configurationKey, context]);
}

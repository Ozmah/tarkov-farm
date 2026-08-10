import {
	createContext,
	type ReactNode,
	useContext,
	useLayoutEffect,
	useMemo,
} from "react";

export type PublicLayoutConfiguration = {
	currentMapImageId?: string;
	editorSearch?: {
		documents?: string;
		image?: string;
		location?: string;
		map?: string;
	};
	headerMeta?: string;
	sidebarPanel?: (closePanel: () => void) => ReactNode;
};

type PublicLayoutContextValue = {
	prepareMapNavigation: (map: { id: string; name: string }) => void;
	setConfiguration: (configuration?: PublicLayoutConfiguration) => void;
};

const PublicLayoutContext = createContext<PublicLayoutContextValue | null>(
	null,
);

export function PublicLayoutConfigurationProvider({
	children,
	prepareMapNavigation,
	setConfiguration,
}: {
	children: ReactNode;
	prepareMapNavigation: PublicLayoutContextValue["prepareMapNavigation"];
	setConfiguration: PublicLayoutContextValue["setConfiguration"];
}) {
	const value = useMemo(
		() => ({ prepareMapNavigation, setConfiguration }),
		[prepareMapNavigation, setConfiguration],
	);

	return (
		<PublicLayoutContext.Provider value={value}>
			{children}
		</PublicLayoutContext.Provider>
	);
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

	// biome-ignore lint/correctness/useExhaustiveDependencies: configurationKey is the explicit semantic identity of this route configuration.
	useLayoutEffect(() => {
		context.setConfiguration(configuration);

		return () => context.setConfiguration(undefined);
	}, [configurationKey, context]);
}

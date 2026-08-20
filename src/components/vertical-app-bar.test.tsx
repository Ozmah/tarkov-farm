// @vitest-environment jsdom

import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	RouterProvider,
} from "@tanstack/react-router";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { VerticalAppBar } from "./vertical-app-bar";

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("VerticalAppBar", () => {
	it("keeps map destinations behind a stable drill-in menu", async () => {
		await renderAppBar();
		fireEvent.click(screen.getByRole("button", { name: "Open menu" }));

		const mainNavigation = await screen.findByRole("navigation", {
			name: "Vertical mode navigation",
		});
		expect(
			within(mainNavigation).getByRole("button", { name: "Maps" }),
		).toBeTruthy();
		expect(screen.queryByRole("link", { name: "Customs" })).toBeNull();

		fireEvent.click(
			within(mainNavigation).getByRole("button", { name: "Maps" }),
		);

		const mapNavigation = await screen.findByRole("navigation", {
			name: "Map navigation",
		});
		expect(
			within(mapNavigation).getByRole("link", { name: "Customs" }),
		).toBeTruthy();
		expect(
			within(mapNavigation).getByRole("link", { name: "Factory" }),
		).toBeTruthy();
		const backButton = screen.getByRole("button", {
			name: "Back to main menu",
		});
		expect(backButton).toBeTruthy();
		await waitFor(() => expect(document.activeElement).toBe(backButton));

		fireEvent.click(backButton);
		await waitFor(() =>
			expect(
				screen.getByRole("navigation", { name: "Vertical mode navigation" }),
			).toBeTruthy(),
		);
		expect(screen.queryByRole("link", { name: "Customs" })).toBeNull();
		await waitFor(() =>
			expect(document.activeElement).toBe(
				screen.getByRole("button", { name: "Maps" }),
			),
		);
	});
});

async function renderAppBar() {
	Object.defineProperty(window, "scrollTo", {
		configurable: true,
		value: vi.fn(),
	});
	const rootRoute = createRootRoute({
		component: () => (
			<VerticalAppBar
				catalog={{
					editorAvailable: false,
					maps: [
						{ id: "customs", name: "Customs" },
						{ id: "factory", name: "Factory" },
					],
				}}
				headerTitle="Home"
				layoutMode="vertical"
				onLayoutModeChange={vi.fn()}
			/>
		),
	});
	const routes = [
		createRoute({ getParentRoute: () => rootRoute, path: "/" }),
		createRoute({ getParentRoute: () => rootRoute, path: "/documents" }),
		createRoute({ getParentRoute: () => rootRoute, path: "/updates" }),
		createRoute({ getParentRoute: () => rootRoute, path: "/about" }),
		createRoute({ getParentRoute: () => rootRoute, path: "/contribute" }),
		createRoute({ getParentRoute: () => rootRoute, path: "/editor" }),
		createRoute({ getParentRoute: () => rootRoute, path: "/maps/$mapId" }),
	];
	const router = createRouter({
		history: createMemoryHistory({ initialEntries: ["/"] }),
		routeTree: rootRoute.addChildren(routes),
	});

	await router.load();
	render(<RouterProvider router={router} />);
	await waitFor(() =>
		expect(screen.getByRole("button", { name: "Open menu" })).toBeTruthy(),
	);
}

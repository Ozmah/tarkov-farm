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
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EditorSidebarNavigation } from "@/components/editor/editor-sidebar-navigation";
import { WorkspaceShell } from "@/components/workspace-shell";

beforeEach(() => {
	window.scrollTo = vi.fn();
	Object.defineProperty(window, "innerWidth", {
		configurable: true,
		value: 1280,
	});
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: vi.fn().mockImplementation(() => ({
			matches: false,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		})),
	});
});

afterEach(cleanup);

describe("WorkspaceShell", () => {
	it("replaces public navigation with editor-only navigation", async () => {
		const onSectionSelect = vi.fn();
		const rootRoute = createRootRoute();
		const editorRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/editor",
			component: () => (
				<WorkspaceShell
					catalog={{
						documents: [],
						documentMaps: [],
						editorAvailable: false,
						maps: [{ id: "customs", name: "Customs" }],
					}}
					currentMapId="customs"
					headerTitle="Contribution reviewer"
					navigationLabel="Editor navigation"
					navigation={
						<EditorSidebarNavigation
							activeSection="import"
							documentSearch="secure-flash-drive"
							selectedLocationId="dorms-214"
							selectedMap={{ id: "customs", isActive: true }}
							selectedViewKey="main"
							onSectionSelect={onSectionSelect}
						/>
					}
				>
					<p>Private editor</p>
				</WorkspaceShell>
			),
		});
		const homeRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/",
			component: () => null,
		});
		const mapRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/maps/$mapId",
			component: () => null,
		});
		const router = createRouter({
			routeTree: rootRoute.addChildren([homeRoute, editorRoute, mapRoute]),
			history: createMemoryHistory({ initialEntries: ["/editor"] }),
		});

		render(<RouterProvider router={router} />);

		const editorNavigation = await screen.findByRole("navigation", {
			name: "Editor navigation",
		});
		expect(editorNavigation).toBeTruthy();
		expect(screen.getByRole("link", { name: "Customs" })).toBeTruthy();
		expect(
			screen
				.getByRole("button", { name: "Review contributions" })
				.getAttribute("aria-current"),
		).toBe("page");
		expect(screen.queryByText("Documents")).toBeNull();
		expect(screen.queryByText("Updates")).toBeNull();
		expect(screen.queryByText("About")).toBeNull();
		expect(screen.queryByText("Want to help?")).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "Edit locations" }));
		expect(onSectionSelect).toHaveBeenCalledWith("locations");

		const exitLink = screen.getByRole("link", { name: "Exit editor" });
		expect(exitLink.getAttribute("href")).toContain("/maps/customs");
		await waitFor(() =>
			expect(screen.getByText("Private editor")).toBeTruthy(),
		);
	});
});

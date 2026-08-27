// @vitest-environment jsdom

import {
	createMemoryHistory,
	createRootRoute,
	createRoute,
	createRouter,
	Link,
	RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FocusedWorkspaceShell } from "@/components/focused-workspace-shell";

beforeEach(() => {
	window.scrollTo = vi.fn();
});

afterEach(cleanup);

describe("FocusedWorkspaceShell", () => {
	it("provides focused full-width workspace chrome", async () => {
		const rootRoute = createRootRoute();
		const workspaceRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/contribute/editor",
			component: () => (
				<FocusedWorkspaceShell
					title="Contribution editor"
					actions={
						<Link to="/contribute" search={{ map: undefined }}>
							Contribution guide
						</Link>
					}
				>
					<p>Editor canvas</p>
				</FocusedWorkspaceShell>
			),
		});
		const contributionRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/contribute",
			component: () => null,
		});
		const homeRoute = createRoute({
			getParentRoute: () => rootRoute,
			path: "/",
			component: () => null,
		});
		const router = createRouter({
			routeTree: rootRoute.addChildren([
				homeRoute,
				contributionRoute,
				workspaceRoute,
			]),
			history: createMemoryHistory({
				initialEntries: ["/contribute/editor"],
			}),
		});

		render(<RouterProvider router={router} />);

		await waitFor(() =>
			expect(
				screen.getByRole("heading", {
					level: 1,
					name: "Contribution editor",
				}),
			).toBeTruthy(),
		);
		expect(
			screen.getByRole("navigation", { name: "Workspace navigation" }),
		).toBeTruthy();
		expect(screen.getByRole("main").id).toBe("main-content");
		expect(
			screen
				.getByRole("link", { name: "Skip to content" })
				.getAttribute("href"),
		).toBe("#main-content");
		expect(screen.getByText("Editor canvas")).toBeTruthy();
		expect(screen.queryByText("Want to help?")).toBeNull();
	});
});

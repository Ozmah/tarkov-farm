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

import { MapNavigationStrip } from "./map-navigation-strip";

const maps = [
	{ id: "customs", name: "Customs" },
	{ id: "factory", name: "Factory" },
	{ id: "ground-zero", name: "Ground Zero" },
	{ id: "interchange", name: "Interchange" },
	{ id: "the-lab", name: "The Lab" },
];

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("MapNavigationStrip", () => {
	it("orders compact map labels and their subordinate views", async () => {
		await renderStrip();
		const navigation = screen.getByRole("navigation", {
			name: "Maps and map views",
		});
		const labels = within(navigation)
			.getAllByRole("link")
			.map((link) => link.textContent);

		expect(labels).toEqual([
			"Customs",
			"Dorms",
			"Factory",
			"GZero",
			"Inter",
			"Labs",
		]);
		expect(
			screen
				.getByRole("link", { name: "Customs — Dorms" })
				.getAttribute("href"),
		).toContain("/maps/customs");
		expect(
			screen
				.getByRole("link", { name: "Customs — Dorms" })
				.getAttribute("href"),
		).toContain("view=dorms");
		expect(
			screen
				.getByRole("link", { name: "Customs — Dorms" })
				.getAttribute("aria-current"),
		).toBe("page");
		expect(
			screen
				.getByRole("link", { name: "Customs main map" })
				.hasAttribute("aria-current"),
		).toBe(false);
	});

	it("starts pending navigation only for ordinary clicks to another map", async () => {
		const onMapNavigationStart = vi.fn();
		await renderStrip(onMapNavigationStart);
		const factory = screen.getByRole("link", { name: "Factory main map" });

		factory.addEventListener("click", (event) => event.preventDefault(), {
			once: true,
		});
		fireEvent.click(factory, { ctrlKey: true });
		expect(onMapNavigationStart).not.toHaveBeenCalled();
		fireEvent.click(factory);
		expect(onMapNavigationStart).toHaveBeenCalledWith({
			id: "factory",
			name: "Factory",
		});
	});

	it("reveals explicit scroll controls only when destinations overflow", async () => {
		await renderStrip();
		const navigation = screen.getByRole("navigation", {
			name: "Maps and map views",
		});
		const scroller = navigation.querySelector("div");
		expect(scroller).not.toBeNull();
		Object.defineProperties(scroller as HTMLDivElement, {
			clientWidth: { configurable: true, value: 300 },
			scrollLeft: { configurable: true, value: 0, writable: true },
			scrollWidth: { configurable: true, value: 900 },
		});
		const scrollBy = vi.fn();
		Object.defineProperty(scroller, "scrollBy", {
			configurable: true,
			value: scrollBy,
		});
		fireEvent.scroll(scroller as HTMLDivElement);

		const moreButton = await screen.findByRole("button", {
			name: "Show more maps",
		});
		fireEvent.click(moreButton);
		expect(scrollBy).toHaveBeenCalledWith({ behavior: "auto", left: 240 });
		expect(
			screen.queryByRole("button", { name: "Show previous maps" }),
		).toBeNull();
	});
});

async function renderStrip(onMapNavigationStart = vi.fn()) {
	Object.defineProperty(window, "scrollTo", {
		configurable: true,
		value: vi.fn(),
	});
	Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
		configurable: true,
		value: vi.fn(),
	});
	const rootRoute = createRootRoute({
		component: () => (
			<MapNavigationStrip
				documentSearch="financial"
				maps={maps}
				onMapNavigationStart={onMapNavigationStart}
				selectedMapId="customs"
				selectedViewKey="dorms"
			/>
		),
	});
	const mapRoute = createRoute({
		getParentRoute: () => rootRoute,
		path: "/maps/$mapId",
		validateSearch: (search: Record<string, unknown>) => ({
			documents:
				typeof search.documents === "string" ? search.documents : undefined,
			location:
				typeof search.location === "string" ? search.location : undefined,
			view: typeof search.view === "string" ? search.view : undefined,
		}),
	});
	const router = createRouter({
		history: createMemoryHistory({
			initialEntries: ["/maps/customs?documents=financial&view=dorms"],
		}),
		routeTree: rootRoute.addChildren([mapRoute]),
	});
	await router.load();
	render(<RouterProvider router={router} />);
	await waitFor(() =>
		expect(
			screen.getByRole("navigation", { name: "Maps and map views" }),
		).toBeTruthy(),
	);
}

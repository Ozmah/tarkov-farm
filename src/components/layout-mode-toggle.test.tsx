// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LayoutModeToggle } from "./layout-mode-toggle";

afterEach(cleanup);

describe("LayoutModeToggle", () => {
	it("exposes the persisted layout preference as an accessible switch", () => {
		const onLayoutModeChange = vi.fn();
		render(
			<LayoutModeToggle
				id="vertical-mode"
				layoutMode="standard"
				onLayoutModeChange={onLayoutModeChange}
			/>,
		);

		const toggle = screen.getByRole("switch", { name: "Vertical mode" });
		expect(toggle.getAttribute("aria-checked")).toBe("false");
		fireEvent.click(toggle);
		expect(onLayoutModeChange).toHaveBeenCalledWith("vertical");
	});

	it("reports persistence failures next to the disabled control", () => {
		render(
			<LayoutModeToggle
				id="vertical-mode"
				layoutMode="vertical"
				disabled
				error="Could not save this preference. Try again."
				onLayoutModeChange={vi.fn()}
			/>,
		);

		const toggle = screen.getByRole("switch", { name: "Vertical mode" });
		expect(toggle.hasAttribute("data-disabled")).toBe(true);
		expect(toggle.getAttribute("aria-describedby")).toBe("vertical-mode-error");
		expect(screen.getByRole("status").textContent).toContain(
			"Could not save this preference",
		);
	});
});

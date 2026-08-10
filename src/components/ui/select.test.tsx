// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./select";

describe("Select labels", () => {
	it("renders the configured label instead of the selected id", () => {
		const items = [{ value: "customs-main", label: "Main map" }];

		render(
			<Select items={items} value="customs-main">
				<SelectTrigger aria-label="Map view">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectGroup>
						<SelectItem value="customs-main">Main map</SelectItem>
					</SelectGroup>
				</SelectContent>
			</Select>,
		);

		expect(screen.getByRole("combobox").textContent).toContain("Main map");
		expect(screen.getByRole("combobox").textContent).not.toContain(
			"customs-main",
		);
	});
});

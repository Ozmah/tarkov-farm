// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LighthouseReworkNotice } from "./lighthouse-rework-notice";

afterEach(cleanup);

describe("Lighthouse rework notice", () => {
	it("stays dismissed during a visit and reappears on the next visit", () => {
		const { rerender } = render(<LighthouseReworkNotice />);
		expect(screen.getByRole("complementary")).toBeTruthy();
		fireEvent.click(
			screen.getByRole("button", { name: "Dismiss Lighthouse map update" }),
		);
		rerender(<LighthouseReworkNotice />);
		expect(screen.queryByRole("complementary")).toBeNull();
		rerender(<div />);
		rerender(<LighthouseReworkNotice />);
		expect(screen.getByRole("complementary")).toBeTruthy();
	});
});

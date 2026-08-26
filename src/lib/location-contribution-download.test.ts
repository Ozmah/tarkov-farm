// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadLocationContributionArchive } from "./location-contribution-archive";

afterEach(() => {
	vi.restoreAllMocks();
	vi.useRealTimers();
});

describe("location contribution archive download", () => {
	it("uses a temporary object URL and revokes it after download initialization", () => {
		vi.useFakeTimers();
		const createObjectUrl = vi.fn(() => "blob:contribution");
		const revokeObjectUrl = vi.fn();
		Object.defineProperty(URL, "createObjectURL", {
			configurable: true,
			value: createObjectUrl,
		});
		Object.defineProperty(URL, "revokeObjectURL", {
			configurable: true,
			value: revokeObjectUrl,
		});
		let clickedAnchor: HTMLAnchorElement | undefined;
		vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
			this: HTMLAnchorElement,
		) {
			clickedAnchor = this;
		});

		downloadLocationContributionArchive({
			blob: new Blob(["zip"], { type: "application/zip" }),
			filename: "contribution.zip",
		});

		expect(createObjectUrl).toHaveBeenCalledOnce();
		expect(clickedAnchor?.download).toBe("contribution.zip");
		expect(clickedAnchor?.href).toBe("blob:contribution");
		expect(clickedAnchor?.isConnected).toBe(false);
		expect(revokeObjectUrl).not.toHaveBeenCalled();

		vi.advanceTimersByTime(60_000);
		expect(revokeObjectUrl).toHaveBeenCalledWith("blob:contribution");
	});
});

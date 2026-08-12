import { describe, expect, it } from "vitest";

import { createSerializedExecutor } from "./serialized-executor";

describe("serialized executor", () => {
	it("runs concurrent operations one at a time", async () => {
		const run = createSerializedExecutor();
		const order: string[] = [];
		let releaseFirst = () => {};
		const gate = new Promise<void>((resolve) => {
			releaseFirst = resolve;
		});
		const first = run(async () => {
			order.push("first-start");
			await gate;
			order.push("first-end");
		});
		const second = run(async () => {
			order.push("second-start", "second-end");
		});

		await Promise.resolve();
		expect(order).not.toContain("second-start");
		releaseFirst();
		await Promise.all([first, second]);

		expect(order).toEqual([
			"first-start",
			"first-end",
			"second-start",
			"second-end",
		]);
	});

	it("continues after a failed operation", async () => {
		const run = createSerializedExecutor();
		await expect(
			run(async () => {
				throw new Error("failed");
			}),
		).rejects.toThrow("failed");
		await expect(run(async () => "ok")).resolves.toBe("ok");
	});
});

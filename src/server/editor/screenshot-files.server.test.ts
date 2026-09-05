import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { spawnMock } = vi.hoisted(() => ({ spawnMock: vi.fn() }));

vi.mock("node:child_process", () => ({ spawn: spawnMock }));

import { executeBunProcessor } from "./screenshot-files.server";

beforeEach(() => spawnMock.mockReset());

afterEach(() => vi.useRealTimers());

describe("screenshot processor", () => {
	it("kills processors that run for more than two minutes", async () => {
		vi.useFakeTimers();
		const subprocess = createSubprocess({ closeOnKill: false });
		spawnMock.mockReturnValue(subprocess);
		const result = executeBunProcessor(["worker.ts"]);
		const rejection = expect(result).rejects.toThrow(
			"timed out after 120 seconds",
		);

		await vi.advanceTimersByTimeAsync(120_000);

		expect(subprocess.kill).toHaveBeenCalledWith("SIGKILL");
		await vi.advanceTimersByTimeAsync(5_000);
		await rejection;
	});

	it("caps diagnostics returned by a failed processor", async () => {
		const subprocess = createSubprocess();
		spawnMock.mockReturnValue(subprocess);
		const result = executeBunProcessor(["worker.ts"]);

		subprocess.stderr.write("x".repeat(70_000));
		subprocess.emit("close", 1);

		const error = await result.catch((reason: unknown) => reason);
		expect(error).toBeInstanceOf(Error);
		expect((error as Error).message).toMatch(/\[truncated\]$/);
		expect((error as Error).message.length).toBeLessThanOrEqual(64 * 1024);
	});

	it("kills processors that return unbounded metadata", async () => {
		const subprocess = createSubprocess();
		spawnMock.mockReturnValue(subprocess);
		const result = executeBunProcessor(["worker.ts"]);

		subprocess.stdout.write("x".repeat(70_000));

		expect(subprocess.kill).toHaveBeenCalledWith("SIGKILL");
		await expect(result).rejects.toThrow("returned too much data");
	});
});

function createSubprocess({ closeOnKill = true } = {}) {
	const subprocess = Object.assign(new EventEmitter(), {
		kill: vi.fn(),
		stderr: new PassThrough(),
		stdout: new PassThrough(),
	});
	subprocess.kill.mockImplementation(() => {
		if (closeOnKill) subprocess.emit("close", null, "SIGKILL");
		return true;
	});
	return subprocess;
}

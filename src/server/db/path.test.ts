import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import { getDatabasePath } from "./path";

vi.mock("node:fs", () => ({ existsSync: vi.fn() }));

afterEach(() => {
	vi.resetAllMocks();
	vi.unstubAllEnvs();
});

describe("getDatabasePath", () => {
	test.each(["local", "production"])(
		"uses the project hideout for local execution with APP_ENV=%s",
		(appEnvironment) => {
			vi.stubEnv("APP_ENV", appEnvironment);
			vi.stubEnv("NODE_ENV", "production");
			vi.mocked(existsSync).mockReturnValue(false);
			expect(getDatabasePath()).toBe(
				resolve(process.cwd(), "hideout/tarkov.sqlite"),
			);
			expect(existsSync).toHaveBeenCalledWith("/etc/tarkov-farm-container");
		},
	);

	test("uses the fixed container path when the image marker exists", () => {
		vi.stubEnv("APP_ENV", "local");
		vi.mocked(existsSync).mockReturnValue(true);
		expect(getDatabasePath()).toBe("/hideout/tarkov.sqlite");
	});

	test("allows temporary project paths without environment configuration", () => {
		expect(
			getDatabasePath({ projectRoot: "/tmp/test-project", isContainer: false }),
		).toBe("/tmp/test-project/hideout/tarkov.sqlite");
	});
});

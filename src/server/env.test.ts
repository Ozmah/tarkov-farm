import { describe, expect, test } from "vitest";
import { getServerEnvironment } from "./env";

describe("getServerEnvironment", () => {
	test("rejects missing required variables", () => {
		expect(() => getServerEnvironment({})).toThrowError(
			"Missing required environment variables: APP_ENV, DATABASE_PATH",
		);
	});

	test("rejects an unsupported application environment", () => {
		expect(() =>
			getServerEnvironment({
				APP_ENV: "staging",
				DATABASE_PATH: "./data/app.sqlite",
			}),
		).toThrowError("APP_ENV must be one of: local, production.");
	});

	test("normalizes valid values", () => {
		expect(
			getServerEnvironment({
				APP_ENV: " LOCAL ",
				DATABASE_PATH: " ./data/app.sqlite ",
			}),
		).toEqual({
			appEnvironment: "local",
			databasePath: "./data/app.sqlite",
		});
	});
});

import { describe, expect, test } from "vitest";
import { getServerEnvironment } from "./env";

describe("getServerEnvironment", () => {
	test("rejects missing required variables", () => {
		expect(() => getServerEnvironment({})).toThrowError(
			"Missing required environment variables: APP_ENV",
		);
	});

	test("rejects an unsupported application environment", () => {
		expect(() =>
			getServerEnvironment({
				APP_ENV: "staging",
			}),
		).toThrowError("APP_ENV must be one of: local, production.");
	});

	test("normalizes valid values", () => {
		expect(
			getServerEnvironment({
				APP_ENV: " LOCAL ",
			}),
		).toEqual({
			appEnvironment: "local",
		});
	});

	test("accepts production without database configuration", () => {
		expect(getServerEnvironment({ APP_ENV: "production" })).toEqual({
			appEnvironment: "production",
		});
	});
});

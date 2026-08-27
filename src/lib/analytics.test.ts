import { afterEach, describe, expect, test } from "vitest";
import {
	captureAnalyticsEvent,
	disableAnalytics,
	enableAnalytics,
	isDoNotTrackEnabled,
	readAnalyticsAcquisitionProperties,
	readAnalyticsRouteProperties,
	registerAnalyticsClient,
	setAnalyticsAcquisitionContext,
	stripAnalyticsEventUrlDetails,
	stripAnalyticsUrlDetails,
} from "./analytics";

afterEach(disableAnalytics);

describe("analytics privacy helpers", () => {
	test("classifies public routes without including search state", () => {
		expect(readAnalyticsRouteProperties("/")).toEqual({ route: "home" });
		expect(readAnalyticsRouteProperties("/maps/customs")).toEqual({
			map_id: "customs",
			route: "map",
		});
		expect(readAnalyticsRouteProperties("/contribute")).toEqual({
			route: "contribute",
		});
		expect(readAnalyticsRouteProperties("/contribute/editor")).toEqual({
			route: "contribution_editor",
		});
		expect(readAnalyticsRouteProperties("/unknown")).toEqual({
			route: "other",
		});
	});

	test("removes query strings and fragments from analytics URLs", () => {
		expect(
			stripAnalyticsUrlDetails(
				"https://tarkov.farm/maps/customs?documents=classified#marker",
				"https://tarkov.farm",
			),
		).toBe("https://tarkov.farm/maps/customs");
		expect(
			stripAnalyticsUrlDetails(
				"/documents?source=discord",
				"https://tarkov.farm",
			),
		).toBe("https://tarkov.farm/documents");
	});

	test("removes nested URL details from Web Vitals payloads", () => {
		expect(
			stripAnalyticsEventUrlDetails(
				{
					$web_vitals_LCP_event: {
						attribution: {
							url: "/images/map.webp?signature=secret#preview",
						},
						entries: [
							{
								name: "https://tarkov.farm/maps/customs?documents=secret",
							},
						],
						navigationURL:
							"https://tarkov.farm/maps/customs?documents=secret#marker",
					},
					label: "leave?non-url#properties-alone",
				},
				"https://tarkov.farm",
			),
		).toEqual({
			$web_vitals_LCP_event: {
				attribution: {
					url: "https://tarkov.farm/images/map.webp",
				},
				entries: [{ name: "https://tarkov.farm/maps/customs" }],
				navigationURL: "https://tarkov.farm/maps/customs",
			},
			label: "leave?non-url#properties-alone",
		});
	});

	test("recognizes current and legacy do-not-track signals", () => {
		expect(isDoNotTrackEnabled("1")).toBe(true);
		expect(isDoNotTrackEnabled(undefined, "YES")).toBe(true);
		expect(isDoNotTrackEnabled("0", null, undefined)).toBe(false);
	});

	test("captures only allowlisted campaign values and a referrer domain", () => {
		expect(
			readAnalyticsAcquisitionProperties(
				"https://tarkov.farm/maps/customs?utm_source=discord&utm_medium=social&utm_campaign=season-1&utm_content=private&gclid=secret#marker",
				"https://www.google.com/search?q=private",
			),
		).toEqual({
			$referring_domain: "www.google.com",
			utm_campaign: "season-1",
			utm_medium: "social",
			utm_source: "discord",
		});
	});

	test("rejects unsafe campaign values and internal referrers", () => {
		expect(
			readAnalyticsAcquisitionProperties(
				"https://tarkov.farm/?utm_source=user@example.com&utm_medium=https%3A%2F%2Fexample.com&utm_campaign=%3Cprivate%3E",
				"https://tarkov.farm/maps/customs?private=true",
			),
		).toEqual({ $referring_domain: "$direct" });
	});
});

describe("analytics event queue", () => {
	test("flushes early events after the client loads", () => {
		const captured: Array<{ eventName: string; properties: unknown }> = [];

		setAnalyticsAcquisitionContext({
			$referring_domain: "discord.com",
			utm_campaign: "season-1",
			utm_medium: "social",
			utm_source: "discord",
		});
		enableAnalytics();
		captureAnalyticsEvent("map_selected", {
			map_id: "customs",
			source: "home",
		});
		captureAnalyticsEvent("screenshot_opened", {
			location_id: "location-1",
			map_id: "customs",
			screenshot_count: 2,
			screenshot_index: 0,
		});
		captureAnalyticsEvent("layout_mode_used", {
			layout_mode: "vertical",
		});
		registerAnalyticsClient({
			capture: (eventName, properties) => {
				captured.push({ eventName, properties });
			},
		});

		expect(captured).toEqual([
			{
				eventName: "map_selected",
				properties: {
					$referring_domain: "discord.com",
					map_id: "customs",
					source: "home",
					utm_campaign: "season-1",
					utm_medium: "social",
					utm_source: "discord",
				},
			},
			{
				eventName: "screenshot_opened",
				properties: {
					$referring_domain: "discord.com",
					location_id: "location-1",
					map_id: "customs",
					screenshot_count: 2,
					screenshot_index: 0,
					utm_campaign: "season-1",
					utm_medium: "social",
					utm_source: "discord",
				},
			},
			{
				eventName: "layout_mode_used",
				properties: {
					$referring_domain: "discord.com",
					layout_mode: "vertical",
					utm_campaign: "season-1",
					utm_medium: "social",
					utm_source: "discord",
				},
			},
		]);
	});
});

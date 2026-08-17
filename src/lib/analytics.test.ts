import { describe, expect, test } from "vitest";
import {
	captureAnalyticsEvent,
	disableAnalytics,
	enableAnalytics,
	readAnalyticsRouteProperties,
	registerAnalyticsClient,
	stripAnalyticsEventUrlDetails,
	stripAnalyticsUrlDetails,
} from "./analytics";

describe("analytics privacy helpers", () => {
	test("classifies public routes without including search state", () => {
		expect(readAnalyticsRouteProperties("/")).toEqual({ route: "home" });
		expect(readAnalyticsRouteProperties("/maps/customs")).toEqual({
			map_id: "customs",
			route: "map",
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
});

describe("analytics event queue", () => {
	test("flushes early events after the client loads", () => {
		const captured: Array<{ eventName: string; properties: unknown }> = [];

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
		registerAnalyticsClient({
			capture: (eventName, properties) => {
				captured.push({ eventName, properties });
			},
		});

		expect(captured).toEqual([
			{
				eventName: "map_selected",
				properties: { map_id: "customs", source: "home" },
			},
			{
				eventName: "screenshot_opened",
				properties: {
					location_id: "location-1",
					map_id: "customs",
					screenshot_count: 2,
					screenshot_index: 0,
				},
			},
		]);
		disableAnalytics();
	});
});

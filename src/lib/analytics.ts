import type { LayoutMode } from "./layout-mode";

export type MapSelectionSource =
	| "documents"
	| "home"
	| "map_strip"
	| "sidebar"
	| "topbar";

export type MapControlSource = "sidebar" | "topbar";

export type LocationViewSource = "direct" | "marker" | MapControlSource;

export type AnalyticsAcquisitionProperties = {
	$referring_domain: string;
	utm_campaign?: string;
	utm_medium?: string;
	utm_source?: string;
};

type AnalyticsRoute =
	| "about"
	| "contribute"
	| "documents"
	| "home"
	| "map"
	| "other"
	| "updates";

export type AppErrorContext =
	| {
			error_code: "catalog_unavailable";
			operation: "catalog_load";
	  }
	| {
			error_code:
				| "map_data_unavailable"
				| "map_image_missing"
				| "map_image_unavailable";
			operation: "map_load";
	  }
	| {
			error_code:
				| "location_data_unavailable"
				| "location_screenshots_unavailable";
			operation: "location_load";
	  }
	| {
			error_code: "unexpected_application_error";
			operation: "route_load";
	  }
	| {
			error_code: "updates_unavailable";
			operation: "updates_load";
	  };

type AppErrorProperties = AppErrorContext & { route: AnalyticsRoute };

type AnalyticsEventProperties = {
	$pageview: {
		$current_url: string;
		$pathname: string;
		map_id?: string;
		route: AnalyticsRoute;
	};
	app_error: AppErrorProperties;
	map_selected: {
		map_id: string;
		source: MapSelectionSource;
	};
	document_filter_changed: {
		document_ids: string[];
		map_id: string;
		selected_count: number;
		source: MapControlSource;
	};
	location_viewed: {
		document_id: string;
		location_id: string;
		map_id: string;
		source: LocationViewSource;
	};
	layout_mode_changed: {
		layout_mode: LayoutMode;
		previous_layout_mode: LayoutMode;
	};
	layout_mode_used: {
		layout_mode: LayoutMode;
	};
	screenshot_opened: {
		location_id: string;
		map_id: string;
		screenshot_count: number;
		screenshot_index: number;
	};
};

type AnalyticsEventName = keyof AnalyticsEventProperties;
type EnrichedAnalyticsEventProperties<EventName extends AnalyticsEventName> =
	AnalyticsEventProperties[EventName] & Partial<AnalyticsAcquisitionProperties>;
type AnalyticsClient = {
	capture: (
		eventName: AnalyticsEventName,
		properties: EnrichedAnalyticsEventProperties<AnalyticsEventName>,
	) => unknown;
};
type PendingAnalyticsEvent = {
	[EventName in AnalyticsEventName]: {
		eventName: EventName;
		properties: EnrichedAnalyticsEventProperties<EventName>;
	};
}[AnalyticsEventName];

const ALLOWED_CAMPAIGN_PROPERTIES = [
	"utm_source",
	"utm_medium",
	"utm_campaign",
] as const;
const SAFE_CAMPAIGN_VALUE = /^[A-Za-z0-9][A-Za-z0-9._~-]{0,79}$/;
const MAX_PENDING_EVENTS = 50;
const ROUTE_BY_PATHNAME = {
	"/": "home",
	"/about": "about",
	"/contribute": "contribute",
	"/documents": "documents",
	"/updates": "updates",
} as const;
const URL_PROPERTY_NAMES = new Set([
	"$current_url",
	"$initial_current_url",
	"$referrer",
	"$session_entry_url",
	"filename",
	"href",
	"name",
	"navigationURL",
	"scriptURL",
	"sourceURL",
	"url",
]);
const pendingEvents: PendingAnalyticsEvent[] = [];
let analyticsAcquisitionContext: AnalyticsAcquisitionProperties | undefined;
let analyticsClient: AnalyticsClient | undefined;
let analyticsEnabled = false;

export function captureAnalyticsEvent<EventName extends AnalyticsEventName>(
	eventName: EventName,
	properties: AnalyticsEventProperties[EventName],
) {
	if (!analyticsEnabled) {
		return;
	}

	const enrichedProperties = {
		...properties,
		...analyticsAcquisitionContext,
	};

	if (analyticsClient) {
		analyticsClient.capture(eventName, enrichedProperties);
		return;
	}

	if (pendingEvents.length === MAX_PENDING_EVENTS) {
		pendingEvents.shift();
	}

	pendingEvents.push({
		eventName,
		properties: enrichedProperties,
	} as PendingAnalyticsEvent);
}

export function enableAnalytics() {
	analyticsEnabled = true;
}

export function setAnalyticsAcquisitionContext(
	properties: AnalyticsAcquisitionProperties,
) {
	analyticsAcquisitionContext = properties;
}

export function registerAnalyticsClient(client: AnalyticsClient) {
	analyticsClient = client;

	for (const event of pendingEvents.splice(0)) {
		client.capture(event.eventName, event.properties);
	}
}

export function disableAnalytics() {
	analyticsEnabled = false;
	analyticsClient = undefined;
	analyticsAcquisitionContext = undefined;
	pendingEvents.length = 0;
}

export function isDoNotTrackEnabled(...values: unknown[]) {
	return values.some(
		(value) =>
			typeof value === "string" &&
			(value.toLowerCase() === "1" || value.toLowerCase() === "yes"),
	);
}

export function readAnalyticsAcquisitionProperties(
	currentUrl: string,
	referrer: string,
): AnalyticsAcquisitionProperties {
	const properties: AnalyticsAcquisitionProperties = {
		$referring_domain: readReferringDomain(currentUrl, referrer),
	};

	try {
		const searchParams = new URL(currentUrl).searchParams;

		for (const propertyName of ALLOWED_CAMPAIGN_PROPERTIES) {
			const value = searchParams.get(propertyName)?.trim();

			if (value && SAFE_CAMPAIGN_VALUE.test(value)) {
				properties[propertyName] = value;
			}
		}
	} catch {
		// Invalid URLs contribute no campaign data.
	}

	return properties;
}

export function readAnalyticsRouteProperties(pathname: string) {
	const mapMatch = pathname.match(/^\/maps\/([^/]+)$/);

	if (mapMatch?.[1]) {
		return { map_id: mapMatch[1], route: "map" } as const;
	}

	const route =
		ROUTE_BY_PATHNAME[pathname as keyof typeof ROUTE_BY_PATHNAME] ?? "other";

	return { route } as const;
}

export function stripAnalyticsUrlDetails(value: string, origin: string) {
	try {
		const url = new URL(value, origin);
		return `${url.origin}${url.pathname}`;
	} catch {
		return value.split(/[?#]/, 1)[0] ?? value;
	}
}

export function stripAnalyticsEventUrlDetails(
	properties: Record<string, unknown>,
	origin: string,
) {
	return stripNestedUrlDetails(properties, origin) as Record<string, unknown>;
}

function stripNestedUrlDetails(
	value: unknown,
	origin: string,
	propertyName?: string,
): unknown {
	if (typeof value === "string") {
		return propertyName &&
			URL_PROPERTY_NAMES.has(propertyName) &&
			/[?#]/.test(value)
			? stripAnalyticsUrlDetails(value, origin)
			: value;
	}

	if (Array.isArray(value)) {
		return value.map((item) => stripNestedUrlDetails(item, origin));
	}

	if (!value || typeof value !== "object") {
		return value;
	}

	return Object.fromEntries(
		Object.entries(value).map(([key, nestedValue]) => [
			key,
			stripNestedUrlDetails(nestedValue, origin, key),
		]),
	);
}

function readReferringDomain(currentUrl: string, referrer: string) {
	if (!referrer) {
		return "$direct";
	}

	try {
		const current = new URL(currentUrl);
		const referring = new URL(referrer);

		if (
			(referring.protocol !== "http:" && referring.protocol !== "https:") ||
			referring.origin === current.origin
		) {
			return "$direct";
		}

		return referring.hostname.toLowerCase();
	} catch {
		return "$direct";
	}
}

export type MapSelectionSource =
	| "current_map"
	| "documents"
	| "home"
	| "sidebar";

export type LocationViewSource = "direct" | "marker" | "sidebar";

type AnalyticsRoute =
	| "about"
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
		source: "sidebar";
	};
	location_viewed: {
		document_id: string;
		location_id: string;
		map_id: string;
		source: LocationViewSource;
	};
	screenshot_opened: {
		location_id: string;
		map_id: string;
		screenshot_count: number;
		screenshot_index: number;
	};
};

type AnalyticsEventName = keyof AnalyticsEventProperties;
type AnalyticsClient = {
	capture: (
		eventName: AnalyticsEventName,
		properties: AnalyticsEventProperties[AnalyticsEventName],
	) => unknown;
};
type PendingAnalyticsEvent = {
	[EventName in AnalyticsEventName]: {
		eventName: EventName;
		properties: AnalyticsEventProperties[EventName];
	};
}[AnalyticsEventName];

const MAX_PENDING_EVENTS = 50;
const ROUTE_BY_PATHNAME = {
	"/": "home",
	"/about": "about",
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
let analyticsClient: AnalyticsClient | undefined;
let analyticsEnabled = false;

export function captureAnalyticsEvent<EventName extends AnalyticsEventName>(
	eventName: EventName,
	properties: AnalyticsEventProperties[EventName],
) {
	if (!analyticsEnabled) {
		return;
	}

	if (analyticsClient) {
		analyticsClient.capture(eventName, properties);
		return;
	}

	if (pendingEvents.length === MAX_PENDING_EVENTS) {
		pendingEvents.shift();
	}

	pendingEvents.push({ eventName, properties } as PendingAnalyticsEvent);
}

export function enableAnalytics() {
	analyticsEnabled = true;
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
	pendingEvents.length = 0;
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

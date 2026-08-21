import { useRouterState } from "@tanstack/react-router";
import type {
	BeforeSendFn,
	PostHogConfig,
} from "posthog-js/dist/module.slim.no-external";
import { useEffect, useRef } from "react";
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
} from "@/lib/analytics";

const WEB_VITALS_SAMPLE_RATE = 0.2;
const postHogKey = import.meta.env.VITE_POSTHOG_KEY?.trim();
let analyticsCaptureAllowed = false;
let initializedPostHog:
	| Parameters<typeof registerAnalyticsClient>[0]
	| undefined;
const removeUrlDetails: BeforeSendFn = (event) => {
	if (!event || !analyticsCaptureAllowed || browserRequestsDoNotTrack()) {
		return null;
	}

	try {
		return {
			...event,
			properties: stripAnalyticsEventUrlDetails(
				event.properties,
				window.location.origin,
			),
		};
	} catch {
		return null;
	}
};

const postHogOptions = {
	api_host:
		import.meta.env.VITE_POSTHOG_HOST?.trim() || "https://us.i.posthog.com",
	defaults: "2026-06-25",
	debug: false,
	persistence: "memory",
	disable_persistence: true,
	autocapture: false,
	capture_pageview: false,
	capture_pageleave: false,
	disable_capture_url_hashes: true,
	// Automatic exception payloads can contain arbitrary messages and URLs.
	capture_exceptions: false,
	capture_performance: {
		network_timing: false,
		web_vitals: true,
		web_vitals_allowed_metrics: ["LCP", "CLS", "FCP", "INP"],
		web_vitals_attribution: true,
	},
	capture_heatmaps: false,
	capture_dead_clicks: false,
	rageclick: false,
	disable_session_recording: true,
	disable_surveys: true,
	disable_surveys_automatic_display: true,
	disable_scroll_properties: true,
	disable_external_dependency_loading: true,
	advanced_disable_flags: true,
	cookieless_mode: "always",
	person_profiles: "never",
	ip: false,
	respect_dnt: true,
	property_denylist: ["$search_engine", "ph_keyword"],
	// Acquisition uses an explicit privacy allowlist captured before the SDK loads.
	save_campaign_params: false,
	save_referrer: false,
	mask_personal_data_properties: true,
} satisfies Partial<PostHogConfig>;

export function AnalyticsProvider() {
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const previousPathnameRef = useRef<string | undefined>(undefined);

	useEffect(() => {
		if (
			import.meta.env.SSR ||
			!import.meta.env.PROD ||
			!postHogKey ||
			browserRequestsDoNotTrack()
		) {
			return;
		}

		let cancelled = false;
		analyticsCaptureAllowed = true;
		setAnalyticsAcquisitionContext(
			readAnalyticsAcquisitionProperties(
				window.location.href,
				document.referrer,
			),
		);
		enableAnalytics();

		if (initializedPostHog) {
			registerAnalyticsClient(initializedPostHog);
			return () => {
				analyticsCaptureAllowed = false;
				disableAnalytics();
			};
		}

		void Promise.all([
			import("posthog-js/dist/module.slim.no-external"),
			import("posthog-js/customizations"),
			import("posthog-js/dist/extension-bundles"),
			import("posthog-js/dist/web-vitals-with-attribution"),
		])
			.then(
				([
					{ default: postHog },
					{ sampleByEvent },
					{ AnalyticsExtensions },
				]) => {
					if (cancelled) {
						return;
					}

					if (browserRequestsDoNotTrack()) {
						analyticsCaptureAllowed = false;
						disableAnalytics();
						return;
					}

					postHog.init(postHogKey, {
						...postHogOptions,
						__extensionClasses: {
							webVitalsAutocapture: AnalyticsExtensions.webVitalsAutocapture,
						},
						before_send: [
							removeUrlDetails,
							sampleByEvent(["$web_vitals"], WEB_VITALS_SAMPLE_RATE),
						],
						loaded: (client) => {
							initializedPostHog = client;
							registerAnalyticsClient(client);
						},
					});
				},
			)
			.catch(() => {
				if (!cancelled) {
					analyticsCaptureAllowed = false;
					disableAnalytics();
				}
			});

		return () => {
			cancelled = true;
			analyticsCaptureAllowed = false;
			disableAnalytics();
		};
	}, []);

	useEffect(() => {
		if (import.meta.env.SSR || !import.meta.env.PROD || !postHogKey) {
			return;
		}

		if (pathname === previousPathnameRef.current) {
			return;
		}

		previousPathnameRef.current = pathname;
		captureAnalyticsEvent("$pageview", {
			$current_url: `${window.location.origin}${pathname}`,
			$pathname: pathname,
			...readAnalyticsRouteProperties(pathname),
		});
	}, [pathname]);

	return null;
}

function browserRequestsDoNotTrack() {
	const legacyNavigator = navigator as Navigator & { msDoNotTrack?: string };
	const legacyWindow = window as Window & { doNotTrack?: string };

	return isDoNotTrackEnabled(
		navigator.doNotTrack,
		legacyNavigator.msDoNotTrack,
		legacyWindow.doNotTrack,
	);
}

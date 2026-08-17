import { useRouterState } from "@tanstack/react-router";
import type { BeforeSendFn, PostHogConfig } from "posthog-js";
import { useEffect, useRef } from "react";
import {
	captureAnalyticsEvent,
	disableAnalytics,
	enableAnalytics,
	readAnalyticsRouteProperties,
	registerAnalyticsClient,
	stripAnalyticsEventUrlDetails,
} from "@/lib/analytics";

const WEB_VITALS_SAMPLE_RATE = 0.2;
const postHogKey = import.meta.env.VITE_POSTHOG_KEY?.trim();
const removeUrlDetails: BeforeSendFn = (event) => {
	if (!event) {
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
	autocapture: false,
	capture_pageview: false,
	capture_pageleave: false,
	disable_capture_url_hashes: true,
	capture_exceptions: {
		capture_unhandled_errors: true,
		capture_unhandled_rejections: true,
		capture_console_errors: false,
	},
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
		if (import.meta.env.SSR || !import.meta.env.PROD || !postHogKey) {
			return;
		}

		let cancelled = false;
		enableAnalytics();

		void Promise.all([
			import("posthog-js"),
			import("posthog-js/customizations"),
			import("posthog-js/dist/exception-autocapture"),
			import("posthog-js/dist/web-vitals-with-attribution"),
		])
			.then(([{ default: postHog }, { sampleByEvent }]) => {
				if (cancelled) {
					return;
				}

				postHog.init(postHogKey, {
					...postHogOptions,
					before_send: [
						removeUrlDetails,
						sampleByEvent(["$web_vitals"], WEB_VITALS_SAMPLE_RATE),
					],
					loaded: registerAnalyticsClient,
				});
			})
			.catch(() => {
				if (!cancelled) {
					disableAnalytics();
				}
			});

		return () => {
			cancelled = true;
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

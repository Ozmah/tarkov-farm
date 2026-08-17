import type { ErrorComponentProps } from "@tanstack/react-router";
import { useRouter, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import {
	type AppErrorContext,
	captureAnalyticsEvent,
	readAnalyticsRouteProperties,
} from "@/lib/analytics";

type RouteErrorProps = ErrorComponentProps & {
	analyticsError: AppErrorContext;
};

export function RouteError({ analyticsError, error }: RouteErrorProps) {
	const router = useRouter();
	const pathname = useRouterState({
		select: (state) => state.location.pathname,
	});
	const route = readAnalyticsRouteProperties(pathname).route;
	const capturedErrorRef = useRef<unknown>(undefined);

	useEffect(() => {
		if (capturedErrorRef.current === error) {
			return;
		}

		capturedErrorRef.current = error;
		captureAnalyticsEvent("app_error", { ...analyticsError, route });
	}, [analyticsError, error, route]);

	return (
		<main className="isolate flex min-h-svh items-center justify-center p-6">
			<div className="flex max-w-md flex-col items-center gap-4 text-center">
				<p className="font-heading text-muted-foreground text-sm uppercase tracking-wide">
					Application error
				</p>
				<h1 className="text-balance font-heading font-medium text-3xl tracking-tight">
					The requested data could not be loaded
				</h1>
				<p className="text-pretty text-base text-muted-foreground">
					Try the request again. If it continues failing, the database may be
					unavailable.
				</p>
				<Button type="button" onClick={() => void router.invalidate()}>
					Try again
				</Button>
			</div>
		</main>
	);
}

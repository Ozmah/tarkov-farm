import {
	ArrowSquareOutIcon,
	GithubLogoIcon,
	XLogoIcon,
} from "@phosphor-icons/react";
import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { buttonVariants } from "@/components/ui/button";
import { readCatalogId } from "@/lib/catalog-search";
import {
	buildLocationIssueUrl,
	CONTRIBUTING_GUIDE_URL,
	X_PROFILE_URL,
} from "@/lib/github-links";
import { createSeoHead } from "@/lib/seo";
import { cn } from "@/lib/utils";

const publicRoute = getRouteApi("/_public");

export const Route = createFileRoute("/_public/contribute")({
	validateSearch: (search: Record<string, unknown>) => ({
		map: readCatalogId(search.map),
	}),
	head: () =>
		createSeoHead({
			title: "Contribute | Tarkov Farm",
			description: "Share a new seasonal document location with Tarkov Farm.",
			pathname: "/contribute",
		}),
	component: ContributePage,
});

function ContributePage() {
	const { map: mapId } = Route.useSearch();
	const catalog = publicRoute.useLoaderData();
	const map = mapId
		? catalog.maps.find((item) => item.id === mapId)
		: undefined;
	const locationIssueUrl = buildLocationIssueUrl({
		currentHref: map ? `/maps/${map.id}` : undefined,
		mapName: map?.name,
	});

	return (
		<div className="min-h-0 flex-1 overflow-auto">
			<div className="mx-auto flex w-full max-w-4xl flex-col gap-12 px-6 py-10 sm:px-10 sm:py-14">
				<header className="flex flex-col gap-4">
					<h1 className="text-balance font-heading font-medium text-4xl tracking-[-0.035em] sm:text-5xl">
						Help Tarkov Farm
					</h1>
					<p className="max-w-[62ch] text-pretty text-base text-muted-foreground leading-relaxed">
						Found a document location that isn't on Tarkov Farm yet? Send it my
						way.
					</p>
					{map ? (
						<p className="font-heading text-primary text-sm uppercase tracking-wide">
							Current map: {map.name}
						</p>
					) : null}
				</header>

				<section
					aria-labelledby="location-rules-title"
					className="flex flex-col gap-6 border-border border-t pt-8"
				>
					<div className="flex flex-col gap-2">
						<h2
							id="location-rules-title"
							className="font-heading font-medium text-2xl tracking-tight"
						>
							Before you send it
						</h2>
						<p className="max-w-[62ch] text-pretty text-muted-foreground text-sm leading-relaxed">
							Right now, I'm only accepting new document locations.
						</p>
					</div>

					<ol className="grid gap-x-8 gap-y-5 text-pretty text-sm leading-relaxed sm:grid-cols-2">
						<ContributionRule number="1">
							Check Tarkov Farm and the open issues first. The location must not
							already be published or waiting for review.
						</ContributionRule>
						<ContributionRule number="2">
							Include the map, document and a clear description of the exact
							place. Add the required key when you know it.
						</ContributionRule>
						<ContributionRule number="3">
							Add at least one clear screenshot you captured in game. It must
							show enough of the surroundings to recognize the location.
						</ContributionRule>
						<ContributionRule number="4">
							If the document is hard to see, circle it in red. Send a wide shot
							and a close-up when one image is not enough.
						</ContributionRule>
					</ol>

					<div className="border border-border bg-card p-5">
						<p className="font-heading font-medium">
							Submit one location per issue.
						</p>
						<p className="mt-1 text-muted-foreground text-sm">
							Found several? Open one issue for each.
						</p>
					</div>
				</section>

				<section
					aria-labelledby="send-location-title"
					className="flex flex-col gap-6 border-border border-t pt-8"
				>
					<h2
						id="send-location-title"
						className="font-heading font-medium text-2xl tracking-tight"
					>
						Send your document
					</h2>

					<div className="grid divide-y divide-border border border-border md:grid-cols-2 md:divide-x md:divide-y-0">
						<ContributionChannel
							title="GitHub"
							description="The easiest way for me to keep track of a contribution and ask follow-up questions."
							href={locationIssueUrl}
							label="Open a GitHub issue"
							icon={<GithubLogoIcon aria-hidden="true" />}
							primary
						/>
						<ContributionChannel
							title="Twitter / X"
							description="Tag @OzmahG in a tweet or send me a DM. The same location and screenshot rules apply."
							href={X_PROFILE_URL}
							label="Open @OzmahG on X"
							icon={<XLogoIcon aria-hidden="true" />}
						/>
					</div>
				</section>

				<section className="border border-primary/40 bg-card p-6 sm:p-8">
					<p className="font-heading font-medium text-xl">
						You're a developer? WTF are you still doing here?
					</p>
					<p className="mt-2 max-w-[60ch] text-muted-foreground text-sm leading-relaxed">
						Read the contribution guide and open a PR.
					</p>
					<a
						href={CONTRIBUTING_GUIDE_URL}
						target="_blank"
						rel="noreferrer"
						className={cn(
							buttonVariants({ variant: "outline", size: "sm" }),
							"mt-5",
						)}
					>
						Read CONTRIBUTING.md
						<ArrowSquareOutIcon aria-hidden="true" data-icon="inline-end" />
					</a>
				</section>
			</div>
		</div>
	);
}

function ContributionRule({
	number,
	children,
}: {
	number: string;
	children: ReactNode;
}) {
	return (
		<li className="flex gap-3">
			<span className="flex size-6 shrink-0 items-center justify-center border border-border font-heading text-xs tabular-nums">
				{number}
			</span>
			<p>{children}</p>
		</li>
	);
}

function ContributionChannel({
	title,
	description,
	href,
	label,
	icon,
	primary = false,
}: {
	title: string;
	description: string;
	href: string;
	label: string;
	icon: ReactNode;
	primary?: boolean;
}) {
	return (
		<article className="flex flex-col items-start p-6">
			<div className="flex items-center gap-2 font-heading font-medium text-lg">
				{icon}
				<h3>{title}</h3>
			</div>
			<p className="mt-3 flex-1 text-pretty text-muted-foreground text-sm leading-relaxed">
				{description}
			</p>
			<a
				href={href}
				target="_blank"
				rel="noreferrer"
				className={cn(
					buttonVariants({
						variant: primary ? "default" : "outline",
						size: "sm",
					}),
					"mt-5",
				)}
			>
				{label}
				<ArrowSquareOutIcon aria-hidden="true" data-icon="inline-end" />
			</a>
		</article>
	);
}

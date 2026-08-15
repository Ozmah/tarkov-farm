import { NewspaperClippingIcon } from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { UpdateFeed } from "@/components/update-feed";
import { getUpdates } from "@/functions/updates";

export const Route = createFileRoute("/_public/updates")({
	head: () => ({
		meta: [
			{ title: "Updates | Tarkov Farm" },
			{
				name: "description",
				content: "New locations, corrections, and improvements to Tarkov Farm.",
			},
		],
	}),
	loader: () => getUpdates(),
	staleTime: 30_000,
	preloadStaleTime: 30_000,
	component: UpdatesRoute,
});

function UpdatesRoute() {
	const updates = Route.useLoaderData();

	return (
		<div className="min-h-0 flex-1 overflow-auto">
			<div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-6 py-10 sm:px-10 sm:py-14">
				<header className="flex flex-col gap-2">
					<h1 className="text-balance font-heading font-medium text-4xl tracking-[-0.035em] sm:text-5xl">
						Updates
					</h1>
					<p className="max-w-[56ch] text-pretty text-base text-muted-foreground leading-relaxed">
						New locations, corrections, and improvements to Tarkov Farm.
					</p>
				</header>

				{updates.length > 0 ? (
					<UpdateFeed updates={updates} />
				) : (
					<Empty className="border border-border">
						<EmptyHeader>
							<EmptyMedia variant="icon">
								<NewspaperClippingIcon aria-hidden="true" />
							</EmptyMedia>
							<EmptyTitle>No updates yet</EmptyTitle>
							<EmptyDescription>
								Published updates will appear here.
							</EmptyDescription>
						</EmptyHeader>
					</Empty>
				)}
			</div>
		</div>
	);
}

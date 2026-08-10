import {
	ArrowSquareOutIcon,
	GithubLogoIcon,
	XLogoIcon,
} from "@phosphor-icons/react";
import { createFileRoute } from "@tanstack/react-router";

import { buttonVariants } from "@/components/ui/button";

export const Route = createFileRoute("/_public/about")({
	head: () => ({
		meta: [
			{ title: "About | Tarkov Farm" },
			{
				name: "description",
				content: "About Tarkov Farm and its creator, Ozmah.",
			},
		],
	}),
	component: AboutPage,
});

function AboutPage() {
	return (
		<div className="min-h-0 flex-1 overflow-auto">
			<main className="mx-auto flex w-full max-w-3xl flex-col gap-10 px-6 py-10 sm:px-10 sm:py-12">
				<section aria-labelledby="about-title" className="flex flex-col gap-4">
					<p className="font-heading text-primary text-sm uppercase tracking-wide">
						About
					</p>
					<h1
						id="about-title"
						className="text-balance font-heading font-medium text-3xl tracking-tight sm:text-4xl"
					>
						Tarkov Farm
					</h1>
					<p className="max-w-[60ch] text-pretty text-base text-muted-foreground leading-relaxed">
						Keeping the wiki tabs chaos at bay.
					</p>
				</section>

				<section
					aria-labelledby="creator-title"
					className="flex flex-col gap-6 border border-border bg-card p-6 sm:p-8"
				>
					<div className="flex flex-col gap-2">
						<p className="text-muted-foreground text-sm uppercase tracking-wide">
							Made by
						</p>
						<h2
							id="creator-title"
							className="font-heading font-medium text-2xl tracking-tight"
						>
							Ozmah
						</h2>
						<p className="text-pretty text-base text-muted-foreground">
							Software Engineer and Tarkov lover.
						</p>
					</div>

					<nav
						aria-label="Ozmah and project links"
						className="flex flex-wrap gap-3"
					>
						<a
							href="https://github.com/Ozmah"
							target="_blank"
							rel="noreferrer"
							className={buttonVariants({ variant: "default", size: "sm" })}
						>
							<GithubLogoIcon aria-hidden="true" data-icon="inline-start" />
							GitHub profile
							<ArrowSquareOutIcon aria-hidden="true" data-icon="inline-end" />
						</a>
						<a
							href="https://x.com/OzmahG"
							target="_blank"
							rel="noreferrer"
							className={buttonVariants({ variant: "outline", size: "sm" })}
						>
							<XLogoIcon aria-hidden="true" data-icon="inline-start" />
							Twitter / X
							<ArrowSquareOutIcon aria-hidden="true" data-icon="inline-end" />
						</a>
						<a
							href="https://github.com/Ozmah/tarkov-farm"
							target="_blank"
							rel="noreferrer"
							className={buttonVariants({ variant: "outline", size: "sm" })}
						>
							Source code
							<ArrowSquareOutIcon aria-hidden="true" data-icon="inline-end" />
						</a>
					</nav>
				</section>

				<p className="max-w-[60ch] text-pretty text-muted-foreground text-sm">
					Tarkov Farm is not affiliated with or endorsed by Battlestate Games.
				</p>
			</main>
		</div>
	);
}

import { formatInstantDate } from "@/lib/date";
import type { PublicUpdate } from "@/lib/publication-updates";

type UpdateFeedProps = {
	updates: PublicUpdate[];
};

export function UpdateFeed({ updates }: UpdateFeedProps) {
	return (
		<ol className="divide-y divide-border border-border border-y">
			{updates.map((update) => (
				<li
					key={update.id}
					className="grid gap-2 py-5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6"
				>
					<time
						dateTime={update.publishedAt}
						className="text-base text-muted-foreground tabular-nums sm:text-sm"
					>
						{formatUpdateDate(update.publishedAt)}
					</time>
					<div className="min-w-0">
						<h3 className="text-balance font-heading font-medium text-lg">
							{update.title}
						</h3>
						<p className="mt-2 max-w-[65ch] whitespace-pre-line text-pretty text-base text-muted-foreground sm:text-sm">
							{update.description}
						</p>
					</div>
				</li>
			))}
		</ol>
	);
}

function formatUpdateDate(value: string) {
	return formatInstantDate(value, {
		dateStyle: "long",
		timeStyle: "short",
	});
}

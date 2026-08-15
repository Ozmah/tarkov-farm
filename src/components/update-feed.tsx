import { formatInstantDate } from "@/lib/date";
import type { PublicUpdate } from "@/lib/publication-updates";
import { cn } from "@/lib/utils";

type UpdateFeedProps = {
	mobileLimit?: number;
	updates: PublicUpdate[];
};

export function UpdateFeed({ mobileLimit, updates }: UpdateFeedProps) {
	return (
		<ol className="divide-y divide-border border-border border-y">
			{updates.map((update, index) => (
				<li
					key={update.id}
					className={cn(
						"relative grid gap-3 py-6 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-8",
						mobileLimit !== undefined &&
							index >= mobileLimit &&
							"hidden sm:grid",
					)}
				>
					<span
						aria-hidden="true"
						className="absolute top-0 left-0 h-px w-10 bg-primary"
					/>
					<time
						dateTime={update.publishedAt}
						className="font-heading text-muted-foreground text-xs uppercase tabular-nums tracking-wide"
					>
						{formatUpdateDate(update.publishedAt)}
					</time>
					<div className="min-w-0">
						<h3 className="text-balance font-heading font-medium text-lg leading-snug">
							{update.title}
						</h3>
						<p className="mt-3 max-w-[68ch] whitespace-pre-line text-pretty text-muted-foreground text-sm leading-relaxed">
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
	});
}

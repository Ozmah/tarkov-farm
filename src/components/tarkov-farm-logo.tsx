import logoUrl from "@/assets/tarkov-farm-logo.svg";
import { cn } from "@/lib/utils";

type TarkovFarmLogoProps = {
	className?: string;
};

export function TarkovFarmLogo({ className }: TarkovFarmLogoProps) {
	return (
		<img
			aria-hidden="true"
			alt=""
			className={cn("block shrink-0", className)}
			draggable={false}
			height={150}
			src={logoUrl}
			width={150}
		/>
	);
}

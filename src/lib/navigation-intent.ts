type NavigationClick = {
	altKey: boolean;
	button: number;
	ctrlKey: boolean;
	defaultPrevented: boolean;
	metaKey: boolean;
	shiftKey: boolean;
};

export function isPlainNavigationClick(event: NavigationClick) {
	return (
		!event.defaultPrevented &&
		event.button === 0 &&
		!event.altKey &&
		!event.ctrlKey &&
		!event.metaKey &&
		!event.shiftKey
	);
}

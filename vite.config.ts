import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const config = defineConfig(({ mode }) => ({
	resolve: { tsconfigPaths: true },
	server: {
		host: "127.0.0.1",
		port: 3000,
		strictPort: false,
	},
	preview: {
		host: "127.0.0.1",
	},
	plugins: [
		devtools({
			injectSource: { enabled: true },
			consolePiping: { enabled: false },
			enhancedLogs: { enabled: false },
			removeDevtoolsOnBuild: true,
			editor: {
				name: "Zed",
				open: async (path, lineNumber, columnNumber) => {
					const { execFile } = await import("node:child_process");
					const location = [path, lineNumber, columnNumber]
						.filter(Boolean)
						.join(":");

					await new Promise<void>((resolve, reject) => {
						execFile("zed", [location], (error) => {
							if (error) reject(error);
							else resolve();
						});
					});
				},
			},
		}),
		tailwindcss(),
		tanstackStart(),
		...(mode === "test"
			? []
			: [
					nitro({
						preset: "bun",
						routeRules: {
							"/documents": {
								headers: {
									"cache-control": "public, max-age=0, must-revalidate",
								},
							},
							"/documents/**": {
								headers: {
									"cache-control": "public, max-age=31536000, immutable",
								},
							},
							"/assets/**": {
								headers: {
									"cache-control": "public, max-age=31536000, immutable",
								},
							},
							"/keys/**": {
								headers: {
									"cache-control": "public, max-age=31536000, immutable",
								},
							},
							"/screenshots/**": {
								headers: {
									"cache-control": "public, max-age=31536000, immutable",
								},
							},
							"/maps/masters/**": {
								headers: {
									"cache-control": "public, max-age=86400",
								},
							},
						},
					}),
				]),
		viteReact(),
	],
}));

export default config;

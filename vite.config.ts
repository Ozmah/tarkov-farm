import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	server: {
		host: "127.0.0.1",
		port: 3000,
		strictPort: true,
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
		viteReact(),
	],
});

export default config;

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
	plugins: [devtools(), tailwindcss(), tanstackStart(), viteReact()],
});

export default config;

import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => ({
  resolve: {
    tsconfigPaths: true,
  },
  plugins: [
    tanstackStart({
      server: { entry: "server" },
    }),
    nitro({ preset: mode === "electron" ? "node-server" : "cloudflare-module" }),
    viteReact(),
    tailwindcss(),
  ],
  test: {
    environment: "jsdom",
    exclude: [...configDefaults.exclude, "**/.worktrees/**"],
    setupFiles: "./tests/setup/setup.ts",
  },
}));

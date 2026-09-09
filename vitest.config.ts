import { defineConfig } from "vitest/config";

// Deliberately standalone from vite.config.ts: that file is wrapped by
// @lovable.dev/vite-tanstack-config, which wires in TanStack Start's SSR
// server entry and Nitro build target — neither of which vitest needs or
// can run under. The pure calculation modules under test have no imports
// of their own, so no plugins are required here.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});

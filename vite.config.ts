// The project's shared TanStack/Vite configuration supplies the framework plugins,
// aliases, build adapter, environment injection, and development server defaults.
// Keep this wrapper until an equivalent standalone configuration is verified.

import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});

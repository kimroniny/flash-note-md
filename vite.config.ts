import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 47821,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 47821,
    strictPort: true,
  },
  build: {
    target: "es2022",
    cssCodeSplit: false,
    assetsInlineLimit: 4096,
    modulePreload: { polyfill: false },
  },
});

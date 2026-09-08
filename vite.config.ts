import { cpSync, mkdirSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

function vditorAssets(): Plugin {
  const copy = () => {
    const from = resolve("node_modules/vditor/dist");
    const to = resolve("public/vditor/dist");
    rmSync(resolve("public/vditor"), { recursive: true, force: true });
    mkdirSync(to, { recursive: true });
    for (const dir of ["js/lute", "js/i18n", "js/icons", "css", "images"]) {
      cpSync(join(from, dir), join(to, dir), { recursive: true });
    }
  };
  return {
    name: "vditor-assets",
    config: copy,
    buildStart: copy,
    configureServer: copy,
  };
}

export default defineConfig({
  base: "./",
  plugins: [vditorAssets()],
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

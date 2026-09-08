import { createReadStream, cpSync, existsSync, mkdirSync, rmSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { defineConfig, type Plugin } from "vite";

function vditorAssets(): Plugin {
  const from = resolve("node_modules/vditor/dist");
  const mime: Record<string, string> = {
    ".css": "text/css; charset=utf-8",
    ".eot": "application/vnd.ms-fontobject",
    ".gif": "image/gif",
    ".js": "text/javascript; charset=utf-8",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".ttf": "font/ttf",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
  };

  const copy = () => {
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
    configureServer(server) {
      copy();
      server.middlewares.use((req, res, next) => {
        const raw = req.url?.split("?")[0] ?? "";
        if (!raw.startsWith("/vditor/dist/")) {
          next();
          return;
        }
        const rel = decodeURIComponent(raw.slice("/vditor/dist/".length));
        if (!rel || rel.includes("\0") || rel.split("/").includes("..")) {
          next();
          return;
        }
        const file = resolve(from, rel);
        const root = from.endsWith(sep) ? from : from + sep;
        if (file !== from && !file.startsWith(root)) {
          next();
          return;
        }
        if (!existsSync(file) || !statSync(file).isFile()) {
          next();
          return;
        }
        const st = statSync(file);
        res.setHeader("Content-Type", mime[extname(file).toLowerCase()] ?? "application/octet-stream");
        res.setHeader("Content-Length", String(st.size));
        if (req.method === "HEAD") {
          res.end();
          return;
        }
        createReadStream(file).pipe(res);
      });
    },
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

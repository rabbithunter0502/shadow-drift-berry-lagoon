#!/usr/bin/env node
/**
 * Static SPA build for GitHub Pages (project site).
 * Nitro/Vercel SSR does not run here — TanStack Start spa shell + client assets.
 *
 * Output: dist/gh-pages/  (ready to publish as Pages root for this repo)
 */
import { cpSync, copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const CLIENT = join(ROOT, "dist", "client");
const OUT = join(ROOT, "dist", "gh-pages");
const BASE = "/shadow-drift-berry-lagoon";

process.env.GH_PAGES = "1";

console.log("[gh-pages] building SPA (GH_PAGES=1)…");
const build = spawnSync(
  process.execPath,
  [join(ROOT, "scripts/with-app-env.mjs"), "vite", "build"],
  { stdio: "inherit", env: { ...process.env, GH_PAGES: "1" } },
);
if (build.status !== 0) process.exit(build.status ?? 1);

if (!existsSync(join(CLIENT, "_shell.html"))) {
  console.error("[gh-pages] missing dist/client/_shell.html — SPA prerender failed");
  process.exit(1);
}

let html = readFileSync(join(CLIENT, "_shell.html"), "utf8");

// SSR CSS hash can differ from the client CSS file name — point at the real client CSS.
const cssFiles = readdirSync(join(CLIENT, "assets")).filter((f) => f.endsWith(".css"));
if (cssFiles.length === 1) {
  html = html.replace(/\/shadow-drift-berry-lagoon\/assets\/styles-[^"]+\.css/g, `${BASE}/assets/${cssFiles[0]}`);
} else if (cssFiles.length > 1) {
  console.warn("[gh-pages] multiple CSS files; leaving shell hrefs as-is:", cssFiles);
}

// Absolute root links from __root head → project base.
html = html
  .replaceAll('href="/favicon.svg"', `href="${BASE}/favicon.svg"`)
  .replaceAll('href="/__grok/manifest.webmanifest"', `href="${BASE}/__grok/manifest.webmanifest"`)
  .replaceAll('href="/__grok/icon-180.png"', `href="${BASE}/__grok/icon-180.png"`);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(CLIENT, OUT, { recursive: true });
writeFileSync(join(OUT, "index.html"), html);
writeFileSync(join(OUT, "404.html"), html); // SPA fallback on GitHub Pages
writeFileSync(join(OUT, ".nojekyll"), "");

mkdirSync(join(OUT, "__grok"), { recursive: true });
writeFileSync(
  join(OUT, "__grok", "manifest.webmanifest"),
  JSON.stringify(
    {
      name: "Thưa",
      short_name: "Thưa",
      id: `${BASE}/`,
      start_url: `${BASE}/?urge=1`,
      scope: `${BASE}/`,
      display: "standalone",
      background_color: "#14120e",
      theme_color: "#14120e",
      icons: [
        {
          src: `${BASE}/__grok/icon-180.png`,
          sizes: "180x180",
          type: "image/png",
        },
      ],
    },
    null,
    2,
  ),
);
// Keep _shell.html for debugging; not required at runtime.

console.log(`[gh-pages] ready → ${OUT}`);
console.log(`[gh-pages] URL: https://rabbithunter0502.github.io${BASE}/`);

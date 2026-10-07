import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

// Read production artifacts only. This is not a browser performance measurement.
if (process.argv.slice(2).some((argument) => argument !== "--json")) {
  throw new Error("Usage: node scripts/audit_ui_build.mjs [--json]");
}
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const app = join(root, "apps", "web", "app");
const build = join(root, "apps", "web", ".next");
const manifestPath = join(build, "server", "app-paths-manifest.json");
if (!existsSync(manifestPath)) {
  throw new Error("Production artifacts are missing. Run pnpm build first.");
}
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

function files(directory) {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? files(path) : [path];
    })
    .sort();
}
function sizes(paths) {
  return [...new Set(paths)].reduce(
    (total, path) => {
      const data = readFileSync(path);
      return {
        files: total.files + 1,
        bytes: total.bytes + data.length,
        gzipBytes: total.gzipBytes + gzipSync(data, { level: 9 }).length,
      };
    },
    { files: 0, bytes: 0, gzipBytes: 0 },
  );
}
function assetPath(url) {
  const path = url.split("?")[0];
  if (!path.startsWith("/_next/static/") || path.includes("..")) {
    throw new Error(`Unexpected generated asset reference: ${url}`);
  }
  return join(build, path.slice("/_next/".length));
}
const pages = files(app).filter((path) => path.endsWith(`${sep}page.tsx`));
const routes = pages.map((path) => {
  const localPath = relative(app, path).split(sep).join("/");
  const appPath = `/${localPath.slice(0, -".tsx".length)}`;
  if (
    !manifest[appPath] ||
    !existsSync(join(build, "server", manifest[appPath]))
  ) {
    throw new Error(
      `Source page missing from the production build: ${appPath}`,
    );
  }
  const parts = localPath.split("/").filter((part) => !part.startsWith("("));
  const route = `/${parts.slice(0, -1).join("/")}`;
  const source = readFileSync(path, "utf8");
  const htmlPath = join(
    build,
    "server",
    "app",
    `${route === "/" ? "index" : route.slice(1)}.html`,
  );
  let initialAssets = null;
  if (existsSync(htmlPath)) {
    const html = readFileSync(htmlPath, "utf8");
    const scripts = [...html.matchAll(/<script\b([^>]*)>/g)]
      .filter((match) => !/\bnomodule\b/i.test(match[1]))
      .map((match) => match[1].match(/\bsrc="([^"]+)"/)?.[1])
      .filter((url) => url?.startsWith("/_next/static/"));
    const styles = [...html.matchAll(/<link\b([^>]*)>/g)]
      .filter((match) => /\brel="stylesheet"/.test(match[1]))
      .map((match) => match[1].match(/\bhref="([^"]+)"/)?.[1])
      .filter((url) => url?.startsWith("/_next/static/"));
    initialAssets = {
      javascript: sizes(scripts.map(assetPath)),
      css: sizes(styles.map(assetPath)),
    };
  }
  return {
    route,
    source: `apps/web/app/${localPath}`,
    serverPage: !/^\s*["']use client["']/.test(source),
    initialAssets,
  };
});
const staticFiles = files(join(build, "static"));
const report = {
  method:
    "Source pages matched to the production manifest. Static HTML script/stylesheet references are deduplicated per route; nomodule scripts are excluded. Gzip estimates sum separate level-9 compressed assets. Dynamic route transfer, RSC/HTML bytes, prefetched navigation, runtime requests, caching, parse cost and Core Web Vitals are not measured.",
  node: process.version,
  sourcePages: routes.length,
  serverPages: routes.filter((route) => route.serverPage).length,
  clientPages: routes.filter((route) => !route.serverPage).length,
  staticPageArtifacts: routes.filter((route) => route.initialAssets).length,
  emittedJavascript: sizes(staticFiles.filter((path) => path.endsWith(".js"))),
  emittedCss: sizes(staticFiles.filter((path) => path.endsWith(".css"))),
  largestStaticRoutes: routes
    .filter((route) => route.initialAssets)
    .sort(
      (a, b) =>
        b.initialAssets.javascript.gzipBytes -
        a.initialAssets.javascript.gzipBytes,
    )
    .slice(0, 5)
    .map(({ route, initialAssets }) => ({ route, ...initialAssets })),
};
console.log(
  JSON.stringify(
    process.argv.includes("--json") ? { ...report, routes } : report,
    null,
    2,
  ),
);

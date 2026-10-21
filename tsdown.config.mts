import { existsSync, globSync } from "node:fs";
import { sep } from "node:path";
import { transform } from "@swc/core";
import { defineConfig } from "tsdown";

const SRC = "src/main/resources";
const SRC_ASSETS = `${SRC}/assets`;
const DST = "build/resources/main";
const DST_ASSETS = `${DST}/assets`;

const logLevel: "silent" | "info" = ["QUIET", "WARN"].includes(process.env.LOG_LEVEL_FROM_GRADLE || "")
  ? "silent"
  : "info";

// Enonic XP loads each controller/service/task by its resource path, so every
// source file must become its own output file with the directory tree intact.
// Turn a glob into a tsdown `entry` map ({ "relative/name": "src/path/file.ts" }).
function entries(dir: string, exts: string, exclude: string[] = []): Record<string, string> {
  return Object.fromEntries(
    globSync(`${dir}/**/*.${exts}`, { exclude }).map((match) => {
      // globSync returns platform separators; entry keys and paths must be posix.
      const file = match.replaceAll(sep, "/");
      return [file.slice(dir.length + 1).replace(/\.[^.]+$/, ""), file];
    }),
  );
}

// /lib/wsutil is one module: only its index.ts is an entry, and the other files in the folder are bundled into
// it. As separate entries they would land in the jar as files of their own, and their shared state in _chunks/.
const serverEntry = entries(SRC, "{ts,js}", ["**/*.d.ts", `${SRC_ASSETS}/**`, `${SRC}/lib/wsutil/!(index).ts`]);
// Likewise the client library is one file, assets/wsutil/xp-websocket.js, with client.ts and lib/wsutil/shared.ts
// bundled into it
const assetEntry = entries(SRC_ASSETS, "{tsx,ts,jsx,js}", ["**/*.d.ts", `${SRC_ASSETS}/wsutil/!(xp-websocket).ts`]);

// XP resolves an absolute import at runtime against the app's own resources
// first, then against the modules provided by the runtime: XP's own libraries
// (/lib/xp/*), libraries `include`d in build.gradle, modules from other apps.
// Mirror that rule at build time: bundle an absolute import only when it is a
// source file of this app, and leave every other one to the runtime — no list
// of runtime modules to maintain. A mistyped specifier is caught by
// `check:types` (TS2307), not by the bundler.
const SRC_EXTS = [".ts", ".js"];
const appSourceCache = new Map<string, boolean>();
function isAppSource(id: string): boolean {
  let hit = appSourceCache.get(id);
  if (hit === undefined) {
    hit = SRC_EXTS.some((ext) => existsSync(`${SRC}${id}${ext}`) || existsSync(`${SRC}${id}/index${ext}`));
    appSourceCache.set(id, hit);
  }
  return hit;
}
const isRuntimeModule = (id: string, _importer: string | undefined, isResolved: boolean): boolean =>
  !isResolved && id.startsWith("/") && !isAppSource(id);

// Nashorn (XP's server-side JS engine) lacks ES2015 destructuring, but Oxc —
// tsdown's transformer — can't target below es2015. Re-lower the bundled server
// output to es5 with SWC after bundling, so bundled deps are covered too.
const nashornEs5 = {
  name: "nashorn-es5",
  async renderChunk(code: string) {
    const out = await transform(code, {
      jsc: {
        parser: { syntax: "ecmascript" },
        target: "es5",
        loose: true,
        externalHelpers: false,
      },
      isModule: false,
      minify: false,
      sourceMaps: false,
    });
    return { code: out.code, map: null };
  },
};

// Skip a build when there are no source files to bundle.
export default defineConfig([
  ...(Object.keys(serverEntry).length
    ? [
        {
          entry: serverEntry,
          outDir: DST,
          format: "cjs" as const,
          target: "es2015", // Rolldown/oxc floor; nashornEs5 plugin re-lowers to es5 for Nashorn
          platform: "neutral" as const,
          clean: false, // outDir also holds resources copied there by Gradle
          dts: false, // d.ts files are useless at runtime
          minify: false, // minifying server files makes debugging harder
          sourcemap: false,
          logLevel,
          plugins: [nashornEs5],
          tsconfig: `${SRC}/tsconfig.json`,
          inputOptions: {
            external: isRuntimeModule,
            resolve: {
              mainFields: ["module", "main"],
            },
          },
          outputOptions: {
            chunkFileNames: "_chunks/[name]-[hash].js", // avoid chunk-name collisions
            // No `Object.defineProperty(exports, Symbol.toStringTag, ...)` preamble: it reads Symbol unguarded at
            // load, which a Nashorn without Symbol cannot do
            generatedCode: { symbols: false },
          },
        },
      ]
    : []),
  ...(Object.keys(assetEntry).length
    ? [
        {
          entry: assetEntry,
          outDir: DST_ASSETS,
          format: "esm" as const,
          target: "es2023",
          outExtensions: () => ({ js: ".js" }), // not .mjs: pages load assetUrl({ path: "wsutil/xp-websocket.js" })
          platform: "browser" as const,
          clean: false,
          dts: false,
          minify: false, // kept readable, for debugging in the browser
          sourcemap: false,
          logLevel,
          tsconfig: `${SRC_ASSETS}/tsconfig.json`,
        },
      ]
    : []),
]);

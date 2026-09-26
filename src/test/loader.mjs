// Module resolver for `node --test`. XP resolves absolute specifiers like "/lib/wsUtil" against the
// app's own resources, and "/lib/xp/*" against its own libraries; the test runner needs the same
// mapping. "/lib/xp/*" are Java-backed with no Node implementation, so they map to stubs.
//
// The library keeps state (handlers, groups, ...) at module level. To give each test a fresh copy,
// a test imports "/lib/wsUtil?fresh=<n>": the query is kept on the resolved URL, which makes Node
// load a new instance, and it is passed on to everything the instance imports, so the whole module
// graph (including the stubs) is fresh and consistent. Registered from register.mjs.
import { resolve as resolvePath } from "node:path";
import { pathToFileURL } from "node:url";

const RESOURCES = `${pathToFileURL(resolvePath(process.cwd(), "src/main/resources")).href}/`;
const STUBS = `${pathToFileURL(resolvePath(process.cwd(), "src/test/stubs")).href}/`;

export function resolve(specifier, context, next) {
  const [bare, query = ""] = specifier.split("?");
  const url = map(bare, context.parentURL);

  if (url) {
    return { url: url + (query ? `?${query}` : freshQuery(context.parentURL)), shortCircuit: true };
  }

  return next(specifier, context);
}

function map(specifier, parentURL) {
  if (specifier === "/lib/wsUtil") {
    return `${RESOURCES}lib/wsUtil/index.ts`;
  }
  if (specifier.startsWith("/lib/xp/")) {
    return `${STUBS}lib-xp-${specifier.slice("/lib/xp/".length)}.mts`;
  }
  if (specifier.startsWith("/assets/")) {
    return `${RESOURCES}${specifier.slice(1)}.ts`;
  }
  // The modules of the library import each other relatively and without extension, which tsdown
  // resolves at build time. Node needs the extension.
  if (/^\.\.?\//.test(specifier) && parentURL?.startsWith(RESOURCES) && !/\.[cm]?[jt]s$/.test(specifier)) {
    return new URL(`${specifier}.ts`, parentURL).href;
  }
  return undefined;
}

function freshQuery(parentURL) {
  if (parentURL?.startsWith(RESOURCES) || parentURL?.startsWith(STUBS)) {
    return new URL(parentURL).search;
  }
  return "";
}

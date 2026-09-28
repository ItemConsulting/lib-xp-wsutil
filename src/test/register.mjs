// Loaded via `node --import` before any test. Registers the module resolver and installs the globals
// Enonic XP provides to every module: `app` and `log`.
// `log` delegates to console lazily, so a test that mocks console.error intercepts log.error.
import { register } from "node:module";

register("./loader.mjs", import.meta.url);

globalThis.app = {
  name: "com.example.app",
  version: "1.0.0",
  config: {},
};

globalThis.log = {
  // The library logs every event at debug level, which would drown the test output. A test that
  // asserts on it mocks log.debug itself.
  debug: () => undefined,
  info: (...args) => console.info(...args),
  error: (...args) => console.error(...args),
  warning: (...args) => console.warn(...args),
};

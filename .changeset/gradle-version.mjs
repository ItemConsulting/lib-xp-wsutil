// Copies the version of package.json into gradle.properties, run by `npm run versioning` after `changeset version`.
//
// A stable version (1.0.0) is used as is. Anything else is a prerelease, like the 1.0.0-beta.0 that `changeset pre`
// produces, and the jar is versioned as a snapshot of the release it leads up to (1.0.0-SNAPSHOT): Maven repositories
// only treat the -SNAPSHOT suffix as a snapshot, and build.gradle publishes those to the snapshots repository.
import { readFileSync, writeFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("package.json", "utf8"));
const [, release, prerelease] = /^(\d+\.\d+\.\d+)(.*)$/.exec(version) ?? [];

if (!release) {
  throw new Error(`Unexpected version in package.json: "${version}"`);
}

const jarVersion = prerelease ? `${release}-SNAPSHOT` : release;
const gradleProperties = readFileSync("gradle.properties", "utf8");

writeFileSync("gradle.properties", gradleProperties.replace(/^version *=.*$/m, `version = ${jarVersion}`));
console.log(`gradle.properties: version = ${jarVersion}`);

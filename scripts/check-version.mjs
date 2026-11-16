import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const read = (p) => readFileSync(resolve(root, p), "utf8");
const pkg = JSON.parse(read("package.json"));
const lock = JSON.parse(read("package-lock.json"));
const tauri = JSON.parse(read("src-tauri/tauri.conf.json"));
const cargo = read("src-tauri/Cargo.toml").match(/^version\s*=\s*"([^"]+)"/m)?.[1];
const cargoLock = read("src-tauri/Cargo.lock").match(/name = "local-music"\s+version = "([^"]+)"/)?.[1];
for (const version of [lock.version, lock.packages[""].version, tauri.version, cargo, cargoLock]) {
  if (version !== pkg.version) throw new Error(`Version mismatch: ${version} versus ${pkg.version}`);
}
const citation = read("CITATION.cff").match(/^version:\s*(.+)$/m)?.[1].trim();
const bibtex = read("README.md").match(/version\s*=\s*\{([^}]+)\}/)?.[1];
if (citation !== pkg.version || bibtex !== pkg.version)
  throw new Error("Citation versions do not match the application");
if (process.env.GITHUB_REF_TYPE === "tag" && process.env.GITHUB_REF_NAME !== `v${pkg.version}`)
  throw new Error("Release tag does not match the application version");
console.log(`Application versions agree: ${pkg.version}`);

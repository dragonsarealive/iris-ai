#!/usr/bin/env bun
/**
 * IRIS repo dev environment: install deps, verify core package, optional tests.
 *
 * Usage (repo root):
 *   bun run setup
 *   bun run setup --update    # reinstall deps (same as fresh install)
 *   bun run setup --test      # also run packages/iris tests
 *   bun run setup --no-install # only typecheck + hints
 */
import path from "path"
import { spawnSync } from "child_process"

const root = path.resolve(path.join(import.meta.dir, ".."))
const core = path.join(root, "packages", "iris")
const argv = process.argv.slice(2)
const noInstall = argv.includes("--no-install")
const wantTest = argv.includes("--test") || argv.includes("-t")

function run(cwd: string, cmd: string, args: string[]) {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" })
  return r.status ?? 1
}

let code = 0

if (!noInstall) {
  console.log("\n→ bun install (repo root)\n")
  code = run(root, "bun", ["install"])
  if (code !== 0) {
    console.error("\nInstall failed. Fix lockfile/network and retry, or use --no-install.\n")
    process.exit(code)
  }
}

console.log("\n→ bun typecheck (packages/iris)\n")
code = run(core, "bun", ["run", "typecheck"])
if (code !== 0) {
  console.error("\nTypecheck failed. See AGENTS.md — use package-scoped typecheck.\n")
  process.exit(code)
}

if (wantTest) {
  console.log("\n→ bun test (packages/iris, 60s timeout)\n")
  code = run(core, "bun", ["test", "--timeout", "60000"])
  if (code !== 0) process.exit(code)
}

console.log(`
── IRIS dev ready ──
  Run TUI:     bun run dev
  Local isolate:  .\\\\script\\\\run-local.ps1   (PowerShell)
  Core tests:  cd packages/iris && bun test
  SDK regen:   ./packages/sdk/js/script/build.ts
  Branch:      dev (not main)
  Context:     PROJECT_CONTEXT.md
`)

#!/usr/bin/env bun
/**
 * Validates March 2026 user-issues fixes in real conditions.
 * Ref: research/opencode-user-issues/opencode-user-issues-march-2026.md
 *
 * Run from packages/iris:
 *   bun script/validate-user-issues/run.ts
 *
 * Optional: skip worktree (needs git):
 *   VALIDATE_SKIP_WORKTREE=1 bun script/validate-user-issues/run.ts
 */
import { validateConstants } from "./constants"
import { validateCleanup } from "./cleanup"
import { validateToolIntegrity } from "./tool-integrity"
import { validateProvider } from "./provider"
import { validateConfig } from "./config"
import { validateWorktree } from "./worktree"

type Result = { name: string; ok: boolean; detail?: string }

async function main() {
  const isWin = process.platform === "win32"
  const skipWorktree = process.env.VALIDATE_SKIP_WORKTREE === "1" || isWin
  if (isWin && !process.env.VALIDATE_SKIP_WORKTREE) {
    console.log("Skipping worktree test on Windows (set VALIDATE_SKIP_WORKTREE=0 to run it).\n")
  }
  const runners: { label: string; fn: () => Promise<Result[]> }[] = [
    { label: "Constants (1.1, 2.1, 2.4)", fn: validateConstants },
    { label: "Cleanup (2.2)", fn: validateCleanup },
    { label: "Tool integrity (3.2)", fn: validateToolIntegrity },
    { label: "Provider (5.1)", fn: validateProvider },
    { label: "Config (1.3)", fn: validateConfig },
  ]
  if (!skipWorktree) runners.push({ label: "Worktree (6.1)", fn: validateWorktree })

  let total = 0
  let passed = 0
  const failed: string[] = []

  for (const { label, fn } of runners) {
    const results = await fn()
    for (const r of results) {
      total++
      if (r.ok) passed++
      else failed.push(`[${label}] ${r.name}${r.detail ? `: ${r.detail}` : ""}`)
    }
  }

  console.log(`\nValidate March 2026 fixes: ${passed}/${total} passed`)
  if (failed.length > 0) {
    console.log("\nFailed:")
    failed.forEach((f) => console.log("  -", f))
    process.exit(1)
  }
  console.log("All checks passed.\n")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

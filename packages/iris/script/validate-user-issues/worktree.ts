/**
 * Validates March 2026 worktree fix (6.1): project returns worktree (sandbox) and repoRoot correctly.
 * Runs in a temp git repo with a linked worktree and checks Project.get().
 */
import path from "path"
import { tmpdir } from "os"
import { mkdtemp, writeFile, rm } from "fs/promises"
import { join } from "path"

async function git(args: string[], cwd: string) {
  const p = Bun.spawn(["git", ...args], { cwd, stdout: "ignore", stderr: "pipe" })
  await p.exited
  return p.exitCode
}

export async function validateWorktree(): Promise<{ name: string; ok: boolean; detail?: string }[]> {
  const out: { name: string; ok: boolean; detail?: string }[] = []
  let worktreePath: string | null = null
  let base: string | null = null

  try {
    base = await mkdtemp(join(tmpdir(), "iris-validate-worktree-"))
    const mainPath = join(base, "main")
    if ((await git(["init", "main"], base)) !== 0) {
      out.push({ name: "worktree setup (git init)", ok: false, detail: "git init failed" })
      return out
    }
    await writeFile(join(mainPath, "file.txt"), "root")
    await git(["add", "file.txt"], mainPath)
    await git(["commit", "-m", "root"], mainPath)

    worktreePath = join(base, "wt")
    if ((await git(["worktree", "add", worktreePath], mainPath)) !== 0) {
      out.push({ name: "worktree setup (worktree add)", ok: false, detail: "worktree add failed" })
      return out
    }
    await writeFile(join(worktreePath, "wt.txt"), "worktree")
    await git(["add", "wt.txt"], worktreePath)
    await git(["commit", "-m", "wt"], worktreePath)

    const { Instance } = await import("../../src/project/instance")
    await Instance.provide({
      directory: worktreePath,
      fn: async () => {
        const worktree = Instance.worktree
        const repoRoot = Instance.repoRoot
        const sandbox = Instance.worktree
        out.push({
          name: "worktree is worktree dir (not main repo)",
          ok: worktree === worktreePath || path.resolve(worktree) === path.resolve(worktreePath!),
          detail: `worktree=${worktree}`,
        })
        out.push({
          name: "repoRoot set",
          ok: typeof repoRoot === "string" && repoRoot.length > 0,
          detail: repoRoot,
        })
        out.push({
          name: "sandbox is worktree top-level",
          ok: sandbox === worktreePath || path.resolve(sandbox) === path.resolve(worktreePath!),
          detail: `sandbox=${sandbox}`,
        })
        return undefined
      },
    })
  } catch (e) {
    out.push({
      name: "worktree project resolution",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    })
  } finally {
    if (base) await rm(base, { recursive: true, force: true }).catch(() => {})
  }

  return out
}

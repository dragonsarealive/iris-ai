import { NodeChildProcessSpawner, NodeFileSystem, NodePath } from "@effect/platform-node"
import { Cause, Duration, Effect, FileSystem, Layer, Schedule, ServiceMap, Stream } from "effect"
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process"
import path from "path"
import z from "zod"
import { InstanceContext } from "@/effect/instance-context"
import { runPromiseInstance } from "@/effect/runtime"
import { Config } from "../config/config"
import { Global } from "../global"
import { Log } from "../util/log"
import { stat, readdir } from "fs/promises"

const log = Log.create({ service: "snapshot" })
const PRUNE = "7.days"

const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_DIFF_SIZE = 1024 * 1024
const MAX_SNAPSHOT_SIZE = 256 * 1024 * 1024
const GIT_SIZE_LIMIT = 50 * 1024 * 1024

// Common git config flags shared across snapshot operations
const GIT_CORE = ["-c", "core.longpaths=true", "-c", "core.symlinks=true"]
const GIT_CFG = ["-c", "core.autocrlf=false", ...GIT_CORE]
const GIT_CFG_QUOTE = [...GIT_CFG, "-c", "core.quotepath=false"]

interface GitResult {
  readonly code: ChildProcessSpawner.ExitCode
  readonly text: string
  readonly stderr: string
}

export namespace Snapshot {
  export const Patch = z.object({
    hash: z.string(),
    files: z.string().array(),
  })
  export type Patch = z.infer<typeof Patch>

  export const FileDiff = z
    .object({
      file: z.string(),
      before: z.string(),
      after: z.string(),
      additions: z.number(),
      deletions: z.number(),
      status: z.enum(["added", "deleted", "modified"]).optional(),
    })
    .meta({
      ref: "FileDiff",
    })
  export type FileDiff = z.infer<typeof FileDiff>

  // Promise facade — existing callers use these
  export function init() {
    void runPromiseInstance(SnapshotService.use((s) => s.init()))
  }

  export async function cleanup() {
    return runPromiseInstance(SnapshotService.use((s) => s.cleanup()))
  }

  export async function track() {
    return runPromiseInstance(SnapshotService.use((s) => s.track()))
  }

  export async function patch(hash: string) {
    return runPromiseInstance(SnapshotService.use((s) => s.patch(hash)))
  }

  export async function restore(snapshot: string) {
    return runPromiseInstance(SnapshotService.use((s) => s.restore(snapshot)))
  }

  export async function revert(patches: Patch[]) {
    return runPromiseInstance(SnapshotService.use((s) => s.revert(patches)))
  }

  export async function diff(hash: string) {
    return runPromiseInstance(SnapshotService.use((s) => s.diff(hash)))
  }

  export async function diffFull(from: string, to: string) {
    return runPromiseInstance(SnapshotService.use((s) => s.diffFull(from, to)))
  }
}

export namespace SnapshotService {
  export interface Service {
    readonly init: () => Effect.Effect<void>
    readonly cleanup: () => Effect.Effect<void>
    readonly track: () => Effect.Effect<string | undefined>
    readonly patch: (hash: string) => Effect.Effect<Snapshot.Patch>
    readonly restore: (snapshot: string) => Effect.Effect<void>
    readonly revert: (patches: Snapshot.Patch[]) => Effect.Effect<void>
    readonly diff: (hash: string) => Effect.Effect<string>
    readonly diffFull: (from: string, to: string) => Effect.Effect<Snapshot.FileDiff[]>
  }
}

export class SnapshotService extends ServiceMap.Service<SnapshotService, SnapshotService.Service>()(
  "@opencode/Snapshot",
) {
  static readonly layer = Layer.effect(
    SnapshotService,
    Effect.gen(function* () {
      const ctx = yield* InstanceContext
      const fileSystem = yield* FileSystem.FileSystem
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner
      const { directory, worktree, project } = ctx
      const isGit = project.vcs === "git"
      const snapshotGit = path.join(Global.Path.data, "snapshot", project.id)

      const gitArgs = (cmd: string[]) => ["--git-dir", snapshotGit, "--work-tree", worktree, ...cmd]

      // Run git with nothrow semantics — always returns a result, never fails
      const git = (args: string[], opts?: { cwd?: string; env?: Record<string, string> }): Effect.Effect<GitResult> =>
        Effect.gen(function* () {
          const command = ChildProcess.make("git", args, {
            cwd: opts?.cwd,
            env: opts?.env,
            extendEnv: true,
          })
          const handle = yield* spawner.spawn(command)
          const [text, stderr] = yield* Effect.all(
            [Stream.mkString(Stream.decodeText(handle.stdout)), Stream.mkString(Stream.decodeText(handle.stderr))],
            { concurrency: 2 },
          )
          const code = yield* handle.exitCode
          return { code, text, stderr }
        }).pipe(
          Effect.scoped,
          Effect.catch((err) =>
            Effect.succeed({
              code: ChildProcessSpawner.ExitCode(1),
              text: "",
              stderr: String(err),
            }),
          ),
        )

      // FileSystem helpers — orDie converts PlatformError to defects
      const exists = (p: string) => fileSystem.exists(p).pipe(Effect.orDie)
      const mkdir = (p: string) => fileSystem.makeDirectory(p, { recursive: true }).pipe(Effect.orDie)
      const writeFile = (p: string, content: string) => fileSystem.writeFileString(p, content).pipe(Effect.orDie)
      const readFile = (p: string) => fileSystem.readFileString(p).pipe(Effect.catch(() => Effect.succeed("")))
      const removeFile = (p: string) => fileSystem.remove(p).pipe(Effect.catch(() => Effect.void))

      // --- internal Effect helpers ---

      const isEnabled = Effect.gen(function* () {
        if (!isGit) return false
        const cfg = yield* Effect.promise(() => Config.get())
        return cfg.snapshot !== false
      })

      const excludesPath = Effect.gen(function* () {
        const result = yield* git(["rev-parse", "--path-format=absolute", "--git-path", "info/exclude"], {
          cwd: worktree,
        })
        const file = result.text.trim()
        if (!file) return undefined
        if (!(yield* exists(file))) return undefined
        return file
      })

      const syncExclude = Effect.gen(function* () {
        const file = yield* excludesPath
        const target = path.join(snapshotGit, "info", "exclude")
        yield* mkdir(path.join(snapshotGit, "info"))
        if (!file) {
          yield* writeFile(target, "")
          return
        }
        const text = yield* readFile(file)
        yield* writeFile(target, text)
      })

      const add = Effect.gen(function* () {
        yield* syncExclude
        yield* git([...GIT_CFG, ...gitArgs(["add", "."])], { cwd: directory })
      })

      // --- service methods ---

      const getSnapshotSize = Effect.gen(function* () {
        let size = 0
        try {
          const entries = yield* Effect.promise(() => readdir(snapshotGit, { withFileTypes: true }))
          for (const entry of entries) {
            const fullPath = path.join(snapshotGit, entry.name)
            try {
              const statResult = yield* Effect.promise(() => stat(fullPath))
              if (statResult.isFile()) {
                size += statResult.size
              } else if (statResult.isDirectory() && entry.name !== "info") {
                const subEntries = yield* Effect.promise(() => readdir(fullPath, { withFileTypes: true }))
                for (const subEntry of subEntries) {
                  const subPath = path.join(fullPath, subEntry.name)
                  const subStat = yield* Effect.promise(() => stat(subPath))
                  if (subStat.isFile()) {
                    size += subStat.size
                  }
                }
              }
            } catch {
              // Skip entries we can't stat
            }
          }
        } catch {
          return 0
        }
        return size
      })

      const cleanup = Effect.fn("SnapshotService.cleanup")(function* () {
        if (!(yield* isEnabled)) return
        if (!(yield* exists(snapshotGit))) return

        const size = yield* getSnapshotSize
        const isOverLimit = size > MAX_SNAPSHOT_SIZE
        if (isOverLimit) {
          log.info("snapshot exceeds size limit, pruning aggressively", { size, limit: MAX_SNAPSHOT_SIZE })
        }

        const pruneArgs = isOverLimit
          ? ["gc", "--prune=now", "--aggressive", "--prune-unreachable", "--no-reuse-pack"]
          : ["gc", `--prune=${PRUNE}`]

        const result = yield* git(gitArgs(pruneArgs), {
          cwd: directory,
        })

        if (result.code !== 0) {
          log.warn("cleanup failed", {
            exitCode: result.code,
            stderr: result.stderr,
            aggressive: isOverLimit,
          })
          return
        }

        if (isOverLimit) {
          yield* git(gitArgs(["reflog", "expire", "--expire=now", "--all"]), {
            cwd: directory,
          })
          yield* git(gitArgs(["repack", "-ad", "--prune-pack-hack"]), {
            cwd: directory,
          })
        }

        const newSize = yield* getSnapshotSize
        log.info("cleanup", { prune: PRUNE, sizeBefore: size, sizeAfter: newSize, aggressive: isOverLimit })
      })

      const track = Effect.fn("SnapshotService.track")(function* () {
        if (!(yield* isEnabled)) return undefined
        const existed = yield* exists(snapshotGit)
        yield* mkdir(snapshotGit)
        if (!existed) {
          yield* git(["init"], {
            env: { GIT_DIR: snapshotGit, GIT_WORK_TREE: worktree },
          })
          yield* git(["--git-dir", snapshotGit, "config", "core.autocrlf", "false"])
          yield* git(["--git-dir", snapshotGit, "config", "core.longpaths", "true"])
          yield* git(["--git-dir", snapshotGit, "config", "core.symlinks", "true"])
          yield* git(["--git-dir", snapshotGit, "config", "core.fsmonitor", "false"])
          yield* writeFile(
            path.join(snapshotGit, "info", "exclude"),
            `.git\nnode_modules\ndist\nbuild\ncoverage\n*.log\n.env\n.next\n.nuxt\ncache\n.turbo\nvendor\n*.pyc\n__pycache__\n`,
          )
          log.info("initialized")
        }
        yield* add
        const result = yield* git(gitArgs(["write-tree"]), { cwd: directory })
        const hash = result.text.trim()
        log.info("tracking", { hash, cwd: directory, git: snapshotGit })
        return hash
      })

      const patch = Effect.fn("SnapshotService.patch")(function* (hash: string) {
        yield* add
        const result = yield* git(
          [...GIT_CFG_QUOTE, ...gitArgs(["diff", "--no-ext-diff", "--name-only", hash, "--", "."])],
          { cwd: directory },
        )

        if (result.code !== 0) {
          log.warn("failed to get diff", { hash, exitCode: result.code })
          return { hash, files: [] } as Snapshot.Patch
        }

        return {
          hash,
          files: result.text
            .trim()
            .split("\n")
            .map((x: string) => x.trim())
            .filter(Boolean)
            .map((x: string) => path.join(worktree, x).replaceAll("\\", "/")),
        } as Snapshot.Patch
      })

      const restore = Effect.fn("SnapshotService.restore")(function* (snapshot: string) {
        log.info("restore", { commit: snapshot })
        const result = yield* git([...GIT_CORE, ...gitArgs(["read-tree", snapshot])], { cwd: worktree })
        if (result.code === 0) {
          const checkout = yield* git([...GIT_CORE, ...gitArgs(["checkout-index", "-a", "-f"])], { cwd: worktree })
          if (checkout.code === 0) return
          log.error("failed to restore snapshot", {
            snapshot,
            exitCode: checkout.code,
            stderr: checkout.stderr,
          })
          return
        }
        log.error("failed to restore snapshot", {
          snapshot,
          exitCode: result.code,
          stderr: result.stderr,
        })
      })

      const revert = Effect.fn("SnapshotService.revert")(function* (patches: Snapshot.Patch[]) {
        const seen = new Set<string>()
        for (const item of patches) {
          for (const file of item.files) {
            if (seen.has(file)) continue
            log.info("reverting", { file, hash: item.hash })
            const result = yield* git([...GIT_CORE, ...gitArgs(["checkout", item.hash, "--", file])], {
              cwd: worktree,
            })
            if (result.code !== 0) {
              const relativePath = path.relative(worktree, file)
              const checkTree = yield* git([...GIT_CORE, ...gitArgs(["ls-tree", item.hash, "--", relativePath])], {
                cwd: worktree,
              })
              if (checkTree.code === 0 && checkTree.text.trim()) {
                log.info("file existed in snapshot but checkout failed, keeping", { file })
              } else {
                log.info("file did not exist in snapshot, deleting", { file })
                yield* removeFile(file)
              }
            }
            seen.add(file)
          }
        }
      })

      const diff = Effect.fn("SnapshotService.diff")(function* (hash: string) {
        yield* add
        const result = yield* git([...GIT_CFG_QUOTE, ...gitArgs(["diff", "--no-ext-diff", hash, "--", "."])], {
          cwd: worktree,
        })

        if (result.code !== 0) {
          log.warn("failed to get diff", {
            hash,
            exitCode: result.code,
            stderr: result.stderr,
          })
          return ""
        }

        return result.text.trim()
      })

      const diffFull = Effect.fn("SnapshotService.diffFull")(function* (from: string, to: string) {
        const result: Snapshot.FileDiff[] = []
        const status = new Map<string, "added" | "deleted" | "modified">()

        const statuses = yield* git(
          [
            ...GIT_CFG_QUOTE,
            ...gitArgs(["diff", "--no-ext-diff", "--name-status", "--no-renames", from, to, "--", "."]),
          ],
          { cwd: directory },
        )

        for (const line of statuses.text.trim().split("\n")) {
          if (!line) continue
          const [code, file] = line.split("\t")
          if (!code || !file) continue
          const kind = code.startsWith("A") ? "added" : code.startsWith("D") ? "deleted" : "modified"
          status.set(file, kind)
        }

        const numstat = yield* git(
          [...GIT_CFG_QUOTE, ...gitArgs(["diff", "--no-ext-diff", "--no-renames", "--numstat", from, to, "--", "."])],
          { cwd: directory },
        )

        for (const line of numstat.text.trim().split("\n")) {
          if (!line) continue
          const [additions, deletions, file] = line.split("\t")
          const isBinaryFile = additions === "-" && deletions === "-"
          const added = isBinaryFile ? 0 : parseInt(additions!)
          const deleted = isBinaryFile ? 0 : parseInt(deletions!)
          const addedBytes = Number.isFinite(added) ? added : 0
          const deletedBytes = Number.isFinite(deleted) ? deleted : 0
          const totalSize = addedBytes + deletedBytes

          if (isBinaryFile) {
            result.push({
              file: file!,
              before: "",
              after: "",
              additions: 0,
              deletions: 0,
              status: status.get(file!) ?? "modified",
            })
            continue
          }

          if (totalSize > MAX_FILE_SIZE) {
            result.push({
              file: file!,
              before: `[File too large to diff: ${totalSize} bytes]`,
              after: "",
              additions: addedBytes,
              deletions: deletedBytes,
              status: status.get(file!) ?? "modified",
            })
            continue
          }

          const beforeBlobSize = yield* git(
            [...GIT_CFG_QUOTE, ...gitArgs(["rev-list", "--count", `${from}:${file}`])],
            { cwd: directory },
          ).pipe(
            Effect.map((r) => {
              const size = parseInt(r.text.trim())
              return Number.isFinite(size) ? size : 0
            }),
            Effect.catch(() => Effect.succeed(0)),
          )

          const afterBlobSize = yield* git([...GIT_CFG_QUOTE, ...gitArgs(["rev-list", "--count", `${to}:${file}`])], {
            cwd: directory,
          }).pipe(
            Effect.map((r) => {
              const size = parseInt(r.text.trim())
              return Number.isFinite(size) ? size : 0
            }),
            Effect.catch(() => Effect.succeed(0)),
          )

          const beforeFileSize = Number.isFinite(beforeBlobSize) ? beforeBlobSize : 0
          const afterFileSize = Number.isFinite(afterBlobSize) ? afterBlobSize : 0

          if (beforeFileSize > GIT_SIZE_LIMIT || afterFileSize > GIT_SIZE_LIMIT) {
            result.push({
              file: file!,
              before: `[File too large to diff: before=${beforeFileSize}, after=${afterFileSize} bytes]`,
              after: "",
              additions: addedBytes,
              deletions: deletedBytes,
              status: status.get(file!) ?? "modified",
            })
            continue
          }

          const [before, after] = yield* Effect.all(
            [
              git([...GIT_CFG, ...gitArgs(["show", `${from}:${file}`])]).pipe(
                Effect.map((r) => {
                  const text = r.text
                  return text.length > MAX_DIFF_SIZE ? text.slice(0, MAX_DIFF_SIZE) + "\n...[truncated]" : text
                }),
              ),
              git([...GIT_CFG, ...gitArgs(["show", `${to}:${file}`])]).pipe(
                Effect.map((r) => {
                  const text = r.text
                  return text.length > MAX_DIFF_SIZE ? text.slice(0, MAX_DIFF_SIZE) + "\n...[truncated]" : text
                }),
              ),
            ],
            { concurrency: 2 },
          )

          result.push({
            file: file!,
            before,
            after,
            additions: addedBytes,
            deletions: deletedBytes,
            status: status.get(file!) ?? "modified",
          })
        }
        return result
      })

      // Start hourly cleanup fiber — scoped to instance lifetime
      yield* cleanup().pipe(
        Effect.catchCause((cause) => {
          log.error("cleanup loop failed", { cause: Cause.pretty(cause) })
          return Effect.void
        }),
        Effect.repeat(Schedule.spaced(Duration.hours(1))),
        Effect.forkScoped,
      )

      return SnapshotService.of({
        init: Effect.fn("SnapshotService.init")(function* () {}),
        cleanup,
        track,
        patch,
        restore,
        revert,
        diff,
        diffFull,
      })
    }),
  ).pipe(
    Layer.provide(NodeChildProcessSpawner.layer),
    Layer.provide(NodeFileSystem.layer),
    Layer.provide(NodePath.layer),
  )
}

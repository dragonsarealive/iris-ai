/**
 * Validates March 2026 fix constants (stability, memory, snapshot).
 * Ref: research/opencode-user-issues/opencode-user-issues-march-2026.md
 */
const EXPECTED_CHUNK_TIMEOUT_MS = 600_000
const EXPECTED_MAX_FILE_SIZE = 10 * 1024 * 1024
const EXPECTED_MAX_DIFF_SIZE = 1024 * 1024
const EXPECTED_MAX_SNAPSHOT_SIZE = 256 * 1024 * 1024
const EXPECTED_GIT_SIZE_LIMIT = 50 * 1024 * 1024

export async function validateConstants(): Promise<{ name: string; ok: boolean; detail?: string }[]> {
  const out: { name: string; ok: boolean; detail?: string }[] = []

  // Provider: DEFAULT_CHUNK_TIMEOUT 600_000 ms (fix 1.1 SSE / agent hang)
  const providerSrc = await Bun.file(new URL("../../src/provider/provider.ts", import.meta.url)).text()
  const hasChunk600k = providerSrc.includes("600_000") && providerSrc.includes("DEFAULT_CHUNK_TIMEOUT")
  out.push({
    name: "DEFAULT_CHUNK_TIMEOUT 600s",
    ok: hasChunk600k,
    detail: hasChunk600k ? "600_000" : "not found",
  })

  // Snapshot: MAX_FILE_SIZE 10*1024*1024, MAX_DIFF_SIZE 1MB, MAX_SNAPSHOT_SIZE 256MB, GIT 50MB (fix 2.1, 2.4)
  const snapshotSrc = await Bun.file(new URL("../../src/snapshot/index.ts", import.meta.url)).text()
  const hasMaxFile10 = snapshotSrc.includes("MAX_FILE_SIZE") && snapshotSrc.includes("10 * 1024 * 1024")
  const hasMaxDiff1M = snapshotSrc.includes("MAX_DIFF_SIZE") && snapshotSrc.includes("1024 * 1024")
  const hasMaxSnap256 = snapshotSrc.includes("MAX_SNAPSHOT_SIZE") && snapshotSrc.includes("256 * 1024 * 1024")
  const hasGit50 = snapshotSrc.includes("GIT_SIZE_LIMIT") && snapshotSrc.includes("50 * 1024 * 1024")
  out.push({
    name: "MAX_FILE_SIZE 10MB",
    ok: hasMaxFile10,
    detail: hasMaxFile10 ? "10*1024*1024" : "not found",
  })
  out.push({
    name: "MAX_DIFF_SIZE 1MB",
    ok: hasMaxDiff1M,
    detail: hasMaxDiff1M ? "1MB" : "not found",
  })
  out.push({
    name: "MAX_SNAPSHOT_SIZE 256MB",
    ok: hasMaxSnap256,
    detail: hasMaxSnap256 ? "256MB" : "not found",
  })
  out.push({
    name: "GIT_SIZE_LIMIT 50MB",
    ok: hasGit50,
    detail: hasGit50 ? "50MB" : "not found",
  })

  return out
}

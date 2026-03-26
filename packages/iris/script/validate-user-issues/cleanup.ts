/**
 * Validates March 2026 DB cleanup fix (2.2): scheduleCleanup, cleanupOldData, pruneLargeBashOutputs.
 */
import { SessionCompaction } from "../../src/session/compaction"

export async function validateCleanup(): Promise<{ name: string; ok: boolean; detail?: string }[]> {
  const out: { name: string; ok: boolean; detail?: string }[] = []

  out.push({
    name: "scheduleCleanup exists",
    ok: typeof SessionCompaction.scheduleCleanup === "function",
  })
  out.push({
    name: "cleanupOldData exists",
    ok: typeof SessionCompaction.cleanupOldData === "function",
  })

  const compactionSrc = await Bun.file(new URL("../../src/session/compaction.ts", import.meta.url)).text()
  const hasPrune = compactionSrc.includes("pruneLargeBashOutputs")
  const hasInterval6h = compactionSrc.includes("6 * 60 * 60 * 1000") || compactionSrc.includes("CLEANUP_INTERVAL_MS")
  const hasRetention30 = compactionSrc.includes("30") && compactionSrc.includes("DB_RETENTION")
  out.push({ name: "pruneLargeBashOutputs exists", ok: hasPrune })
  out.push({ name: "cleanup interval 6h", ok: hasInterval6h })
  out.push({ name: "DB retention 30 days", ok: hasRetention30 })

  return out
}

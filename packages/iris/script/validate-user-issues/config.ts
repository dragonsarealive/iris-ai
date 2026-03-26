/**
 * Validates March 2026 config fix (1.3): continue_loop_on_deny default true.
 */
export async function validateConfig(): Promise<{ name: string; ok: boolean; detail?: string }[]> {
  const out: { name: string; ok: boolean; detail?: string }[] = []

  const src = await Bun.file(new URL("../../src/config/config.ts", import.meta.url)).text()
  const hasContinueLoop = src.includes("continue_loop_on_deny")
  const defaultTrue = src.includes("continue_loop_on_deny") && src.includes(".default(true)")
  out.push({
    name: "continue_loop_on_deny default true",
    ok: hasContinueLoop && defaultTrue,
    detail: hasContinueLoop ? (defaultTrue ? "default true" : "default not true") : "not found",
  })

  return out
}

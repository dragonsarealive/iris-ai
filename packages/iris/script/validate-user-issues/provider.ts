/**
 * Validates March 2026 provider fix (5.1): mergeProvider uses match ?? { id, models: {} } for custom providers.
 */
export async function validateProvider(): Promise<{ name: string; ok: boolean; detail?: string }[]> {
  const out: { name: string; ok: boolean; detail?: string }[] = []

  const src = await Bun.file(new URL("../../src/provider/provider.ts", import.meta.url)).text()
  const flat = src.replace(/\s+/g, " ")
  const hasMergeMatchFallback =
    flat.includes("match ?? { id: providerID, models: {} }") || flat.includes("match ?? { id: providerID, models: {} },")
  const hasMergeProvider = src.includes("function mergeProvider") || src.includes("mergeProvider(providerID")
  out.push({
    name: "mergeProvider match ?? { id, models: {} }",
    ok: hasMergeMatchFallback,
    detail: hasMergeProvider ? (hasMergeMatchFallback ? "present" : "fallback not found") : "mergeProvider not found",
  })

  return out
}

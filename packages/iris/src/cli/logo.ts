/** Inner width between `|` characters (ASCII box). */
const inner = 24

/** Terminal-safe IRIS banner lines (no ANSI). Version from `Installation.VERSION` at call sites. */
export function getBanner(version: string) {
  const title = `I R I S v${version}`
  const innerLine = ` ${title}${" ".repeat(Math.max(0, inner - 1 - title.length))}`
  return [`+------------------------+`, `|${innerLine}|`, `+------------------------+`]
}

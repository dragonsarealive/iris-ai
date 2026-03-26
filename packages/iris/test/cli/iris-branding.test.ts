import { describe, expect, test } from "bun:test"
import { getBanner } from "../../src/cli/logo"
import { UI } from "../../src/cli/ui"
import { Installation } from "../../src/installation"
import iris from "../../src/cli/cmd/tui/context/theme/iris.json" with { type: "json" }

function stripAnsi(text: string) {
  return text.replace(/\x1B\[[0-9;]*m/g, "")
}

describe("iris branding", () => {
  test("renders a terminal-safe ASCII banner with version", () => {
    const line = getBanner("0.1.0")
    expect(line).toEqual([
      "+------------------------+",
      "| I R I S v0.1.0         |",
      "+------------------------+",
    ])
  })

  test("prints CLI logo with muted frame and green title line", () => {
    const out = UI.logo()
    expect(out).toContain("\x1b[90m+------------------------+\x1b[0m")
    expect(out).toContain(`\x1b[92m| I R I S v${Installation.VERSION}`)
    expect(out).not.toContain("OpenCode")

    const plain = stripAnsi(out)
    expect(plain).toContain("+------------------------+")
    expect(plain).toContain(`I R I S v${Installation.VERSION}`)
    expect(/[^\x20-\x7E\r\n]/.test(plain)).toBe(false)
  })

  test("keeps iris theme core palette values stable", () => {
    expect(iris.theme.primary.dark).toBe("darkStep9")
    expect(iris.defs.darkStep9).toBe("#7ee787")
    expect(iris.theme.secondary.dark).toBe("darkSecondary")
    expect(iris.defs.darkSecondary).toBe("#79c0ff")
    expect(iris.theme.background.dark).toBe("darkStep1")
    expect(iris.defs.darkStep1).toBe("#0a0e14")
    expect(iris.theme.text.dark).toBe("darkStep12")
    expect(iris.defs.darkStep12).toBe("#c9d1d9")
  })
})

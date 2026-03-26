import { TextAttributes } from "@opentui/core"
import type { JSX } from "solid-js"
import { useTheme } from "@tui/context/theme"
import { getBanner } from "@/cli/logo"
import { Installation } from "@/installation"

export function Logo() {
  const { theme } = useTheme()
  const lines = getBanner(Installation.VERSION)

  const row = (line: string, i: number): JSX.Element => (
    <text
      fg={i === 1 ? theme.success : theme.textMuted}
      attributes={i === 1 ? TextAttributes.BOLD : undefined}
      selectable={false}
    >
      {line}
    </text>
  )

  return <box flexDirection="column">{lines.map((line, i) => row(line, i))}</box>
}

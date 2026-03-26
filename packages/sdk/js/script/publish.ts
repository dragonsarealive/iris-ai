#!/usr/bin/env bun

import { Script } from "@iris-ai/script"
import { $ } from "bun"
import { fileURLToPath } from "url"

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)

const pkg = (await import("../package.json").then((m) => m.default)) as {
  name: string
  version: string
  exports: Record<string, string | object>
}
const original = JSON.parse(JSON.stringify(pkg))
{
  const check = await $`npm view ${original.name}@${original.version} version`.nothrow().quiet()
  if (check.exitCode === 0 && check.text().trim() === original.version) {
    console.log(`Skipping publish: ${original.name}@${original.version} already on npm`)
    process.exit(0)
  }
}
function transformExports(exports: Record<string, string | object>) {
  for (const [key, value] of Object.entries(exports)) {
    if (typeof value === "object" && value !== null) {
      transformExports(value as Record<string, string | object>)
    } else if (typeof value === "string") {
      const file = value.replace("./src/", "./dist/").replace(".ts", "")
      exports[key] = {
        import: file + ".js",
        types: file + ".d.ts",
      }
    }
  }
}
transformExports(pkg.exports)
await Bun.write("package.json", JSON.stringify(pkg, null, 2))
await $`bun pm pack`
await $`npm publish *.tgz --tag ${Script.channel} --access public`
await Bun.write("package.json", JSON.stringify(original, null, 2))

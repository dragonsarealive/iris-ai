#!/usr/bin/env bun
import { Script } from "@iris-ai/script"
import { $ } from "bun"
import { fileURLToPath } from "url"

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)

const pkg = await import("../package.json").then((m) => m.default)
{
  const check = await $`npm view ${pkg.name}@${pkg.version} version`.nothrow().quiet()
  if (check.exitCode === 0 && check.text().trim() === pkg.version) {
    console.log(`Skipping publish: ${pkg.name}@${pkg.version} already on npm`)
    process.exit(0)
  }
}

await $`bun tsc`
const original = JSON.parse(JSON.stringify(pkg))
for (const [key, value] of Object.entries(pkg.exports)) {
  const file = value.replace("./src/", "./dist/").replace(".ts", "")
  // @ts-ignore
  pkg.exports[key] = {
    import: file + ".js",
    types: file + ".d.ts",
  }
}
await Bun.write("package.json", JSON.stringify(pkg, null, 2))
await $`bun pm pack && npm publish *.tgz --tag ${Script.channel} --access public`
await Bun.write("package.json", JSON.stringify(original, null, 2))

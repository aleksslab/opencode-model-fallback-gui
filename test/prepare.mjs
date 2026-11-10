import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

// The app loads the GUI bundle with its own module map available as
// `@opencode/plugin/gui`. Outside the app that specifier does not resolve, so
// the test harness rewrites it to the installed package build.
const dir = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(dir, "..")
const bundle = path.join(root, "dist", "gui-experimental.cjs")
const target = path.join(dir, ".bundle.cjs")
const gui = path.join(root, "node_modules", "@opencode", "plugin", "dist", "gui", "index.js")

const source = fs.readFileSync(bundle, "utf8")
const patched = source.replace('require("@opencode/plugin/gui")', `require(${JSON.stringify(gui)})`)

if (patched === source) {
  console.error(`Could not find the @opencode/plugin/gui require in ${bundle}`)
  process.exit(1)
}

fs.writeFileSync(target, patched)
console.log(`Prepared ${path.relative(root, target)}`)

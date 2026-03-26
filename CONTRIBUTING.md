# Contributing to IRIS

**IRIS** is a fork of OpenCode. Pull requests are welcome.

Maintainers review each PR and merge only what fits the project. A PR might be declined without a long debate—that is normal. Opening an issue first is optional; use one if you want feedback before you code.

Follow the [style guide](./AGENTS.md) when you can.

## Pull requests

- Keep changes focused and explain what you changed and why.
- For UI work, screenshots (before/after) help a lot.
- For behavior changes, say how you tested it so a reviewer can repeat it.

## Adding new providers

Upstream often adds provider definitions via [models.dev](https://github.com/anomalyco/models.dev). If IRIS needs code changes too, include them in your PR here.

## Developing IRIS

- **Requirements:** Bun 1.3+
- From the repo root:

  ```bash
  bun install
  bun dev
  ```

### Run against another directory

By default `bun dev` uses `packages/iris` as the working tree. To use another path:

```bash
bun dev <directory>
```

Example (repo root as the project):

```bash
bun dev .
```

### Standalone build

```bash
./packages/iris/script/build.ts --single
```

Output lives under `packages/iris/dist/<platform>/bin/` (the compiled binary name may still be `opencode` in that folder; the published CLI is **`iris`**, with **`opencode`** as a compatibility alias).

### Layout

- `packages/iris` — core CLI, server, TUI (SolidJS + [opentui](https://github.com/sst/opentui))
- `packages/app` — shared web UI (SolidJS)
- `packages/desktop` — Tauri app wrapping `packages/app`
- `packages/plugin` — `@iris-ai/plugin`

### `bun dev` vs installed CLI

`bun dev` runs the same interface as the **`iris`** binary:

```bash
bun dev --help
bun dev serve
bun dev web
bun dev <directory>
```

### API server

```bash
bun dev serve
```

Default port is **4096**; override with e.g. `bun dev serve --port 8080`.

### Web app

1. Start the server (`bun dev serve`).
2. In another terminal:

   ```bash
   bun run --cwd packages/app dev
   ```

### Desktop app

```bash
bun run --cwd packages/desktop tauri dev
```

Web-only (no native window): `bun run --cwd packages/desktop dev`. Production bundle: `bun run --cwd packages/desktop tauri build`.

See [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) if the desktop app fails to start.

### Regenerate SDK / OpenAPI

After API or SDK–visible server changes:

```bash
./script/generate.ts
```

### Debugging

Reliable approach: `bun run --inspect=<url> dev ...` from the repo root and attach your debugger to that URL.

- Server breakpoints: try `bun dev spawn` (worker mode can hide breakpoints on plain `bun dev`).
- Or debug server and TUI separately, e.g. server:  
  `bun run --inspect=ws://localhost:6499/ --cwd packages/iris ./src/index.ts serve --port 4096`  
  then attach the TUI with `iris attach http://localhost:4096`.

VS Code: see [.vscode/settings.example.json](.vscode/settings.example.json) and [.vscode/launch.example.json](.vscode/launch.example.json).

Optional: `export BUN_OPTIONS=--inspect=ws://localhost:6499/` to avoid repeating the flag.

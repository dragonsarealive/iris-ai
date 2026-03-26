<p align="center">
  <a href="https://github.com/dragonsarealive/iris-ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="IRIS">
    </picture>
  </a>
</p>
<p align="center"><strong>IRIS</strong> — Der Open-Source KI-Coding-Agent (Fork von OpenCode).</p>
<p align="center">
  <a href="https://www.npmjs.com/package/iris-code"><img alt="npm" src="https://img.shields.io/npm/v/iris-code?style=flat-square" /></a>
  <a href="https://github.com/dragonsarealive/iris-ai/actions/workflows/publish.yml"><img alt="Build status" src="https://img.shields.io/github/actions/workflow/status/dragonsarealive/iris-ai/publish.yml?style=flat-square&branch=dev" /></a>
</p>

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.zh.md">简体中文</a> |
  <a href="README.zht.md">繁體中文</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.it.md">Italiano</a> |
  <a href="README.da.md">Dansk</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.pl.md">Polski</a> |
  <a href="README.ru.md">Русский</a> |
  <a href="README.bs.md">Bosanski</a> |
  <a href="README.ar.md">العربية</a> |
  <a href="README.no.md">Norsk</a> |
  <a href="README.br.md">Português (Brasil)</a> |
  <a href="README.th.md">ไทย</a> |
  <a href="README.tr.md">Türkçe</a> |
  <a href="README.uk.md">Українська</a> |
  <a href="README.bn.md">বাংলা</a> |
  <a href="README.gr.md">Ελληνικά</a> |
  <a href="README.vi.md">Tiếng Việt</a>
</p>

---

### Installation

```bash
# YOLO
curl -fsSL https://raw.githubusercontent.com/dragonsarealive/iris-ai/dev/install | bash

# Paketmanager
npm i -g iris-code@latest           # oder bun/pnpm/yarn
bunx iris-code                      # run without installing
brew install dragonsarealive/tap/iris # macOS und Linux (empfohlen, immer aktuell)
```

> [!TIP]
> Entferne Versionen älter als 0.1.x vor der Installation.

### Desktop-App (BETA)

IRIS ist auch als Desktop-Anwendung verfügbar. Lade sie direkt von der [Releases-Seite](https://github.com/dragonsarealive/iris-ai/releases) herunter.

| Plattform             | Download                              |
| --------------------- | ------------------------------------- |
| macOS (Apple Silicon) | `iris-desktop-darwin-aarch64.dmg` |
| macOS (Intel)         | `iris-desktop-darwin-x64.dmg`     |
| Windows               | `iris-desktop-windows-x64.exe`    |
| Linux                 | `.deb`, `.rpm` oder AppImage          |

#### Installationsverzeichnis

Das Installationsskript beachtet die folgende Prioritätsreihenfolge für den Installationspfad:

1. `$IRIS_INSTALL_DIR` - Benutzerdefiniertes Installationsverzeichnis
2. `$XDG_BIN_DIR` - XDG Base Directory Specification-konformer Pfad
3. `$HOME/bin` - Standard-Binärverzeichnis des Users (falls vorhanden oder erstellbar)
4. `$HOME/.iris/bin` - Standard-Fallback

```bash
# Beispiele
IRIS_INSTALL_DIR=/usr/local/bin curl -fsSL https://raw.githubusercontent.com/dragonsarealive/iris-ai/dev/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://raw.githubusercontent.com/dragonsarealive/iris-ai/dev/install | bash
```

### Umgebungsvariablen

IRIS akzeptiert **`IRIS_*`-Spiegel** der älteren `OPENCODE_*`-Flags (z. B. `IRIS_SERVER_PASSWORD`, `IRIS_EXPERIMENTAL_AGENT_TEAMS`). Ist `OPENCODE_*` nicht gesetzt, wird `IRIS_*` beim Start übernommen. In neuen Skripten `IRIS_*` bevorzugen.


### Agents

IRIS enthält zwei eingebaute Agents, zwischen denen du mit der `Tab`-Taste wechseln kannst.

- **build** - Standard-Agent mit vollem Zugriff für Entwicklungsarbeit
- **plan** - Nur-Lese-Agent für Analyse und Code-Exploration
  - Verweigert Datei-Edits standardmäßig
  - Fragt vor dem Ausführen von bash-Befehlen nach
  - Ideal zum Erkunden unbekannter Codebases oder zum Planen von Änderungen

Außerdem ist ein **general**-Subagent für komplexe Suchen und mehrstufige Aufgaben enthalten.
Dieser wird intern genutzt und kann in Nachrichten mit `@general` aufgerufen werden.

Mehr dazu unter [Agents](https://opencode.ai/docs/agents).

### Dokumentation

Mehr Infos zur Konfiguration von IRIS findest du in der [upstream OpenCode-Dokumentation](https://opencode.ai/docs). IRIS-spezifische Docs findest du unter irislab.dev.

### Beitragen

Wenn du zu IRIS beitragen möchtest, lies bitte unsere [Contributing Docs](./CONTRIBUTING.md), bevor du einen Pull Request einreichst.

### Auf OpenCode aufbauen

Wenn du an einem Projekt arbeitest, das mit OpenCode zusammenhängt und "opencode" als Teil seines Namens verwendet (z.B. "opencode-dashboard" oder "opencode-mobile"), füge bitte einen Hinweis in deine README ein, dass es nicht vom OpenCode-Team gebaut wird und nicht in irgendeiner Weise mit uns verbunden ist.

### FAQ

#### Worin unterscheidet sich das von Claude Code?

In Bezug auf die Fähigkeiten ist es Claude Code sehr ähnlich. Hier sind die wichtigsten Unterschiede:

- 100% open source
- Nicht an einen Anbieter gekoppelt. Wir empfehlen die Modelle aus [OpenCode Zen](https://opencode.ai/zen); IRIS kann aber auch mit Claude, OpenAI, Google oder sogar lokalen Modellen genutzt werden. Mit der Weiterentwicklung der Modelle werden die Unterschiede kleiner und die Preise sinken, deshalb ist Provider-Unabhängigkeit wichtig.
- LSP-Unterstützung direkt nach dem Start
- Fokus auf TUI. IRIS wird von Neovim-Nutzern und den Machern von [terminal.shop](https://terminal.shop) gebaut; wir treiben die Grenzen dessen, was im Terminal möglich ist.
- Client/Server-Architektur. Das ermöglicht z.B., IRIS auf deinem Computer laufen zu lassen, während du es von einer mobilen App aus fernsteuerst. Das TUI-Frontend ist nur einer der möglichen Clients.

---

**GitHub** [dragonsarealive/iris-ai](https://github.com/dragonsarealive/iris-ai)

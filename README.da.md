<p align="center">
  <a href="https://github.com/dragonsarealive/iris-ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="IRIS">
    </picture>
  </a>
</p>
<p align="center"><strong>IRIS</strong> — Den open source AI-kodeagent (fork af OpenCode).</p>
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

# Pakkehåndteringer
npm i -g iris-code@latest            # eller bun/pnpm/yarn
bunx iris-code                      # run without installing
brew install dragonsarealive/tap/iris # macOS og Linux (anbefalet, altid up to date)
```

> [!TIP]
> Fjern versioner ældre end 0.1.x før installation.

### Desktop-app (BETA)

IRIS findes også som desktop-app. Download direkte fra [releases-siden](https://github.com/dragonsarealive/iris-ai/releases).

| Platform              | Download                              |
| --------------------- | ------------------------------------- |
| macOS (Apple Silicon) | `iris-desktop-darwin-aarch64.dmg` |
| macOS (Intel)         | `iris-desktop-darwin-x64.dmg`     |
| Windows               | `iris-desktop-windows-x64.exe`    |
| Linux                 | `.deb`, `.rpm`, eller AppImage        |

#### Installationsmappe

Installationsscriptet bruger følgende prioriteringsrækkefølge for installationsstien:

1. `$IRIS_INSTALL_DIR` - Tilpasset installationsmappe
2. `$XDG_BIN_DIR` - Sti der følger XDG Base Directory Specification
3. `$HOME/bin` - Standard bruger-bin-mappe (hvis den findes eller kan oprettes)
4. `$HOME/.iris/bin` - Standard fallback

```bash
# Eksempler
IRIS_INSTALL_DIR=/usr/local/bin curl -fsSL https://raw.githubusercontent.com/dragonsarealive/iris-ai/dev/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://raw.githubusercontent.com/dragonsarealive/iris-ai/dev/install | bash
```

### Miljøvariabler

IRIS accepterer **`IRIS_*`-spejle** af ældre `OPENCODE_*`-flag (f.eks. `IRIS_SERVER_PASSWORD`, `IRIS_EXPERIMENTAL_AGENT_TEAMS`). Hvis `OPENCODE_*` ikke er sat, kopieres `IRIS_*` ved opstart. Brug helst `IRIS_*` i nye scripts.


### Agents

IRIS har to indbyggede agents, som du kan skifte mellem med `Tab`-tasten.

- **build** - Standard, agent med fuld adgang til udviklingsarbejde
- **plan** - Skrivebeskyttet agent til analyse og kodeudforskning
  - Afviser filredigering som standard
  - Spørger om tilladelse før bash-kommandoer
  - Ideel til at udforske ukendte kodebaser eller planlægge ændringer

Derudover findes der en **general**-subagent til komplekse søgninger og flertrinsopgaver.
Den bruges internt og kan kaldes via `@general` i beskeder.

Læs mere om [agents](https://opencode.ai/docs/agents).

### Dokumentation

For mere info om konfiguration af IRIS, se [upstream OpenCode documentation](https://opencode.ai/docs). IRIS-specifik dokumentation findes på irislab.dev.

### Bidrag

Hvis du vil bidrage til IRIS, så læs vores [contributing docs](./CONTRIBUTING.md) før du sender en pull request.

### Bygget på OpenCode

Hvis du arbejder på et projekt der er relateret til OpenCode og bruger "opencode" som en del af navnet; f.eks. "opencode-dashboard" eller "opencode-mobile", så tilføj en note i din README, der tydeliggør at projektet ikke er bygget af OpenCode-teamet og ikke er tilknyttet os på nogen måde.

### FAQ

#### Hvordan adskiller dette sig fra Claude Code?

Det minder meget om Claude Code i forhold til funktionalitet. Her er de vigtigste forskelle:

- 100% open source
- Ikke låst til en udbyder. Selvom vi anbefaler modellerne via [OpenCode Zen](https://opencode.ai/zen); kan IRIS bruges med Claude, OpenAI, Google eller endda lokale modeller. Efterhånden som modeller udvikler sig vil forskellene mindskes og priserne falde, så det er vigtigt at være provider-agnostic.
- LSP-support out of the box
- Fokus på TUI. IRIS er bygget af neovim-brugere og skaberne af [terminal.shop](https://terminal.shop); vi vil skubbe grænserne for hvad der er muligt i terminalen.
- Klient/server-arkitektur. Det kan f.eks. lade IRIS køre på din computer, mens du styrer den eksternt fra en mobilapp. Det betyder at TUI-frontend'en kun er en af de mulige clients.

---

**GitHub** [dragonsarealive/iris-ai](https://github.com/dragonsarealive/iris-ai)

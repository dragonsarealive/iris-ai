<p align="center">
  <a href="https://github.com/dragonsarealive/iris-ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="IRIS">
    </picture>
  </a>
</p>
<p align="center"><strong>IRIS</strong> je open source AI agent za programiranje (fork OpenCode-a).</p>
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

### Instalacija

```bash
# YOLO
curl -fsSL https://raw.githubusercontent.com/dragonsarealive/iris-ai/dev/install | bash

# Package manageri
npm i -g iris-code@latest            # ili bun/pnpm/yarn
bunx iris-code                      # run without installing
brew install dragonsarealive/tap/iris # macOS i Linux (preporučeno, uvijek ažurno)
```

> [!TIP]
> Ukloni verzije starije od 0.1.x prije instalacije.

### Desktop aplikacija (BETA)

IRIS je dostupan i kao desktop aplikacija. Preuzmi je direktno sa [stranice izdanja](https://github.com/dragonsarealive/iris-ai/releases).

| Platforma             | Preuzimanje                           |
| --------------------- | ------------------------------------- |
| macOS (Apple Silicon) | `iris-desktop-darwin-aarch64.dmg` |
| macOS (Intel)         | `iris-desktop-darwin-x64.dmg`     |
| Windows               | `iris-desktop-windows-x64.exe`    |
| Linux                 | `.deb`, `.rpm`, ili AppImage          |

#### Instalacijski direktorij

Instalacijska skripta koristi sljedeći redoslijed prioriteta za putanju instalacije:

1. `$IRIS_INSTALL_DIR` - Prilagođeni instalacijski direktorij
2. `$XDG_BIN_DIR` - Putanja usklađena sa XDG Base Directory specifikacijom
3. `$HOME/bin` - Standardni korisnički bin direktorij (ako postoji ili se može kreirati)
4. `$HOME/.iris/bin` - Podrazumijevana rezervna lokacija

```bash
# Primjeri
IRIS_INSTALL_DIR=/usr/local/bin curl -fsSL https://raw.githubusercontent.com/dragonsarealive/iris-ai/dev/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://raw.githubusercontent.com/dragonsarealive/iris-ai/dev/install | bash
```

### Varijable okruženja

IRIS prihvata **`IRIS_*` zrcala** naslijeđenih `OPENCODE_*` zastava (npr. `IRIS_SERVER_PASSWORD`, `IRIS_EXPERIMENTAL_AGENT_TEAMS`). Ako `OPENCODE_*` nije postavljen, vrijednost `IRIS_*` se kopira pri pokretanju. Za nove skripte koristi `IRIS_*`.


### Agenti

IRIS uključuje dva ugrađena agenta između kojih možeš prebacivati tasterom `Tab`.

- **build** - Podrazumijevani agent sa punim pristupom za razvoj
- **plan** - Agent samo za čitanje za analizu i istraživanje koda
  - Podrazumijevano zabranjuje izmjene datoteka
  - Traži dozvolu prije pokretanja bash komandi
  - Idealan za istraživanje nepoznatih codebase-ova ili planiranje izmjena

Uključen je i **general** pod-agent za složene pretrage i višekoračne zadatke.
Koristi se interno i može se pozvati pomoću `@general` u porukama.

Saznaj više o [agentima](https://opencode.ai/docs/agents).

### Dokumentacija

Za više informacija o konfiguraciji IRIS-a, pogledaj [upstream OpenCode documentation](https://opencode.ai/docs). IRIS-specifična dokumentacija je na irislab.dev.

### Doprinosi

Ako želiš doprinositi IRIS-u, pročitaj [upute za doprinošenje](./CONTRIBUTING.md) prije slanja pull requesta.

### Gradnja na OpenCode-u

Ako radiš na projektu koji je povezan s OpenCode-om i koristi "opencode" kao dio naziva, npr. "opencode-dashboard" ili "opencode-mobile", dodaj napomenu u svoj README da projekat nije napravio OpenCode tim i da nije povezan s nama.

### FAQ

#### Po čemu se razlikuje od Claude Code-a?

Po mogućnostima je vrlo sličan Claude Code-u. Ključne razlike su:

- 100% open source
- Nije vezan za jednog provajdera. Iako preporučujemo modele koje nudimo kroz [OpenCode Zen](https://opencode.ai/zen), IRIS možeš koristiti s Claude, OpenAI, Google ili čak lokalnim modelima. Kako modeli napreduju, razlike među njima će se smanjivati, a cijene padati, zato je nezavisnost od provajdera važna.
- LSP podrška odmah po instalaciji
- Fokus na TUI. IRIS grade neovim korisnici i kreatori [terminal.shop](https://terminal.shop); pomjeraćemo granice onoga što je moguće u terminalu.
- Klijent/server arhitektura. To, recimo, omogućava da IRIS radi na tvom računaru dok ga daljinski koristiš iz mobilne aplikacije, što znači da je TUI frontend samo jedan od mogućih klijenata.

---

**GitHub** [dragonsarealive/iris-ai](https://github.com/dragonsarealive/iris-ai)

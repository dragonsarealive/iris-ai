<p align="center">
  <a href="https://github.com/dragonsarealive/iris-ai">
    <picture>
      <source srcset="packages/console/app/src/asset/logo-ornate-dark.svg" media="(prefers-color-scheme: dark)">
      <source srcset="packages/console/app/src/asset/logo-ornate-light.svg" media="(prefers-color-scheme: light)">
      <img src="packages/console/app/src/asset/logo-ornate-light.svg" alt="IRIS">
    </picture>
  </a>
</p>
<p align="center"><strong>IRIS</strong> — El agente de programación con IA de código abierto (fork de OpenCode).</p>
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

### Instalación

```bash
# YOLO
curl -fsSL https://raw.githubusercontent.com/dragonsarealive/iris-ai/dev/install | bash

# Gestores de paquetes
npm i -g iris-code@latest           # o bun/pnpm/yarn
bunx iris-code                      # run without installing
brew install dragonsarealive/tap/iris # macOS y Linux (recomendado, siempre al día)
```

> [!TIP]
> Elimina versiones anteriores a 0.1.x antes de instalar.

### App de escritorio (BETA)

IRIS también está disponible como aplicación de escritorio. Descárgala directamente desde la [página de releases](https://github.com/dragonsarealive/iris-ai/releases).

| Plataforma            | Descarga                              |
| --------------------- | ------------------------------------- |
| macOS (Apple Silicon) | `iris-desktop-darwin-aarch64.dmg` |
| macOS (Intel)         | `iris-desktop-darwin-x64.dmg`     |
| Windows               | `iris-desktop-windows-x64.exe`    |
| Linux                 | `.deb`, `.rpm`, o AppImage            |

#### Directorio de instalación

El script de instalación respeta el siguiente orden de prioridad para la ruta de instalación:

1. `$IRIS_INSTALL_DIR` - Directorio de instalación personalizado
2. `$XDG_BIN_DIR` - Ruta compatible con la especificación XDG Base Directory
3. `$HOME/bin` - Directorio binario estándar del usuario (si existe o se puede crear)
4. `$HOME/.iris/bin` - Alternativa por defecto

```bash
# Ejemplos
IRIS_INSTALL_DIR=/usr/local/bin curl -fsSL https://raw.githubusercontent.com/dragonsarealive/iris-ai/dev/install | bash
XDG_BIN_DIR=$HOME/.local/bin curl -fsSL https://raw.githubusercontent.com/dragonsarealive/iris-ai/dev/install | bash
```

### Variables de entorno

IRIS acepta **espejos `IRIS_*`** de los flags heredados `OPENCODE_*` (p. ej. `IRIS_SERVER_PASSWORD`, `IRIS_EXPERIMENTAL_AGENT_TEAMS`). Si no está definida la variable `OPENCODE_*`, se copia el valor `IRIS_*` al iniciar. Prefiere `IRIS_*` en scripts nuevos.


### Agents

IRIS incluye dos agents integrados que puedes alternar con la tecla `Tab`.

- **build** - Por defecto, agent con acceso completo para trabajo de desarrollo
- **plan** - Agent de solo lectura para análisis y exploración de código
  - Niega ediciones de archivos por defecto
  - Pide permiso antes de ejecutar comandos bash
  - Ideal para explorar codebases desconocidas o planificar cambios

Además, incluye un subagent **general** para búsquedas complejas y tareas de varios pasos.
Se usa internamente y se puede invocar con `@general` en los mensajes.

Más información sobre [agents](https://opencode.ai/docs/agents).

### Documentación

Para más información sobre cómo configurar IRIS, consulta la [documentación upstream de OpenCode](https://opencode.ai/docs). La documentación específica de IRIS está disponible en irislab.dev.

### Contribuir

Si te interesa contribuir a IRIS, lee nuestras [docs de contribución](./CONTRIBUTING.md) antes de enviar un pull request.

### Construyendo sobre OpenCode

Si estás trabajando en un proyecto relacionado con OpenCode y usas "opencode" como parte del nombre; por ejemplo, "opencode-dashboard" u "opencode-mobile", agrega una nota en tu README para aclarar que no está construido por el equipo de OpenCode y que no está afiliado con nosotros de ninguna manera.

### FAQ

#### ¿En qué se diferencia de Claude Code?

Es muy similar a Claude Code en cuanto a capacidades. Estas son las diferencias clave:

- 100% open source
- No está acoplado a ningún proveedor. Aunque recomendamos los modelos que ofrecemos a través de [OpenCode Zen](https://opencode.ai/zen); IRIS se puede usar con Claude, OpenAI, Google o incluso modelos locales. A medida que evolucionan los modelos, las brechas se cerrarán y los precios bajarán, por lo que ser agnóstico al proveedor es importante.
- Soporte LSP listo para usar
- Un enfoque en la TUI. IRIS está construido por usuarios de neovim y los creadores de [terminal.shop](https://terminal.shop); vamos a empujar los límites de lo que es posible en la terminal.
- Arquitectura cliente/servidor. Esto, por ejemplo, permite ejecutar IRIS en tu computadora mientras lo controlas de forma remota desde una app móvil. Esto significa que el frontend TUI es solo uno de los posibles clientes.

---

**GitHub** [dragonsarealive/iris-ai](https://github.com/dragonsarealive/iris-ai)

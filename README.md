# claude-backup

CLI para respaldar y restaurar tu configuración del ecosistema Claude
(Claude Code CLI + Claude Desktop app + skills/plugins custom) y migrarla
entre dispositivos (Windows, macOS, Linux).

## Instalación

```bash
npm install
npm link   # expone el comando `claude-backup` globalmente
```

O ejecutalo directo sin instalar globalmente:

```bash
node bin/claude-backup.js <comando>
```

## Qué respalda, y de dónde

El discovery **nunca asume** que un archivo existe: en runtime revisa cada
ruta candidata y solo incluye lo que realmente encuentra en el disco. Esto
es lo que verifica:

### Claude Code (CLI) — `~/.claude/` en las tres plataformas
(Claude Code es Node.js y resuelve el home igual en Windows/macOS/Linux)

- `settings.json`, `settings.local.json` — configuración del CLI
- `CLAUDE.md` — instrucciones globales
- `.credentials.json` — tokens OAuth (**siempre cifrado**)
- `~/.claude.json` — algunas versiones guardan ahí servidores MCP a nivel
  usuario; si el discovery detecta claves tipo `apiKey`/`token`/`secret`
  dentro de cualquier JSON (no solo este), lo marca sensible automáticamente
- `skills/` — skills custom
- `commands/`, `agents/`, `hooks/` — slash commands, subagentes y hooks
  custom (si tu versión los guarda en directorios separados)
- `plugins/installed_plugins.json`, `plugins/known_marketplaces.json`,
  `plugins/marketplaces/`, `plugins/data/` — plugins instalados y sus
  marketplaces
- `keybindings.json`
- `projects/`, `sessions/`, `history.jsonl` — historial de proyectos y
  sesiones. **Excluido por default** (puede ser pesado y contiene
  fragmentos de conversaciones/código); usar `--include-history` para
  incluirlo.

### Claude Desktop app

| OS | Ruta base |
|---|---|
| macOS | `~/Library/Application Support/Claude/` |
| Windows | `%APPDATA%\Claude\` |
| Linux | `~/.config/Claude/` (Anthropic no distribuye build oficial para Linux; esto aplica si usás un wrapper no oficial) |

Se usa una **lista blanca** de archivos de configuración conocidos
(`claude_desktop_config.json`, `config.json`, `mcp-user-tool-toggles.json`,
`git-worktrees.json`, `extensions-blocklist.json`) — nunca se tocan los
directorios de cache de Electron/Chromium (`Cache/`, `IndexedDB/`,
`Cookies`, `Crashpad/`, etc.), que no son configuración migrable.
`config.json` contiene el cache de tokens OAuth de la app y se cifra
siempre.

### Claude Web (claude.ai)

**No se respalda nada.** Toda la configuración vive server-side asociada a
tu cuenta; lo único local sería `localStorage` del navegador, que no es
portable entre dispositivos ni tiene valor de migración.

### Skills/plugins externos (repos fuera de `~/.claude`)

Si tenés un repo de skills clonado localmente (ej.
`jarbitechture-claude-skills`) y referenciado desde `plugins/marketplaces/`
o `plugins/data/`, el discovery lo sigue automáticamente. Para incluir
cualquier otra ruta manualmente:

```bash
claude-backup backup --extra-path /ruta/a/mi/repo-de-skills
```

Si el repo solo existe en GitHub (no clonado), no se empaqueta contenido:
volvés a clonarlo en el dispositivo destino.

## Comandos

### `backup`

```bash
claude-backup backup
claude-backup backup -o mi-backup.zip
claude-backup backup --profile settings --profile skills   # parcial
claude-backup backup --include-history
```

Si detecta archivos sensibles (credenciales, tokens), pide una passphrase
por prompt interactivo (nunca por argumento en texto plano salvo que uses
`--passphrase`, pensado solo para scripting/CI). Esos archivos se cifran
con **AES-256-GCM**, derivando la clave con **scrypt** desde la
passphrase — todo con `node:crypto`, sin librerías caseras de cifrado. El
resto del backup queda sin cifrar dentro del mismo `.zip`. El manifest
(`manifest.json`, sin cifrar, embebido en el zip) indica exactamente qué
ítems están cifrados.

### `restore <archivo>`

```bash
claude-backup restore mi-backup.zip
claude-backup restore mi-backup.zip --all
claude-backup restore mi-backup.zip --items code.settings --items code.skills
```

Sin `--all`/`--items`, te deja elegir interactivamente qué restaurar. Antes
de sobrescribir cualquier archivo existente en el dispositivo destino, lo
copia a una carpeta de seguridad temporal (se informa la ruta al final).

### `status`

```bash
claude-backup status
```

Dry-run: muestra qué incluiría un `backup` ahora mismo en este dispositivo,
sin tocar ningún archivo.

### `diff <archivo>`

```bash
claude-backup diff mi-backup.zip
```

Compara la configuración actual del dispositivo contra un backup dado
(por hash de contenido), mostrando qué cambió/falta. Si el backup tiene
ítems cifrados, pide la passphrase para incluirlos en la comparación (o
usá `--skip-encrypted` para omitirlos).

## Perfiles / flags de backup parcial

`--profile <categoría>` (repetible) filtra por: `settings`, `skills`,
`plugins`, `credentials`, `desktop`, `skills-external`, `history`. Por
default se incluye todo excepto `history`.

## Seguridad

- Los ítems sensibles se cifran archivo por archivo con AES-256-GCM +
  scrypt, nunca en texto plano.
- Ninguna passphrase ni contenido de credenciales se loguea en stdout.
- El manifest declara qué está cifrado, pero nunca el contenido.
- `diff`/`status` nunca imprimen valores de credenciales, solo
  rutas/tamaños/estado.

## Transporte

Por default el backup es un `.zip` local que movés vos manualmente entre
dispositivos (USB, AirDrop, etc.). No hay sync automático a un proveedor
específico incluido en esta versión — el diseño (`archive.js` produce un
`.zip` autocontenido) permite agregar un paso de sync plugable (ej. subir
el `.zip` resultante a un repo git privado o a un bucket) sin tocar la
lógica de backup/restore.

## Tests

```bash
npm test
```

Cubre: detección de rutas con filesystem mockeado (home temporal, sin
tocar tu `~/.claude` real) y el ciclo completo backup → restore, incluida
la verificación de que una passphrase incorrecta falla en vez de escribir
datos corruptos.

## Limitaciones conocidas

- `restore` no es transaccional: si falla a mitad de camino (ej.
  passphrase incorrecta detectada en el tercer ítem), los ítems ya
  procesados quedan escritos. La copia de seguridad de lo sobrescrito
  siempre se hace antes de tocar cada archivo, así que nada se pierde,
  pero conviene revisar el resultado si un restore se corta.
- El discovery de rutas de Claude Code/Desktop se basa en la estructura
  observada en versiones actuales; si Anthropic cambia dónde guarda algo,
  agregá la regla nueva en `src/discovery/rules.js` (es solo un catálogo
  declarativo de rutas candidatas).

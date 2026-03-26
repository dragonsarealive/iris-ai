# Run IRIS from this repo with local config/cache under .iris-dev (does not touch global iris).
# Requires: Bun 1.3+
#
# CLI / TUI / web / serve (args forwarded to packages/iris iris CLI):
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\script\run-local.ps1 .
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\script\run-local.ps1 web --port 4097
#
# Live team agents E2E (real SessionPrompt + HTTP; uses same XDG paths):
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\script\run-local.ps1 team-e2e .
#   powershell ... team-e2e E:\my-repo
#
# From an already-open PowerShell window you can use:
#   Set-ExecutionPolicy -Scope Process Bypass; .\script\run-local.ps1 .

param(
  [Parameter(Position = 0, ValueFromRemainingArguments = $true)]
  [string[]] $Passthrough = @()
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Get-Item $PSScriptRoot).Parent.FullName
$DevRoot = Join-Path $RepoRoot ".iris-dev"

$env:XDG_DATA_HOME = Join-Path $DevRoot "share"
$env:XDG_CONFIG_HOME = Join-Path $DevRoot "config"
$env:XDG_CACHE_HOME = Join-Path $DevRoot "cache"
$env:XDG_STATE_HOME = Join-Path $DevRoot "state"

Set-Location $RepoRoot

if ($Passthrough.Count -ge 1 -and $Passthrough[0] -ne "team-e2e") {
  Write-Host "IRIS (run-local): XDG -> $DevRoot" -ForegroundColor DarkCyan
  Write-Host "Starting TUI... First launch may sit quiet for 1-3+ min (SQLite migration, config/plugins, worker compile). Try: same command with --print-logs for stderr logs." -ForegroundColor DarkGray
}

if ($Passthrough.Count -ge 1 -and $Passthrough[0] -eq "team-e2e") {
  $projArg = if ($Passthrough.Count -ge 2) { $Passthrough[1] } else { $RepoRoot }
  if ($projArg -eq "." -or [string]::IsNullOrWhiteSpace($projArg)) {
    $projArg = (Get-Location).Path
  }
  $projResolved = (Resolve-Path -LiteralPath $projArg).Path
  $env:OPENCODE_EXPERIMENTAL_AGENT_TEAMS = "1"
  $env:IRIS_TEAM_E2E_DIR = $projResolved
  $env:IRIS_TEAM_E2E_PORT = if ($env:IRIS_TEAM_E2E_PORT) { $env:IRIS_TEAM_E2E_PORT } else { "4099" }
  & bun --cwd (Join-Path $RepoRoot "packages\iris") script/team-live-test.ts
  exit $LASTEXITCODE
}

& bun run dev -- @Passthrough

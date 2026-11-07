$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$runtime = if (Test-Path -LiteralPath $bundledNode) { $bundledNode } elseif ($nodeCommand) { $nodeCommand.Source } else { $null }
if (-not $runtime) { Write-Host 'Install Node.js 22.13 or later from https://nodejs.org.'; Read-Host 'Press Enter'; exit 1 }
& $runtime (Join-Path $PSScriptRoot 'companion.mjs')


$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$bundledNode = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
$nodeCommand = Get-Command node -ErrorAction SilentlyContinue
$runtime = if (Test-Path -LiteralPath $bundledNode) { $bundledNode } elseif ($nodeCommand) { $nodeCommand.Source } else { $null }
if (-not $runtime) { Write-Host 'Install Node.js 22.13 or later from https://nodejs.org, then try again.'; Read-Host 'Press Enter'; exit 1 }
$version = & $runtime -p 'process.versions.node'
if ([int]($version.Split('.')[0]) -lt 22) { Write-Host 'Node.js 22.13 or later is required.'; Read-Host 'Press Enter'; exit 1 }
Write-Host 'Open http://localhost:4173/ in your browser.'
Write-Host 'Keep this window open. Press Ctrl+C to stop.'
$env:PORT = '4173'
& $runtime (Join-Path $PSScriptRoot 'scripts\start-r1.mjs')


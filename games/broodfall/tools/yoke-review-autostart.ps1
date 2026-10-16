<#
  Starts the YOKE's Lines review server (tools/yoke-review-server.cjs, http://localhost:8792/) at every login of this
  Windows user, the same way the Mudpuppy home server does. No admin: a .cmd in the Startup folder. Run once:

    powershell -ExecutionPolicy Bypass -File C:\Users\Merry\dev\space-derelict\games\broodfall\tools\yoke-review-autostart.ps1
    ... -Remove        to take it out again

  A second copy fails to bind port 8792 and exits, so it is safe if the server is already running.
#>
param([switch]$Remove)

$startup = [Environment]::GetFolderPath('Startup')
$cmd = Join-Path $startup 'YOKE Lines Review Server.cmd'
if ($Remove) {
  if (Test-Path $cmd) { Remove-Item $cmd -Force; "removed $cmd" } else { "nothing to remove" }
  exit 0
}
$serve = Join-Path $PSScriptRoot 'yoke-review-server.cjs'
if (-not (Test-Path $serve)) { throw "yoke-review-server.cjs not found next to this script: $serve" }
$body = @"
@echo off
REM YOKE's Lines review page (http://localhost:8792/). Installed by yoke-review-autostart.ps1.
cd /d "$PSScriptRoot\.."
start "YOKE Lines Review" /min node "$serve"
"@
Set-Content -Path $cmd -Value $body -Encoding ascii
"installed: $cmd"

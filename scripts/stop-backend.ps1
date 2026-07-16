$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$PidFile = Join-Path $ProjectRoot "logs\backend.pid"

if (-not (Test-Path $PidFile)) {
  Write-Host "No backend PID file found."
  exit 0
}

$BackendPid = (Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
if (-not $BackendPid) {
  Remove-Item -LiteralPath $PidFile -ErrorAction SilentlyContinue
  Write-Host "Backend PID file was empty."
  exit 0
}

$Process = Get-Process -Id $BackendPid -ErrorAction SilentlyContinue
if ($Process) {
  Stop-Process -Id $BackendPid -Force
  Write-Host "Backend stopped. PID: $BackendPid"
} else {
  Write-Host "Backend process was not running. PID: $BackendPid"
}

Remove-Item -LiteralPath $PidFile -ErrorAction SilentlyContinue

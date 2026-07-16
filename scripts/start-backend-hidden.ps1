$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$LogDir = Join-Path $ProjectRoot "logs"
$PidFile = Join-Path $LogDir "backend.pid"
$Python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"
$StdoutLog = Join-Path $LogDir "backend.out.log"
$StderrLog = Join-Path $LogDir "backend.err.log"

if (-not (Test-Path $Python)) {
  throw "Python virtual environment was not found: $Python"
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

if (Test-Path $PidFile) {
  $ExistingPid = (Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
  if ($ExistingPid -and (Get-Process -Id $ExistingPid -ErrorAction SilentlyContinue)) {
    Write-Host "Backend is already running. PID: $ExistingPid"
    exit 0
  }
}

$Listener = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($Listener) {
  Set-Content -Path $PidFile -Value $Listener.OwningProcess -Encoding ASCII
  Write-Host "Port 8000 is already in use. PID: $($Listener.OwningProcess)"
  exit 0
}

$CurrentPath = [System.Environment]::GetEnvironmentVariable("Path", "Process")
[System.Environment]::SetEnvironmentVariable("PATH", $null, "Process")
if ($CurrentPath) {
  [System.Environment]::SetEnvironmentVariable("Path", $CurrentPath, "Process")
}

$Process = Start-Process `
  -WindowStyle Hidden `
  -FilePath $Python `
  -ArgumentList @("-m", "uvicorn", "backend.main:app", "--host", "127.0.0.1", "--port", "8000") `
  -WorkingDirectory $ProjectRoot `
  -RedirectStandardOutput $StdoutLog `
  -RedirectStandardError $StderrLog `
  -PassThru

Set-Content -Path $PidFile -Value $Process.Id -Encoding ASCII
Start-Sleep -Seconds 2

try {
  $Health = Invoke-RestMethod -Uri "http://127.0.0.1:8000/api/health" -Method Get -TimeoutSec 5
  Write-Host "Backend started. PID: $($Process.Id). Storage: $($Health.storage)"
} catch {
  Write-Host "Backend process started, but health check did not respond yet. PID: $($Process.Id)"
  Write-Host "Check logs: $StderrLog"
}

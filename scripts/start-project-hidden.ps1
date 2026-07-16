$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$LogDir = Join-Path $ProjectRoot "logs"
$Python = Join-Path $ProjectRoot ".venv\Scripts\python.exe"

if (-not (Test-Path $Python)) {
  throw "Python virtual environment was not found: $Python"
}

New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

function Normalize-ProcessPath {
  $CurrentPath = [System.Environment]::GetEnvironmentVariable("Path", "Process")
  [System.Environment]::SetEnvironmentVariable("PATH", $null, "Process")
  if ($CurrentPath) {
    [System.Environment]::SetEnvironmentVariable("Path", $CurrentPath, "Process")
  }
}

function Start-ServiceIfNeeded {
  param(
    [Parameter(Mandatory=$true)][string]$Name,
    [Parameter(Mandatory=$true)][int]$Port,
    [Parameter(Mandatory=$true)][string[]]$Arguments,
    [Parameter(Mandatory=$true)][string]$WorkingDirectory
  )

  $PidFile = Join-Path $LogDir "$Name.pid"
  $StdoutLog = Join-Path $LogDir "$Name.out.log"
  $StderrLog = Join-Path $LogDir "$Name.err.log"

  if (Test-Path $PidFile) {
    $ExistingPid = (Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
    if ($ExistingPid -and (Get-Process -Id $ExistingPid -ErrorAction SilentlyContinue)) {
      Write-Host "$Name already running. PID: $ExistingPid"
      return
    }
  }

  $Listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($Listener) {
    Set-Content -Path $PidFile -Value $Listener.OwningProcess -Encoding ASCII
    Write-Host "$Name port $Port is already in use. PID: $($Listener.OwningProcess)"
    return
  }

  $Process = Start-Process `
    -WindowStyle Hidden `
    -FilePath $Python `
    -ArgumentList $Arguments `
    -WorkingDirectory $WorkingDirectory `
    -RedirectStandardOutput $StdoutLog `
    -RedirectStandardError $StderrLog `
    -PassThru

  Set-Content -Path $PidFile -Value $Process.Id -Encoding ASCII
  Write-Host "$Name started. PID: $($Process.Id)"
}

Normalize-ProcessPath

Start-ServiceIfNeeded `
  -Name "frontend" `
  -Port 5173 `
  -Arguments @("-m", "http.server", "5173", "--bind", "127.0.0.1") `
  -WorkingDirectory (Join-Path $ProjectRoot "frontend")

Start-Sleep -Seconds 2

try {
  $Frontend = Invoke-WebRequest -Uri "http://127.0.0.1:5173/" -UseBasicParsing -TimeoutSec 5
  Write-Host "Frontend: $($Frontend.StatusCode) http://127.0.0.1:5173/"
} catch {
  Write-Host "Frontend health check failed."
}

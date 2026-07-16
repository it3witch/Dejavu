$ErrorActionPreference = "Stop"

$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$LogDir = Join-Path $ProjectRoot "logs"

foreach ($Name in @("frontend", "backend")) {
  $PidFile = Join-Path $LogDir "$Name.pid"
  if (-not (Test-Path $PidFile)) {
    continue
  }

  $Pid = (Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
  if ($Pid) {
    Stop-Process -Id $Pid -Force -ErrorAction SilentlyContinue
  }

  Remove-Item -LiteralPath $PidFile -ErrorAction SilentlyContinue
  Write-Host "$Name stopped."
}

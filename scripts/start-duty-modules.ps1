# Starts the 4 duty module apps for the platform portal embed (local only).
# Resolves paths from this repo root — works on any machine clone.
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $root "inspect-mn"))) {
  Write-Error "Expected repo root at $root (inspect-mn missing)."
}

$apps = @(
  @{ Name = "inspection-center"; Rel = "inspection-center"; Port = 3001 },
  @{ Name = "bgs-policy-compliance"; Rel = "bgs-policy-compliance"; Port = 3002 },
  @{ Name = "development"; Rel = "development"; Port = 3003 },
  @{ Name = "process"; Rel = "process"; Port = 3004 }
)

foreach ($app in $apps) {
  $path = Join-Path $root $app.Rel
  if (-not (Test-Path $path)) {
    Write-Host "SKIP missing $path"
    continue
  }
  Write-Host "Starting $($app.Name) on port $($app.Port)..."
  Start-Process -FilePath "npm" -ArgumentList @("run", "dev", "--", "-p", "$($app.Port)") -WorkingDirectory $path -WindowStyle Minimized
}

$portal = Join-Path $root "inspect-mn"
Write-Host ""
Write-Host "Then start portal:"
Write-Host "  cd `"$portal`""
Write-Host "  npm run dev"
Write-Host ""
Write-Host "Open http://localhost:3000 - sidebar: inspection / policy / development / process"
Write-Host "Duty modules require matching POLICY_EMBED_SECRET / INSPECTION_EMBED_SECRET on portal + modules."

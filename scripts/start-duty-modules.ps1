# Starts the 3 ҮҮРЭГ module apps for the platform portal embed.
$ErrorActionPreference = "Stop"

$apps = @(
  @{ Name = "inspection-center"; Path = "C:\Users\Owner\platform\inspection-center"; Port = 3001 },
  @{ Name = "bgs-policy-compliance"; Path = "C:\Users\Owner\platform\bgs-policy-compliance"; Port = 3002 },
  @{ Name = "development"; Path = "C:\Users\Owner\platform\development"; Port = 3003 }
)

foreach ($app in $apps) {
  if (-not (Test-Path $app.Path)) {
    Write-Host "SKIP missing $($app.Path)"
    continue
  }
  Write-Host "Starting $($app.Name) on port $($app.Port)..."
  Start-Process -FilePath "npm" -ArgumentList @("run", "dev", "--", "-p", "$($app.Port)") -WorkingDirectory $app.Path -WindowStyle Minimized
}

Write-Host ""
Write-Host "Then start portal:"
Write-Host "  cd C:\Users\Owner\platform\inspect-mn"
Write-Host "  npm run dev"
Write-Host ""
Write-Host "Open portal and use sidebar: Хяналт шалгалт / Журмын биелэлт / Судалгаа хөгжүүлэлт"

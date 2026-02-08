# Cleanup Script - Remove Old Directories

Write-Host "Cleaning up old kargogig directories..." -ForegroundColor Yellow

# Remove old backend
if (Test-Path "kargogig-backend") {
    Write-Host "Removing kargogig-backend..." -ForegroundColor Cyan
    Remove-Item -Recurse -Force "kargogig-backend"
    Write-Host "✓ kargogig-backend removed" -ForegroundColor Green
}

# Remove old frontend
if (Test-Path "kargogig-frontend") {
    Write-Host "Removing kargogig-frontend..." -ForegroundColor Cyan
    Remove-Item -Recurse -Force "kargogig-frontend"
    Write-Host "✓ kargogig-frontend removed" -ForegroundColor Green
}

# Remove root-level JSON files that are no longer needed
$oldFiles = @("estimate_body.json", "route_body.json", "route.json", "routes_body.json")
foreach ($file in $oldFiles) {
    if (Test-Path $file) {
        Write-Host "Removing $file..." -ForegroundColor Cyan
        Remove-Item -Force $file
        Write-Host "✓ $file removed" -ForegroundColor Green
    }
}

Write-Host "`nCleanup complete! ✨" -ForegroundColor Green
Write-Host "Old directories have been removed." -ForegroundColor White
Write-Host "`nNew structure:" -ForegroundColor Yellow
Write-Host "  apps/web-customer  - Customer web app" -ForegroundColor White
Write-Host "  apps/web-company   - Company dashboard" -ForegroundColor White
Write-Host "  apps/admin         - Admin panel" -ForegroundColor White
Write-Host "  services/backend   - NestJS API (clean & organized)" -ForegroundColor White
Write-Host "  packages/contracts - Shared types & schemas" -ForegroundColor White
Write-Host "  packages/ui-auth   - Supabase auth helpers" -ForegroundColor White
Write-Host "  packages/ui        - Shared UI components" -ForegroundColor White
Write-Host "  packages/config    - Shared configs (ESLint, TS, Prettier)" -ForegroundColor White

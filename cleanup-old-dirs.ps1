# Monorepo Cleanup Script

# Remove old kargogig-frontend directory (now in apps/customer-web)
Remove-Item -Recurse -Force kargogig-frontend -ErrorAction SilentlyContinue

# Remove old kargogig-backend directory (now in services/backend)
Remove-Item -Recurse -Force kargogig-backend -ErrorAction SilentlyContinue

Write-Host "✓ Cleanup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Run 'npm install' in root to install all workspace dependencies"
Write-Host "2. Copy .env.local files to each app"
Write-Host "3. Run 'npm run dev:customer' to start customer web app"
Write-Host ""

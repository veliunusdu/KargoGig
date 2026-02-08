# Backend Reorganization Script
# Moves existing modules to src/modules/ and organizes SQL files

Write-Host "🚀 Starting backend reorganization..." -ForegroundColor Cyan
Write-Host ""

$backendPath = "services\backend"
$srcPath = "$backendPath\src"

# 1. Create modules directory
Write-Host "📁 Creating src/modules directory..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "$srcPath\modules" | Out-Null

# 2. Move module folders to src/modules/
$modulesToMove = @(
    "admin",
    "announcements",
    "companies",
    "customers",
    "drivers",
    "health",
    "maps",
    "matching",
    "notifications",
    "offers",
    "payments",
    "profiles",
    "refunds",
    "rides",
    "shipments",
    "vehicles"
)

Write-Host "📦 Moving modules to src/modules/..." -ForegroundColor Yellow
foreach ($module in $modulesToMove) {
    $source = "$srcPath\$module"
    $dest = "$srcPath\modules\$module"
    
    if (Test-Path $source) {
        Write-Host "  ✓ Moving $module..." -ForegroundColor Green
        Move-Item -Path $source -Destination $dest -Force
    } else {
        Write-Host "  ⚠ $module not found, skipping..." -ForegroundColor DarkYellow
    }
}

# 3. Move observability to modules
Write-Host "📦 Moving observability to modules..." -ForegroundColor Yellow
if (Test-Path "$srcPath\observability") {
    Move-Item -Path "$srcPath\observability" -Destination "$srcPath\modules\observability" -Force
    Write-Host "  ✓ Moved observability" -ForegroundColor Green
}

# 4. Move supabase to src/ (it stays at root level, not in modules)
Write-Host "📦 Supabase module stays at src/supabase (correct location)" -ForegroundColor Green

# 5. Organize SQL files
Write-Host "🗃️  Organizing SQL files..." -ForegroundColor Yellow

# Migration files
$migrationFiles = @(
    "day3_shopier_migration.sql",
    "day4_analytics_events.sql",
    "day4_audit_logs_request_id.sql",
    "day5_audit_logs_request_id.sql",
    "day5_refunds_migration.sql",
    "day7_push_notifications_migration.sql",
    "week8_day3_automation_fix.sql",
    "payment_guardrails.sql"
)

foreach ($file in $migrationFiles) {
    $source = "$backendPath\sql\$file"
    if (Test-Path $source) {
        Move-Item -Path $source -Destination "$backendPath\sql\migrations\$file" -Force
        Write-Host "  ✓ Moved $file to migrations/" -ForegroundColor Green
    }
}

# RPC files
$rpcFiles = @(
    "admin_actions_rpc.sql",
    "is_admin_rpc.sql",
    "verify_complete_ride_rpc.sql",
    "create_company_as_user.sql",
    "credit_company_wallet_for_payment.sql",
    "refund_full_for_payment.sql",
    "refund_partial_for_payment.sql"
)

foreach ($file in $rpcFiles) {
    $source = "$backendPath\sql\$file"
    if (Test-Path $source) {
        Move-Item -Path $source -Destination "$backendPath\sql\rpcs\$file" -Force
        Write-Host "  ✓ Moved $file to rpcs/" -ForegroundColor Green
    }
}

# Trigger files
$triggerFiles = @(
    "day5_fix_both_triggers.sql",
    "day5_offers_accept_trigger_fix.sql",
    "day5_trigger_simple_fix.sql",
    "disable_buggy_trigger.sql"
)

foreach ($file in $triggerFiles) {
    $source = "$backendPath\sql\$file"
    if (Test-Path $source) {
        Move-Item -Path $source -Destination "$backendPath\sql\triggers\$file" -Force
        Write-Host "  ✓ Moved $file to triggers/" -ForegroundColor Green
    }
}

# Debug files
$debugFiles = @(
    "debug_enum.sql"
)

foreach ($file in $debugFiles) {
    $source = "$backendPath\sql\$file"
    if (Test-Path $source) {
        Move-Item -Path $source -Destination "$backendPath\sql\debug\$file" -Force
        Write-Host "  ✓ Moved $file to debug/" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "✅ Backend reorganization complete!" -ForegroundColor Green
Write-Host ""
Write-Host "⚠️  IMPORTANT: You need to update imports in the following files:" -ForegroundColor Yellow
Write-Host "   - src/app.module.ts (update module paths)"
Write-Host "   - Any files importing from moved modules"
Write-Host ""
Write-Host "💡 TIP: Use VS Code's 'Organize Imports' feature to fix paths automatically" -ForegroundColor Cyan
Write-Host "   1. Open app.module.ts"
Write-Host "   2. Press Shift+Alt+O (Windows) or Shift+Option+O (Mac)"
Write-Host ""
Write-Host "🔍 To find files needing updates, run:" -ForegroundColor Cyan
Write-Host "   grep -r 'from.*/(admin|customers|drivers)' src/" -ForegroundColor White
Write-Host ""

$ErrorActionPreference = "Stop"

$SUPABASE_URL = $env:SUPABASE_URL.TrimEnd("/")
$SERVICE_KEY  = $env:SUPABASE_SERVICE_ROLE_KEY
$COMPANY_USER_ID = "8076b2fa-8467-4dac-8f26-27b330e7f564"  # From .env.test comments

if ([string]::IsNullOrWhiteSpace($SUPABASE_URL)) { throw "SUPABASE_URL not set" }
if ([string]::IsNullOrWhiteSpace($SERVICE_KEY)) { throw "SUPABASE_SERVICE_ROLE_KEY not set" }

$headers = @{
  apikey = $SERVICE_KEY
  Authorization = "Bearer $SERVICE_KEY"
  "Content-Type" = "application/json"
  Prefer = "return=representation"
}

Write-Host "`nChecking if company exists for user $COMPANY_USER_ID..." -ForegroundColor Cyan

try {
  $existing = Invoke-RestMethod -Method Get `
    -Uri "$SUPABASE_URL/rest/v1/companies?user_id=eq.$COMPANY_USER_ID&select=id,name" `
    -Headers $headers
  
  if ($existing -and $existing.Count -gt 0) {
    Write-Host "✓ Company already exists: $($existing[0].name) (ID: $($existing[0].id))" -ForegroundColor Green
    Write-Host "`nYou can now run tests with: pnpm run test:e2e -- test/day5-demo.e2e-spec.ts"
    exit 0
  }
} catch {
  Write-Host "Company not found, will create..." -ForegroundColor Yellow
}

Write-Host "Creating company for user $COMPANY_USER_ID..." -ForegroundColor Cyan

try {
  $body = @{
    p_user_id = $COMPANY_USER_ID
    p_name = "Demo Transport Co."
    p_status = "approved"
  } | ConvertTo-Json
  
  $companyId = Invoke-RestMethod -Method Post `
    -Uri "$SUPABASE_URL/rest/v1/rpc/create_company_as_user" `
    -Headers $headers `
    -Body $body
  
  Write-Host "✓ Created company ID: $companyId" -ForegroundColor Green
  Write-Host "`nYou can now run tests with: pnpm run test:e2e -- test/day5-demo.e2e-spec.ts"
} catch {
  Write-Host "❌ Error creating company:" -ForegroundColor Red
  Write-Host $_.Exception.Message
  Write-Host "`nMake sure the create_company_as_user function exists in your database."
  Write-Host "Run: psql \`$DATABASE_URL -f services/backend/sql/create_company_as_user.sql"
  exit 1
}

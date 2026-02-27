$ErrorActionPreference = "Stop"

function Require($name) {
  $v = [Environment]::GetEnvironmentVariable($name, "Process")
  if ([string]::IsNullOrWhiteSpace($v)) { throw "Missing env var: $name" }
  return $v
}

$SUPABASE_URL = (Require "SUPABASE_URL").TrimEnd("/")
$SERVICE_KEY  = Require "SUPABASE_SERVICE_ROLE_KEY"

$demoCustomerEmail = Require "DEMO_CUSTOMER_EMAIL"
$demoCustomerPass  = Require "DEMO_CUSTOMER_PASSWORD"
$demoCompanyEmail  = Require "DEMO_COMPANY_EMAIL"
$demoCompanyPass   = Require "DEMO_COMPANY_PASSWORD"

$authHeaders = @{
  apikey = $SERVICE_KEY
  Authorization = "Bearer $SERVICE_KEY"
  "Content-Type" = "application/json"
}

function Find-UserIdByEmail([string]$Email) {
  $page = 1
  $per  = 200
  while ($true) {
    $resp = Invoke-RestMethod -Method Get -Uri "$SUPABASE_URL/auth/v1/admin/users?page=$page&per_page=$per" -Headers $authHeaders
    $u = $resp.users | Where-Object { $_.email -eq $Email } | Select-Object -First 1
    if ($u) { return $u.id }
    if ($resp.users.Count -lt $per) { return $null }
    $page++
  }
}

function Ensure-AuthUser([string]$Email, [string]$Password) {
  $id = Find-UserIdByEmail $Email
  if (-not $id) {
    Write-Host "Creating auth user: $Email" -ForegroundColor Cyan
    $body = @{ email=$Email; password=$Password; email_confirm=$true } | ConvertTo-Json
    $created = Invoke-RestMethod -Method Post -Uri "$SUPABASE_URL/auth/v1/admin/users" -Headers $authHeaders -Body $body
    return $created.id
  } else {
    Write-Host "User exists: $Email (resetting password)" -ForegroundColor Yellow
    $body = @{ password=$Password; email_confirm=$true } | ConvertTo-Json
    Invoke-RestMethod -Method Put -Uri "$SUPABASE_URL/auth/v1/admin/users/$id" -Headers $authHeaders -Body $body | Out-Null
    return $id
  }
}

function Ensure-Company([string]$UserId, [string]$CompanyName) {
  # Check if company exists for this user
  $existing = Invoke-RestMethod -Method Get -Uri "$SUPABASE_URL/rest/v1/companies?user_id=eq.$UserId&select=id,name" -Headers $authHeaders
  
  if ($existing -and $existing.Count -gt 0) {
    Write-Host "Company exists for user: $($existing[0].name) (ID: $($existing[0].id))" -ForegroundColor Yellow
    return $existing[0].id
  }
  
  Write-Host "Creating company '$CompanyName' for user $UserId" -ForegroundColor Cyan
  
  # Call the RPC function to create company with proper user context
  $body = @{
    p_user_id = $UserId
    p_name = $CompanyName
    p_status = "approved"
  } | ConvertTo-Json
  
  $companyId = Invoke-RestMethod -Method Post -Uri "$SUPABASE_URL/rest/v1/rpc/create_company_as_user" -Headers $authHeaders -Body $body
  
  Write-Host "✓ Created company ID: $companyId" -ForegroundColor Green
  return $companyId
}

# Seed users
Write-Host "`n=== Seeding Demo Users ===" -ForegroundColor Magenta

$customerUserId = Ensure-AuthUser $demoCustomerEmail $demoCustomerPass
$companyUserId  = Ensure-AuthUser $demoCompanyEmail  $demoCompanyPass

Write-Host "`n=== Seeding Demo Company ===" -ForegroundColor Magenta
$companyId = Ensure-Company $companyUserId "Demo Transport Co."

Write-Host "`n✅ DONE - Demo data seeded" -ForegroundColor Green
Write-Host "Customer User ID: $customerUserId"
Write-Host "Company User ID:  $companyUserId"
Write-Host "Company ID:       $companyId"
Write-Host "`nYou can now run: pnpm run test:e2e -- test/day5-demo.e2e-spec.ts"

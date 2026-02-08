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
$demoDriverEmail   = Require "DEMO_DRIVER_EMAIL"
$demoDriverPass    = Require "DEMO_DRIVER_PASSWORD"

$authHeaders = @{
  apikey = $SERVICE_KEY
  Authorization = "Bearer $SERVICE_KEY"
}

function Find-UserIdByEmail([string]$Email) {
  $page = 1
  $per  = 200
  while ($true) {
    $resp = Invoke-RestMethod -Method Get -Uri "$SUPABASE_URL/auth/v1/admin/users?page=$page&per_page=$per" -Headers $authHeaders
    $u = $resp.users | Where-Object { $_.email -eq $Email } | Select-Object -First 1
    if ($u) { return $u.id }
    if ($resp.users.Count -lt $per) { return $null } # last page
    $page++
  }
}

function Ensure-AuthUser([string]$Email, [string]$Password) {
  $id = Find-UserIdByEmail $Email
  if (-not $id) {
    Write-Host "Creating auth user: $Email" -ForegroundColor Cyan
    $body = @{ email=$Email; password=$Password; email_confirm=$true } | ConvertTo-Json
    $created = Invoke-RestMethod -Method Post -Uri "$SUPABASE_URL/auth/v1/admin/users" -Headers $authHeaders -ContentType "application/json" -Body $body
    return $created.id
  } else {
    Write-Host "User exists, resetting password: $Email" -ForegroundColor Yellow
    $body = @{ password=$Password; email_confirm=$true } | ConvertTo-Json
    Invoke-RestMethod -Method Put -Uri "$SUPABASE_URL/auth/v1/admin/users/$id" -Headers $authHeaders -ContentType "application/json" -Body $body | Out-Null
    return $id
  }
}

$customerUserId = Ensure-AuthUser $demoCustomerEmail $demoCustomerPass
$companyUserId  = Ensure-AuthUser $demoCompanyEmail  $demoCompanyPass
$driverUserId   = Ensure-AuthUser $demoDriverEmail   $demoDriverPass

Write-Host "`nDONE ✅ Auth users ready" -ForegroundColor Green
Write-Host "customerUserId=$customerUserId"
Write-Host "companyUserId=$companyUserId"
Write-Host "driverUserId=$driverUserId"

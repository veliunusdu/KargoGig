<#
.SYNOPSIS
  KargoGig Day 5 — End-to-end demo script (PowerShell 5.1 compatible)
.DESCRIPTION
  Runs the full demo flow: health -> announcement -> match -> offer -> accept -> checkout -> callback
  Uses Supabase password grants for authentication.
.NOTES
  Required env vars (in .env or .env.test):
    SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
    DEMO_CUSTOMER_EMAIL, DEMO_CUSTOMER_PASSWORD
    DEMO_COMPANY_EMAIL, DEMO_COMPANY_PASSWORD
    API_BASE_URL (default: http://localhost:3000)
#>

$ErrorActionPreference = "Stop"

# ============================================================
#  Helpers
# ============================================================
function Load-DotEnv {
  param([string]$Path, [switch]$Override)
  if (-not (Test-Path $Path)) { return }
  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if ($line -eq "" -or $line.StartsWith("#")) { return }
    $parts = $line -split "=", 2
    if ($parts.Length -eq 2) {
      $key = $parts[0].Trim()
      $val = $parts[1].Trim().Trim('"').Trim("'")
      # Set variable - override if flag is set or if doesn't exist
      if ($Override -or -not (Get-Item -Path "Env:$key" -ErrorAction SilentlyContinue)) {
        Set-Item -Path "Env:$key" -Value $val
      }
    }
  }
}

function Env {
  param([string]$Name, [string]$Default = "")
  $v = Get-Item -Path "Env:$Name" -ErrorAction SilentlyContinue
  if ($v) { return $v.Value }
  return $Default
}

function Get-SupabaseToken {
  param([string]$Email, [string]$Password, [string]$Label = "user")

  $url  = Env "SUPABASE_URL"
  $anon = Env "SUPABASE_ANON_KEY"

  $body = @{ email = $Email; password = $Password } | ConvertTo-Json
  $headers = @{
    "apikey"        = $anon
    "Authorization" = "Bearer $anon"
    "Content-Type"  = "application/json"
  }

  Write-Host "`n--- Login: $Label ($Email) ---" -ForegroundColor Cyan
  try {
    $resp = Invoke-RestMethod `
      -Uri "$url/auth/v1/token?grant_type=password" `
      -Method POST `
      -Headers $headers `
      -Body $body `
      -ErrorAction Stop

    $token = $resp.access_token
    $parts = $token.Split(".")
    if ($parts.Count -ne 3) {
      Write-Host "  [WARN] Token does not look like a JWT (parts=$($parts.Count))" -ForegroundColor Yellow
    } else {
      Write-Host "  [OK] Got JWT for $Label" -ForegroundColor Green
    }
    return $token
  }
  catch {
    Write-Host "  [FAIL] Login failed for $Email : $_" -ForegroundColor Red
    throw
  }
}

$script:reqCounter = 0
function Next-RequestId {
  $script:reqCounter++
  return "demo-{0:D3}" -f $script:reqCounter
}

function Invoke-Api {
  param(
    [string]$Method,
    [string]$Path,
    [string]$Token = "",
    [object]$Body = $null,
    [string]$Label = ""
  )

  $base = Env "API_BASE_URL" "http://localhost:3000"
  $uri  = "$base$Path"
  $rid  = Next-RequestId

  $headers = @{
    "Content-Type"  = "application/json"
    "x-request-id"  = $rid
  }
  if ($Token) {
    $headers["Authorization"] = "Bearer $Token"
  }

  $displayLabel = if ($Label) { $Label } else { "$Method $Path" }
  Write-Host "`n=== [$rid] $displayLabel ===" -ForegroundColor Magenta

  $params = @{
    Uri         = $uri
    Method      = $Method
    Headers     = $headers
    ErrorAction = "Stop"
  }
  if ($Body -and ($Method -ne "GET")) {
    $jsonBody = ""
    if ($Body -is [string]) { $jsonBody = $Body }
    else { $jsonBody = $Body | ConvertTo-Json -Depth 10 }
    $params["Body"] = $jsonBody
  }

  try {
    $resp = Invoke-RestMethod @params
    $respJson = $resp | ConvertTo-Json -Depth 10
    Write-Host $respJson -ForegroundColor Gray
    return $resp
  }
  catch {
    $ex = $_.Exception
    $errBody = ""
    if ($ex.Response) {
      try {
        $stream = $ex.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $errBody = $reader.ReadToEnd()
        $reader.Close()
        $stream.Close()
      }
      catch {}
    }
    Write-Host "  [ERROR] $($ex.Message)" -ForegroundColor Red
    if ($errBody) {
      Write-Host "  Response: $errBody" -ForegroundColor DarkRed
    }
    throw
  }
}

# ============================================================
#  Load env
# ============================================================
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Split-Path -Parent $scriptDir

# Load .env files (later files override earlier ones)
Load-DotEnv (Join-Path $backendDir ".env") -Override
Load-DotEnv (Join-Path $backendDir ".env.test") -Override
# Also try root-level .env
Load-DotEnv (Join-Path (Split-Path -Parent $backendDir) ".env") -Override

# Validate required vars
$required = @("SUPABASE_URL", "SUPABASE_ANON_KEY", "DEMO_CUSTOMER_EMAIL", "DEMO_CUSTOMER_PASSWORD", "DEMO_COMPANY_EMAIL", "DEMO_COMPANY_PASSWORD")
foreach ($var in $required) {
  $val = Env $var
  if (-not $val) {
    Write-Host "[FATAL] Missing env var: $var" -ForegroundColor Red
    Write-Host "Set it in .env or .env.test" -ForegroundColor Yellow
    exit 1
  }
}

Write-Host "`n============================================" -ForegroundColor Green
Write-Host "  KargoGig Day 5 — End-to-End Demo" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green

# ============================================================
#  1) GET /api/v1/health
# ============================================================
Write-Host "`n`n>>> STEP 1: Health Check <<<" -ForegroundColor Yellow
$health = Invoke-Api -Method GET -Path "/api/v1/health" -Label "Health Check"

# ============================================================
#  2) Login
# ============================================================
Write-Host "`n`n>>> STEP 2: Authentication <<<" -ForegroundColor Yellow
$customerToken = Get-SupabaseToken `
  -Email (Env "DEMO_CUSTOMER_EMAIL") `
  -Password (Env "DEMO_CUSTOMER_PASSWORD") `
  -Label "customer"

$companyToken = Get-SupabaseToken `
  -Email (Env "DEMO_COMPANY_EMAIL") `
  -Password (Env "DEMO_COMPANY_PASSWORD") `
  -Label "company"

# ============================================================
#  3) POST /api/v1/announcements
# ============================================================
Write-Host "`n`n>>> STEP 3: Create Announcement (customer) <<<" -ForegroundColor Yellow
$annBody = @{
  pickup_location    = "Kadikoy, Istanbul"
  pickup_lat         = 40.9903
  pickup_lng         = 29.0295
  pickup_city        = "Istanbul"
  delivery_location  = "Besiktas, Istanbul"
  delivery_lat       = 41.0422
  delivery_lng       = 29.0057
  delivery_city      = "Istanbul"
  cargo_type         = "furniture"
  cargo_weight       = 120
  notes              = "Day5 demo test - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
}

$announcement = Invoke-Api -Method POST -Path "/api/v1/announcements" `
  -Token $customerToken -Body $annBody -Label "Create Announcement"

$announcementId = $announcement.id
if (-not $announcementId) {
  Write-Host "[FATAL] No announcement ID returned!" -ForegroundColor Red
  exit 1
}
Write-Host "`n  >> announcement_id = $announcementId" -ForegroundColor Green

# ============================================================
#  4) POST /api/v1/announcements/:id/match
# ============================================================
Write-Host "`n`n>>> STEP 4: Match Announcement <<<" -ForegroundColor Yellow
try {
  $match = Invoke-Api -Method POST `
    -Path "/api/v1/announcements/$announcementId/match?radius_meters=50000&limit=20" `
    -Token $companyToken -Label "Match Announcement"
  Write-Host "  Matched drivers: $($match.matched_count)" -ForegroundColor Cyan
}
catch {
  Write-Host "  [WARN] Matching may not have active drivers nearby. Continuing..." -ForegroundColor Yellow
}

# ============================================================
#  5) POST /api/v1/offers
# ============================================================
Write-Host "`n`n>>> STEP 5: Create Offer (company) <<<" -ForegroundColor Yellow

# We need company_id. Decode JWT payload to get user_id, then look up company.
# For simplicity, use the Supabase REST API to look up the company.
$svcKey = Env "SUPABASE_SERVICE_ROLE_KEY"
$supaUrl = Env "SUPABASE_URL"

# Decode company user_id from JWT
$companyJwtParts = $companyToken.Split(".")
$companyPayloadB64 = $companyJwtParts[1]
# Fix base64 padding
$padLen = 4 - ($companyPayloadB64.Length % 4)
if ($padLen -lt 4) { $companyPayloadB64 = $companyPayloadB64 + ("=" * $padLen) }
$companyPayload = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($companyPayloadB64))
$companyJwt = $companyPayload | ConvertFrom-Json
$companyUserId = $companyJwt.sub

# Look up company_id via company_users table
$companyLookupHeaders = @{
  "apikey"        = $svcKey
  "Authorization" = "Bearer $svcKey"
}
$companyUserData = Invoke-RestMethod `
  -Uri "$supaUrl/rest/v1/company_users?user_id=eq.$companyUserId&select=company_id" `
  -Method GET -Headers $companyLookupHeaders

$companyId = $null
if ($companyUserData -is [System.Array] -and $companyUserData.Count -gt 0) {
  $companyId = $companyUserData[0].company_id
} elseif ($companyUserData.company_id) {
  $companyId = $companyUserData.company_id
}

if (-not $companyId) {
  Write-Host "  [WARN] Could not resolve company_id for user $companyUserId. Using 1001 as fallback." -ForegroundColor Yellow
  $companyId = 1001
}
Write-Host "  Resolved company_id = $companyId" -ForegroundColor Cyan

$offerBody = @{
  announcement_id = $announcementId
  company_id      = $companyId
  price           = 250.00
  currency        = "TRY"
  notes           = "Day5 demo offer"
}

$offer = Invoke-Api -Method POST -Path "/api/v1/offers" `
  -Token $companyToken -Body $offerBody -Label "Create Offer"

$offerId = $offer.id
if (-not $offerId) {
  Write-Host "[FATAL] No offer ID returned!" -ForegroundColor Red
  exit 1
}
Write-Host "`n  >> offer_id = $offerId" -ForegroundColor Green

# ============================================================
#  6) PATCH /api/v1/offers/:id/accept
# ============================================================
Write-Host "`n`n>>> STEP 6: Accept Offer (customer) <<<" -ForegroundColor Yellow
$accepted = Invoke-Api -Method PATCH -Path "/api/v1/offers/$offerId/accept" `
  -Token $customerToken -Label "Accept Offer"

# Try to find shipment_id from the response or look it up
$shipmentId = $null
if ($accepted.shipment_id) {
  $shipmentId = $accepted.shipment_id
}

if (-not $shipmentId) {
  # Look up shipment by offer_id
  Write-Host "  Looking up shipment by offer_id..." -ForegroundColor Cyan
  Start-Sleep -Seconds 1
  $shipmentData = Invoke-RestMethod `
    -Uri "$supaUrl/rest/v1/shipments?offer_id=eq.$offerId&select=id" `
    -Method GET -Headers $companyLookupHeaders

  if ($shipmentData -is [System.Array] -and $shipmentData.Count -gt 0) {
    $shipmentId = $shipmentData[0].id
  } elseif ($shipmentData.id) {
    $shipmentId = $shipmentData.id
  }
}

if (-not $shipmentId) {
  Write-Host "  [WARN] No shipment found for offer $offerId." -ForegroundColor Yellow
  Write-Host "  The DB trigger to create shipments may not be active." -ForegroundColor Yellow
  Write-Host "  Payment steps will be skipped." -ForegroundColor Yellow

  Write-Host "`n============================================" -ForegroundColor Green
  Write-Host "  Demo completed (partial: up to offer accept)" -ForegroundColor Green
  Write-Host "============================================" -ForegroundColor Green
  exit 0
}
Write-Host "`n  >> shipment_id = $shipmentId" -ForegroundColor Green

# ============================================================
#  7) Complete shipment (set final_price via service role)
# ============================================================
Write-Host "`n`n>>> STEP 7: Mark shipment completed (admin) <<<" -ForegroundColor Yellow
$updateBody = @{
  status       = "completed"
  final_price  = 250.00
  delivered_at = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
} | ConvertTo-Json

$updateHeaders = @{
  "apikey"        = $svcKey
  "Authorization" = "Bearer $svcKey"
  "Content-Type"  = "application/json"
  "Prefer"        = "return=representation"
}

try {
  $updatedShipment = Invoke-RestMethod `
    -Uri "$supaUrl/rest/v1/shipments?id=eq.$shipmentId" `
    -Method PATCH -Headers $updateHeaders -Body $updateBody
  Write-Host "  Shipment $shipmentId marked as completed with final_price=250" -ForegroundColor Green
}
catch {
  Write-Host "  [WARN] Could not update shipment status: $_" -ForegroundColor Yellow
}

# ============================================================
#  8) POST /api/v1/payments/checkout
# ============================================================
Write-Host "`n`n>>> STEP 8: Checkout (customer) <<<" -ForegroundColor Yellow
$checkoutBody = @{
  shipment_id = $shipmentId
}

try {
  $checkout = Invoke-Api -Method POST -Path "/api/v1/payments/checkout" `
    -Token $customerToken -Body $checkoutBody -Label "Payment Checkout"

  $platformOrderId = $checkout.platform_order_id
  if (-not $platformOrderId) {
    Write-Host "  [WARN] No platform_order_id returned" -ForegroundColor Yellow
  } else {
    Write-Host "`n  >> platform_order_id = $platformOrderId" -ForegroundColor Green
  }
}
catch {
  Write-Host "  [WARN] Checkout failed. Shipment may not be in correct state." -ForegroundColor Yellow
  $platformOrderId = $null
}

# ============================================================
#  9) POST /api/v1/payments/callback/mock
# ============================================================
if ($platformOrderId) {
  Write-Host "`n`n>>> STEP 9: Mock Payment Callback <<<" -ForegroundColor Yellow
  $callbackBody = @{
    platform_order_id   = $platformOrderId
    status              = "success"
    provider_payment_id = "MOCK-DEMO-$(Get-Date -Format 'yyyyMMddHHmmss')"
  }

  try {
    $callback = Invoke-Api -Method POST -Path "/api/v1/payments/callback/mock" `
      -Body $callbackBody -Label "Mock Payment Callback"

    Write-Host "`n  >> Payment status: $($callback.status)" -ForegroundColor Green
  }
  catch {
    Write-Host "  [WARN] Callback failed: $_" -ForegroundColor Yellow
  }
}

# ============================================================
#  Summary + Debug Queries
# ============================================================
Write-Host "`n`n============================================" -ForegroundColor Green
Write-Host "  DEMO COMPLETE!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  announcement_id    = $announcementId"
Write-Host "  offer_id           = $offerId"
Write-Host "  shipment_id        = $shipmentId"
Write-Host "  platform_order_id  = $platformOrderId"
Write-Host ""

Write-Host "--- Debug Queries (Supabase REST) ---" -ForegroundColor Cyan
Write-Host ""
Write-Host "# Audit logs for a specific request_id:" -ForegroundColor DarkGray
Write-Host "Invoke-RestMethod -Uri `"$supaUrl/rest/v1/audit_logs?request_id=eq.demo-003&select=*&order=created_at.desc`" ``" -ForegroundColor White
Write-Host "  -Headers @{ apikey=`"$svcKey`"; Authorization=`"Bearer $svcKey`" }" -ForegroundColor White
Write-Host ""
Write-Host "# Analytics events for this demo:" -ForegroundColor DarkGray
Write-Host "Invoke-RestMethod -Uri `"$supaUrl/rest/v1/analytics_events?select=*&order=created_at.desc&limit=20`" ``" -ForegroundColor White
Write-Host "  -Headers @{ apikey=`"$svcKey`"; Authorization=`"Bearer $svcKey`" }" -ForegroundColor White
Write-Host ""
Write-Host "# All payments for this shipment:" -ForegroundColor DarkGray
Write-Host "Invoke-RestMethod -Uri `"$supaUrl/rest/v1/payments?shipment_id=eq.$shipmentId&select=*`" ``" -ForegroundColor White
Write-Host "  -Headers @{ apikey=`"$svcKey`"; Authorization=`"Bearer $svcKey`" }" -ForegroundColor White
Write-Host ""

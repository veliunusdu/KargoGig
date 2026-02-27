<#
.SYNOPSIS
  Run ALL backend E2E tests sequentially and print a summary.

.DESCRIPTION
  Discovers every *.e2e-spec.ts under services/backend/test,
  runs each one via `npm run test:e2e`, collects pass/fail,
  and prints a final report.

  Clears SUPABASE_* env vars first to avoid overrides.

.USAGE
  cd services/backend
  .\scripts\run-all-tests.ps1
#>

param(
  [switch]$StopOnFailure   # stop at first failing spec
)

$ErrorActionPreference = 'Continue'
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$backendDir = Split-Path -Parent $scriptDir

Push-Location $backendDir

# ── Clean conflicting env vars ──────────────────────────────
Remove-Item Env:\SUPABASE_* -ErrorAction SilentlyContinue

# ── Discover test files ─────────────────────────────────────
$testFiles = Get-ChildItem -Path "test" -Filter "*.e2e-spec.ts" |
  Sort-Object Name

$total    = $testFiles.Count
$passed   = 0
$failed   = 0
$skipped  = 0
$results  = @()
$overallStart = Get-Date

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Backend E2E Test Runner" -ForegroundColor Cyan
Write-Host "  Found $total test files" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# ── Run each spec ───────────────────────────────────────────
foreach ($file in $testFiles) {
  $name = $file.BaseName -replace '\.e2e-spec$', ''
  $idx  = $results.Count + 1

  Write-Host "[$idx/$total] Running: $($file.Name) ..." -ForegroundColor Yellow
  $start = Get-Date

  # Run test and capture only exit code (suppress verbose output)
  $output = npm run test:e2e -- $name --forceExit 2>&1
  $exitCode = $LASTEXITCODE
  $elapsed = ((Get-Date) - $start).TotalSeconds

  if ($exitCode -eq 0) {
    $status = "PASS"
    $color  = "Green"
    $passed++
  } else {
    $status = "FAIL"
    $color  = "Red"
    $failed++
  }

  $results += [PSCustomObject]@{
    Index    = $idx
    Name     = $file.Name
    Status   = $status
    Duration = [math]::Round($elapsed, 1)
  }

  Write-Host "  => $status ($([math]::Round($elapsed,1))s)" -ForegroundColor $color

  if ($StopOnFailure -and $exitCode -ne 0) {
    Write-Host ""
    Write-Host "Stopping early (-StopOnFailure). Re-run failed test:" -ForegroundColor Red
    Write-Host "  npm run test:e2e -- $name" -ForegroundColor Yellow
    $skipped = $total - $idx
    break
  }
}

$overallElapsed = [math]::Round(((Get-Date) - $overallStart).TotalSeconds, 1)

# ── Summary ─────────────────────────────────────────────────
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$results | Format-Table -AutoSize @(
  @{Label="#";       Expression={$_.Index}; Width=3},
  @{Label="Test";    Expression={$_.Name}},
  @{Label="Status";  Expression={$_.Status}},
  @{Label="Time(s)"; Expression={$_.Duration}; Align="Right"}
)

$passColor = if ($failed -eq 0) { "Green" } else { "Yellow" }
$failColor = if ($failed -eq 0) { "Green" } else { "Red" }

Write-Host "Total: $total | " -NoNewline
Write-Host "Passed: $passed " -NoNewline -ForegroundColor $passColor
Write-Host "| " -NoNewline
Write-Host "Failed: $failed " -NoNewline -ForegroundColor $failColor
if ($skipped -gt 0) {
  Write-Host "| Skipped: $skipped " -NoNewline -ForegroundColor DarkYellow
}
Write-Host "| Time: ${overallElapsed}s"
Write-Host ""

Pop-Location

# Exit with non-zero if any failed
if ($failed -gt 0) { exit 1 }

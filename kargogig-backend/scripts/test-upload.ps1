# Quick test script for document upload endpoints (PowerShell)
# Usage: .\test-upload.ps1

$BASE_URL = "http://localhost:3000"

Write-Host "🚀 Testing Document Upload Endpoints" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Get upload URL
Write-Host "📝 Test 1: Request upload URL for company/1111/tax_certificate.pdf" -ForegroundColor Yellow
Write-Host "Request:" -ForegroundColor Gray
$uploadRequest = @{
    ownerType = "company"
    ownerId = 1111
    documentType = "tax_certificate"
    ext = "pdf"
} | ConvertTo-Json

Write-Host $uploadRequest -ForegroundColor Gray
Write-Host ""

try {
    $uploadResponse = Invoke-RestMethod -Uri "$BASE_URL/documents/upload-url" `
        -Method Post `
        -ContentType "application/json" `
        -Body $uploadRequest

    Write-Host "Response:" -ForegroundColor Gray
    $uploadResponse | ConvertTo-Json | Write-Host -ForegroundColor Gray
    Write-Host ""

    $path = $uploadResponse.path
    $signedUrl = $uploadResponse.signed_url

    if (-not $path) {
        Write-Host "❌ Error: Failed to get upload URL" -ForegroundColor Red
        exit 1
    }

    Write-Host "✅ Path generated: $path" -ForegroundColor Green
    Write-Host "✅ Signed URL: $($signedUrl.Substring(0, [Math]::Min(60, $signedUrl.Length)))..." -ForegroundColor Green
    Write-Host ""

    # Test 2: Create document record
    Write-Host "📝 Test 2: Create document record in DB" -ForegroundColor Yellow
    Write-Host "Request:" -ForegroundColor Gray
    $docRequest = @{
        owner_type = "company"
        owner_id = 1111
        document_type = "tax_certificate"
        file_url = $path
        expires_at = "2027-01-01"
    } | ConvertTo-Json

    Write-Host $docRequest -ForegroundColor Gray
    Write-Host ""

    $docResponse = Invoke-RestMethod -Uri "$BASE_URL/documents" `
        -Method Post `
        -ContentType "application/json" `
        -Body $docRequest

    Write-Host "Response:" -ForegroundColor Gray
    $docResponse | ConvertTo-Json | Write-Host -ForegroundColor Gray
    Write-Host ""

    # Verify file_url matches path
    $fileUrl = $docResponse.file_url

    if ($fileUrl -eq $path) {
        Write-Host "✅ SUCCESS: file_url matches the generated path!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Verification:" -ForegroundColor Cyan
        Write-Host "  - Generated path: $path" -ForegroundColor White
        Write-Host "  - Stored file_url: $fileUrl" -ForegroundColor White
        Write-Host "  - Match: YES ✓" -ForegroundColor Green
    } else {
        Write-Host "❌ MISMATCH:" -ForegroundColor Red
        Write-Host "  - Generated path: $path" -ForegroundColor White
        Write-Host "  - Stored file_url: $fileUrl" -ForegroundColor White
        exit 1
    }

    Write-Host ""
    Write-Host "🎉 All tests passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Summary:" -ForegroundColor Cyan
    Write-Host "  - Upload URL endpoint: ✅" -ForegroundColor Green
    Write-Host "  - Document creation endpoint: ✅" -ForegroundColor Green
    Write-Host "  - Path format: ✅" -ForegroundColor Green
    Write-Host "  - DB record: ✅" -ForegroundColor Green

} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response body: $responseBody" -ForegroundColor Red
    }
    exit 1
}

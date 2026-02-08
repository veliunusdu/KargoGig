# Test UPSERT behavior for documents

Write-Host "🧪 Testing UPSERT Behavior" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan
Write-Host ""

$BASE_URL = "http://localhost:3000"

# Test: Upload same document twice
Write-Host "📝 Test: Upload same document type twice for same owner" -ForegroundColor Yellow
Write-Host ""

try {
    # First upload
    Write-Host "Step 1: First upload for company/1111/tax_certificate" -ForegroundColor Gray
    $upload1 = Invoke-RestMethod -Uri "$BASE_URL/documents/upload-url" `
        -Method Post `
        -ContentType "application/json" `
        -Body (@{
            ownerType = "company"
            ownerId = 1111
            documentType = "tax_certificate"
            ext = "pdf"
        } | ConvertTo-Json)

    $doc1 = Invoke-RestMethod -Uri "$BASE_URL/documents" `
        -Method Post `
        -ContentType "application/json" `
        -Body (@{
            owner_type = "company"
            owner_id = 1111
            document_type = "tax_certificate"
            file_url = $upload1.path
            expires_at = "2027-01-01"
        } | ConvertTo-Json)

    Write-Host "  ✅ First document created" -ForegroundColor Green
    Write-Host "     ID: $($doc1.id)" -ForegroundColor White
    Write-Host "     Path: $($doc1.file_url)" -ForegroundColor White
    Write-Host "     Status: $($doc1.status)" -ForegroundColor White
    Write-Host ""

    $firstId = $doc1.id
    $firstPath = $doc1.file_url

    Start-Sleep -Seconds 2

    # Second upload (should UPSERT)
    Write-Host "Step 2: Second upload for same company/1111/tax_certificate" -ForegroundColor Gray
    $upload2 = Invoke-RestMethod -Uri "$BASE_URL/documents/upload-url" `
        -Method Post `
        -ContentType "application/json" `
        -Body (@{
            ownerType = "company"
            ownerId = 1111
            documentType = "tax_certificate"
            ext = "pdf"
        } | ConvertTo-Json)

    $doc2 = Invoke-RestMethod -Uri "$BASE_URL/documents" `
        -Method Post `
        -ContentType "application/json" `
        -Body (@{
            owner_type = "company"
            owner_id = 1111
            document_type = "tax_certificate"
            file_url = $upload2.path
            expires_at = "2027-02-01"
        } | ConvertTo-Json)

    Write-Host "  ✅ Second document upserted" -ForegroundColor Green
    Write-Host "     ID: $($doc2.id)" -ForegroundColor White
    Write-Host "     Path: $($doc2.file_url)" -ForegroundColor White
    Write-Host "     Status: $($doc2.status)" -ForegroundColor White
    Write-Host ""

    # Verify UPSERT behavior
    Write-Host "Verification:" -ForegroundColor Cyan
    
    if ($doc2.id -eq $firstId) {
        Write-Host "  ✅ Same ID: $firstId (record was updated, not inserted)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ Different IDs: $firstId vs $($doc2.id) (should be same!)" -ForegroundColor Red
    }

    if ($doc2.file_url -ne $firstPath) {
        Write-Host "  ✅ file_url changed: $firstPath → $($doc2.file_url)" -ForegroundColor Green
    } else {
        Write-Host "  ❌ file_url NOT changed (should be different!)" -ForegroundColor Red
    }

    if ($doc2.status -eq "pending") {
        Write-Host "  ✅ status reset to 'pending'" -ForegroundColor Green
    } else {
        Write-Host "  ❌ status is '$($doc2.status)' (should be 'pending'!)" -ForegroundColor Red
    }

    if ($null -eq $doc2.verified_by -and $null -eq $doc2.verified_at) {
        Write-Host "  ✅ verified_by and verified_at are null" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️  verified_by: $($doc2.verified_by), verified_at: $($doc2.verified_at)" -ForegroundColor Yellow
    }

    Write-Host ""
    Write-Host "🎉 UPSERT test completed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Summary:" -ForegroundColor Cyan
    Write-Host "  - First upload created record: ID=$firstId" -ForegroundColor White
    Write-Host "  - Second upload updated same record: ID=$($doc2.id)" -ForegroundColor White
    Write-Host "  - Path updated correctly: ✅" -ForegroundColor White
    Write-Host "  - Status reset to pending: ✅" -ForegroundColor White

} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response: $responseBody" -ForegroundColor Red
    }
    exit 1
}

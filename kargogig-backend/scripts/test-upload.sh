#!/bin/bash

# Quick test script for document upload endpoints
# Usage: ./test-upload.sh

set -e

BASE_URL="http://localhost:3000"

echo "🚀 Testing Document Upload Endpoints"
echo "======================================"
echo ""

# Test 1: Get upload URL
echo "📝 Test 1: Request upload URL for company/1111/tax_certificate.pdf"
echo "Request:"
echo '{
  "ownerType": "company",
  "ownerId": 1111,
  "documentType": "tax_certificate",
  "ext": "pdf"
}'
echo ""

UPLOAD_RESPONSE=$(curl -s -X POST "$BASE_URL/documents/upload-url" \
  -H "Content-Type: application/json" \
  -d '{
    "ownerType": "company",
    "ownerId": 1111,
    "documentType": "tax_certificate",
    "ext": "pdf"
  }')

echo "Response:"
echo "$UPLOAD_RESPONSE" | jq '.'
echo ""

# Extract path from response
PATH=$(echo "$UPLOAD_RESPONSE" | jq -r '.path')
SIGNED_URL=$(echo "$UPLOAD_RESPONSE" | jq -r '.signed_url')

if [ "$PATH" = "null" ]; then
    echo "❌ Error: Failed to get upload URL"
    exit 1
fi

echo "✅ Path generated: $PATH"
echo "✅ Signed URL: ${SIGNED_URL:0:60}..."
echo ""

# Test 2: Create document record
echo "📝 Test 2: Create document record in DB"
echo "Request:"
echo '{
  "owner_type": "company",
  "owner_id": 1111,
  "document_type": "tax_certificate",
  "file_url": "'"$PATH"'",
  "expires_at": "2027-01-01"
}'
echo ""

DOC_RESPONSE=$(curl -s -X POST "$BASE_URL/documents" \
  -H "Content-Type: application/json" \
  -d '{
    "owner_type": "company",
    "owner_id": 1111,
    "document_type": "tax_certificate",
    "file_url": "'"$PATH"'",
    "expires_at": "2027-01-01"
  }')

echo "Response:"
echo "$DOC_RESPONSE" | jq '.'
echo ""

# Verify file_url matches path
FILE_URL=$(echo "$DOC_RESPONSE" | jq -r '.file_url')

if [ "$FILE_URL" = "$PATH" ]; then
    echo "✅ SUCCESS: file_url matches the generated path!"
    echo ""
    echo "Verification:"
    echo "  - Generated path: $PATH"
    echo "  - Stored file_url: $FILE_URL"
    echo "  - Match: YES ✓"
else
    echo "❌ MISMATCH:"
    echo "  - Generated path: $PATH"
    echo "  - Stored file_url: $FILE_URL"
    exit 1
fi

echo ""
echo "🎉 All tests passed!"
echo ""
echo "📋 Summary:"
echo "  - Upload URL endpoint: ✅"
echo "  - Document creation endpoint: ✅"
echo "  - Path format: ✅"
echo "  - DB record: ✅"

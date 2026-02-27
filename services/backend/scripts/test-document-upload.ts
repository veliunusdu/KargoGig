/**
 * Quick Manual Test Script for Documents Upload
 * 
 * This script demonstrates the document upload flow:
 * 1. Request a signed upload URL
 * 2. Show the generated path
 * 3. Create a document record with that path
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3000';

interface UploadUrlResponse {
  ok: boolean;
  path: string;
  signed_url: string;
}

interface DocumentResponse {
  id: number;
  owner_type: string;
  owner_id: number;
  document_type: string;
  file_url: string;
  status: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

async function testDocumentUpload() {
  console.log('🚀 Starting document upload test...\n');

  // Step 1: Request upload URL
  console.log('📝 Step 1: Request signed upload URL');
  console.log('   Owner: company/1111');
  console.log('   Document Type: tax_certificate');
  console.log('   Extension: pdf\n');

  try {
    const uploadUrlResponse = await axios.post<UploadUrlResponse>(
      `${BASE_URL}/documents/upload-url`,
      {
        ownerType: 'company',
        ownerId: 1111,
        documentType: 'tax_certificate',
        ext: 'pdf',
      }
    );

    console.log('✅ Upload URL Response:');
    console.log(`   path: ${uploadUrlResponse.data.path}`);
    console.log(`   signed_url: ${uploadUrlResponse.data.signed_url.substring(0, 80)}...`);
    console.log('');

    // Verify path format
    const expectedPattern = /^company\/1111\/tax_certificate\/[a-f0-9-]+\.pdf$/;
    const pathMatches = expectedPattern.test(uploadUrlResponse.data.path);
    console.log(`   ✓ Path format correct: ${pathMatches}`);
    console.log('');

    // Step 2: Simulate file upload (in real scenario, client uploads to signed_url)
    console.log('📤 Step 2: Client uploads file to signed_url (skipped in test)');
    console.log('   In production: PUT file to signed_url\n');

    // Step 3: Create document record
    console.log('💾 Step 3: Create document record in DB');
    console.log(`   file_url: ${uploadUrlResponse.data.path}\n`);

    const documentResponse = await axios.post<DocumentResponse>(
      `${BASE_URL}/documents`,
      {
        owner_type: 'company',
        owner_id: 1111,
        document_type: 'tax_certificate',
        file_url: uploadUrlResponse.data.path, // ← Path from step 1
        expires_at: '2027-01-01',
      }
    );

    console.log('✅ Document Record Created:');
    console.log(`   id: ${documentResponse.data.id}`);
    console.log(`   owner_type: ${documentResponse.data.owner_type}`);
    console.log(`   owner_id: ${documentResponse.data.owner_id}`);
    console.log(`   document_type: ${documentResponse.data.document_type}`);
    console.log(`   file_url: ${documentResponse.data.file_url}`);
    console.log(`   status: ${documentResponse.data.status}`);
    console.log(`   expires_at: ${documentResponse.data.expires_at}`);
    console.log('');

    // Verify
    if (documentResponse.data.file_url === uploadUrlResponse.data.path) {
      console.log('✅ SUCCESS: file_url matches the generated path!');
    } else {
      console.log('❌ ERROR: file_url does not match!');
    }

    console.log('\n🎉 Test completed successfully!');
    console.log('\n📋 Summary:');
    console.log(`   - Path generated: ${uploadUrlResponse.data.path}`);
    console.log(`   - Document ID: ${documentResponse.data.id}`);
    console.log(`   - Status: ${documentResponse.data.status}`);

  } catch (error: any) {
    console.error('❌ Error:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Run test
testDocumentUpload();

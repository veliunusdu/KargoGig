import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentsModule } from '../src/documents/documents.module';
import { DocumentsService } from '../src/documents/documents.service';
import { OwnerType, FileExtension } from '../src/documents/dto';

describe('Documents - Upload URL Test', () => {
  let app: INestApplication;
  let documentsService: DocumentsService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [DocumentsModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    documentsService = moduleFixture.get<DocumentsService>(DocumentsService);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should generate upload URL for company tax_certificate', async () => {
    // Test case: company 1111, tax_certificate.pdf
    const result = await documentsService.createUploadUrl({
      ownerType: OwnerType.COMPANY,
      ownerId: 1111,
      documentType: 'tax_certificate',
      ext: FileExtension.PDF,
    });

    console.log('✅ Upload URL Response:');
    console.log(JSON.stringify(result, null, 2));

    // Assertions
    expect(result.ok).toBe(true);
    expect(result.path).toMatch(/^company\/1111\/tax_certificate\/[a-f0-9-]+\.pdf$/);
    expect(result.signed_url).toBeDefined();
    expect(result.signed_url).toContain('https://');
  });

  it('should create document record after upload', async () => {
    // First, get upload URL
    const uploadResult = await documentsService.createUploadUrl({
      ownerType: OwnerType.COMPANY,
      ownerId: 1111,
      documentType: 'tax_certificate',
      ext: FileExtension.PDF,
    });

    console.log('📁 Generated path:', uploadResult.path);

    // Now create document record (simulating after file upload)
    const doc = await documentsService.createDocument({
      owner_type: OwnerType.COMPANY,
      owner_id: 1111,
      document_type: 'tax_certificate',
      file_url: uploadResult.path, // ← Path goes to DB as file_url
      expires_at: '2027-01-01',
    });

    console.log('✅ Document Record Created:');
    console.log(JSON.stringify(doc, null, 2));

    // Assertions
    expect(doc.id).toBeDefined();
    expect(doc.owner_type).toBe('company');
    expect(doc.owner_id).toBe(1111);
    expect(doc.document_type).toBe('tax_certificate');
    expect(doc.file_url).toBe(uploadResult.path); // ← Verify path matches
    expect(doc.status).toBe('pending');
  });

  it('should generate different paths for different document types', async () => {
    const results = await Promise.all([
      documentsService.createUploadUrl({
        ownerType: OwnerType.DRIVER,
        ownerId: 5555,
        documentType: 'drivers_license',
        ext: FileExtension.JPG,
      }),
      documentsService.createUploadUrl({
        ownerType: OwnerType.VEHICLE,
        ownerId: 9999,
        documentType: 'insurance',
        ext: FileExtension.PDF,
      }),
    ]);

    console.log('📋 Multiple paths generated:');
    results.forEach((r) => console.log(`  - ${r.path}`));

    expect(results[0].path).toMatch(/^driver\/5555\/drivers_license\/[a-f0-9-]+\.jpg$/);
    expect(results[1].path).toMatch(/^vehicle\/9999\/insurance\/[a-f0-9-]+\.pdf$/);
  });
});

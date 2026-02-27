import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  Patch,
  Param,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { CreateUploadUrlDto, CreateDocumentDto, UpdateDocumentStatusDto } from './dto';

@Controller('documents')
export class DocumentsController {
  private readonly logger = new Logger(DocumentsController.name);

  constructor(private readonly documentsService: DocumentsService) {}

  /**
   * POST /documents/upload-url
   * Get a signed upload URL for document upload
   */
  @Post('upload-url')
  @HttpCode(HttpStatus.CREATED)
  async createUploadUrl(@Body() dto: CreateUploadUrlDto) {
    this.logger.log(
      `Upload URL requested: ${dto.ownerType}/${dto.ownerId}/${dto.documentType}`,
    );
    return this.documentsService.createUploadUrl(dto);
  }

  /**
   * POST /documents
   * Register a document after file upload completes
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createDocument(@Body() dto: CreateDocumentDto) {
    this.logger.log(
      `Document creation requested: ${dto.owner_type}/${dto.owner_id}/${dto.document_type}`,
    );
    return this.documentsService.createDocument(dto);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDocumentStatusDto,
    @Req() req: any,
  ) {
    const auth = req.headers?.authorization ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    return this.documentsService.updateStatus(id, dto, token);
  }
}

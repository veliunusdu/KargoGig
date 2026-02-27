import {
  Injectable,
  Logger,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { DocumentsRepository, DocumentRow } from './documents.repository';
import { StorageProvider } from './storage.provider';
import { SupabaseService } from '../supabase/supabase.service';
import {
  CreateUploadUrlDto,
  CreateDocumentDto,
  UpdateDocumentStatusDto,
} from './dto';

export interface UploadUrlResponse {
  ok: true;
  path: string;
  signed_url: string;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);
  private readonly supabase: SupabaseClient;

  constructor(
    private readonly repository: DocumentsRepository,
    private readonly storage: StorageProvider,
    private readonly supabaseService: SupabaseService,
  ) {
    this.supabase = this.supabaseService.serviceClient();
  }

  /**
   * Generate a storage path and signed upload URL
   */
  async createUploadUrl(dto: CreateUploadUrlDto): Promise<UploadUrlResponse> {
    // 1) Build path
    const path = this.storage.buildDocumentPath({
      ownerType: dto.ownerType,
      ownerId: dto.ownerId,
      documentType: dto.documentType,
      ext: dto.ext,
    });

    // 2) Create signed upload URL from Supabase Storage
    const signedUrl = await this.storage.createSignedUploadUrl(path);

    this.logger.log(
      `Upload URL created: ${dto.ownerType}/${dto.ownerId}/${dto.documentType}`,
    );

    return {
      ok: true,
      path,
      signed_url: signedUrl,
    };
  }

  /**
   * Create document row in DB after file upload completes
   */
  async createDocument(dto: CreateDocumentDto): Promise<DocumentRow> {
    const doc = await this.repository.create(dto);

    this.logger.log(
      `Document registered: id=${doc.id} path=${dto.file_url}`,
    );

    return doc;
  }

  /**
   * Update document status (verify/reject)
   * Business rules:
   * - Document must exist
   * - Only transition from 'pending' allowed (idempotent if same status)
   * - Admin check is left commented for now
   */
  async updateStatus(
    id: number,
    dto: UpdateDocumentStatusDto,
    accessToken: string,
  ) {
    if (!accessToken) throw new UnauthorizedException('Missing bearer token');

    const { data, error } = await this.supabase.auth.getUser(accessToken);
    if (error || !data?.user) throw new UnauthorizedException('Invalid token');

    const actorUserId = data.user.id; // <-- this is the 'sub' UUID

    const doc = await this.repository.findById(id);
    if (!doc) throw new NotFoundException('Document not found');

    // only allow status change from 'pending'
    if (doc.status !== 'pending') {
      if (doc.status === dto.status) return doc; // idempotent
      throw new ConflictException(`Document already ${doc.status}`);
    }

    // Admin check (commented, enable when rolesRepo available)
    // const isAdmin = await this.rolesRepo.isAdmin(actorUserId);
    // if (!isAdmin) throw new ForbiddenException('Admin only');

    return await this.repository.updateStatus(id, dto, actorUserId);
  }
}

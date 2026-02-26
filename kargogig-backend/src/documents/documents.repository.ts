import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { CreateDocumentDto, UpdateDocumentStatusDto } from './dto';
import { SupabaseService } from '../supabase/supabase.service';

export interface DocumentRow {
  id: number;
  owner_type: string;
  owner_id: number;
  document_type: string;
  file_url: string;
  status: string;
  expires_at: string | null;
  verified_by: string | null;
  verified_at: string | null;
  meta: Record<string, any>;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class DocumentsRepository {
  private readonly logger = new Logger(DocumentsRepository.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get supabase(): SupabaseClient {
    return this.supabaseService.serviceClient();
  }

  /**
   * Upsert document row with status 'pending'
   * If (owner_type, owner_id, document_type) already exists → update file_url, reset status to pending
   */
  async create(dto: CreateDocumentDto): Promise<DocumentRow> {
    const payload = {
      owner_type: dto.owner_type,
      owner_id: dto.owner_id,
      document_type: dto.document_type,
      file_url: dto.file_url,
      status: 'pending',
      expires_at: dto.expires_at || null,
      verified_by: null,
      verified_at: null,
      verification_notes: null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('documents')
      .upsert(payload, { onConflict: 'owner_type,owner_id,document_type' })
      .select('*')
      .single();

    if (error) {
      this.logger.error(`Upsert document failed: ${error.message}`);
      throw error;
    }

    this.logger.log(
      `Document upserted: id=${data.id} type=${dto.document_type} owner=${dto.owner_type}/${dto.owner_id}`,
    );

    return data as DocumentRow;
  }

  async updateStatus(
    id: number,
    dto: UpdateDocumentStatusDto,
    actorUserId: string,
  ) {
    const patch: any = {
      status: dto.status,
      verification_notes: dto.notes ?? null,
      verified_by: actorUserId,
      verified_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await this.supabase
      .from('documents')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  async findById(id: number): Promise<DocumentRow | null> {
    const { data, error } = await this.supabase
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // not found
      throw error;
    }

    return data as DocumentRow;
  }
}

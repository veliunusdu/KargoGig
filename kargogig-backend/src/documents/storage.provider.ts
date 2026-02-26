import { Injectable, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { OwnerType, FileExtension } from './dto';
import { SupabaseService } from '../supabase/supabase.service';

const BUCKET = 'documents';

@Injectable()
export class StorageProvider {
  private readonly logger = new Logger(StorageProvider.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get supabase(): SupabaseClient {
    return this.supabaseService.serviceClient();
  }

  /**
   * Build a storage path following the convention:
   *   {ownerType}/{ownerId}/{documentType}/{uuid}.{ext}
   */
  buildDocumentPath(params: {
    ownerType: OwnerType;
    ownerId: number;
    documentType: string;
    ext: FileExtension;
  }): string {
    const uuid = randomUUID();
    return `${params.ownerType}/${params.ownerId}/${params.documentType}/${uuid}.${params.ext}`;
  }

  /**
   * Create a signed upload URL (PUT).
   * The client will PUT the file directly to this URL.
   */
  async createSignedUploadUrl(path: string): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(BUCKET)
      .createSignedUploadUrl(path);

    if (error) {
      this.logger.error(`Failed to create signed upload URL: ${error.message}`);
      throw error;
    }

    this.logger.log(`Signed upload URL created for path: ${path}`);
    return data.signedUrl;
  }

  /**
   * Create a signed download URL (GET) – short-lived (e.g. 60 seconds).
   */
  async createSignedDownloadUrl(
    path: string,
    expiresInSeconds = 60,
  ): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, expiresInSeconds);

    if (error) {
      this.logger.error(
        `Failed to create signed download URL: ${error.message}`,
      );
      throw error;
    }

    return data.signedUrl;
  }
}

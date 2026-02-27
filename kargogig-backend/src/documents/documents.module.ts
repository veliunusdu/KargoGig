import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentsRepository } from './documents.repository';
import { StorageProvider } from './storage.provider';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsRepository, StorageProvider],
  exports: [DocumentsService],
})
export class DocumentsModule {}

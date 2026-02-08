import { Module } from '@nestjs/common';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { DocumentsRepository } from './documents.repository';
import { StorageProvider } from './storage.provider';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, DocumentsRepository, StorageProvider],
  exports: [DocumentsService],
})
export class DocumentsModule {}

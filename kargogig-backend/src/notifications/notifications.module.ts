import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsRepository } from './notifications.repository';
import { ExpoPushGateway } from './providers/expo-push.gateway';
import { MockPushProvider } from './providers/mock-push.provider';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationsRepository,
    ExpoPushGateway,
    MockPushProvider,
  ],
  exports: [NotificationsService], // Export for use in other modules (e.g., ShipmentsModule)
})
export class NotificationsModule {}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateOfferDto } from './dto/create-offer.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class OffersService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Yeni teklif oluşturur (şirket tarafından)
   */
  async createOffer(createDto: CreateOfferDto) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('offers')
      .insert(createDto)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Bir ilana gelen teklifleri getirir
   */
  async getOffersByAnnouncement(announcementId: number) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('offers')
      .select(
        `
        *,
        companies:company_id (
          id,
          name,
          status
        )
      `,
      )
      .eq('announcement_id', announcementId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Şirketin verdiği teklifleri getirir
   */
  async getOffersByCompany(companyId: number) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('offers')
      .select(
        `
        *,
        announcements:announcement_id (
          id,
          pickup_location,
          delivery_location,
          cargo_type,
          status
        )
      `,
      )
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Teklif detayını getirir
   */
  async getOfferById(id: number) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('offers')
      .select(
        `
        *,
        companies:company_id (name, email, phone),
        announcements:announcement_id (*)
      `,
      )
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException('Teklif bulunamadı');
      }
      throw error;
    }
    return data;
  }

  /**
   * Teklifi kabul eder (müşteri tarafından)
   * DB trigger otomatik olarak shipment oluşturacak
   */
  async acceptOffer(id: number) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('offers')
      .update({ status: 'accepted' })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      // Trigger'dan gelen hata mesajlarını yakala
      if (error.message?.includes('pending')) {
        throw new BadRequestException('Teklif zaten cevaplanmış');
      }
      throw error;
    }

    // Trigger oluşturduğu shipment'ı bul ve notification gönder
    try {
      const { data: shipment } = await this.supabaseService
        .getClient()
        .from('shipments')
        .select('id, customer_id, driver_id')
        .eq('offer_id', id)
        .single();

      if (shipment && shipment.customer_id && shipment.driver_id) {
        // Async notification (don't block response)
        this.notificationsService
          .onShipmentAccepted(
            shipment.id,
            shipment.customer_id,
            shipment.driver_id,
          )
          .catch((err) => {
            console.error('[OffersService] Notification failed:', err);
          });
      }
    } catch (notifError) {
      // Log but don't fail the request
      console.error('[OffersService] Failed to send notification:', notifError);
    }

    return data;
  }

  /**
   * Teklifi reddeder (müşteri tarafından)
   */
  async rejectOffer(id: number) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('offers')
      .update({ status: 'rejected' })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.message?.includes('pending')) {
        throw new BadRequestException('Teklif zaten cevaplanmış');
      }
      throw error;
    }
    return data;
  }

  /**
   * Teklifi iptal eder (şirket tarafından)
   */
  async cancelOffer(id: number) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('offers')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { track } from '../observability/analytics.js';
import { logger } from '../observability/logger.js';

@Injectable()
export class AnnouncementsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Yeni ilan oluşturur.
   *
   * 1. Auth header'dan user_id çözülür
   * 2. customers tablosundan customer_id alınır
   * 3. pickup_point / delivery_point EWKT olarak hesaplanır
   * 4. service client ile insert yapılır (RLS bypass)
   */
  async createAnnouncement(
    createDto: CreateAnnouncementDto,
    authHeader?: string,
  ) {
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedException('Authorization header eksik');
    }

    // 1) Token'dan user_id al
    const userClient = this.supabaseService.asUser(token);
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      throw new UnauthorizedException('Geçersiz token');
    }

    // 2) customers tablosundan customer_id bul
    const { data: customer, error: custError } = await this.supabaseService
      .getServiceClient()
      .from('customers')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (custError || !customer) {
      throw new BadRequestException(
        'Bu kullanıcıya ait müşteri kaydı bulunamadı',
      );
    }

    // 3) PostGIS EWKT point'leri oluştur
    const pickupPoint = `SRID=4326;POINT(${createDto.pickup_lng} ${createDto.pickup_lat})`;
    const deliveryPoint = `SRID=4326;POINT(${createDto.delivery_lng} ${createDto.delivery_lat})`;

    // 4) DTO'dan customer_id'yi çıkar (güvenlik: client'ın setlemesini engelle)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { customer_id: _ignored, ...dtoFields } = createDto;

    const insertPayload = {
      ...dtoFields,
      customer_id: customer.id,
      pickup_point: pickupPoint,
      delivery_point: deliveryPoint,
    };

    const { data, error } = await this.supabaseService
      .getServiceClient()
      .from('announcements')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      logger.error(
        { err: error, insertPayload: { ...insertPayload, pickup_point: pickupPoint } },
        'Announcement insert failed',
      );
      throw new BadRequestException(
        error.message || 'İlan oluşturulamadı',
      );
    }

    track('announcement_created', {
      entityType: 'announcement',
      entityId: data.id,
      customer_id: customer.id,
    });

    return data;
  }

  /**
   * Tüm pending ilanları getirir (şirketler için marketplace)
   */
  async getPendingAnnouncements() {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('announcements')
      .select(
        `
        *,
        customers (
          id,
          user_id,
          profiles:user_id (name, phone)
        )
      `,
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Müşterinin kendi ilanlarını getirir
   */
  async getMyAnnouncements(customerId: number) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('announcements')
      .select('*')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * İlan detayını getirir
   */
  async getAnnouncementById(id: number) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('announcements')
      .select(
        `
        *,
        customers (
          id,
          user_id,
          profiles:user_id (name, phone)
        ),
        offers (
          id,
          price,
          currency,
          status,
          company_id,
          companies:company_id (name)
        )
      `,
      )
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException('İlan bulunamadı');
      }
      throw error;
    }
    return data;
  }

  /**
   * İlanı günceller
   */
  async updateAnnouncement(
    id: number,
    updateData: Partial<CreateAnnouncementDto>,
  ) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('announcements')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * İlanı siler (veya iptal eder)
   */
  async deleteAnnouncement(id: number) {
    // Soft delete yerine status'u cancelled yapıyoruz
    const { data, error } = await this.supabaseService
      .getClient()
      .from('announcements')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

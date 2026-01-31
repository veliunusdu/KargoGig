import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@Injectable()
export class AnnouncementsService {
    constructor(private readonly supabaseService: SupabaseService) { }

    /**
     * Yeni ilan oluşturur
     */
    async createAnnouncement(createDto: CreateAnnouncementDto) {
        // PostGIS point otomatik oluşturulacak (trigger ile)
        const { data, error } = await this.supabaseService
            .getClient()
            .from('announcements')
            .insert({
                ...createDto,
                // Trigger lat/lng'den point oluşturacak
            })
            .select()
            .single();

        if (error) throw error;
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

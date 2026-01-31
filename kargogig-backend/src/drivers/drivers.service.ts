import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class DriversService {
    constructor(private readonly supabaseService: SupabaseService) { }

    /**
     * Yeni sürücü kaydı oluşturur
     */
    async createDriver(createData: {
        user_id: string;
        company_id?: number;
        license_number?: string;
    }) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('drivers')
            .insert(createData)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Sürücüyü user_id ile getirir
     */
    async getDriverByUserId(userId: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('drivers')
            .select(
                `
        *,
        companies:company_id (id, name),
        profiles:user_id (name, phone, email)
      `,
            )
            .eq('user_id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                throw new NotFoundException('Sürücü bulunamadı');
            }
            throw error;
        }
        return data;
    }

    /**
     * Sürücüyü ID ile getirir
     */
    async getDriverById(id: number) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('drivers')
            .select(
                `
        *,
        companies:company_id (id, name),
        profiles:user_id (name, phone, email)
      `,
            )
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                throw new NotFoundException('Sürücü bulunamadı');
            }
            throw error;
        }
        return data;
    }

    /**
     * Şirkete ait sürücüleri listeler
     */
    async getDriversByCompany(companyId: number) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('drivers')
            .select(
                `
        *,
        profiles:user_id (name, phone, email)
      `,
            )
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    /**
     * Sürücü bilgilerini günceller
     */
    async updateDriver(
        id: number,
        updateData: {
            license_number?: string;
            availability?: string;
            is_available?: boolean;
            company_id?: number;
        },
    ) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('drivers')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Sürücü müsaitlik durumunu değiştirir
     */
    async setAvailability(id: number, isAvailable: boolean) {
        return this.updateDriver(id, { is_available: isAvailable });
    }
}

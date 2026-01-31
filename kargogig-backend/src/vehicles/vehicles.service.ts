import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class VehiclesService {
    constructor(private readonly supabaseService: SupabaseService) { }

    /**
     * Yeni araç ekler
     */
    async createVehicle(createData: {
        company_id: number;
        plate_number: string;
        vehicle_type?: string;
        make?: string;
        model?: string;
        year?: number;
        capacity_kg?: number;
        driver_id?: number;
    }) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('vehicles')
            .insert(createData)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Araç detayını getirir
     */
    async getVehicleById(id: number) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('vehicles')
            .select(
                `
        *,
        companies:company_id (id, name),
        drivers:driver_id (id, user_id, profiles:user_id (name))
      `,
            )
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                throw new NotFoundException('Araç bulunamadı');
            }
            throw error;
        }
        return data;
    }

    /**
     * Şirkete ait araçları listeler
     */
    async getVehiclesByCompany(companyId: number) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('vehicles')
            .select(
                `
        *,
        drivers:driver_id (id, user_id, profiles:user_id (name))
      `,
            )
            .eq('company_id', companyId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data;
    }

    /**
     * Araç bilgilerini günceller
     */
    async updateVehicle(
        id: number,
        updateData: {
            plate_number?: string;
            vehicle_type?: string;
            make?: string;
            model?: string;
            year?: number;
            capacity_kg?: number;
            driver_id?: number | null;
            is_active?: boolean;
        },
    ) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('vehicles')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Araca sürücü atar
     */
    async assignDriver(vehicleId: number, driverId: number | null) {
        return this.updateVehicle(vehicleId, { driver_id: driverId });
    }

    /**
     * Aracı deaktive eder
     */
    async deactivateVehicle(id: number) {
        return this.updateVehicle(id, { is_active: false });
    }
}

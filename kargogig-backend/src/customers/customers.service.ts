import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class CustomersService {
    constructor(private readonly supabaseService: SupabaseService) { }

    /**
     * Kullanıcının müşteri kaydını getirir (user_id ile)
     */
    async getCustomerByUserId(userId: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('customers')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Müşteri ID ile getirir
     */
    async getCustomerById(customerId: number) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('customers')
            .select('*')
            .eq('id', customerId)
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Müşteri bilgilerini günceller
     */
    async updateCustomer(
        userId: string,
        updateData: {
            billing_address?: string;
            tax_number?: string;
            default_company_id?: number;
        },
    ) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('customers')
            .update(updateData)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
}

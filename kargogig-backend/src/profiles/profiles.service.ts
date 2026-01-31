import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ProfilesService {
    constructor(private readonly supabaseService: SupabaseService) { }

    /**
     * Kullanıcının kendi profilini getirir
     */
    async getProfile(userId: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) throw error;
        return data;
    }

    /**
     * Profili günceller
     */
    async updateProfile(
        userId: string,
        updateData: { name?: string; phone?: string },
    ) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('profiles')
            .update(updateData)
            .eq('id', userId)
            .select()
            .single();

        if (error) throw error;
        return data;
    }
}

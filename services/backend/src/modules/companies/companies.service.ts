import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class CompaniesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Yeni şirket oluşturur
   */
  async createCompany(createData: {
    name: string;
    company_type?: string;
    tax_number?: string;
    email?: string;
    phone?: string;
    address?: string;
  }) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('companies')
      .insert(createData)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Şirket detayını getirir
   */
  async getCompanyById(companyId: number) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException('Şirket bulunamadı');
      }
      throw error;
    }
    return data;
  }

  /**
   * Kullanıcının üyesi olduğu şirketleri getirir
   */
  async getMyCompanies(userId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('company_users')
      .select(
        `
        company_id,
        role,
        companies (
          id,
          name,
          company_type,
          status,
          email,
          phone
        )
      `,
      )
      .eq('user_id', userId);

    if (error) throw error;
    return data;
  }

  /**
   * Şirketi günceller
   */
  async updateCompany(
    companyId: number,
    updateData: {
      name?: string;
      tax_number?: string;
      email?: string;
      phone?: string;
      address?: string;
    },
  ) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('companies')
      .update(updateData)
      .eq('id', companyId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Kullanıcıyı şirkete ekler (owner/admin yapabilir)
   */
  async addCompanyUser(
    companyId: number,
    userId: string,
    role: string = 'viewer',
  ) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('company_users')
      .insert({
        company_id: companyId,
        user_id: userId,
        role: role,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  ParseIntPipe,
  BadRequestException,
} from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { AdminGuard } from '../common/guards/admin.guard';
import { SetCompanyStatusDto } from './dto/set-company-status.dto';
import { ForceShipmentStatusDto } from './dto/force-shipment-status.dto';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  private get supabase() {
    const url = process.env.SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  @Get('ping')
  ping() {
    return { ok: true };
  }

  @Get('companies')
  async listCompanies(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = Math.min(parseInt(limit || '50', 10), 100);
    const parsedOffset = parseInt(offset || '0', 10);

    let query = this.supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false })
      .range(parsedOffset, parsedOffset + parsedLimit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { ok: true, data, count: data?.length || 0 };
  }

  @Patch('companies/:companyId/status')
  async setCompanyStatus(
    @Param('companyId', ParseIntPipe) companyId: number,
    @Body() body: SetCompanyStatusDto,
  ) {
    const { data, error } = await this.supabase.rpc('admin_set_company_status', {
      p_company_id: companyId,
      p_new_status: body.status,
      p_notes: body.notes || null,
    });

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { ok: true, data: data?.[0] || null };
  }

  @Get('rides')
  async listRides(
    @Query('status') status?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const parsedLimit = Math.min(parseInt(limit || '50', 10), 100);
    const parsedOffset = parseInt(offset || '0', 10);

    let query = this.supabase
      .from('shipments')
      .select('*')
      .order('created_at', { ascending: false })
      .range(parsedOffset, parsedOffset + parsedLimit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { ok: true, data, count: data?.length || 0 };
  }

  @Patch('rides/:shipmentId/force-status')
  async forceShipmentStatus(
    @Param('shipmentId', ParseIntPipe) shipmentId: number,
    @Body() body: ForceShipmentStatusDto,
  ) {
    const { data, error } = await this.supabase.rpc(
      'admin_force_shipment_status',
      {
        p_shipment_id: shipmentId,
        p_new_status: body.status,
        p_notes: body.notes || null,
      },
    );

    if (error) {
      throw new BadRequestException(error.message);
    }

    return { ok: true, data: data?.[0] || null };
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ShipmentsService {
  constructor(private readonly supabaseService: SupabaseService) {}

  /**
   * Shipment detayını getirir
   */
  async getShipmentById(id: number) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('shipments')
      .select(
        `
        *,
        offers:offer_id (*),
        announcements:announcement_id (
          pickup_location, pickup_city, pickup_lat, pickup_lng,
          delivery_location, delivery_city, delivery_lat, delivery_lng,
          cargo_type, cargo_weight
        ),
        customers:customer_id (id, user_id, profiles:user_id (name, phone)),
        companies:company_id (id, name, phone),
        drivers:driver_id (id, user_id, profiles:user_id (name, phone)),
        vehicles:vehicle_id (id, plate_number, vehicle_type)
      `,
      )
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException('Gönderi bulunamadı');
      }
      throw error;
    }
    return data;
  }

  /**
   * Tracking code ile shipment getirir (public endpoint için)
   */
  async getShipmentByTrackingCode(trackingCode: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('shipments')
      .select(
        `
        id, tracking_code, status, picked_up_at, delivered_at,
        announcements:announcement_id (
          pickup_location, pickup_city,
          delivery_location, delivery_city,
          cargo_type
        ),
        companies:company_id (name)
      `,
      )
      .eq('tracking_code', trackingCode)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new NotFoundException('Gönderi bulunamadı');
      }
      throw error;
    }
    return data;
  }

  /**
   * Müşterinin gönderilerini listeler
   */
  async getShipmentsByCustomer(customerId: number) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('shipments')
      .select(
        `
        *,
        announcements:announcement_id (
          pickup_location, pickup_city,
          delivery_location, delivery_city,
          cargo_type
        ),
        companies:company_id (name)
      `,
      )
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Şirketin gönderilerini listeler
   */
  async getShipmentsByCompany(companyId: number) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('shipments')
      .select(
        `
        *,
        announcements:announcement_id (
          pickup_location, pickup_city,
          delivery_location, delivery_city,
          cargo_type
        ),
        customers:customer_id (id, profiles:user_id (name, phone)),
        drivers:driver_id (id, profiles:user_id (name))
      `,
      )
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Sürücünün atanmış gönderilerini listeler
   */
  async getShipmentsByDriver(driverId: number) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('shipments')
      .select(
        `
        *,
        announcements:announcement_id (
          pickup_location, pickup_city, pickup_lat, pickup_lng,
          delivery_location, delivery_city, delivery_lat, delivery_lng,
          cargo_type, cargo_weight
        ),
        customers:customer_id (id, profiles:user_id (name, phone))
      `,
      )
      .eq('driver_id', driverId)
      .in('status', ['assigned', 'picked_up', 'in_transit'])
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Shipment durumunu günceller
   */
  async updateShipmentStatus(
    id: number,
    status: 'assigned' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled',
  ) {
    const updateData: Record<string, unknown> = { status };

    if (status === 'picked_up') {
      updateData.picked_up_at = new Date().toISOString();
    } else if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString();
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('shipments')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Shipment'a sürücü ve araç atar
   */
  async assignDriverAndVehicle(
    id: number,
    driverId: number,
    vehicleId?: number,
  ) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('shipments')
      .update({
        driver_id: driverId,
        vehicle_id: vehicleId || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Tracking bilgisi ekler (sürücü konumu)
   */
  async addTrackingPoint(shipmentId: number, lat: number, lng: number) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('shipment_tracking')
      .insert({
        shipment_id: shipmentId,
        lat,
        lng,
        // point trigger tarafından oluşturulacak
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Shipment'ın tracking geçmişini getirir
   */
  async getTrackingHistory(shipmentId: number) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('shipment_tracking')
      .select('*')
      .eq('shipment_id', shipmentId)
      .order('recorded_at', { ascending: false });

    if (error) throw error;
    return data;
  }
}

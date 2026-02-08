import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ShipmentsService } from './shipments.service';

@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  /**
   * GET /shipments/track/:trackingCode
   * Public tracking - sadece tracking code ile sorgulama
   */
  @Get('track/:trackingCode')
  async getShipmentByTrackingCode(@Param('trackingCode') trackingCode: string) {
    return this.shipmentsService.getShipmentByTrackingCode(trackingCode);
  }

  /**
   * GET /shipments/customer?customerId=xxx
   * Müşterinin gönderileri
   */
  @Get('customer')
  async getShipmentsByCustomer(@Query('customerId') customerId: string) {
    return this.shipmentsService.getShipmentsByCustomer(
      parseInt(customerId, 10),
    );
  }

  /**
   * GET /shipments/company?companyId=xxx
   * Şirketin gönderileri
   */
  @Get('company')
  async getShipmentsByCompany(@Query('companyId') companyId: string) {
    return this.shipmentsService.getShipmentsByCompany(parseInt(companyId, 10));
  }

  /**
   * GET /shipments/driver?driverId=xxx
   * Sürücünün aktif gönderileri
   */
  @Get('driver')
  async getShipmentsByDriver(@Query('driverId') driverId: string) {
    return this.shipmentsService.getShipmentsByDriver(parseInt(driverId, 10));
  }

  /**
   * GET /shipments/:id
   * Gönderi detayı
   */
  @Get(':id')
  async getShipmentById(@Param('id') id: string) {
    return this.shipmentsService.getShipmentById(parseInt(id, 10));
  }

  /**
   * GET /shipments/:id/tracking
   * Tracking geçmişi
   */
  @Get(':id/tracking')
  async getTrackingHistory(@Param('id') id: string) {
    return this.shipmentsService.getTrackingHistory(parseInt(id, 10));
  }

  /**
   * PATCH /shipments/:id/status
   * Durum güncelle
   */
  @Patch(':id/status')
  async updateShipmentStatus(
    @Param('id') id: string,
    @Body()
    body: {
      status:
        | 'assigned'
        | 'picked_up'
        | 'in_transit'
        | 'delivered'
        | 'cancelled';
    },
  ) {
    return this.shipmentsService.updateShipmentStatus(
      parseInt(id, 10),
      body.status,
    );
  }

  /**
   * PATCH /shipments/:id/assign
   * Sürücü ve araç ata
   */
  @Patch(':id/assign')
  async assignDriverAndVehicle(
    @Param('id') id: string,
    @Body() body: { driver_id: number; vehicle_id?: number },
  ) {
    return this.shipmentsService.assignDriverAndVehicle(
      parseInt(id, 10),
      body.driver_id,
      body.vehicle_id,
    );
  }

  /**
   * POST /shipments/:id/tracking
   * Tracking noktası ekle (sürücü konumu)
   */
  @Post(':id/tracking')
  async addTrackingPoint(
    @Param('id') id: string,
    @Body() body: { lat: number; lng: number },
  ) {
    return this.shipmentsService.addTrackingPoint(
      parseInt(id, 10),
      body.lat,
      body.lng,
    );
  }
}

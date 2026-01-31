import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
} from '@nestjs/common';
import { VehiclesService } from './vehicles.service';

@Controller('vehicles')
export class VehiclesController {
    constructor(private readonly vehiclesService: VehiclesService) { }

    /**
     * POST /vehicles
     * Yeni araç ekle
     */
    @Post()
    async createVehicle(
        @Body()
        createData: {
            company_id: number;
            plate_number: string;
            vehicle_type?: string;
            make?: string;
            model?: string;
            year?: number;
            capacity_kg?: number;
            driver_id?: number;
        },
    ) {
        return this.vehiclesService.createVehicle(createData);
    }

    /**
     * GET /vehicles/company?companyId=xxx
     * Şirketin araçlarını listele
     */
    @Get('company')
    async getVehiclesByCompany(@Query('companyId') companyId: string) {
        return this.vehiclesService.getVehiclesByCompany(parseInt(companyId, 10));
    }

    /**
     * GET /vehicles/:id
     * Araç detayı
     */
    @Get(':id')
    async getVehicleById(@Param('id') id: string) {
        return this.vehiclesService.getVehicleById(parseInt(id, 10));
    }

    /**
     * PATCH /vehicles/:id
     * Araç güncelle
     */
    @Patch(':id')
    async updateVehicle(
        @Param('id') id: string,
        @Body()
        updateData: {
            plate_number?: string;
            vehicle_type?: string;
            make?: string;
            model?: string;
            year?: number;
            capacity_kg?: number;
            driver_id?: number;
            is_active?: boolean;
        },
    ) {
        return this.vehiclesService.updateVehicle(parseInt(id, 10), updateData);
    }

    /**
     * PATCH /vehicles/:id/assign-driver
     * Araca sürücü ata
     */
    @Patch(':id/assign-driver')
    async assignDriver(
        @Param('id') id: string,
        @Body() body: { driver_id: number | null },
    ) {
        return this.vehiclesService.assignDriver(
            parseInt(id, 10),
            body.driver_id,
        );
    }

    /**
     * DELETE /vehicles/:id
     * Aracı deaktive et
     */
    @Delete(':id')
    async deactivateVehicle(@Param('id') id: string) {
        return this.vehiclesService.deactivateVehicle(parseInt(id, 10));
    }
}

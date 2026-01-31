import {
    Controller,
    Get,
    Post,
    Patch,
    Body,
    Param,
    Query,
} from '@nestjs/common';
import { DriversService } from './drivers.service';

@Controller('drivers')
export class DriversController {
    constructor(private readonly driversService: DriversService) { }

    /**
     * POST /drivers
     * Yeni sürücü kaydı
     */
    @Post()
    async createDriver(
        @Body()
        createData: {
            user_id: string;
            company_id?: number;
            license_number?: string;
        },
    ) {
        return this.driversService.createDriver(createData);
    }

    /**
     * GET /drivers/user/:userId
     * User ID ile sürücü getir
     */
    @Get('user/:userId')
    async getDriverByUserId(@Param('userId') userId: string) {
        return this.driversService.getDriverByUserId(userId);
    }

    /**
     * GET /drivers/company?companyId=xxx
     * Şirketin sürücülerini listele
     */
    @Get('company')
    async getDriversByCompany(@Query('companyId') companyId: string) {
        return this.driversService.getDriversByCompany(parseInt(companyId, 10));
    }

    /**
     * GET /drivers/:id
     * Sürücü detayı
     */
    @Get(':id')
    async getDriverById(@Param('id') id: string) {
        return this.driversService.getDriverById(parseInt(id, 10));
    }

    /**
     * PATCH /drivers/:id
     * Sürücü güncelle
     */
    @Patch(':id')
    async updateDriver(
        @Param('id') id: string,
        @Body()
        updateData: {
            license_number?: string;
            availability?: string;
            is_available?: boolean;
            company_id?: number;
        },
    ) {
        return this.driversService.updateDriver(parseInt(id, 10), updateData);
    }

    /**
     * PATCH /drivers/:id/availability
     * Müsaitlik durumu değiştir
     */
    @Patch(':id/availability')
    async setAvailability(
        @Param('id') id: string,
        @Body() body: { is_available: boolean },
    ) {
        return this.driversService.setAvailability(
            parseInt(id, 10),
            body.is_available,
        );
    }
}

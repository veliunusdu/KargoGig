import {
    Controller,
    Get,
    Post,
    Patch,
    Body,
    Param,
    Query,
} from '@nestjs/common';
import { CompaniesService } from './companies.service';

@Controller('companies')
export class CompaniesController {
    constructor(private readonly companiesService: CompaniesService) { }

    /**
     * POST /companies
     * Yeni şirket oluşturur
     */
    @Post()
    async createCompany(
        @Body()
        createData: {
            name: string;
            company_type?: string;
            tax_number?: string;
            email?: string;
            phone?: string;
            address?: string;
        },
    ) {
        return this.companiesService.createCompany(createData);
    }

    /**
     * GET /companies/my?userId=xxx
     * Kullanıcının üyesi olduğu şirketleri getirir
     * TODO: JWT Guard eklenince userId auth'dan alınacak
     */
    @Get('my')
    async getMyCompanies(@Query('userId') userId: string) {
        return this.companiesService.getMyCompanies(userId);
    }

    /**
     * GET /companies/:id
     * Şirket detayı
     */
    @Get(':id')
    async getCompanyById(@Param('id') id: string) {
        return this.companiesService.getCompanyById(parseInt(id, 10));
    }

    /**
     * PATCH /companies/:id
     * Şirketi günceller
     */
    @Patch(':id')
    async updateCompany(
        @Param('id') id: string,
        @Body()
        updateData: {
            name?: string;
            tax_number?: string;
            email?: string;
            phone?: string;
            address?: string;
        },
    ) {
        return this.companiesService.updateCompany(parseInt(id, 10), updateData);
    }

    /**
     * POST /companies/:id/users
     * Şirkete kullanıcı ekler
     */
    @Post(':id/users')
    async addCompanyUser(
        @Param('id') id: string,
        @Body() body: { userId: string; role?: string },
    ) {
        return this.companiesService.addCompanyUser(
            parseInt(id, 10),
            body.userId,
            body.role,
        );
    }
}

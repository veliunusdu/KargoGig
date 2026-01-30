import {
    Controller,
    Get,
    Post,
    Patch,
    Body,
    Param,
    Query,
} from '@nestjs/common';
import { OffersService } from './offers.service';
import { CreateOfferDto } from './dto/create-offer.dto';

@Controller('offers')
export class OffersController {
    constructor(private readonly offersService: OffersService) { }

    /**
     * POST /offers
     * Yeni teklif oluşturur (şirket)
     */
    @Post()
    async createOffer(@Body() createDto: CreateOfferDto) {
        return this.offersService.createOffer(createDto);
    }

    /**
     * GET /offers/announcement/:announcementId
     * Bir ilana gelen teklifler
     */
    @Get('announcement/:announcementId')
    async getOffersByAnnouncement(
        @Param('announcementId') announcementId: string,
    ) {
        return this.offersService.getOffersByAnnouncement(
            parseInt(announcementId, 10),
        );
    }

    /**
     * GET /offers/company?companyId=xxx
     * Şirketin verdiği teklifler
     */
    @Get('company')
    async getOffersByCompany(@Query('companyId') companyId: string) {
        return this.offersService.getOffersByCompany(parseInt(companyId, 10));
    }

    /**
     * GET /offers/:id
     * Teklif detayı
     */
    @Get(':id')
    async getOfferById(@Param('id') id: string) {
        return this.offersService.getOfferById(parseInt(id, 10));
    }

    /**
     * PATCH /offers/:id/accept
     * Teklifi kabul et (müşteri)
     */
    @Patch(':id/accept')
    async acceptOffer(@Param('id') id: string) {
        return this.offersService.acceptOffer(parseInt(id, 10));
    }

    /**
     * PATCH /offers/:id/reject
     * Teklifi reddet (müşteri)
     */
    @Patch(':id/reject')
    async rejectOffer(@Param('id') id: string) {
        return this.offersService.rejectOffer(parseInt(id, 10));
    }

    /**
     * PATCH /offers/:id/cancel
     * Teklifi iptal et (şirket)
     */
    @Patch(':id/cancel')
    async cancelOffer(@Param('id') id: string) {
        return this.offersService.cancelOffer(parseInt(id, 10));
    }
}

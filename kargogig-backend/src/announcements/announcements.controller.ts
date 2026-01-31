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
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';

@Controller('announcements')
export class AnnouncementsController {
    constructor(private readonly announcementsService: AnnouncementsService) { }

    /**
     * POST /announcements
     * Yeni ilan oluşturur
     */
    @Post()
    async createAnnouncement(@Body() createDto: CreateAnnouncementDto) {
        return this.announcementsService.createAnnouncement(createDto);
    }

    /**
     * GET /announcements
     * Tüm pending ilanları getirir (marketplace)
     */
    @Get()
    async getPendingAnnouncements() {
        return this.announcementsService.getPendingAnnouncements();
    }

    /**
     * GET /announcements/my?customerId=xxx
     * Müşterinin kendi ilanlarını getirir
     */
    @Get('my')
    async getMyAnnouncements(@Query('customerId') customerId: string) {
        return this.announcementsService.getMyAnnouncements(parseInt(customerId, 10));
    }

    /**
     * GET /announcements/:id
     * İlan detayı
     */
    @Get(':id')
    async getAnnouncementById(@Param('id') id: string) {
        return this.announcementsService.getAnnouncementById(parseInt(id, 10));
    }

    /**
     * PATCH /announcements/:id
     * İlanı günceller
     */
    @Patch(':id')
    async updateAnnouncement(
        @Param('id') id: string,
        @Body() updateData: Partial<CreateAnnouncementDto>,
    ) {
        return this.announcementsService.updateAnnouncement(
            parseInt(id, 10),
            updateData,
        );
    }

    /**
     * DELETE /announcements/:id
     * İlanı iptal eder
     */
    @Delete(':id')
    async deleteAnnouncement(@Param('id') id: string) {
        return this.announcementsService.deleteAnnouncement(parseInt(id, 10));
    }
}

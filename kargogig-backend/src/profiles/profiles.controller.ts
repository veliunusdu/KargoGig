import { Controller, Get, Patch, Body, Param } from '@nestjs/common';
import { ProfilesService } from './profiles.service';

@Controller('profiles')
export class ProfilesController {
    constructor(private readonly profilesService: ProfilesService) { }

    /**
     * GET /profiles/:userId
     * Kullanıcı profilini getirir
     * TODO: JWT Guard eklenince userId auth.uid()'den alınacak
     */
    @Get(':userId')
    async getProfile(@Param('userId') userId: string) {
        return this.profilesService.getProfile(userId);
    }

    /**
     * PATCH /profiles/:userId
     * Profili günceller
     */
    @Patch(':userId')
    async updateProfile(
        @Param('userId') userId: string,
        @Body() updateData: { name?: string; phone?: string },
    ) {
        return this.profilesService.updateProfile(userId, updateData);
    }
}

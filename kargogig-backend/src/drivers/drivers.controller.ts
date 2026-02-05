import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  ParseIntPipe,
  Logger,
} from '@nestjs/common';
import { DriversService } from './drivers.service';
import {
  CreateDriverDto,
  UpdateDriverLocationDto,
  NearbyDriversQueryDto,
} from './dto';

/**
 * Controller for driver-related HTTP endpoints
 * All routes are prefixed with /drivers (via global prefix: /api/v1/drivers)
 */
@Controller('drivers')
export class DriversController {
  private readonly logger = new Logger(DriversController.name);

  constructor(private readonly driversService: DriversService) {}

  // ─────────────────────────────────────────────────────────────
  // DRIVER CRUD ENDPOINTS
  // ─────────────────────────────────────────────────────────────

  /**
   * POST /drivers
   * Create a new driver record
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createDriver(@Body() dto: CreateDriverDto) {
    this.logger.log(`[POST /drivers] Creating driver for user: ${dto.user_id}`);
    return this.driversService.createDriver(dto);
  }

  /**
   * GET /drivers/user/:userId
   * Get driver by user ID
   */
  @Get('user/:userId')
  async getDriverByUserId(@Param('userId') userId: string) {
    this.logger.log(`[GET /drivers/user/${userId}] Fetching driver by user ID`);
    return this.driversService.getDriverByUserId(userId);
  }

  /**
   * GET /drivers/company?companyId=xxx
   * Get all drivers for a company
   */
  @Get('company')
  async getDriversByCompany(@Query('companyId', ParseIntPipe) companyId: number) {
    this.logger.log(`[GET /drivers/company] Fetching drivers for company: ${companyId}`);
    return this.driversService.getDriversByCompany(companyId);
  }

  // ─────────────────────────────────────────────────────────────
  // LOCATION ENDPOINTS (Day 4 Real-time Location)
  // ─────────────────────────────────────────────────────────────

  /**
   * PATCH /drivers/location
   * Update driver's own location (RLS enforced via JWT)
   * Requires Authorization header with driver's JWT token
   */
  @Patch('location')
  @HttpCode(HttpStatus.OK)
  async updateMyLocation(
    @Headers('authorization') authHeader: string,
    @Body() dto: UpdateDriverLocationDto,
  ) {
    this.logger.log(`[PATCH /drivers/location] lat=${dto.lat}, lng=${dto.lng}`);
    return this.driversService.upsertMyLocation(authHeader, dto);
  }

  /**
   * GET /drivers/nearby?lat=xxx&lng=xxx&radius=xxx&limit=xxx
   * Find nearby drivers (public endpoint, uses service role internally)
   */
  @Get('nearby')
  async findNearbyDrivers(@Query() query: NearbyDriversQueryDto) {
    this.logger.log(
      `[GET /drivers/nearby] lat=${query.lat}, lng=${query.lng}, radius=${query.radius}, limit=${query.limit}`,
    );
    return this.driversService.findNearbyDrivers({
      lat: query.lat,
      lng: query.lng,
      radius: query.radius,
      limit: query.limit,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // DRIVER DETAIL & UPDATE ENDPOINTS
  // ─────────────────────────────────────────────────────────────

  /**
   * GET /drivers/:id
   * Get driver details by ID
   * NOTE: Must be declared AFTER /nearby to avoid route conflict
   */
  @Get(':id')
  async getDriverById(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`[GET /drivers/${id}] Fetching driver by ID`);
    return this.driversService.getDriverById(id);
  }

  /**
   * PATCH /drivers/:id
   * Update driver information
   */
  @Patch(':id')
  async updateDriver(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    updateData: {
      license_number?: string;
      availability?: string;
      is_available?: boolean;
      company_id?: number;
    },
  ) {
    this.logger.log(`[PATCH /drivers/${id}] Updating driver`);
    return this.driversService.updateDriver(id, updateData);
  }

  /**
   * PATCH /drivers/:id/availability
   * Toggle driver availability status
   */
  @Patch(':id/availability')
  async setAvailability(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { is_available: boolean },
  ) {
    this.logger.log(`[PATCH /drivers/${id}/availability] Setting availability: ${body.is_available}`);
    return this.driversService.setAvailability(id, body.is_available);
  }
}

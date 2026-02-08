import {
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { DriversRepository } from './drivers.repository';
import { DriverNearbyResult, DriverWithRelations, Driver } from './types';
import { NEARBY_DRIVERS_DEFAULT_RADIUS_M, NEARBY_DRIVERS_DEFAULT_LIMIT } from './constants/drivers.constants';

/**
 * Service layer for driver business logic
 * Orchestrates repository calls and handles error mapping
 */
@Injectable()
export class DriversService {
  private readonly logger = new Logger(DriversService.name);

  constructor(private readonly driversRepository: DriversRepository) {}

  // ─────────────────────────────────────────────────────────────
  // DRIVER CRUD OPERATIONS
  // ─────────────────────────────────────────────────────────────

  /**
   * Create a new driver record
   */
  async createDriver(createData: {
    user_id: string;
    company_id?: number;
    license_number?: string;
  }): Promise<Driver> {
    const { data, error } = await this.driversRepository.createDriver(createData);

    if (error) {
      this.logger.error(`[createDriver] Error: ${error.message}`);
      throw new HttpException(
        `Failed to create driver: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!data) {
      throw new HttpException('Failed to create driver', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    return data;
  }

  /**
   * Get driver by ID
   */
  async getDriverById(id: number): Promise<DriverWithRelations> {
    const { data, error } = await this.driversRepository.findDriverById(id);

    if (error) {
      // Supabase returns PGRST116 for "no rows returned"
      if ((error as { code?: string }).code === 'PGRST116') {
        throw new NotFoundException('Sürücü bulunamadı');
      }
      this.logger.error(`[getDriverById] Error: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.BAD_GATEWAY);
    }

    if (!data) {
      throw new NotFoundException('Sürücü bulunamadı');
    }

    return data;
  }

  /**
   * Get driver by user ID
   */
  async getDriverByUserId(userId: string): Promise<DriverWithRelations> {
    const { data, error } = await this.driversRepository.findDriverByUserId(userId);

    if (error) {
      if ((error as { code?: string }).code === 'PGRST116') {
        throw new NotFoundException('Sürücü bulunamadı');
      }
      this.logger.error(`[getDriverByUserId] Error: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.BAD_GATEWAY);
    }

    if (!data) {
      throw new NotFoundException('Sürücü bulunamadı');
    }

    return data;
  }

  /**
   * Get all drivers for a company
   */
  async getDriversByCompany(companyId: number): Promise<DriverWithRelations[]> {
    const { data, error } = await this.driversRepository.findDriversByCompanyId(companyId);

    if (error) {
      this.logger.error(`[getDriversByCompany] Error: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.BAD_GATEWAY);
    }

    return data ?? [];
  }

  /**
   * Update driver information
   */
  async updateDriver(
    id: number,
    updateData: {
      license_number?: string;
      availability?: string;
      is_available?: boolean;
      company_id?: number;
    },
  ): Promise<Driver> {
    const { data, error } = await this.driversRepository.updateDriver(id, updateData);

    if (error) {
      this.logger.error(`[updateDriver] Error: ${error.message}`);
      throw new HttpException(error.message, HttpStatus.BAD_GATEWAY);
    }

    if (!data) {
      throw new NotFoundException('Sürücü bulunamadı');
    }

    return data;
  }

  /**
   * Set driver availability status
   */
  async setAvailability(id: number, isAvailable: boolean): Promise<Driver> {
    return this.updateDriver(id, { is_available: isAvailable });
  }

  // ─────────────────────────────────────────────────────────────
  // LOCATION OPERATIONS
  // ─────────────────────────────────────────────────────────────

  /**
   * Update driver's own location (RLS enforced)
   * Driver can only update their own location
   */
  async upsertMyLocation(
    authHeader: string,
    dto: { lat: number; lng: number },
  ): Promise<unknown> {
    // Extract JWT from "Bearer <token>"
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedException('Authorization header eksik veya geçersiz');
    }

    this.logger.log(`[upsertMyLocation] Updating location: lat=${dto.lat}, lng=${dto.lng}`);

    const { data, error } = await this.driversRepository.upsertMyLocation(
      token,
      dto.lat,
      dto.lng,
    );

    if (error) {
      this.logger.error(`[upsertMyLocation] RPC error: ${error.message}`);
      throw new HttpException(
        `Failed to update location: ${error.message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    this.logger.log('[upsertMyLocation] Location updated successfully');
    return data;
  }

  /**
   * Find nearby drivers (service role, no RLS)
   * Returns drivers within radius ordered by distance
   */
  async findNearbyDrivers(params: {
    lat: number;
    lng: number;
    radius?: number;
    limit?: number;
  }): Promise<DriverNearbyResult[]> {
    const radius = params.radius ?? NEARBY_DRIVERS_DEFAULT_RADIUS_M;
    const limit = params.limit ?? NEARBY_DRIVERS_DEFAULT_LIMIT;

    this.logger.log(
      `[findNearbyDrivers] Searching: lat=${params.lat}, lng=${params.lng}, radius=${radius}m, limit=${limit}`,
    );

    // Debug: Check if there's any data in driver_locations
    const debugInfo = await this.driversRepository.debugCheckDriverLocations();
    this.logger.log(
      `[findNearbyDrivers] DEBUG driver_locations: count=${debugInfo.count}, sample=${JSON.stringify(debugInfo.sample)}`,
    );

    const { data, error } = await this.driversRepository.findDriversWithinRadius({
      lat: params.lat,
      lng: params.lng,
      radiusM: radius,
      limit,
    });

    if (error) {
      this.logger.error(`[findNearbyDrivers] RPC error: ${error.message}`);
      throw new HttpException(
        `RPC error: ${error.message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    const results = data ?? [];

    this.logger.log(`[findNearbyDrivers] Found ${results.length} drivers`);

    // Ensure distance_m is a number (PostGIS may return string)
    return results.map((row) => ({
      ...row,
      distance_m: Number(row.distance_m),
    }));
  }

  // ─────────────────────────────────────────────────────────────
  // SESSION MANAGEMENT (Day 5)
  // ─────────────────────────────────────────────────────────────

  /**
   * Mark driver as online and create/update session
   */
  async goOnline(
    authHeader: string | undefined,
    dto: { device_type?: string; device_token?: string },
  ): Promise<{ ok: boolean; driver_id: number; is_online: boolean }> {
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedException('Authorization header eksik veya geçersiz');
    }

    this.logger.log(
      `[goOnline] device_type=${dto.device_type || 'unknown'}, has_token=${!!dto.device_token}`,
    );

    const { data, error } = await this.driversRepository.goOnline(
      token,
      dto.device_type || 'unknown',
      dto.device_token || null,
    );

    if (error) {
      this.logger.error(`[goOnline] RPC error: ${error.message}`);

      // Map specific errors
      const msg = error.message?.toLowerCase() || '';
      if (msg.includes('not a driver')) {
        throw new HttpException('Not a driver', HttpStatus.FORBIDDEN);
      }
      if (msg.includes('not approved')) {
        throw new HttpException('Driver not approved', HttpStatus.CONFLICT);
      }

      throw new HttpException(
        `Failed to go online: ${error.message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    this.logger.log(`[goOnline] Success: driver_id=${data?.driver_id}`);
    return data!;
  }

  /**
   * Mark driver as offline
   */
  async goOffline(
    authHeader: string | undefined,
    dto: { device_type?: string },
  ): Promise<{ ok: boolean; driver_id: number; is_online: boolean }> {
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      throw new UnauthorizedException('Authorization header eksik veya geçersiz');
    }

    this.logger.log(`[goOffline] device_type=${dto.device_type || 'unknown'}`);

    const { data, error } = await this.driversRepository.goOffline(
      token,
      dto.device_type || 'unknown',
    );

    if (error) {
      this.logger.error(`[goOffline] RPC error: ${error.message}`);

      // Map specific errors
      const msg = error.message?.toLowerCase() || '';
      if (msg.includes('not a driver')) {
        throw new HttpException('Not a driver', HttpStatus.FORBIDDEN);
      }

      throw new HttpException(
        `Failed to go offline: ${error.message}`,
        HttpStatus.BAD_GATEWAY,
      );
    }

    this.logger.log(`[goOffline] Success: driver_id=${data?.driver_id}`);
    return data!;
  }
}

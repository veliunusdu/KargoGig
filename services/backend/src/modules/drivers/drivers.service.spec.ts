import { Test, TestingModule } from '@nestjs/testing';
import { DriversService } from './drivers.service';
import { DriversRepository } from './drivers.repository';
import { HttpException, NotFoundException, UnauthorizedException } from '@nestjs/common';

describe('DriversService', () => {
  let service: DriversService;
  let repository: jest.Mocked<DriversRepository>;

  beforeEach(async () => {
    const mockRepository = {
      createDriver: jest.fn(),
      findDriverById: jest.fn(),
      findDriverByUserId: jest.fn(),
      findDriversByCompanyId: jest.fn(),
      updateDriver: jest.fn(),
      upsertMyLocation: jest.fn(),
      findDriversWithinRadius: jest.fn(),
      debugCheckDriverLocations: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DriversService,
        { provide: DriversRepository, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<DriversService>(DriversService);
    repository = module.get(DriversRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findNearbyDrivers', () => {
    it('should return nearby drivers', async () => {
      const mockDrivers = [
        { driver_id: 1, company_id: null, lat: 41.0, lng: 29.0, distance_m: 100, last_seen_at: '2026-01-01T00:00:00Z' },
      ];

      repository.debugCheckDriverLocations.mockResolvedValue({ count: 1, sample: {} });
      repository.findDriversWithinRadius.mockResolvedValue({ data: mockDrivers, error: null });

      const result = await service.findNearbyDrivers({ lat: 41.0, lng: 29.0 });

      expect(result).toHaveLength(1);
      expect(result[0].driver_id).toBe(1);
      expect(result[0].distance_m).toBe(100);
    });

    it('should throw HttpException on RPC error', async () => {
      repository.debugCheckDriverLocations.mockResolvedValue({ count: 0, sample: null });
      repository.findDriversWithinRadius.mockResolvedValue({ data: null, error: new Error('RPC failed') });

      await expect(service.findNearbyDrivers({ lat: 41.0, lng: 29.0 })).rejects.toThrow(HttpException);
    });

    it('should return empty array when no drivers found', async () => {
      repository.debugCheckDriverLocations.mockResolvedValue({ count: 0, sample: null });
      repository.findDriversWithinRadius.mockResolvedValue({ data: [], error: null });

      const result = await service.findNearbyDrivers({ lat: 41.0, lng: 29.0 });

      expect(result).toHaveLength(0);
    });
  });

  describe('upsertMyLocation', () => {
    it('should throw UnauthorizedException when no auth header', async () => {
      await expect(
        service.upsertMyLocation('', { lat: 41.0, lng: 29.0 }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should update location successfully', async () => {
      repository.upsertMyLocation.mockResolvedValue({ data: { success: true }, error: null });

      const result = await service.upsertMyLocation('Bearer valid-token', { lat: 41.0, lng: 29.0 });

      expect(result).toEqual({ success: true });
      expect(repository.upsertMyLocation).toHaveBeenCalledWith('valid-token', 41.0, 29.0);
    });
  });

  describe('getDriverById', () => {
    it('should throw NotFoundException when driver not found', async () => {
      repository.findDriverById.mockResolvedValue({ data: null, error: null });

      await expect(service.getDriverById(999)).rejects.toThrow(NotFoundException);
    });
  });
});

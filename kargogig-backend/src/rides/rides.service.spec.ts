import { Test, TestingModule } from '@nestjs/testing';
import { RidesService } from './rides.service';
import { SupabaseService } from '../supabase/supabase.service';
import { MapsService } from '../maps/maps.service';
import { PaymentsService } from '../payments/payments.service';
import { NotificationsService } from '../notifications/notifications.service';

describe('RidesService', () => {
  let service: RidesService;

  // Mock Supabase Query Builder Chain
  const mockSupabaseBuilder = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn(),
  };

  const mockSupabaseClient = {
    from: jest.fn().mockReturnValue(mockSupabaseBuilder),
  };

  const mockSupabaseService = {
    admin: jest.fn().mockReturnValue(mockSupabaseClient),
    getClient: jest.fn().mockReturnValue(mockSupabaseClient),
    asUser: jest.fn().mockReturnValue(mockSupabaseClient),
  };

  const mockMapsService = {
    computeRoute: jest.fn(),
  };

  const mockPaymentsService = {};
  const mockNotificationsService = {};

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RidesService,
        { provide: SupabaseService, useValue: mockSupabaseService },
        { provide: MapsService, useValue: mockMapsService },
        { provide: PaymentsService, useValue: mockPaymentsService },
        { provide: NotificationsService, useValue: mockNotificationsService },
      ],
    }).compile();

    service = module.get<RidesService>(RidesService);

    jest.clearAllMocks();
  });

  describe('estimate', () => {
    const dto = {
      origin: { lat: 10, lng: 10 },
      destination: { lat: 20, lng: 20 },
      companyId: 1,
    };

    const mockPricing = {
      currency: 'TRY',
      base_fare: 10,
      per_km: 2,
      per_minute: 1,
      minimum_fare: 20,
    };

    it('should calculate estimate and cache pricing (only 1 DB call)', async () => {
      mockMapsService.computeRoute.mockResolvedValue({
        distanceMeters: 5000, // 5 km
        duration: '600s', // 10 min
      });

      mockSupabaseBuilder.maybeSingle.mockResolvedValue({
        data: mockPricing,
        error: null,
      });

      // First call - should hit DB
      await service.estimate(dto);
      // Second call - should use cache
      await service.estimate(dto);

      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(1);
      expect(mockSupabaseClient.from).toHaveBeenCalledWith('company_pricing');
    });

    it('should refetch pricing after TTL expires', async () => {
      mockMapsService.computeRoute.mockResolvedValue({
        distanceMeters: 5000,
        duration: '600s',
      });
      mockSupabaseBuilder.maybeSingle.mockResolvedValue({
        data: mockPricing,
        error: null,
      });

      // Mock Date.now
      const now = 1000000000000;
      jest.spyOn(Date, 'now').mockReturnValue(now);

      // 1. Call (DB hit)
      await service.estimate(dto);
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(1);

      // 2. Call within TTL (Cache hit)
      jest.spyOn(Date, 'now').mockReturnValue(now + 1000); // +1 sec
      await service.estimate(dto);
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(1);

      // 3. Call after TTL (DB hit again)
      jest.spyOn(Date, 'now').mockReturnValue(now + 5 * 60 * 1000 + 100); // +5 min 100ms
      await service.estimate(dto);
      expect(mockSupabaseClient.from).toHaveBeenCalledTimes(2);
    });
  });
});

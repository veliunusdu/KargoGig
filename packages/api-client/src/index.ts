import type { Ride, Payment, Offer, Vehicle } from '@kargogig/types/models';
import type { CreateRideInput, CreateOfferInput } from '@kargogig/types/schemas';

export class ApiClient {
  private baseUrl: string;
  private token?: string;

  constructor(baseUrl: string, token?: string) {
    this.baseUrl = baseUrl;
    this.token = token;
  }

  private async fetch<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      ...options?.headers,
    };

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  }

  // Rides
  async createRide(data: CreateRideInput): Promise<Ride> {
    return this.fetch<Ride>('/rides', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getRide(id: string): Promise<Ride> {
    return this.fetch<Ride>(`/rides/${id}`);
  }

  async getMyRides(): Promise<Ride[]> {
    return this.fetch<Ride[]>('/rides/my');
  }

  async cancelRide(id: string): Promise<void> {
    return this.fetch<void>(`/rides/${id}/cancel`, { method: 'POST' });
  }

  // Offers
  async createOffer(data: CreateOfferInput): Promise<Offer> {
    return this.fetch<Offer>('/offers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async acceptOffer(id: string): Promise<Offer> {
    return this.fetch<Offer>(`/offers/${id}/accept`, { method: 'POST' });
  }

  // Payments
  async getPayment(id: string): Promise<Payment> {
    return this.fetch<Payment>(`/payments/${id}`);
  }

  async getMyPayments(): Promise<Payment[]> {
    return this.fetch<Payment[]>('/payments/my');
  }

  // Vehicles
  async getVehicles(): Promise<Vehicle[]> {
    return this.fetch<Vehicle[]>('/vehicles');
  }

  async getVehicle(id: string): Promise<Vehicle> {
    return this.fetch<Vehicle>(`/vehicles/${id}`);
  }
}

export function createApiClient(baseUrl: string, token?: string) {
  return new ApiClient(baseUrl, token);
}

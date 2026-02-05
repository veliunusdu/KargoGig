export class CreateAnnouncementDto {
  customer_id: number;

  pickup_location: string;
  pickup_lat: number;
  pickup_lng: number;
  pickup_city?: string;

  delivery_location: string;
  delivery_lat: number;
  delivery_lng: number;
  delivery_city?: string;

  cargo_type: string;
  cargo_weight?: number;
  cargo_volume?: string;
  cargo_dimensions?: Record<string, unknown>;

  scheduled_date?: string;
  pickup_date?: string;
  delivery_date?: string;

  budget_min?: number;
  budget_max?: number;
  currency?: string;

  notes?: string;
}

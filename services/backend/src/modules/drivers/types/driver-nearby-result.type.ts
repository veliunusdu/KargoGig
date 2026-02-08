/**
 * Result type for nearby drivers query
 * Matches the return type of drivers_within_radius RPC
 */
export interface DriverNearbyResult {
  driver_id: number;
  company_id: number | null;
  lat: number;
  lng: number;
  distance_m: number;
  last_seen_at: string;
}

/**
 * Raw result from RPC (distance_m may be string from PostGIS)
 */
export interface DriverNearbyResultRaw {
  driver_id: number;
  company_id: number | null;
  lat: number;
  lng: number;
  distance_m: number | string;
  last_seen_at: string;
}

/**
 * Driver location update result
 */
export interface DriverLocationUpdateResult {
  driver_id: number;
  updated_at: string;
}

/**
 * Driver basic info
 */
export interface Driver {
  id: number;
  user_id: string;
  company_id: number | null;
  license_number: string | null;
  is_available: boolean;
  availability: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Driver with relations (profile, company)
 */
export interface DriverWithRelations extends Driver {
  companies: {
    id: number;
    name: string;
  } | null;
  profiles: {
    name: string | null;
    phone: string | null;
    email: string | null;
  } | null;
}

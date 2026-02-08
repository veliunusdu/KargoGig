/**
 * Driver Location Constants
 * Default values and limits for driver location operations
 */

// Nearby drivers query defaults
export const NEARBY_DRIVERS_DEFAULT_RADIUS_M = 5000;
export const NEARBY_DRIVERS_MIN_RADIUS_M = 100;
export const NEARBY_DRIVERS_MAX_RADIUS_M = 100000;

export const NEARBY_DRIVERS_DEFAULT_LIMIT = 20;
export const NEARBY_DRIVERS_MIN_LIMIT = 1;
export const NEARBY_DRIVERS_MAX_LIMIT = 100;

// Latitude/Longitude bounds
export const LAT_MIN = -90;
export const LAT_MAX = 90;
export const LNG_MIN = -180;
export const LNG_MAX = 180;

// Driver location freshness (for filtering stale locations)
export const LOCATION_STALE_THRESHOLD_MINUTES = 30;

// RPC function names
export const RPC_UPSERT_MY_DRIVER_LOCATION = 'upsert_my_driver_location';
export const RPC_DRIVERS_WITHIN_RADIUS = 'drivers_within_radius';

// Table names
export const TABLE_DRIVERS = 'drivers';
export const TABLE_DRIVER_LOCATIONS = 'driver_locations';

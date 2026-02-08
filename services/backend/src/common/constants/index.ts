/**
 * API Response statuses
 */
export const API_STATUS = {
  SUCCESS: 'success',
  ERROR: 'error',
  PENDING: 'pending',
} as const;

/**
 * Ride statuses
 */
export const RIDE_STATUS = {
  PENDING: 'pending',
  MATCHED: 'matched',
  ACCEPTED: 'accepted',
  PICKED_UP: 'picked_up',
  IN_TRANSIT: 'in_transit',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const;

/**
 * Payment statuses
 */
export const PAYMENT_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed',
  REFUNDED: 'refunded',
} as const;

/**
 * User roles
 */
export const USER_ROLES = {
  CUSTOMER: 'customer',
  DRIVER: 'driver',
  COMPANY: 'company',
  ADMIN: 'admin',
} as const;

/**
 * Vehicle types
 */
export const VEHICLE_TYPES = {
  SEDAN: 'sedan',
  SUV: 'suv',
  VAN: 'van',
  TRUCK: 'truck',
} as const;

/**
 * Offer statuses
 */
export const OFFER_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
} as const;

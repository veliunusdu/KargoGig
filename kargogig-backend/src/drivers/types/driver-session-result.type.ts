/**
 * Result type for driver session RPCs (go online/offline)
 */
export interface DriverSessionResult {
  ok: boolean;
  driver_id: number;
  is_online: boolean;
}

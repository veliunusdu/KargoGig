import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PostgrestError } from '@supabase/supabase-js';

/**
 * Maps Supabase RPC errors to appropriate NestJS HTTP exceptions.
 *
 * Error message patterns (from your SQL RPCs):
 * - "Not authenticated" → 401 Unauthorized
 * - "Forbidden", "Not a driver", "Shipment not assigned to this driver" → 403 Forbidden
 * - "No shipment for announcement", "not found" → 404 Not Found
 * - "Cannot cancel after pickup/in_transit", "already cancelled" → 409 Conflict
 * - Other errors → 400 Bad Request or 500 Internal Server Error
 */
export function mapRpcErrorToHttp(error: PostgrestError | null): HttpException {
  if (!error) {
    return new InternalServerErrorException('Unknown RPC error');
  }

  const msg = error.message?.toLowerCase() ?? '';
  const details = error.details?.toLowerCase() ?? '';
  const hint = error.hint?.toLowerCase() ?? '';

  // 401 Unauthorized
  if (msg.includes('not authenticated') || msg.includes('authentication required')) {
    return new UnauthorizedException(error.message);
  }

  // 403 Forbidden
  if (
    msg.includes('forbidden') ||
    msg.includes('not a driver') ||
    msg.includes('shipment not assigned to this driver') ||
    msg.includes('permission denied') ||
    msg.includes('access denied')
  ) {
    return new ForbiddenException(error.message);
  }

  // 404 Not Found
  if (
    msg.includes('not found') ||
    msg.includes('no shipment for announcement') ||
    msg.includes('announcement not found') ||
    msg.includes('shipment not found')
  ) {
    return new NotFoundException(error.message);
  }

  // 422 Unprocessable Entity (geo-fence failures, location issues)
  if (
    msg.includes('geo-fence failed') ||
    msg.includes('geofence failed') ||
    msg.includes('too far from pickup') ||
    msg.includes('too far from dropoff') ||
    msg.includes('driver location missing') ||
    msg.includes('location not available') ||
    msg.includes('invalid coordinates') ||
    msg.includes('invalid lat') ||
    msg.includes('invalid lng')
  ) {
    return new UnprocessableEntityException(error.message);
  }

  // 409 Conflict (state conflict)
  if (
    msg.includes('cannot cancel after pickup') ||
    msg.includes('cannot cancel after in_transit') ||
    msg.includes('already cancelled') ||
    msg.includes('already arrived') ||
    msg.includes('already started') ||
    msg.includes('already completed') ||
    msg.includes('cannot start: not arrived') ||
    msg.includes('cannot complete: not in progress') ||
    msg.includes('must arrive before starting') ||
    msg.includes('not in progress') ||
    msg.includes('shipment not in progress') ||
    msg.includes('ride not active') ||
    msg.includes('invalid state') ||
    msg.includes('state conflict') ||
    details.includes('conflict')
  ) {
    return new ConflictException(error.message);
  }

  // Generic bad request for validation errors
  if (
    error.code === '23503' || // FK violation
    error.code === '23505' || // unique violation
    error.code === '22P02' || // invalid input syntax
    msg.includes('invalid') ||
    msg.includes('required')
  ) {
    return new BadRequestException(error.message);
  }

  // 500 Internal Server Error for everything else
  return new InternalServerErrorException(error.message);
}

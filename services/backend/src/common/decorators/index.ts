import { SetMetadata } from '@nestjs/common';

/**
 * Public route decorator - skip auth guard
 */
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Roles decorator - specify required roles
 */
export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Request ID decorator - inject request ID into controller
 */
export const REQUEST_ID_KEY = 'requestId';
export const RequestId = () => SetMetadata(REQUEST_ID_KEY, true);

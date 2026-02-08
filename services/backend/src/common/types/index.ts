/**
 * Common TypeScript types used across the application
 */

export type UUID = string;

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface Location {
  lat: number;
  lng: number;
  address?: string;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

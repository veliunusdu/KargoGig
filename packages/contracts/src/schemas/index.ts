import { z } from 'zod';

// Location schema
export const LocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  address: z.string(),
});

// Ride schemas
export const CreateRideSchema = z.object({
  pickup_location: LocationSchema,
  dropoff_location: LocationSchema,
  vehicle_type: z.enum(['sedan', 'suv', 'van', 'truck']),
  cargo_weight_kg: z.number().min(1).max(10000),
  notes: z.string().optional(),
});

export const UpdateRideStatusSchema = z.object({
  status: z.enum(['matched', 'accepted', 'picked_up', 'in_transit', 'completed', 'cancelled']),
});

// Auth schemas
export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['customer', 'driver', 'company']),
});

// Payment schemas
export const CreatePaymentSchema = z.object({
  ride_id: z.string().uuid(),
  payment_method: z.string(),
  amount: z.number().positive(),
});

// Offer schemas
export const CreateOfferSchema = z.object({
  ride_id: z.string().uuid(),
  price: z.number().positive(),
});

export type CreateRideInput = z.infer<typeof CreateRideSchema>;
export type UpdateRideStatusInput = z.infer<typeof UpdateRideStatusSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type SignupInput = z.infer<typeof SignupSchema>;
export type CreatePaymentInput = z.infer<typeof CreatePaymentSchema>;
export type CreateOfferInput = z.infer<typeof CreateOfferSchema>;

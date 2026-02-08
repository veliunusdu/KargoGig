// User types
export interface User {
  id: string;
  email: string;
  role: 'customer' | 'driver' | 'company' | 'admin';
  created_at: string;
}

// Ride types
export interface Ride {
  id: string;
  customer_id: string;
  driver_id: string | null;
  status: 'pending' | 'matched' | 'accepted' | 'picked_up' | 'in_transit' | 'completed' | 'cancelled';
  pickup_location: Location;
  dropoff_location: Location;
  estimated_price: number;
  final_price: number | null;
  created_at: string;
  updated_at: string;
}

export interface Location {
  lat: number;
  lng: number;
  address: string;
}

// Vehicle types
export interface Vehicle {
  id: string;
  type: 'sedan' | 'suv' | 'van' | 'truck';
  capacity_kg: number;
  plate_number: string;
  driver_id: string;
}

// Payment types
export interface Payment {
  id: string;
  ride_id: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  payment_method: string;
  created_at: string;
}

// Offer types
export interface Offer {
  id: string;
  ride_id: string;
  driver_id: string;
  price: number;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  created_at: string;
}

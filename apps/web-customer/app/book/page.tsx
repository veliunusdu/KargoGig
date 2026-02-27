"use client";

import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { createApiClient } from "@kargogig/api-client";
import type { CreateRideInput } from "@kargogig/contracts/schemas";

type VehicleType = 'sedan' | 'suv' | 'van' | 'truck';
type PaymentMethod = 'credit_card' | 'cash' | 'wallet';
type BookingStep = 'details' | 'confirm' | 'processing' | 'success';

interface VehicleOption {
  type: VehicleType;
  name: string;
  icon: string;
  baseRate: number;
  perKmRate: number;
  maxWeight: number;
  description: string;
}

const VEHICLE_OPTIONS: VehicleOption[] = [
  {
    type: 'sedan',
    name: 'Sedan',
    icon: '🚗',
    baseRate: 50,
    perKmRate: 8,
    maxWeight: 200,
    description: 'Small items, documents'
  },
  {
    type: 'suv',
    name: 'SUV',
    icon: '🚙',
    baseRate: 75,
    perKmRate: 12,
    maxWeight: 500,
    description: 'Medium cargo, luggage'
  },
  {
    type: 'van',
    name: 'Van',
    icon: '🚐',
    baseRate: 100,
    perKmRate: 15,
    maxWeight: 1000,
    description: 'Large items, furniture'
  },
  {
    type: 'truck',
    name: 'Truck',
    icon: '🚚',
    baseRate: 150,
    perKmRate: 20,
    maxWeight: 5000,
    description: 'Heavy cargo, pallets'
  },
];

const PAYMENT_METHODS = [
  { id: 'credit_card' as PaymentMethod, name: 'Credit Card', icon: '💳', description: 'Pay with credit/debit card' },
  { id: 'cash' as PaymentMethod, name: 'Cash', icon: '💵', description: 'Pay driver in cash' },
  { id: 'wallet' as PaymentMethod, name: 'Wallet', icon: '👛', description: 'Use KargoGig wallet balance' },
];

export default function BookingPage() {
  const supabase = createSupabaseBrowser();
  
  // Form state
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupLat, setPickupLat] = useState(41.0082); // Istanbul default
  const [pickupLng, setPickupLng] = useState(28.9784);
  
  const [dropoffAddress, setDropoffAddress] = useState("");
  const [dropoffLat, setDropoffLat] = useState(41.0082);
  const [dropoffLng, setDropoffLng] = useState(28.9784);
  
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>('sedan');
  const [cargoWeight, setCargoWeight] = useState(10);
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('credit_card');
  
  // UI state
  const [step, setStep] = useState<BookingStep>('details');
  const [estimatedDistance, setEstimatedDistance] = useState(5); // km
  const [error, setError] = useState<string | null>(null);
  const [createdRideId, setCreatedRideId] = useState<string | null>(null);

  const selectedVehicleOption = VEHICLE_OPTIONS.find(v => v.type === selectedVehicle)!;
  
  // Calculate estimated price
  const estimatedPrice = Math.round(
    selectedVehicleOption.baseRate + 
    (estimatedDistance * selectedVehicleOption.perKmRate) +
    (cargoWeight > selectedVehicleOption.maxWeight * 0.5 ? 30 : 0) // Extra charge for heavy loads
  );

  // Mock distance calculation (in real app, use Google Maps Distance Matrix API)
  const calculateDistance = () => {
    // Simple mock: random distance between 1-20 km
    const mockDistance = Math.round(Math.random() * 19) + 1;
    setEstimatedDistance(mockDistance);
  };

  const handleContinueToConfirm = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!pickupAddress || !dropoffAddress) {
      setError("Please enter both pickup and dropoff addresses");
      return;
    }

    if (cargoWeight > selectedVehicleOption.maxWeight) {
      setError(`Weight exceeds maximum for ${selectedVehicleOption.name} (${selectedVehicleOption.maxWeight}kg)`);
      return;
    }

    setError(null);
    setStep('confirm');
  };

  const handleConfirmBooking = async () => {
    setStep('processing');
    setError(null);

    try {
      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setError("You must be logged in to book a ride");
        setStep('confirm');
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const apiClient = createApiClient(apiUrl, session.access_token);

      const rideData: CreateRideInput = {
        pickup_location: {
          lat: pickupLat,
          lng: pickupLng,
          address: pickupAddress,
        },
        dropoff_location: {
          lat: dropoffLat,
          lng: dropoffLng,
          address: dropoffAddress,
        },
        vehicle_type: selectedVehicle,
        cargo_weight_kg: cargoWeight,
        notes: notes || undefined,
      };

      const ride = await apiClient.createRide(rideData);
      setCreatedRideId(ride.id);
      setStep('success');
      
      // Redirect to tracking page after 3 seconds
      setTimeout(() => {
        window.location.href = `/track/${ride.id}`;
      }, 3000);

    } catch (err: any) {
      setError(err.message || "Failed to create ride");
      setStep('confirm');
    }
  };

  // Processing view
  if (step === 'processing') {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: 20,
        backgroundColor: '#f9fafb'
      }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: 48, marginBottom: 16, animation: 'pulse 2s infinite' }}>⏳</div>
          <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Processing Your Booking</h2>
          <p style={{ color: '#666', marginBottom: 16 }}>Please wait while we create your ride...</p>
          <div style={{ 
            width: '100%', 
            height: 4, 
            backgroundColor: '#e5e7eb', 
            borderRadius: 2,
            overflow: 'hidden'
          }}>
            <div style={{
              width: '70%',
              height: '100%',
              backgroundColor: '#3b82f6',
              animation: 'progress 1.5s infinite'
            }} />
          </div>
        </div>
      </div>
    );
  }

  // Success view
  if (step === 'success') {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: 20,
        backgroundColor: '#f9fafb'
      }}>
        <div style={{ textAlign: 'center', maxWidth: 500 }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12, color: '#10b981' }}>
            Booking Confirmed!
          </h2>
          <p style={{ fontSize: 16, color: '#666', marginBottom: 24 }}>
            Your ride has been created successfully. We're finding the best drivers for you.
          </p>
          <div style={{
            backgroundColor: 'white',
            padding: 20,
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            marginBottom: 24,
            textAlign: 'left'
          }}>
            <div style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>Ride ID</div>
            <div style={{ fontSize: 16, fontWeight: 600, fontFamily: 'monospace', marginBottom: 16 }}>
              {createdRideId}
            </div>
            <div style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>Estimated Price</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#3b82f6' }}>₺{estimatedPrice}</div>
          </div>
          <a
            href={`/track/${createdRideId}`}
            style={{
              display: 'inline-block',
              padding: '14px 32px',
              backgroundColor: '#3b82f6',
              color: 'white',
              textDecoration: 'none',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              marginBottom: 16,
              boxShadow: '0 4px 6px rgba(59, 130, 246, 0.3)'
            }}
          >
            🗺️ Track Your Ride
          </a>
          <p style={{ fontSize: 13, color: '#999' }}>Or wait, redirecting automatically...</p>
        </div>
      </div>
    );
  }

  // Confirmation view
  if (step === 'confirm') {
    return (
      <div style={{ minHeight: '100vh', padding: 20, backgroundColor: '#f9fafb' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button 
              onClick={() => setStep('details')} 
              style={{ 
                fontSize: 24, 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer',
                padding: 0
              }}
            >
              ←
            </button>
            <h1 style={{ fontSize: 28, fontWeight: 700 }}>Confirm Booking</h1>
          </div>

          {/* Progress Indicator */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            marginBottom: 32,
            position: 'relative'
          }}>
            <div style={{ 
              position: 'absolute',
              top: 15,
              left: '25%',
              right: '25%',
              height: 2,
              backgroundColor: '#3b82f6'
            }} />
            
            <div style={{ textAlign: 'center', flex: 1, position: 'relative' }}>
              <div style={{ 
                width: 32, 
                height: 32, 
                borderRadius: '50%', 
                backgroundColor: '#10b981',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 600,
                marginBottom: 8
              }}>✓</div>
              <div style={{ fontSize: 13, color: '#10b981', fontWeight: 500 }}>Details</div>
            </div>
            
            <div style={{ textAlign: 'center', flex: 1, position: 'relative' }}>
              <div style={{ 
                width: 32, 
                height: 32, 
                borderRadius: '50%', 
                backgroundColor: '#3b82f6',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: 600,
                marginBottom: 8
              }}>2</div>
              <div style={{ fontSize: 13, color: '#3b82f6', fontWeight: 500 }}>Confirm</div>
            </div>
            
            <div style={{ textAlign: 'center', flex: 1, position: 'relative' }}>
              <div style={{ 
                width: 32, 
                height: 32, 
                borderRadius: '50%', 
                backgroundColor: '#e5e7eb',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#9ca3af',
                fontWeight: 600,
                marginBottom: 8
              }}>3</div>
              <div style={{ fontSize: 13, color: '#9ca3af' }}>Complete</div>
            </div>
          </div>

          {/* Booking Summary */}
          <div style={{
            backgroundColor: 'white',
            padding: 24,
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            marginBottom: 20
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>📋 Booking Summary</h3>
            
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>Route</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'start', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>📍</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Pickup</div>
                      <div style={{ fontSize: 14, color: '#666' }}>{pickupAddress}</div>
                    </div>
                  </div>
                  <div style={{ paddingLeft: 26, borderLeft: '2px dashed #d1d5db', height: 20 }} />
                  <div style={{ display: 'flex', alignItems: 'start', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>🎯</span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Dropoff</div>
                      <div style={{ fontSize: 14, color: '#666' }}>{dropoffAddress}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 16 }}>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>Vehicle</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 32 }}>{selectedVehicleOption.icon}</span>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>{selectedVehicleOption.name}</div>
                    <div style={{ fontSize: 13, color: '#666' }}>{selectedVehicleOption.description}</div>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 16 }}>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>Cargo</div>
                <div style={{ fontSize: 15 }}>
                  <strong>{cargoWeight} kg</strong>
                  {notes && (
                    <div style={{ marginTop: 8, fontSize: 14, color: '#666', fontStyle:  'italic' }}>
                      Note: {notes}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 16 }}>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 6 }}>Distance</div>
                <div style={{ fontSize: 15 }}><strong>{estimatedDistance} km</strong></div>
              </div>
            </div>
          </div>

          {/* Payment Method Selection */}
          <div style={{
            backgroundColor: 'white',
            padding: 24,
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            marginBottom: 20
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>💳 Payment Method</h3>
            
            <div style={{ display: 'grid', gap: 12 }}>
              {PAYMENT_METHODS.map((method) => (
                <div
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id)}
                  style={{
                    padding: 16,
                    border: `2px solid ${paymentMethod === method.id ? '#3b82f6' : '#e5e7eb'}`,
                    borderRadius: 8,
                    cursor: 'pointer',
                    backgroundColor: paymentMethod === method.id ? '#eff6ff' : 'white',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12
                  }}
                >
                  <span style={{ fontSize: 32 }}>{method.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 16 }}>{method.name}</div>
                    <div style={{ fontSize: 13, color: '#666' }}>{method.description}</div>
                  </div>
                  {paymentMethod === method.id && (
                    <div style={{ 
                      width: 24, 
                      height: 24, 
                      borderRadius: '50%', 
                      backgroundColor: '#3b82f6',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: 14
                    }}>
                      ✓
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Price Summary */}
          <div style={{
            backgroundColor: 'white',
            padding: 24,
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            marginBottom: 20
          }}>
            <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>💰 Price Breakdown</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span>Base fare ({selectedVehicleOption.name})</span>
                <span>₺{selectedVehicleOption.baseRate}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span>Distance ({estimatedDistance} km × ₺{selectedVehicleOption.perKmRate})</span>
                <span>₺{estimatedDistance * selectedVehicleOption.perKmRate}</span>
              </div>
              {cargoWeight > selectedVehicleOption.maxWeight * 0.5 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span>Heavy cargo surcharge</span>
                  <span>₺30</span>
                </div>
              )}
            </div>

            <div style={{ 
              borderTop: '2px solid #e5e7eb', 
              paddingTop: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: 20, fontWeight: 600 }}>Total Estimate</span>
              <span style={{ fontSize: 32, fontWeight: 700, color: '#3b82f6' }}>
                ₺{estimatedPrice}
              </span>
            </div>
          </div>

          {error && (
            <div style={{
              padding: 12,
              backgroundColor: '#fee2e2',
              border: '1px solid #fca5a5',
              borderRadius: 8,
              color: '#991b1b',
              fontSize: 14,
              marginBottom: 20
            }}>
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => setStep('details')}
              style={{
                flex: 1,
                padding: '14px 24px',
                backgroundColor: 'white',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              ← Back to Edit
            </button>
            <button
              onClick={handleConfirmBooking}
              style={{
                flex: 2,
                padding: '14px 24px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 4px 6px rgba(59, 130, 246, 0.3)'
              }}
            >
              Confirm & Book Ride
            </button>
          </div>

          <div style={{
            marginTop: 16,
            padding: 12,
            backgroundColor: '#fef3c7',
            borderRadius: 6,
            fontSize: 13,
            color: '#92400e',
            textAlign: 'center'
          }}>
            ℹ️ By confirming, you agree to the estimated price. Drivers may send different offers.
          </div>
        </div>
      </div>
    );
  }

  // Details form view
  return (
    <div style={{ minHeight: '100vh', padding: 20, backgroundColor: '#f9fafb' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/" style={{ fontSize: 24, textDecoration: 'none' }}>←</a>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>Book a Ride</h1>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          {/* Left: Form */}
          <form onSubmit={handleContinueToConfirm} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Location Section */}
            <div style={{ 
              backgroundColor: 'white', 
              padding: 20, 
              borderRadius: 12, 
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>📍 Locations</h3>
              
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
                  Pickup Address
                </label>
                <input
                  type="text"
                  value={pickupAddress}
                  onChange={(e) => setPickupAddress(e.target.value)}
                  onBlur={calculateDistance}
                  placeholder="Enter pickup address"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 14
                  }}
                  required
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
                  Dropoff Address
                </label>
                <input
                  type="text"
                  value={dropoffAddress}
                  onChange={(e) => setDropoffAddress(e.target.value)}
                  onBlur={calculateDistance}
                  placeholder="Enter dropoff address"
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 14
                  }}
                  required
                />
              </div>

              <div style={{ 
                marginTop: 12, 
                padding: 8, 
                backgroundColor: '#f3f4f6', 
                borderRadius: 6,
                fontSize: 13,
                color: '#666'
              }}>
                📏 Estimated distance: <strong>{estimatedDistance} km</strong>
              </div>
            </div>

            {/* Vehicle Selection */}
            <div style={{ 
              backgroundColor: 'white', 
              padding: 20, 
              borderRadius: 12, 
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>🚗 Select Vehicle</h3>
              
              <div style={{ display: 'grid', gap: 12 }}>
                {VEHICLE_OPTIONS.map((vehicle) => (
                  <div
                    key={vehicle.type}
                    onClick={() => setSelectedVehicle(vehicle.type)}
                    style={{
                      padding: 16,
                      border: `2px solid ${selectedVehicle === vehicle.type ? '#3b82f6' : '#e5e7eb'}`,
                      borderRadius: 8,
                      cursor: 'pointer',
                      backgroundColor: selectedVehicle === vehicle.type ? '#eff6ff' : 'white',
                      transition: 'all 0.2s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 32 }}>{vehicle.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 16 }}>{vehicle.name}</div>
                        <div style={{ fontSize: 13, color: '#666' }}>{vehicle.description}</div>
                        <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                          Max: {vehicle.maxWeight}kg
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, color: '#666' }}>from</div>
                        <div style={{ fontSize: 18, fontWeight: 600 }}>₺{vehicle.baseRate}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cargo Details */}
            <div style={{ 
              backgroundColor: 'white', 
              padding: 20, 
              borderRadius: 12, 
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>📦 Cargo Details</h3>
              
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
                  Weight (kg)
                </label>
                <input
                  type="number"
                  value={cargoWeight}
                  onChange={(e) => setCargoWeight(Number(e.target.value))}
                  min="1"
                  max={selectedVehicleOption.maxWeight}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 14
                  }}
                  required
                />
                <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                  Max for {selectedVehicleOption.name}: {selectedVehicleOption.maxWeight}kg
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 6 }}>
                  Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special instructions?"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #d1d5db',
                    borderRadius: 8,
                    fontSize: 14,
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                />
              </div>
            </div>

            {error && (
              <div style={{
                padding: 12,
                backgroundColor: '#fee2e2',
                border: '1px solid #fca5a5',
                borderRadius: 8,
                color: '#991b1b',
                fontSize: 14
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              style={{
                padding: '14px 24px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background-color 0.2s',
                boxShadow: '0 4px 6px rgba(59, 130, 246, 0.3)'
              }}
            >
              Continue to Confirm →
            </button>
          </form>

          {/* Right: Price Breakdown & Map Placeholder */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Price Breakdown */}
            <div style={{ 
              backgroundColor: 'white', 
              padding: 20, 
              borderRadius: 12, 
              border: '1px solid #e5e7eb',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              position: 'sticky',
              top: 20
            }}>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>💰 Price Estimate</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span>Base fare ({selectedVehicleOption.name})</span>
                  <span>₺{selectedVehicleOption.baseRate}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span>Distance ({estimatedDistance} km)</span>
                  <span>₺{estimatedDistance * selectedVehicleOption.perKmRate}</span>
                </div>
                {cargoWeight > selectedVehicleOption.maxWeight * 0.5 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                    <span>Heavy cargo surcharge</span>
                    <span>₺30</span>
                  </div>
                )}
              </div>

              <div style={{ 
                borderTop: '2px solid #e5e7eb', 
                paddingTop: 12,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontSize: 18, fontWeight: 600 }}>Total</span>
                <span style={{ fontSize: 24, fontWeight: 700, color: '#3b82f6' }}>
                  ₺{estimatedPrice}
                </span>
              </div>

              <div style={{
                marginTop: 16,
                padding: 12,
                backgroundColor: '#fef3c7',
                borderRadius: 6,
                fontSize: 13,
                color: '#92400e'
              }}>
                ℹ️ Final price may vary based on actual distance and driver offers
              </div>
            </div>

            {/* Map Placeholder */}
            <div style={{ 
              backgroundColor: '#e5e7eb', 
              padding: 40, 
              borderRadius: 12, 
              border: '1px solid #d1d5db',
              textAlign: 'center',
              minHeight: 300,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 12
            }}>
              <div style={{ fontSize: 48 }}>🗺️</div>
              <div style={{ fontSize: 16, fontWeight: 500, color: '#6b7280' }}>
                Map View
              </div>
              <div style={{ fontSize: 13, color: '#9ca3af' }}>
                Interactive map coming soon
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { createApiClient } from "@kargogig/api-client";
import type { Ride } from "@kargogig/contracts/models";

interface DriverLocation {
  lat: number;
  lng: number;
  heading: number;
}

interface ETAInfo {
  minutes: number;
  distance: number;
}

export default function TrackRidePage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseBrowser();
  const [ride, setRide] = useState<Ride | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [eta, setEta] = useState<ETAInfo>({ minutes: 15, distance: 5.2 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    async function fetchRide() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          window.location.href = "/login";
          return;
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const apiClient = createApiClient(apiUrl, session.access_token);
        
        const rideData = await apiClient.getRide(params.id);
        setRide(rideData);

        // Mock driver location near pickup for active rides
        if (rideData.status !== 'pending' && rideData.status !== 'cancelled' && rideData.status !== 'completed') {
          setDriverLocation({
            lat: rideData.pickup_location.lat + (Math.random() - 0.5) * 0.01,
            lng: rideData.pickup_location.lng + (Math.random() - 0.5) * 0.01,
            heading: Math.random() * 360
          });

          // Simulate real-time updates every 5 seconds
          intervalId = setInterval(() => {
            setDriverLocation(prev => prev ? {
              lat: prev.lat + (Math.random() - 0.5) * 0.001,
              lng: prev.lng + (Math.random() - 0.5) * 0.001,
              heading: (prev.heading + (Math.random() - 0.5) * 20) % 360
            } : null);

            setEta(prev => ({
              minutes: Math.max(1, prev.minutes - 0.5 + (Math.random() - 0.5)),
              distance: Math.max(0.1, prev.distance - 0.1 + (Math.random() - 0.5) * 0.2)
            }));

            setLastUpdate(new Date());
          }, 5000);
        }
      } catch (err: any) {
        setError(err.message || "Failed to load ride");
      } finally {
        setLoading(false);
      }
    }

    fetchRide();

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [supabase, params.id]);

  const handleCancel = async () => {
    if (!window.confirm("Are you sure you want to cancel this ride? You may be charged a cancellation fee.")) {
      return;
    }

    setCancelling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        window.location.href = "/login";
        return;
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
      const apiClient = createApiClient(apiUrl, session.access_token);
      
      await apiClient.cancelRide(params.id);
      window.location.href = `/rides/${params.id}`;
    } catch (err: any) {
      alert(err.message || "Failed to cancel ride");
    } finally {
      setCancelling(false);
    }
  };

  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending':
        return { 
          color: '#f59e0b', 
          icon: '🔍', 
          title: 'Finding Driver',
          message: 'We\'re looking for the best driver for your ride...'
        };
      case 'matched':
        return { 
          color: '#8b5cf6', 
          icon: '🤝', 
          title: 'Driver Matched',
          message: 'A driver has been assigned to your ride!'
        };
      case 'accepted':
        return { 
          color: '#3b82f6', 
          icon: '🚗', 
          title: 'Driver on the Way',
          message: 'Your driver is heading to the pickup location'
        };
      case 'picked_up':
        return { 
          color: '#10b981', 
          icon: '📦', 
          title: 'Cargo Picked Up',
          message: 'Driver has picked up your cargo and is heading to destination'
        };
      case 'in_transit':
        return { 
          color: '#10b981', 
          icon: '🚚', 
          title: 'In Transit',
          message: 'Your cargo is on the way to the destination'
        };
      case 'completed':
        return { 
          color: '#059669', 
          icon: '✅', 
          title: 'Delivered',
          message: 'Your ride has been completed successfully!'
        };
      case 'cancelled':
        return { 
          color: '#ef4444', 
          icon: '❌', 
          title: 'Cancelled',
          message: 'This ride has been cancelled'
        };
      default:
        return { 
          color: '#6b7280', 
          icon: '⏳', 
          title: 'Processing',
          message: 'Processing your ride...'
        };
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ textAlign: 'center', color: '#666' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          Loading tracking information...
        </div>
      </div>
    );
  }

  if (error || !ride) {
    return (
      <div style={{ minHeight: '100vh', padding: 20, backgroundColor: '#f9fafb' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', paddingTop: 80 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>Unable to Track Ride</h2>
          <p style={{ color: '#666', marginBottom: 24 }}>{error || "This ride doesn't exist."}</p>
          <a 
            href="/rides"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              backgroundColor: '#3b82f6',
              color: 'white',
              textDecoration: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600
            }}
          >
            Back to Rides
          </a>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(ride.status);
  const canCancel = ['pending', 'matched', 'accepted'].includes(ride.status);
  const showTracking = ['accepted', 'picked_up', 'in_transit'].includes(ride.status);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <div style={{ 
        backgroundColor: 'white', 
        borderBottom: '1px solid #e5e7eb',
        padding: '16px 20px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href={`/rides/${params.id}`} style={{ fontSize: 20, textDecoration: 'none' }}>←</a>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 2 }}>Track Ride</h1>
              <div style={{ fontSize: 12, color: '#666', fontFamily: 'monospace' }}>#{params.id.slice(0, 8)}</div>
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#999' }}>
            Updated {Math.floor((Date.now() - lastUpdate.getTime()) / 1000)}s ago
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* Left: Map & Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Status Banner */}
            <div style={{
              backgroundColor: statusInfo.color + '10',
              border: `2px solid ${statusInfo.color}40`,
              borderRadius: 12,
              padding: 20,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 48, marginBottom: 8 }}>{statusInfo.icon}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: statusInfo.color, marginBottom: 4 }}>
                {statusInfo.title}
              </div>
              <div style={{ fontSize: 14, color: '#666' }}>{statusInfo.message}</div>
            </div>

            {/* Map with Driver Location */}
            <div style={{ 
              backgroundColor: '#e5e7eb', 
              borderRadius: 12, 
              border: '1px solid #d1d5db',
              minHeight: 400,
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Mock Map Background */}
              <div style={{ 
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: 12
              }}>
                <div style={{ fontSize: 48 }}>🗺️</div>
                <div style={{ fontSize: 16, fontWeight: 500, color: '#6b7280' }}>Live Map</div>
              </div>

              {/* Mock Route Line */}
              {showTracking && (
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                  <line 
                    x1="20%" 
                    y1="70%" 
                    x2="80%" 
                    y2="30%" 
                    stroke="#3b82f6" 
                    strokeWidth="4" 
                    strokeDasharray="10,5"
                    opacity="0.6"
                  />
                </svg>
              )}

              {/* Pickup Marker */}
              <div style={{
                position: 'absolute',
                left: '20%',
                top: '70%',
                transform: 'translate(-50%, -100%)',
                textAlign: 'center'
              }}>
                <div style={{ 
                  fontSize: 32,
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
                }}>📍</div>
                <div style={{ 
                  backgroundColor: 'white',
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  whiteSpace: 'nowrap'
                }}>
                  Pickup
                </div>
              </div>

              {/* Dropoff Marker */}
              <div style={{
                position: 'absolute',
                left: '80%',
                top: '30%',
                transform: 'translate(-50%, -100%)',
                textAlign: 'center'
              }}>
                <div style={{ 
                  fontSize: 32,
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
                }}>🎯</div>
                <div style={{ 
                  backgroundColor: 'white',
                  padding: '4px 8px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  whiteSpace: 'nowrap'
                }}>
                  Destination
                </div>
              </div>

              {/* Driver Marker (animated) */}
              {showTracking && driverLocation && (
                <div style={{
                  position: 'absolute',
                  left: '45%',
                  top: '55%',
                  transform: 'translate(-50%, -50%)',
                  animation: 'pulse 2s infinite'
                }}>
                  <div style={{ 
                    fontSize: 36,
                    filter: 'drop-shadow(0 4px 6px rgba(59, 130, 246, 0.4))',
                    transform: `rotate(${driverLocation.heading}deg)`
                  }}>🚗</div>
                  <div style={{ 
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    backgroundColor: '#3b82f6',
                    opacity: 0.2,
                    animation: 'ping 2s infinite'
                  }} />
                </div>
              )}
            </div>

            {/* ETA Card */}
            {showTracking && (
              <div style={{
                backgroundColor: 'white',
                padding: 20,
                borderRadius: 12,
                border: '1px solid #e5e7eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ fontSize: 40 }}>⏱️</div>
                  <div>
                    <div style={{ fontSize: 14, color: '#666', marginBottom: 2 }}>Estimated Time</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#3b82f6' }}>
                      {Math.round(eta.minutes)} min
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, color: '#666', marginBottom: 2 }}>Distance</div>
                  <div style={{ fontSize: 18, fontWeight: 600 }}>
                    {eta.distance.toFixed(1)} km
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right: Details & Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Route Details */}
            <div style={{
              backgroundColor: 'white',
              padding: 20,
              borderRadius: 12,
              border: '1px solid #e5e7eb'
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>📍</span> Route Details
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ padding: 12, backgroundColor: '#f9fafb', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4, fontWeight: 500 }}>FROM</div>
                  <div style={{ fontSize: 14 }}>{ride.pickup_location.address}</div>
                </div>
                
                <div style={{ padding: 12, backgroundColor: '#f9fafb', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: '#666', marginBottom: 4, fontWeight: 500 }}>TO</div>
                  <div style={{ fontSize: 14 }}>{ride.dropoff_location.address}</div>
                </div>
              </div>
            </div>

            {/* Driver Info (if matched) */}
            {ride.driver_id && (
              <div style={{
                backgroundColor: 'white',
                padding: 20,
                borderRadius: 12,
                border: '1px solid #e5e7eb'
              }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>👤</span> Driver Information
                </h3>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ 
                    width: 48, 
                    height: 48, 
                    borderRadius: '50%', 
                    backgroundColor: '#e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 24
                  }}>
                    👨‍✈️
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600 }}>Driver</div>
                    <div style={{ fontSize: 12, color: '#666', fontFamily: 'monospace' }}>
                      ID: {ride.driver_id.slice(0, 8)}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={{
                    flex: 1,
                    padding: '10px 16px',
                    backgroundColor: '#3b82f6',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}>
                    <span>📞</span> Call
                  </button>
                  <button style={{
                    flex: 1,
                    padding: '10px 16px',
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: 6,
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6
                  }}>
                    <span>💬</span> Message
                  </button>
                </div>
              </div>
            )}

            {/* Ride Timeline */}
            <div style={{
              backgroundColor: 'white',
              padding: 20,
              borderRadius: 12,
              border: '1px solid #e5e7eb'
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span>📋</span> Ride Timeline
              </h3>
              
              <div style={{ position: 'relative', paddingLeft: 24 }}>
                {/* Timeline items */}
                {[
                  { status: 'pending', label: 'Ride Created', time: new Date(ride.created_at).toLocaleTimeString(), active: true },
                  { status: 'matched', label: 'Driver Matched', time: ride.driver_id ? 'Completed' : 'Pending', active: !!ride.driver_id },
                  { status: 'accepted', label: 'Driver Accepted', time: ['accepted', 'picked_up', 'in_transit', 'completed'].includes(ride.status) ? 'Completed' : 'Pending', active: ['accepted', 'picked_up', 'in_transit', 'completed'].includes(ride.status) },
                  { status: 'picked_up', label: 'Cargo Picked Up', time: ['picked_up', 'in_transit', 'completed'].includes(ride.status) ? 'Completed' : 'Pending', active: ['picked_up', 'in_transit', 'completed'].includes(ride.status) },
                  { status: 'in_transit', label: 'In Transit', time: ['in_transit', 'completed'].includes(ride.status) ? 'In Progress' : 'Pending', active: ['in_transit', 'completed'].includes(ride.status) },
                  { status: 'completed', label: 'Delivered', time: ride.status === 'completed' ? 'Completed' : 'Pending', active: ride.status === 'completed' }
                ].map((item, index, arr) => (
                  <div key={item.status} style={{ position: 'relative', paddingBottom: index < arr.length - 1 ? 20 : 0 }}>
                    {/* Vertical line */}
                    {index < arr.length - 1 && (
                      <div style={{
                        position: 'absolute',
                        left: -16,
                        top: 12,
                        width: 2,
                        height: 28,
                        backgroundColor: item.active ? '#3b82f6' : '#e5e7eb'
                      }} />
                    )}
                    
                    {/* Dot */}
                    <div style={{
                      position: 'absolute',
                      left: -20,
                      top: 4,
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      backgroundColor: item.active ? '#3b82f6' : '#e5e7eb',
                      border: `2px solid ${item.active ? '#3b82f6' : '#d1d5db'}`
                    }} />
                    
                    {/* Content */}
                    <div>
                      <div style={{ 
                        fontSize: 14, 
                        fontWeight: item.active ? 600 : 400,
                        color: item.active ? '#111827' : '#9ca3af'
                      }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>{item.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Price */}
            <div style={{
              backgroundColor: 'white',
              padding: 20,
              borderRadius: 12,
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>
                    {ride.final_price ? 'Final Price' : 'Estimated Price'}
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#3b82f6' }}>
                    ₺{ride.final_price || ride.estimated_price}
                  </div>
                </div>
                <div style={{ fontSize: 48 }}>💰</div>
              </div>
            </div>

            {/* Cancel Button */}
            {canCancel && (
              <button
                onClick={handleCancel}
                disabled={cancelling}
                style={{
                  width: '100%',
                  padding: '12px 24px',
                  backgroundColor: cancelling ? '#9ca3af' : 'white',
                  color: '#ef4444',
                  border: '2px solid #ef4444',
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: cancelling ? 'not-allowed' : 'pointer'
                }}
              >
                {cancelling ? 'Cancelling...' : '❌ Cancel Ride'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Inline animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        @keyframes ping {
          0% { transform: translate(-50%, -50%) scale(1); opacity: 0.4; }
          100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

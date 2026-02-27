"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { createApiClient } from "@kargogig/api-client";
import type { Ride } from "@kargogig/contracts/models";

export default function RideDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseBrowser();
  const [ride, setRide] = useState<Ride | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
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
      } catch (err: any) {
        setError(err.message || "Failed to load ride");
      } finally {
        setLoading(false);
      }
    }

    fetchRide();
  }, [supabase, params.id]);

  const handleCancel = async () => {
    if (!window.confirm("Are you sure you want to cancel this ride?")) {
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
      window.location.reload();
    } catch (err: any) {
      alert(err.message || "Failed to cancel ride");
    } finally {
      setCancelling(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#10b981';
      case 'cancelled': return '#ef4444';
      case 'in_transit': return '#3b82f6';
      case 'accepted': return '#8b5cf6';
      case 'pending': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#666' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
          Loading ride details...
        </div>
      </div>
    );
  }

  if (error || !ride) {
    return (
      <div style={{ minHeight: '100vh', padding: 20 }}>
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center', paddingTop: 80 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 12 }}>Ride Not Found</h2>
          <p style={{ color: '#666', marginBottom: 24 }}>{error || "This ride doesn't exist or you don't have access to it."}</p>
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

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: 20 }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/rides" style={{ fontSize: 24, textDecoration: 'none' }}>←</a>
          <h1 style={{ fontSize: 28, fontWeight: 700 }}>Ride Details</h1>
        </div>

        {/* Status Banner */}
        <div style={{
          padding: 16,
          backgroundColor: getStatusColor(ride.status) + '20',
          border: `1px solid ${getStatusColor(ride.status)}40`,
          borderRadius: 12,
          marginBottom: 20,
          textAlign: 'center'
        }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: getStatusColor(ride.status) }}>
            {getStatusLabel(ride.status)}
          </div>
        </div>

        {/* Route Information */}
        <div style={{
          backgroundColor: 'white',
          padding: 24,
          borderRadius: 12,
          border: '1px solid #e5e7eb',
          marginBottom: 20
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>📍 Route</h3>
          
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 14, color: '#666', marginBottom: 6 }}>Pickup Location</div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>{ride.pickup_location.address}</div>
            <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>
              {ride.pickup_location.lat.toFixed(6)}, {ride.pickup_location.lng.toFixed(6)}
            </div>
          </div>

          <div style={{ 
            height: 40, 
            borderLeft: '2px dashed #d1d5db',
            marginLeft: 8,
            marginBottom: 20
          }} />

          <div>
            <div style={{ fontSize: 14, color: '#666', marginBottom: 6 }}>Dropoff Location</div>
            <div style={{ fontSize: 16, fontWeight: 500 }}>{ride.dropoff_location.address}</div>
            <div style={{ fontSize: 13, color: '#999', marginTop: 4 }}>
              {ride.dropoff_location.lat.toFixed(6)}, {ride.dropoff_location.lng.toFixed(6)}
            </div>
          </div>
        </div>

        {/* Price Information */}
        <div style={{
          backgroundColor: 'white',
          padding: 24,
          borderRadius: 12,
          border: '1px solid #e5e7eb',
          marginBottom: 20
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>💰 Pricing</h3>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ color: '#666' }}>Estimated Price</span>
            <span style={{ fontWeight: 500 }}>₺{ride.estimated_price}</span>
          </div>
          
          {ride.final_price && (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              paddingTop: 12,
              borderTop: '1px solid #f3f4f6'
            }}>
              <span style={{ fontSize: 16, fontWeight: 600 }}>Final Price</span>
              <span style={{ fontSize: 20, fontWeight: 700, color: '#3b82f6' }}>₺{ride.final_price}</span>
            </div>
          )}
        </div>

        {/* Ride Information */}
        <div style={{
          backgroundColor: 'white',
          padding: 24,
          borderRadius: 12,
          border: '1px solid #e5e7eb',
          marginBottom: 20
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>ℹ️ Information</h3>
          
          <div style={{ display: 'grid', gap: 12 }}>
            <div>
              <div style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>Ride ID</div>
              <div style={{ fontSize: 14, fontFamily: 'monospace' }}>{ride.id}</div>
            </div>
            
            {ride.driver_id && (
              <div>
                <div style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>Driver ID</div>
                <div style={{ fontSize: 14, fontFamily: 'monospace' }}>{ride.driver_id}</div>
              </div>
            )}
            
            <div>
              <div style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>Created</div>
              <div style={{ fontSize: 14 }}>{new Date(ride.created_at).toLocaleString()}</div>
            </div>
            
            <div>
              <div style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>Last Updated</div>
              <div style={{ fontSize: 14 }}>{new Date(ride.updated_at).toLocaleString()}</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        {['accepted', 'picked_up', 'in_transit'].includes(ride.status) && (
          <a
            href={`/track/${params.id}`}
            style={{
              display: 'block',
              textAlign: 'center',
              width: '100%',
              padding: '14px 24px',
              backgroundColor: '#3b82f6',
              color: 'white',
              textDecoration: 'none',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              marginBottom: 12,
              boxShadow: '0 4px 6px rgba(59, 130, 246, 0.3)'
            }}
          >
            🗺️ Track Live
          </a>
        )}

        {ride.status === 'pending' && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            style={{
              width: '100%',
              padding: '14px 24px',
              backgroundColor: cancelling ? '#9ca3af' : '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600,
              cursor: cancelling ? 'not-allowed' : 'pointer'
            }}
          >
            {cancelling ? 'Cancelling...' : 'Cancel Ride'}
          </button>
        )}

        {ride.status === 'cancelled' && (
          <a
            href="/book"
            style={{
              display: 'block',
              textAlign: 'center',
              width: '100%',
              padding: '14px 24px',
              backgroundColor: '#3b82f6',
              color: 'white',
              textDecoration: 'none',
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 600
            }}
          >
            Book Another Ride
          </a>
        )}
      </div>
    </div>
  );
}

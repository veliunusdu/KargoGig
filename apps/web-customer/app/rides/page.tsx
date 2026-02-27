"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";
import { createApiClient } from "@kargogig/api-client";
import type { Ride } from "@kargogig/contracts/models";

export default function RidesPage() {
  const supabase = createSupabaseBrowser();
  const [rides, setRides] = useState<Ride[]>([]);
  const [filteredRides, setFilteredRides] = useState<Ride[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    async function fetchRides() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          window.location.href = "/login";
          return;
        }

        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
        const apiClient = createApiClient(apiUrl, session.access_token);
        
        const myRides = await apiClient.getMyRides();
        setRides(myRides);
        setFilteredRides(myRides);
      } catch (err: any) {
        setError(err.message || "Failed to load rides");
      } finally {
        setLoading(false);
      }
    }

    fetchRides();
  }, [supabase]);

  useEffect(() => {
    if (statusFilter === 'all') {
      setFilteredRides(rides);
    } else {
      setFilteredRides(rides.filter(ride => ride.status === statusFilter));
    }
  }, [statusFilter, rides]);

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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f9fafb' }}>
        <div style={{ textAlign: 'center', color: '#666' }}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', padding: 20 }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/" style={{ fontSize: 24, textDecoration: 'none' }}>←</a>
            <h1 style={{ fontSize: 28, fontWeight: 700 }}>Ride History</h1>
          </div>
          <a 
            href="/book" 
            style={{
              padding: '10px 20px',
              backgroundColor: '#3b82f6',
              color: 'white',
              textDecoration: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600
            }}
          >
            + New Ride
          </a>
        </div>

        {/* Filter Tabs */}
        {!error && rides.length > 0 && (
          <div style={{ 
            marginBottom: 24, 
            display: 'flex', 
            gap: 8,
            overflowX: 'auto',
            paddingBottom: 8
          }}>
            {[
              { value: 'all', label: 'All', count: rides.length },
              { value: 'pending', label: 'Pending', count: rides.filter(r => r.status === 'pending').length },
              { value: 'accepted', label: 'Active', count: rides.filter(r => ['accepted', 'picked_up', 'in_transit'].includes(r.status)).length },
              { value: 'completed', label: 'Completed', count: rides.filter(r => r.status === 'completed').length },
              { value: 'cancelled', label: 'Cancelled', count: rides.filter(r => r.status === 'cancelled').length }
            ].map(filter => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: statusFilter === filter.value ? '#3b82f6' : 'white',
                  color: statusFilter === filter.value ? 'white' : '#374151',
                  border: `1px solid ${statusFilter === filter.value ? '#3b82f6' : '#e5e7eb'}`,
                  borderRadius: 20,
                  fontSize: 14,
                  fontWeight: 500,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s'
                }}
              >
                {filter.label} ({filter.count})
              </button>
            ))}
          </div>
        )}

        {error && (
          <div style={{
            padding: 16,
            backgroundColor: '#fee2e2',
            borderRadius: 8,
            color: '#991b1b'
          }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

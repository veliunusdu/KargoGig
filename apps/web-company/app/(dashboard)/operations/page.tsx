"use client";

import { useEffect, useState, useCallback } from "react";

interface DriverPin {
  id: string;
  name: string;
  lat: number;
  lng: number;
  status: "available" | "busy" | "offline";
  currentRide: string | null;
  vehicle: string;
  heading: number;
}

interface RideOp {
  id: string;
  pickup: { lat: number; lng: number; address: string };
  dropoff: { lat: number; lng: number; address: string };
  status: "pending" | "in_transit" | "waiting_pickup";
  driverId: string | null;
  driverName: string | null;
  customerName: string;
  amount: number;
  createdAt: string;
}

const MOCK_DRIVERS: DriverPin[] = [
  { id: "d1", name: "Ali K.", lat: 41.0082, lng: 28.9784, status: "busy", currentRide: "R-1040", vehicle: "Ford Transit", heading: 45 },
  { id: "d2", name: "Mehmet D.", lat: 41.0150, lng: 29.0050, status: "busy", currentRide: "R-1041", vehicle: "Mercedes Sprinter", heading: 120 },
  { id: "d3", name: "Ayşe T.", lat: 41.0280, lng: 29.0215, status: "available", currentRide: null, vehicle: "VW Caddy", heading: 0 },
  { id: "d4", name: "Hasan Y.", lat: 40.9930, lng: 29.0350, status: "available", currentRide: null, vehicle: "Fiat Doblo", heading: 270 },
  { id: "d5", name: "Caner S.", lat: 41.0400, lng: 29.0000, status: "offline", currentRide: null, vehicle: "Ford Transit", heading: 90 },
];

const MOCK_RIDES: RideOp[] = [
  { id: "R-1042", pickup: { lat: 41.012, lng: 28.990, address: "Kadıköy Meydan" }, dropoff: { lat: 41.040, lng: 29.010, address: "Beşiktaş İskele" }, status: "pending", driverId: null, driverName: null, customerName: "Zehra B.", amount: 235, createdAt: "2 min ago" },
  { id: "R-1041", pickup: { lat: 41.010, lng: 28.975, address: "Moda Caddesi" }, dropoff: { lat: 41.035, lng: 29.019, address: "Ortaköy" }, status: "in_transit", driverId: "d2", driverName: "Mehmet D.", customerName: "Can E.", amount: 180, createdAt: "18 min ago" },
  { id: "R-1040", pickup: { lat: 41.002, lng: 28.960, address: "Bağdat Caddesi" }, dropoff: { lat: 41.030, lng: 28.990, address: "Ümraniye" }, status: "in_transit", driverId: "d1", driverName: "Ali K.", customerName: "Deniz M.", amount: 310, createdAt: "25 min ago" },
  { id: "R-1039", pickup: { lat: 41.020, lng: 29.030, address: "Üsküdar Meydanı" }, dropoff: { lat: 41.045, lng: 29.050, address: "Beykoz" }, status: "waiting_pickup", driverId: "d3", driverName: "Ayşe T.", customerName: "Emre K.", amount: 195, createdAt: "5 min ago" },
];

const STATUS_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  pending: { bg: "#fef3c7", fg: "#d97706", label: "Pending" },
  in_transit: { bg: "#dbeafe", fg: "#2563eb", label: "In Transit" },
  waiting_pickup: { bg: "#f3e8ff", fg: "#7c3aed", label: "Waiting Pickup" },
};

const DRIVER_STATUS_COLORS: Record<string, string> = {
  available: "#10b981",
  busy: "#f59e0b",
  offline: "#94a3b8",
};

export default function OperationsPage() {
  const [drivers, setDrivers] = useState(MOCK_DRIVERS);
  const [rides] = useState(MOCK_RIDES);
  const [selectedRide, setSelectedRide] = useState<RideOp | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<DriverPin | null>(null);
  const [dispatchMode, setDispatchMode] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "in_transit" | "waiting_pickup">("all");
  const [toast, setToast] = useState<string | null>(null);

  // Simulate driver movement
  useEffect(() => {
    const interval = setInterval(() => {
      setDrivers((prev) =>
        prev.map((d) => ({
          ...d,
          lat: d.lat + (Math.random() - 0.5) * 0.002,
          lng: d.lng + (Math.random() - 0.5) * 0.002,
          heading: (d.heading + (Math.random() - 0.5) * 30 + 360) % 360,
        }))
      );
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleDispatch = useCallback((rideId: string, driverId: string) => {
    const driver = drivers.find((d) => d.id === driverId);
    setToast(`Dispatched ${driver?.name} to ride ${rideId}`);
    setDispatchMode(false);
    setSelectedRide(null);
    setTimeout(() => setToast(null), 3000);
  }, [drivers]);

  const filteredRides = rides.filter((r) => filter === "all" || r.status === filter);
  const availableDrivers = drivers.filter((d) => d.status === "available");

  return (
    <div>
      {/* Toast */}
      {toast && (
        <div style={{
          position: "fixed", top: 24, right: 24, zIndex: 100,
          backgroundColor: "#10b981", color: "white",
          padding: "12px 20px", borderRadius: 8,
          fontSize: 13, fontWeight: 500,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}>{toast}</div>
      )}

      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: 0 }}>Live Operations</h1>
        <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>Monitor drivers and manage dispatching in real-time.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20, minHeight: "calc(100vh - 200px)" }}>
        {/* Map Area */}
        <div style={{
          backgroundColor: "white",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          overflow: "hidden",
          position: "relative",
        }}>
          {/* Map placeholder with driver pins */}
          <div style={{
            background: "linear-gradient(135deg, #e0f2fe 0%, #f0fdf4 50%, #fef3c7 100%)",
            height: "100%",
            minHeight: 500,
            position: "relative",
          }}>
            {/* Map label */}
            <div style={{
              position: "absolute", top: 12, left: 12, zIndex: 10,
              backgroundColor: "white",
              padding: "6px 12px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 500,
              color: "#64748b",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}>
              📍 Istanbul — {drivers.filter(d => d.status !== "offline").length} active drivers
            </div>

            {/* Driver Pins */}
            {drivers.map((d) => {
              const left = ((d.lng - 28.92) / 0.2) * 100;
              const top = ((41.06 - d.lat) / 0.1) * 100;
              return (
                <button
                  key={d.id}
                  onClick={() => { setSelectedDriver(d); setSelectedRide(null); }}
                  title={`${d.name} — ${d.status}`}
                  style={{
                    position: "absolute",
                    left: `${Math.max(2, Math.min(95, left))}%`,
                    top: `${Math.max(2, Math.min(95, top))}%`,
                    width: 32, height: 32,
                    borderRadius: "50%",
                    border: `3px solid ${DRIVER_STATUS_COLORS[d.status]}`,
                    backgroundColor: "white",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 14,
                    boxShadow: selectedDriver?.id === d.id
                      ? `0 0 0 4px ${DRIVER_STATUS_COLORS[d.status]}40, 0 2px 8px rgba(0,0,0,0.2)`
                      : "0 2px 6px rgba(0,0,0,0.15)",
                    zIndex: selectedDriver?.id === d.id ? 20 : 10,
                    transition: "all 0.3s",
                    transform: `rotate(${d.heading}deg)`,
                  }}
                >
                  🚛
                </button>
              );
            })}

            {/* Ride markers */}
            {rides.filter(r => r.status === "pending").map((r) => {
              const left = ((r.pickup.lng - 28.92) / 0.2) * 100;
              const top = ((41.06 - r.pickup.lat) / 0.1) * 100;
              return (
                <div
                  key={r.id}
                  onClick={() => { setSelectedRide(r); setSelectedDriver(null); }}
                  style={{
                    position: "absolute",
                    left: `${Math.max(2, Math.min(95, left))}%`,
                    top: `${Math.max(2, Math.min(95, top))}%`,
                    width: 24, height: 24,
                    borderRadius: "50%",
                    backgroundColor: "#ef4444",
                    border: "2px solid white",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    color: "white",
                    fontWeight: 700,
                    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                    animation: "pulse 2s infinite",
                    zIndex: 15,
                  }}
                >
                  !
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{
            position: "absolute", bottom: 12, left: 12,
            backgroundColor: "white",
            padding: "8px 12px",
            borderRadius: 8,
            fontSize: 11,
            display: "flex",
            gap: 16,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}>
            {[
              { color: "#10b981", label: "Available" },
              { color: "#f59e0b", label: "Busy" },
              { color: "#94a3b8", label: "Offline" },
              { color: "#ef4444", label: "Pending Ride" },
            ].map((l) => (
              <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: l.color }} />
                <span style={{ color: "#64748b" }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Selected detail card */}
          {(selectedDriver || selectedRide) && (
            <div style={{
              backgroundColor: "white",
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              padding: 16,
            }}>
              {selectedDriver && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{selectedDriver.name}</h3>
                    <span style={{ fontSize: 11, fontWeight: 600, color: DRIVER_STATUS_COLORS[selectedDriver.status] }}>
                      {selectedDriver.status.toUpperCase()}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#64748b", display: "grid", gap: 6 }}>
                    <div>🚛 {selectedDriver.vehicle}</div>
                    {selectedDriver.currentRide && <div>📦 Ride: {selectedDriver.currentRide}</div>}
                    <div>📍 {selectedDriver.lat.toFixed(4)}, {selectedDriver.lng.toFixed(4)}</div>
                  </div>
                </>
              )}
              {selectedRide && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{selectedRide.id}</h3>
                    <span style={{
                      padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                      backgroundColor: STATUS_BADGE[selectedRide.status].bg,
                      color: STATUS_BADGE[selectedRide.status].fg,
                    }}>{STATUS_BADGE[selectedRide.status].label}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#64748b", display: "grid", gap: 6 }}>
                    <div>📍 From: {selectedRide.pickup.address}</div>
                    <div>🎯 To: {selectedRide.dropoff.address}</div>
                    <div>👤 Customer: {selectedRide.customerName}</div>
                    <div>💰 ₺{selectedRide.amount}</div>
                    {selectedRide.driverName && <div>🚛 Driver: {selectedRide.driverName}</div>}
                  </div>

                  {selectedRide.status === "pending" && !dispatchMode && (
                    <button
                      onClick={() => setDispatchMode(true)}
                      style={{
                        marginTop: 12, width: "100%",
                        padding: "8px 0", backgroundColor: "#3b82f6",
                        color: "white", border: "none", borderRadius: 8,
                        fontSize: 13, fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      Dispatch Driver
                    </button>
                  )}

                  {dispatchMode && (
                    <div style={{ marginTop: 12 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>
                        Select available driver:
                      </div>
                      {availableDrivers.length === 0 && (
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>No available drivers</div>
                      )}
                      {availableDrivers.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => handleDispatch(selectedRide.id, d.id)}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            width: "100%", padding: "8px 12px",
                            border: "1px solid #e2e8f0", borderRadius: 6,
                            backgroundColor: "white", cursor: "pointer",
                            marginBottom: 4, fontSize: 13,
                          }}
                        >
                          <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#10b981" }} />
                          {d.name} — {d.vehicle}
                        </button>
                      ))}
                      <button
                        onClick={() => setDispatchMode(false)}
                        style={{
                          marginTop: 4, width: "100%", padding: "6px 0",
                          border: "none", backgroundColor: "transparent",
                          color: "#94a3b8", fontSize: 12, cursor: "pointer",
                        }}
                      >Cancel</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Ride Queue */}
          <div style={{
            backgroundColor: "white",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}>
            <div style={{ padding: "12px 16px", borderBottom: "1px solid #f1f5f9" }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 8px" }}>Active Rides</h3>
              <div style={{ display: "flex", gap: 6 }}>
                {(["all", "pending", "in_transit", "waiting_pickup"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 6,
                      border: "none",
                      fontSize: 11,
                      fontWeight: 500,
                      cursor: "pointer",
                      backgroundColor: filter === f ? "#3b82f6" : "#f1f5f9",
                      color: filter === f ? "white" : "#64748b",
                    }}
                  >{f === "all" ? "All" : f.replace("_", " ")}</button>
                ))}
              </div>
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: 8 }}>
              {filteredRides.map((r) => {
                const badge = STATUS_BADGE[r.status];
                return (
                  <div
                    key={r.id}
                    onClick={() => { setSelectedRide(r); setSelectedDriver(null); }}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      cursor: "pointer",
                      marginBottom: 4,
                      backgroundColor: selectedRide?.id === r.id ? "#eff6ff" : "transparent",
                      border: selectedRide?.id === r.id ? "1px solid #bfdbfe" : "1px solid transparent",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#1e40af" }}>{r.id}</span>
                      <span style={{
                        padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 600,
                        backgroundColor: badge.bg, color: badge.fg,
                      }}>{badge.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {r.pickup.address} → {r.dropoff.address}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                      {r.customerName} • ₺{r.amount} • {r.createdAt}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

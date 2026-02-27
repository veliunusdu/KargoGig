"use client";

import { useState } from "react";

interface Ride {
  id: string;
  customer: string;
  driver: string | null;
  pickup: string;
  dropoff: string;
  status: "pending" | "accepted" | "in_transit" | "delivered" | "cancelled";
  amount: number;
  distance: string;
  createdAt: string;
  deliveredAt: string | null;
  vehicle: string;
  weight: string;
  notes: string;
}

const MOCK_RIDES: Ride[] = [
  { id: "R-1042", customer: "Zehra B.", driver: null, pickup: "Kadıköy Meydan, İstanbul", dropoff: "Beşiktaş İskele, İstanbul", status: "pending", amount: 235, distance: "12.4 km", createdAt: "2025-01-28 14:32", deliveredAt: null, vehicle: "—", weight: "85 kg", notes: "Fragile items" },
  { id: "R-1041", customer: "Can E.", driver: "Mehmet Demir", pickup: "Moda Caddesi, İstanbul", dropoff: "Ortaköy, İstanbul", status: "in_transit", amount: 180, distance: "8.2 km", createdAt: "2025-01-28 14:10", deliveredAt: null, vehicle: "Mercedes Sprinter", weight: "120 kg", notes: "" },
  { id: "R-1040", customer: "Deniz M.", driver: "Ali Kaya", pickup: "Bağdat Caddesi, İstanbul", dropoff: "Ümraniye, İstanbul", status: "in_transit", amount: 310, distance: "15.7 km", createdAt: "2025-01-28 13:45", deliveredAt: null, vehicle: "Ford Transit", weight: "450 kg", notes: "2nd floor delivery" },
  { id: "R-1039", customer: "Emre K.", driver: "Ayşe Toprak", pickup: "Üsküdar Meydanı, İstanbul", dropoff: "Beykoz, İstanbul", status: "accepted", amount: 195, distance: "11.3 km", createdAt: "2025-01-28 13:20", deliveredAt: null, vehicle: "VW Caddy", weight: "30 kg", notes: "" },
  { id: "R-1038", customer: "Selin T.", driver: "Ali Kaya", pickup: "Bakırköy, İstanbul", dropoff: "Fatih, İstanbul", status: "delivered", amount: 270, distance: "9.8 km", createdAt: "2025-01-28 12:55", deliveredAt: "2025-01-28 13:40", vehicle: "Ford Transit", weight: "200 kg", notes: "" },
  { id: "R-1037", customer: "Burak A.", driver: "Caner Şahin", pickup: "Maltepe, İstanbul", dropoff: "Kartal, İstanbul", status: "delivered", amount: 145, distance: "5.1 km", createdAt: "2025-01-28 11:30", deliveredAt: "2025-01-28 12:05", vehicle: "Ford Transit", weight: "75 kg", notes: "" },
  { id: "R-1036", customer: "Naz D.", driver: "Mehmet Demir", pickup: "Taksim, İstanbul", dropoff: "Levent, İstanbul", status: "delivered", amount: 220, distance: "7.3 km", createdAt: "2025-01-28 10:15", deliveredAt: "2025-01-28 11:00", vehicle: "Mercedes Sprinter", weight: "350 kg", notes: "Office equipment" },
  { id: "R-1035", customer: "Oğuz Y.", driver: null, pickup: "Şişli, İstanbul", dropoff: "Beyoğlu, İstanbul", status: "cancelled", amount: 90, distance: "2.1 km", createdAt: "2025-01-28 09:45", deliveredAt: null, vehicle: "—", weight: "15 kg", notes: "Customer cancelled" },
  { id: "R-1034", customer: "Gizem K.", driver: "Ayşe Toprak", pickup: "Sarıyer, İstanbul", dropoff: "Maslak, İstanbul", status: "delivered", amount: 165, distance: "6.0 km", createdAt: "2025-01-27 16:30", deliveredAt: "2025-01-27 17:10", vehicle: "VW Caddy", weight: "40 kg", notes: "" },
  { id: "R-1033", customer: "Tolga B.", driver: "Caner Şahin", pickup: "Ataşehir, İstanbul", dropoff: "Pendik, İstanbul", status: "delivered", amount: 290, distance: "14.2 km", createdAt: "2025-01-27 15:00", deliveredAt: "2025-01-27 16:15", vehicle: "Ford Transit", weight: "500 kg", notes: "Heavy load" },
];

const STATUS_CONFIG: Record<string, { bg: string; fg: string; label: string }> = {
  pending: { bg: "#fef3c7", fg: "#d97706", label: "Pending" },
  accepted: { bg: "#e0f2fe", fg: "#0284c7", label: "Accepted" },
  in_transit: { bg: "#dbeafe", fg: "#2563eb", label: "In Transit" },
  delivered: { bg: "#dcfce7", fg: "#16a34a", label: "Delivered" },
  cancelled: { bg: "#fee2e2", fg: "#dc2626", label: "Cancelled" },
};

type StatusFilter = "all" | "pending" | "accepted" | "in_transit" | "delivered" | "cancelled";

export default function RidesPage() {
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedRide, setSelectedRide] = useState<Ride | null>(null);
  const [dateRange, setDateRange] = useState<"today" | "week" | "month" | "all">("today");

  const filtered = MOCK_RIDES.filter((r) => {
    const matchStatus = filter === "all" || r.status === filter;
    const matchSearch =
      r.id.toLowerCase().includes(search.toLowerCase()) ||
      r.customer.toLowerCase().includes(search.toLowerCase()) ||
      (r.driver || "").toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const statusCounts = MOCK_RIDES.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: 0 }}>Ride Monitoring</h1>
        <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>Track and manage all rides across your fleet.</p>
      </div>

      {/* Status summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 20 }}>
        {(["pending", "accepted", "in_transit", "delivered", "cancelled"] as const).map((s) => {
          const cfg = STATUS_CONFIG[s];
          return (
            <button
              key={s}
              onClick={() => setFilter(filter === s ? "all" : s)}
              style={{
                backgroundColor: filter === s ? cfg.fg : "white",
                color: filter === s ? "white" : cfg.fg,
                border: `1px solid ${filter === s ? cfg.fg : "#e2e8f0"}`,
                borderRadius: 10,
                padding: "12px 16px",
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 700 }}>{statusCounts[s] || 0}</div>
              <div style={{ fontSize: 12, fontWeight: 500, marginTop: 2 }}>{cfg.label}</div>
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selectedRide ? "1fr 380px" : "1fr", gap: 20 }}>
        {/* Main table */}
        <div style={{
          backgroundColor: "white",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
        }}>
          {/* Toolbar */}
          <div style={{
            padding: "12px 16px",
            borderBottom: "1px solid #f1f5f9",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 8,
          }}>
            <input
              placeholder="Search by ID, customer, driver..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                padding: "6px 12px", border: "1px solid #e2e8f0",
                borderRadius: 6, fontSize: 13, width: 260,
              }}
            />
            <div style={{ display: "flex", gap: 4 }}>
              {(["today", "week", "month", "all"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDateRange(d)}
                  style={{
                    padding: "4px 12px", borderRadius: 6,
                    border: "none", fontSize: 12, fontWeight: 500,
                    cursor: "pointer",
                    backgroundColor: dateRange === d ? "#1e293b" : "#f1f5f9",
                    color: dateRange === d ? "white" : "#64748b",
                  }}
                >{d === "all" ? "All Time" : d.charAt(0).toUpperCase() + d.slice(1)}</button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                  {["ID", "Customer", "Route", "Driver", "Status", "Amount", "Date"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 14px", color: "#64748b", fontWeight: 500, fontSize: 12, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const cfg = STATUS_CONFIG[r.status];
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedRide(r)}
                      style={{
                        borderBottom: "1px solid #f8fafc",
                        cursor: "pointer",
                        backgroundColor: selectedRide?.id === r.id ? "#eff6ff" : "transparent",
                      }}
                    >
                      <td style={{ padding: "10px 14px", fontWeight: 600, color: "#1e40af" }}>{r.id}</td>
                      <td style={{ padding: "10px 14px" }}>{r.customer}</td>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ maxWidth: 180 }}>
                          <div style={{ fontSize: 12, color: "#64748b" }}>{r.pickup}</div>
                          <div style={{ fontSize: 12, color: "#0f172a" }}>→ {r.dropoff}</div>
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px", color: r.driver ? "#0f172a" : "#94a3b8" }}>
                        {r.driver || "Unassigned"}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{
                          padding: "3px 10px", borderRadius: 99,
                          fontSize: 11, fontWeight: 600,
                          backgroundColor: cfg.bg, color: cfg.fg,
                        }}>{cfg.label}</span>
                      </td>
                      <td style={{ padding: "10px 14px", fontWeight: 500 }}>₺{r.amount}</td>
                      <td style={{ padding: "10px 14px", color: "#94a3b8", fontSize: 12 }}>
                        {r.createdAt.split(" ")[1]}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
                      No rides found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detail panel */}
        {selectedRide && (
          <div style={{
            backgroundColor: "white",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            padding: 20,
            position: "sticky",
            top: 80,
            alignSelf: "start",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: "#1e40af" }}>
                {selectedRide.id}
              </h3>
              <button
                onClick={() => setSelectedRide(null)}
                style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#94a3b8" }}
              >✕</button>
            </div>

            <div style={{
              padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600,
              backgroundColor: STATUS_CONFIG[selectedRide.status].bg,
              color: STATUS_CONFIG[selectedRide.status].fg,
              display: "inline-block",
              marginBottom: 16,
            }}>
              {STATUS_CONFIG[selectedRide.status].label}
            </div>

            {/* Detail sections */}
            <div style={{ display: "grid", gap: 16 }}>
              <DetailSection title="Route">
                <DetailRow label="Pickup" value={selectedRide.pickup} />
                <DetailRow label="Dropoff" value={selectedRide.dropoff} />
                <DetailRow label="Distance" value={selectedRide.distance} />
              </DetailSection>

              <DetailSection title="People">
                <DetailRow label="Customer" value={selectedRide.customer} />
                <DetailRow label="Driver" value={selectedRide.driver || "Unassigned"} />
              </DetailSection>

              <DetailSection title="Cargo">
                <DetailRow label="Weight" value={selectedRide.weight} />
                <DetailRow label="Vehicle" value={selectedRide.vehicle} />
                {selectedRide.notes && <DetailRow label="Notes" value={selectedRide.notes} />}
              </DetailSection>

              <DetailSection title="Payment & Time">
                <DetailRow label="Amount" value={`₺${selectedRide.amount}`} />
                <DetailRow label="Created" value={selectedRide.createdAt} />
                {selectedRide.deliveredAt && <DetailRow label="Delivered" value={selectedRide.deliveredAt} />}
              </DetailSection>
            </div>

            {selectedRide.status === "in_transit" && (
              <a
                href={`/operations`}
                style={{
                  display: "block",
                  textAlign: "center",
                  marginTop: 16,
                  padding: "8px 0",
                  backgroundColor: "#3b82f6",
                  color: "white",
                  borderRadius: 8,
                  textDecoration: "none",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >Track on Map →</a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", marginBottom: 6 }}>{title}</div>
      <div style={{ display: "grid", gap: 4 }}>{children}</div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ color: "#0f172a", fontWeight: 500, maxWidth: 200, textAlign: "right" }}>{value}</span>
    </div>
  );
}

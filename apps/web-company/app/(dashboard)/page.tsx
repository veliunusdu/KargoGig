"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@kargogig/ui-auth/client";

const METRICS = [
  { key: "totalRides", label: "Total Rides", icon: "📦", color: "#3b82f6", value: 1284, change: "+12%" },
  { key: "activeDrivers", label: "Active Drivers", icon: "🚗", color: "#10b981", value: 23, change: "+3" },
  { key: "revenue", label: "Revenue (₺)", icon: "💰", color: "#f59e0b", value: 87650, change: "+8.5%" },
  { key: "fleetSize", label: "Fleet Size", icon: "🚛", color: "#8b5cf6", value: 38, change: "+2" },
];

const RECENT_RIDES = [
  { id: "R-1041", from: "Istanbul / Kadıköy", to: "Istanbul / Beşiktaş", driver: "Ali K.", status: "delivered", amount: 245, time: "14:32" },
  { id: "R-1040", from: "Ankara / Çankaya", to: "Ankara / Keçiören", driver: "Mehmet D.", status: "in_transit", amount: 180, time: "14:10" },
  { id: "R-1039", from: "Istanbul / Maltepe", to: "Istanbul / Üsküdar", driver: "Ayşe T.", status: "delivered", amount: 312, time: "13:45" },
  { id: "R-1038", from: "Istanbul / Ataşehir", to: "Istanbul / Beykoz", driver: "Hasan Y.", status: "pending", amount: 195, time: "13:20" },
  { id: "R-1037", from: "Istanbul / Bakırköy", to: "Istanbul / Fatih", driver: "Caner S.", status: "delivered", amount: 270, time: "12:55" },
];

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  delivered: { bg: "#dcfce7", fg: "#16a34a" },
  in_transit: { bg: "#dbeafe", fg: "#2563eb" },
  pending: { bg: "#fef3c7", fg: "#d97706" },
  cancelled: { bg: "#fee2e2", fg: "#dc2626" },
};

const DRIVER_STATUS = [
  { name: "Ali K.", status: "busy", currentRide: "R-1040", vehicle: "Ford Transit" },
  { name: "Mehmet D.", status: "busy", currentRide: "R-1041", vehicle: "Mercedes Sprinter" },
  { name: "Ayşe T.", status: "available", currentRide: null, vehicle: "VW Caddy" },
  { name: "Hasan Y.", status: "available", currentRide: null, vehicle: "Fiat Doblo" },
  { name: "Caner S.", status: "offline", currentRide: null, vehicle: "Ford Transit" },
];

export default function DashboardPage() {
  const supabase = createSupabaseBrowser();
  const [companyName, setCompanyName] = useState("My Company");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.company_name) {
        setCompanyName(user.user_metadata.company_name);
      }
    });
  }, [supabase]);

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: 0 }}>Dashboard</h1>
        <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>
          Welcome back, {companyName}. Here&apos;s your overview.
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: 16,
        marginBottom: 24,
      }}>
        {METRICS.map((m) => (
          <div key={m.key} style={{
            backgroundColor: "white",
            borderRadius: 12,
            padding: 20,
            border: "1px solid #e2e8f0",
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>{m.label}</span>
              <span style={{
                width: 36, height: 36, borderRadius: 8,
                backgroundColor: m.color + "15",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18,
              }}>{m.icon}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#0f172a" }}>
              {m.key === "revenue" ? `₺${m.value.toLocaleString()}` : m.value.toLocaleString()}
            </div>
            <div style={{ fontSize: 12, color: "#10b981", marginTop: 4, fontWeight: 500 }}>
              {m.change} from last week
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 20 }}>
        {/* Recent Rides */}
        <div style={{
          backgroundColor: "white",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Recent Rides</h2>
            <a href="/rides" style={{ fontSize: 13, color: "#3b82f6", textDecoration: "none" }}>View all →</a>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                  {["ID", "From → To", "Driver", "Status", "Amount", "Time"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 16px", color: "#64748b", fontWeight: 500, fontSize: 12, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {RECENT_RIDES.map((r) => {
                  const st = STATUS_COLORS[r.status] || STATUS_COLORS.pending;
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                      <td style={{ padding: "10px 16px", fontWeight: 600, color: "#1e40af" }}>{r.id}</td>
                      <td style={{ padding: "10px 16px" }}>
                        <div style={{ maxWidth: 200 }}>
                          <div style={{ fontSize: 12, color: "#64748b" }}>{r.from}</div>
                          <div style={{ fontSize: 12, color: "#0f172a" }}>→ {r.to}</div>
                        </div>
                      </td>
                      <td style={{ padding: "10px 16px" }}>{r.driver}</td>
                      <td style={{ padding: "10px 16px" }}>
                        <span style={{
                          padding: "3px 10px",
                          borderRadius: 99,
                          fontSize: 11,
                          fontWeight: 600,
                          backgroundColor: st.bg,
                          color: st.fg,
                        }}>{r.status.replace("_", " ")}</span>
                      </td>
                      <td style={{ padding: "10px 16px", fontWeight: 500 }}>₺{r.amount}</td>
                      <td style={{ padding: "10px 16px", color: "#94a3b8" }}>{r.time}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Driver Status Sidebar */}
        <div style={{
          backgroundColor: "white",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>Driver Status</h2>
            <a href="/fleet" style={{ fontSize: 13, color: "#3b82f6", textDecoration: "none" }}>All drivers →</a>
          </div>
          <div style={{ padding: 8 }}>
            {DRIVER_STATUS.map((d, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 12px",
                borderRadius: 8,
                marginBottom: 2,
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%",
                  backgroundColor: d.status === "busy" ? "#f59e0b" : d.status === "available" ? "#10b981" : "#94a3b8",
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "#0f172a" }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>
                    {d.vehicle} {d.currentRide ? `• ${d.currentRide}` : ""}
                  </div>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 500,
                  color: d.status === "busy" ? "#d97706" : d.status === "available" ? "#16a34a" : "#94a3b8",
                }}>
                  {d.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

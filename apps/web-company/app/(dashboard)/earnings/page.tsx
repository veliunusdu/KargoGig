"use client";

import { useState } from "react";

const MONTHS = ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan"];
const MONTHLY_REVENUE = [42300, 51200, 48900, 62100, 71400, 87650];
const MONTHLY_RIDES = [186, 224, 212, 278, 312, 342];

const TOP_DRIVERS = [
  { name: "Ali Kaya", rides: 68, revenue: 17850, payout: 12495 },
  { name: "Caner Şahin", rides: 58, revenue: 15340, payout: 10738 },
  { name: "Mehmet Demir", rides: 52, revenue: 14200, payout: 9940 },
  { name: "Ayşe Toprak", rides: 45, revenue: 11800, payout: 8260 },
  { name: "Hasan Yılmaz", rides: 22, revenue: 5800, payout: 4060 },
];

const RECENT_PAYOUTS = [
  { id: "P-301", driver: "Ali Kaya", amount: 4200, date: "Jan 25, 2025", status: "completed" },
  { id: "P-300", driver: "Mehmet Demir", amount: 3800, date: "Jan 25, 2025", status: "completed" },
  { id: "P-299", driver: "Caner Şahin", amount: 3650, date: "Jan 25, 2025", status: "completed" },
  { id: "P-298", driver: "Ayşe Toprak", amount: 2900, date: "Jan 25, 2025", status: "pending" },
  { id: "P-297", driver: "Hasan Yılmaz", amount: 1400, date: "Jan 18, 2025", status: "completed" },
];

export default function EarningsPage() {
  const [period, setPeriod] = useState<"week" | "month" | "quarter" | "year">("month");

  const maxRevenue = Math.max(...MONTHLY_REVENUE);
  const totalRevenue = MONTHLY_REVENUE.reduce((s, v) => s + v, 0);
  const totalRides = MONTHLY_RIDES.reduce((s, v) => s + v, 0);
  const avgPerRide = Math.round(totalRevenue / totalRides);
  const commissionRate = 0.30;
  const totalCommission = Math.round(totalRevenue * commissionRate);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: 0 }}>Earnings & Revenue</h1>
        <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>Financial overview and driver payouts.</p>
      </div>

      {/* Period selector */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
        {(["week", "month", "quarter", "year"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            style={{
              padding: "6px 16px", borderRadius: 6,
              border: "none", fontSize: 13, fontWeight: 500,
              cursor: "pointer",
              backgroundColor: period === p ? "#1e293b" : "#f1f5f9",
              color: period === p ? "white" : "#64748b",
            }}
          >{p.charAt(0).toUpperCase() + p.slice(1)}</button>
        ))}
      </div>

      {/* Summary KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Total Revenue", value: `₺${totalRevenue.toLocaleString()}`, icon: "💰", color: "#10b981", sub: `${MONTHS.length} months` },
          { label: "Commission Earned", value: `₺${totalCommission.toLocaleString()}`, icon: "🏢", color: "#3b82f6", sub: `${(commissionRate * 100)}% rate` },
          { label: "Total Rides", value: totalRides.toLocaleString(), icon: "📦", color: "#8b5cf6", sub: `Avg ₺${avgPerRide}/ride` },
          { label: "This Month", value: `₺${MONTHLY_REVENUE[MONTHLY_REVENUE.length - 1].toLocaleString()}`, icon: "📈", color: "#f59e0b", sub: `+${Math.round(((MONTHLY_REVENUE[5] - MONTHLY_REVENUE[4]) / MONTHLY_REVENUE[4]) * 100)}% vs last month` },
        ].map((k, i) => (
          <div key={i} style={{
            backgroundColor: "white", borderRadius: 12, padding: 20,
            border: "1px solid #e2e8f0",
          }}>
            <div style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: "#0f172a" }}>{k.value}</div>
            <div style={{ fontSize: 12, color: k.color, marginTop: 4, fontWeight: 500 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 20 }}>
        {/* Revenue Chart */}
        <div style={{
          backgroundColor: "white",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          padding: 20,
        }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 20px" }}>Revenue Trend</h2>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 200 }}>
            {MONTHLY_REVENUE.map((v, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: "#0f172a", marginBottom: 4 }}>
                  ₺{(v / 1000).toFixed(0)}k
                </div>
                <div style={{
                  width: "100%",
                  height: `${(v / maxRevenue) * 160}px`,
                  background: `linear-gradient(to top, #3b82f6, #60a5fa)`,
                  borderRadius: "6px 6px 0 0",
                  minHeight: 20,
                  transition: "height 0.3s",
                }} />
                <div style={{ fontSize: 11, color: "#64748b", marginTop: 6 }}>{MONTHS[i]}</div>
              </div>
            ))}
          </div>

          {/* Rides bar chart */}
          <div style={{ marginTop: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 12px", color: "#64748b" }}>Rides per Month</h3>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, height: 100 }}>
              {MONTHLY_RIDES.map((v, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{v}</div>
                  <div style={{
                    width: "100%",
                    height: `${(v / Math.max(...MONTHLY_RIDES)) * 70}px`,
                    backgroundColor: "#8b5cf6",
                    borderRadius: "4px 4px 0 0",
                    opacity: 0.7,
                    minHeight: 10,
                  }} />
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{MONTHS[i]}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top drivers + Recent payouts */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Top Drivers */}
          <div style={{
            backgroundColor: "white",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
          }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Top Drivers (This Month)</h3>
            </div>
            <div style={{ padding: 8 }}>
              {TOP_DRIVERS.map((d, i) => (
                <div key={i} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "8px 12px",
                  borderRadius: 6,
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%",
                    backgroundColor: "#dbeafe", color: "#1e40af",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700,
                  }}>{i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "#0f172a" }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{d.rides} rides</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a" }}>₺{d.revenue.toLocaleString()}</div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>payout: ₺{d.payout.toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recent payouts */}
          <div style={{
            backgroundColor: "white",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
          }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid #f1f5f9" }}>
              <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>Recent Payouts</h3>
            </div>
            <div style={{ padding: 8 }}>
              {RECENT_PAYOUTS.map((p) => (
                <div key={p.id} style={{
                  display: "flex", alignItems: "center",
                  padding: "8px 12px",
                  borderRadius: 6,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{p.driver}</div>
                    <div style={{ fontSize: 11, color: "#94a3b8" }}>{p.id} • {p.date}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>₺{p.amount.toLocaleString()}</div>
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      color: p.status === "completed" ? "#16a34a" : "#d97706",
                    }}>{p.status}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

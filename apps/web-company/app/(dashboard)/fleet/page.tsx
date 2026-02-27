"use client";

import { useState } from "react";

interface Driver {
  id: string;
  name: string;
  email: string;
  phone: string;
  status: "active" | "inactive" | "pending";
  vehicle: string;
  ridesCompleted: number;
  rating: number;
  joinedAt: string;
  avatar: string;
}

const MOCK_DRIVERS: Driver[] = [
  { id: "d1", name: "Ali Kaya", email: "ali.kaya@email.com", phone: "+90 532 111 2233", status: "active", vehicle: "Ford Transit (34 AB 1234)", ridesCompleted: 342, rating: 4.8, joinedAt: "Jan 2024", avatar: "AK" },
  { id: "d2", name: "Mehmet Demir", email: "mehmet.d@email.com", phone: "+90 533 222 3344", status: "active", vehicle: "Mercedes Sprinter (34 CD 5678)", ridesCompleted: 218, rating: 4.6, joinedAt: "Mar 2024", avatar: "MD" },
  { id: "d3", name: "Ayşe Toprak", email: "ayse.t@email.com", phone: "+90 534 333 4455", status: "active", vehicle: "VW Caddy (34 EF 9012)", ridesCompleted: 156, rating: 4.9, joinedAt: "May 2024", avatar: "AT" },
  { id: "d4", name: "Hasan Yılmaz", email: "hasan.y@email.com", phone: "+90 535 444 5566", status: "inactive", vehicle: "Fiat Doblo (34 GH 3456)", ridesCompleted: 89, rating: 4.3, joinedAt: "Jul 2024", avatar: "HY" },
  { id: "d5", name: "Caner Şahin", email: "caner.s@email.com", phone: "+90 536 555 6677", status: "active", vehicle: "Ford Transit (34 IJ 7890)", ridesCompleted: 275, rating: 4.7, joinedAt: "Feb 2024", avatar: "CS" },
  { id: "d6", name: "Elif Arslan", email: "elif.a@email.com", phone: "+90 537 666 7788", status: "pending", vehicle: "—", ridesCompleted: 0, rating: 0, joinedAt: "Invited", avatar: "EA" },
];

interface Vehicle {
  id: string;
  plate: string;
  model: string;
  type: "van" | "truck" | "car" | "motorcycle";
  capacity: string;
  driver: string | null;
  status: "in_use" | "available" | "maintenance";
  lastService: string;
}

const MOCK_VEHICLES: Vehicle[] = [
  { id: "v1", plate: "34 AB 1234", model: "Ford Transit 2022", type: "van", capacity: "1200 kg", driver: "Ali Kaya", status: "in_use", lastService: "Dec 2024" },
  { id: "v2", plate: "34 CD 5678", model: "Mercedes Sprinter 2023", type: "truck", capacity: "2500 kg", driver: "Mehmet Demir", status: "in_use", lastService: "Nov 2024" },
  { id: "v3", plate: "34 EF 9012", model: "VW Caddy 2023", type: "car", capacity: "600 kg", driver: "Ayşe Toprak", status: "in_use", lastService: "Jan 2025" },
  { id: "v4", plate: "34 GH 3456", model: "Fiat Doblo 2021", type: "car", capacity: "700 kg", driver: null, status: "maintenance", lastService: "Oct 2024" },
  { id: "v5", plate: "34 IJ 7890", model: "Ford Transit 2021", type: "van", capacity: "1200 kg", driver: "Caner Şahin", status: "in_use", lastService: "Dec 2024" },
  { id: "v6", plate: "34 KL 1122", model: "Iveco Daily 2022", type: "truck", capacity: "3500 kg", driver: null, status: "available", lastService: "Jan 2025" },
];

const VEHICLE_ICONS: Record<string, string> = { van: "🚐", truck: "🚛", car: "🚗", motorcycle: "🏍️" };
const VEHICLE_STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  in_use: { bg: "#dbeafe", fg: "#2563eb" },
  available: { bg: "#dcfce7", fg: "#16a34a" },
  maintenance: { bg: "#fef3c7", fg: "#d97706" },
};

const DRIVER_STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  active: { bg: "#dcfce7", fg: "#16a34a" },
  inactive: { bg: "#fee2e2", fg: "#dc2626" },
  pending: { bg: "#fef3c7", fg: "#d97706" },
};

export default function FleetPage() {
  const [tab, setTab] = useState<"drivers" | "vehicles">("drivers");
  const [search, setSearch] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [driverDetailId, setDriverDetailId] = useState<string | null>(null);

  const filteredDrivers = MOCK_DRIVERS.filter(
    (d) => d.name.toLowerCase().includes(search.toLowerCase()) || d.email.toLowerCase().includes(search.toLowerCase())
  );
  const filteredVehicles = MOCK_VEHICLES.filter(
    (v) => v.plate.toLowerCase().includes(search.toLowerCase()) || v.model.toLowerCase().includes(search.toLowerCase())
  );

  const selectedDriver = driverDetailId ? MOCK_DRIVERS.find((d) => d.id === driverDetailId) : null;

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setToast(`Invitation sent to ${inviteEmail}`);
    setShowInvite(false);
    setInviteEmail("");
    setInviteName("");
    setTimeout(() => setToast(null), 3000);
  }

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

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: 0 }}>Fleet Management</h1>
          <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>
            Manage your drivers and vehicles.
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          style={{
            padding: "8px 20px",
            backgroundColor: "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + Invite Driver
        </button>
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          backgroundColor: "rgba(0,0,0,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <form onSubmit={handleInvite} style={{
            backgroundColor: "white",
            borderRadius: 12,
            padding: 28,
            width: 420,
            boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 4px" }}>Invite New Driver</h2>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>
              Send an email invitation to join your fleet.
            </p>
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>Full Name</label>
              <input
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                required
                style={{
                  width: "100%", padding: "8px 12px", border: "1px solid #d1d5db",
                  borderRadius: 6, fontSize: 14, boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>Email Address</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
                style={{
                  width: "100%", padding: "8px 12px", border: "1px solid #d1d5db",
                  borderRadius: 6, fontSize: 14, boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => setShowInvite(false)}
                style={{
                  padding: "8px 16px", border: "1px solid #d1d5db",
                  borderRadius: 6, backgroundColor: "white", cursor: "pointer", fontSize: 13,
                }}
              >Cancel</button>
              <button
                type="submit"
                style={{
                  padding: "8px 20px", backgroundColor: "#3b82f6",
                  color: "white", border: "none", borderRadius: 6,
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >Send Invitation</button>
            </div>
          </form>
        </div>
      )}

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Total Drivers", value: MOCK_DRIVERS.length, icon: "👤", color: "#3b82f6" },
          { label: "Active", value: MOCK_DRIVERS.filter(d => d.status === "active").length, icon: "✅", color: "#10b981" },
          { label: "Vehicles", value: MOCK_VEHICLES.length, icon: "🚛", color: "#8b5cf6" },
          { label: "In Maintenance", value: MOCK_VEHICLES.filter(v => v.status === "maintenance").length, icon: "🔧", color: "#f59e0b" },
        ].map((s, i) => (
          <div key={i} style={{
            backgroundColor: "white", borderRadius: 10, padding: 16,
            border: "1px solid #e2e8f0",
          }}>
            <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#0f172a" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div style={{
        backgroundColor: "white",
        borderRadius: 12,
        border: "1px solid #e2e8f0",
      }}>
        <div style={{
          padding: "12px 16px",
          borderBottom: "1px solid #f1f5f9",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <div style={{ display: "flex", gap: 4 }}>
            {(["drivers", "vehicles"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setSearch(""); setDriverDetailId(null); }}
                style={{
                  padding: "6px 16px",
                  borderRadius: 6,
                  border: "none",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  backgroundColor: tab === t ? "#3b82f6" : "#f1f5f9",
                  color: tab === t ? "white" : "#64748b",
                }}
              >
                {t === "drivers" ? "👤 Drivers" : "🚛 Vehicles"}
              </button>
            ))}
          </div>
          <input
            placeholder={`Search ${tab}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              padding: "6px 12px", border: "1px solid #e2e8f0",
              borderRadius: 6, fontSize: 13, width: 220,
            }}
          />
        </div>

        {/* Drivers Tab */}
        {tab === "drivers" && !selectedDriver && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                  {["Driver", "Contact", "Vehicle", "Rides", "Rating", "Status", ""].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 14px", color: "#64748b", fontWeight: 500, fontSize: 12, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredDrivers.map((d) => {
                  const st = DRIVER_STATUS_COLORS[d.status];
                  return (
                    <tr key={d.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: "50%",
                            backgroundColor: "#e0f2fe", color: "#1e40af",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 11, fontWeight: 700,
                          }}>{d.avatar}</div>
                          <div>
                            <div style={{ fontWeight: 500, color: "#0f172a" }}>{d.name}</div>
                            <div style={{ fontSize: 11, color: "#94a3b8" }}>Since {d.joinedAt}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ fontSize: 12, color: "#64748b" }}>{d.email}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{d.phone}</div>
                      </td>
                      <td style={{ padding: "10px 14px", fontSize: 12, color: "#64748b" }}>{d.vehicle}</td>
                      <td style={{ padding: "10px 14px", fontWeight: 500 }}>{d.ridesCompleted}</td>
                      <td style={{ padding: "10px 14px" }}>
                        {d.rating > 0 ? (
                          <span style={{ color: "#f59e0b", fontWeight: 500 }}>⭐ {d.rating}</span>
                        ) : "—"}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{
                          padding: "3px 10px", borderRadius: 99,
                          fontSize: 11, fontWeight: 600,
                          backgroundColor: st.bg, color: st.fg,
                        }}>{d.status}</span>
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <button
                          onClick={() => setDriverDetailId(d.id)}
                          style={{
                            padding: "4px 12px", border: "1px solid #e2e8f0",
                            borderRadius: 6, backgroundColor: "white",
                            fontSize: 11, cursor: "pointer", color: "#3b82f6",
                          }}
                        >Details</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Driver Detail */}
        {tab === "drivers" && selectedDriver && (
          <div style={{ padding: 20 }}>
            <button
              onClick={() => setDriverDetailId(null)}
              style={{
                display: "flex", alignItems: "center", gap: 4,
                background: "none", border: "none", color: "#3b82f6",
                cursor: "pointer", fontSize: 13, marginBottom: 16,
              }}
            >← Back to drivers</button>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ padding: 20, backgroundColor: "#f8fafc", borderRadius: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                  <div style={{
                    width: 48, height: 48, borderRadius: "50%",
                    backgroundColor: "#dbeafe", color: "#1e40af",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 16, fontWeight: 700,
                  }}>{selectedDriver.avatar}</div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700 }}>{selectedDriver.name}</div>
                    <span style={{
                      padding: "2px 8px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                      backgroundColor: DRIVER_STATUS_COLORS[selectedDriver.status].bg,
                      color: DRIVER_STATUS_COLORS[selectedDriver.status].fg,
                    }}>{selectedDriver.status}</span>
                  </div>
                </div>
                <div style={{ display: "grid", gap: 8, fontSize: 13, color: "#475569" }}>
                  <div>📧 {selectedDriver.email}</div>
                  <div>📞 {selectedDriver.phone}</div>
                  <div>🚛 {selectedDriver.vehicle}</div>
                  <div>📅 Joined: {selectedDriver.joinedAt}</div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { label: "Rides Completed", value: selectedDriver.ridesCompleted, icon: "📦" },
                  { label: "Rating", value: selectedDriver.rating > 0 ? `⭐ ${selectedDriver.rating}` : "N/A", icon: "⭐" },
                  { label: "Revenue Generated", value: `₺${(selectedDriver.ridesCompleted * 185).toLocaleString()}`, icon: "💰" },
                  { label: "On-time Rate", value: "96%", icon: "⏱️" },
                ].map((s, i) => (
                  <div key={i} style={{
                    backgroundColor: "#f8fafc", borderRadius: 10, padding: 16,
                    textAlign: "center",
                  }}>
                    <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: "#0f172a" }}>{s.value}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Vehicles Tab */}
        {tab === "vehicles" && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                  {["Vehicle", "Plate", "Type", "Capacity", "Driver", "Status", "Last Service"].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "10px 14px", color: "#64748b", fontWeight: 500, fontSize: 12, textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredVehicles.map((v) => {
                  const st = VEHICLE_STATUS_COLORS[v.status];
                  return (
                    <tr key={v.id} style={{ borderBottom: "1px solid #f8fafc" }}>
                      <td style={{ padding: "10px 14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 20 }}>{VEHICLE_ICONS[v.type]}</span>
                          <span style={{ fontWeight: 500 }}>{v.model}</span>
                        </div>
                      </td>
                      <td style={{ padding: "10px 14px", fontFamily: "monospace", fontSize: 12 }}>{v.plate}</td>
                      <td style={{ padding: "10px 14px", textTransform: "capitalize" }}>{v.type}</td>
                      <td style={{ padding: "10px 14px" }}>{v.capacity}</td>
                      <td style={{ padding: "10px 14px", color: v.driver ? "#0f172a" : "#94a3b8" }}>
                        {v.driver || "Unassigned"}
                      </td>
                      <td style={{ padding: "10px 14px" }}>
                        <span style={{
                          padding: "3px 10px", borderRadius: 99,
                          fontSize: 11, fontWeight: 600,
                          backgroundColor: st.bg, color: st.fg,
                        }}>{v.status.replace("_", " ")}</span>
                      </td>
                      <td style={{ padding: "10px 14px", color: "#64748b", fontSize: 12 }}>{v.lastService}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

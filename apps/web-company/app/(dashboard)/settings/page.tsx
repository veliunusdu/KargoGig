"use client";

import { useState } from "react";
import { createSupabaseBrowser } from "@kargogig/ui-auth/client";
import { useRouter } from "next/navigation";

type Tab = "company" | "notifications" | "billing" | "security";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "company", label: "Company Info", icon: "🏢" },
  { key: "notifications", label: "Notifications", icon: "🔔" },
  { key: "billing", label: "Billing", icon: "💳" },
  { key: "security", label: "Security", icon: "🔒" },
];

export default function SettingsPage() {
  const supabase = createSupabaseBrowser();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("company");
  const [toast, setToast] = useState<string | null>(null);

  // Company Info
  const [companyName, setCompanyName] = useState("KargoGig Lojistik A.Ş.");
  const [taxId, setTaxId] = useState("1234567890");
  const [phone, setPhone] = useState("+90 212 555 0000");
  const [address, setAddress] = useState("Levent Mah. Büyükdere Cad. No:123, Beşiktaş, İstanbul");
  const [contactName, setContactName] = useState("Ahmet Yıldız");
  const [contactEmail, setContactEmail] = useState("ahmet@kargogig.com");

  // Notifications
  const [notifNewRide, setNotifNewRide] = useState(true);
  const [notifRideComplete, setNotifRideComplete] = useState(true);
  const [notifDriverOnline, setNotifDriverOnline] = useState(false);
  const [notifPayment, setNotifPayment] = useState(true);
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifSms, setNotifSms] = useState(false);

  // Security
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function handleSaveCompany(e: React.FormEvent) {
    e.preventDefault();
    showToast("Company information saved");
  }

  function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    if (newPw !== confirmPw) {
      showToast("Passwords do not match");
      return;
    }
    showToast("Password updated successfully");
    setCurrentPw("");
    setNewPw("");
    setConfirmPw("");
  }

  return (
    <div>
      {toast && (
        <div style={{
          position: "fixed", top: 24, right: 24, zIndex: 100,
          backgroundColor: "#10b981", color: "white",
          padding: "12px 20px", borderRadius: 8,
          fontSize: 13, fontWeight: 500,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        }}>{toast}</div>
      )}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: 0 }}>Settings</h1>
        <p style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>Manage your company profile and preferences.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 20 }}>
        {/* Tab nav */}
        <div style={{
          backgroundColor: "white",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          padding: 8,
          alignSelf: "start",
        }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: "none",
                fontSize: 13,
                fontWeight: activeTab === t.key ? 600 : 400,
                cursor: "pointer",
                backgroundColor: activeTab === t.key ? "#eff6ff" : "transparent",
                color: activeTab === t.key ? "#1e40af" : "#64748b",
                textAlign: "left",
                marginBottom: 2,
              }}
            >
              <span>{t.icon}</span> {t.label}
            </button>
          ))}

          <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 8, paddingTop: 8 }}>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.push("/login");
              }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                width: "100%",
                padding: "10px 14px",
                borderRadius: 8,
                border: "none",
                fontSize: 13,
                cursor: "pointer",
                backgroundColor: "transparent",
                color: "#dc2626",
                textAlign: "left",
              }}
            >
              🚪 Sign Out
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{
          backgroundColor: "white",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          padding: 24,
        }}>
          {/* Company Info */}
          {activeTab === "company" && (
            <form onSubmit={handleSaveCompany}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 20px" }}>Company Information</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <FieldGroup label="Company Name" value={companyName} onChange={setCompanyName} />
                <FieldGroup label="Tax ID" value={taxId} onChange={setTaxId} />
                <FieldGroup label="Phone" value={phone} onChange={setPhone} />
                <FieldGroup label="Contact Person" value={contactName} onChange={setContactName} />
                <FieldGroup label="Contact Email" value={contactEmail} onChange={setContactEmail} type="email" />
              </div>
              <div style={{ marginTop: 16 }}>
                <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>Address</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%", padding: "8px 12px", border: "1px solid #d1d5db",
                    borderRadius: 6, fontSize: 14, resize: "vertical", boxSizing: "border-box",
                    fontFamily: "inherit",
                  }}
                />
              </div>
              <button
                type="submit"
                style={{
                  marginTop: 20, padding: "8px 24px",
                  backgroundColor: "#3b82f6", color: "white",
                  border: "none", borderRadius: 8,
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >Save Changes</button>
            </form>
          )}

          {/* Notifications */}
          {activeTab === "notifications" && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 20px" }}>Notification Preferences</h2>

              <div style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 12 }}>Events</h3>
                <ToggleRow label="New ride request" desc="Get notified when a new ride is created" checked={notifNewRide} onChange={setNotifNewRide} />
                <ToggleRow label="Ride completed" desc="Notification when a ride is delivered" checked={notifRideComplete} onChange={setNotifRideComplete} />
                <ToggleRow label="Driver comes online" desc="Alert when a driver starts their shift" checked={notifDriverOnline} onChange={setNotifDriverOnline} />
                <ToggleRow label="Payment received" desc="Notification for incoming payments" checked={notifPayment} onChange={setNotifPayment} />
              </div>

              <div>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 12 }}>Channels</h3>
                <ToggleRow label="Email notifications" desc="Receive notifications via email" checked={notifEmail} onChange={setNotifEmail} />
                <ToggleRow label="SMS notifications" desc="Receive notifications via SMS" checked={notifSms} onChange={setNotifSms} />
              </div>

              <button
                onClick={() => showToast("Notification preferences saved")}
                style={{
                  marginTop: 20, padding: "8px 24px",
                  backgroundColor: "#3b82f6", color: "white",
                  border: "none", borderRadius: 8,
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}
              >Save Preferences</button>
            </div>
          )}

          {/* Billing */}
          {activeTab === "billing" && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 20px" }}>Billing & Subscription</h2>

              <div style={{
                padding: 20, borderRadius: 10, marginBottom: 20,
                background: "linear-gradient(135deg, #1e40af, #3b82f6)",
                color: "white",
              }}>
                <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>Current Plan</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Business Pro</div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>Unlimited drivers · Priority support · Advanced analytics</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 12 }}>₺2,499/month</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                {[
                  { label: "Next billing date", value: "Feb 1, 2025" },
                  { label: "Payment method", value: "Visa •••• 4242" },
                  { label: "Commission rate", value: "30%" },
                  { label: "YTD revenue", value: `₺${(363550).toLocaleString()}` },
                ].map((b, i) => (
                  <div key={i} style={{
                    padding: 16, backgroundColor: "#f8fafc",
                    borderRadius: 8, border: "1px solid #e2e8f0",
                  }}>
                    <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>{b.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#0f172a" }}>{b.value}</div>
                  </div>
                ))}
              </div>

              <h3 style={{ fontSize: 14, fontWeight: 600, margin: "0 0 12px" }}>Recent Invoices</h3>
              <div style={{ display: "grid", gap: 6 }}>
                {[
                  { month: "January 2025", amount: "₺2,499", status: "Paid" },
                  { month: "December 2024", amount: "₺2,499", status: "Paid" },
                  { month: "November 2024", amount: "₺2,499", status: "Paid" },
                ].map((inv, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "10px 14px", backgroundColor: "#f8fafc", borderRadius: 6,
                    fontSize: 13,
                  }}>
                    <span>{inv.month}</span>
                    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                      <span style={{ fontWeight: 500 }}>{inv.amount}</span>
                      <span style={{ color: "#16a34a", fontSize: 11, fontWeight: 600 }}>{inv.status}</span>
                      <button style={{
                        padding: "3px 10px", border: "1px solid #d1d5db",
                        borderRadius: 4, backgroundColor: "white",
                        fontSize: 11, cursor: "pointer",
                      }}>Download</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Security */}
          {activeTab === "security" && (
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: "0 0 20px" }}>Security</h2>

              <form onSubmit={handleChangePassword} style={{ marginBottom: 24 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Change Password</h3>
                <div style={{ display: "grid", gap: 12, maxWidth: 380 }}>
                  <FieldGroup label="Current Password" value={currentPw} onChange={setCurrentPw} type="password" />
                  <FieldGroup label="New Password" value={newPw} onChange={setNewPw} type="password" />
                  <FieldGroup label="Confirm New Password" value={confirmPw} onChange={setConfirmPw} type="password" />
                </div>
                <button
                  type="submit"
                  style={{
                    marginTop: 16, padding: "8px 24px",
                    backgroundColor: "#3b82f6", color: "white",
                    border: "none", borderRadius: 8,
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >Update Password</button>
              </form>

              <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: 20 }}>
                <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#dc2626" }}>Danger Zone</h3>
                <p style={{ fontSize: 13, color: "#64748b", marginBottom: 12 }}>
                  Deactivating your account will remove all your data and cannot be undone.
                </p>
                <button style={{
                  padding: "8px 20px", border: "1px solid #fecaca",
                  borderRadius: 8, backgroundColor: "#fef2f2",
                  color: "#dc2626", fontSize: 13, fontWeight: 600, cursor: "pointer",
                }}>Deactivate Account</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FieldGroup({ label, value, onChange, type = "text" }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 500, color: "#374151", display: "block", marginBottom: 4 }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "100%", padding: "8px 12px", border: "1px solid #d1d5db",
          borderRadius: 6, fontSize: 14, boxSizing: "border-box",
        }}
      />
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange }: {
  label: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "10px 0", borderBottom: "1px solid #f8fafc",
    }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: "#0f172a" }}>{label}</div>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>{desc}</div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: 44, height: 24, borderRadius: 12,
          border: "none", cursor: "pointer",
          backgroundColor: checked ? "#3b82f6" : "#d1d5db",
          position: "relative",
          transition: "background-color 0.2s",
        }}
      >
        <span style={{
          position: "absolute",
          top: 2, left: checked ? 22 : 2,
          width: 20, height: 20, borderRadius: "50%",
          backgroundColor: "white",
          transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }} />
      </button>
    </div>
  );
}

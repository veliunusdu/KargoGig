"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@kargogig/ui-auth/client";
import { useRouter, usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/operations", label: "Operations", icon: "🗺️" },
  { href: "/fleet", label: "Fleet", icon: "🚛" },
  { href: "/rides", label: "Rides", icon: "📦" },
  { href: "/earnings", label: "Earnings", icon: "💰" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseBrowser();
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.push("/login");
      } else {
        setUser(user);
        setLoading(false);
      }
    });
  }, [supabase, router]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🚛</div>
          <div style={{ color: "#64748b" }}>Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      {/* Sidebar */}
      <aside style={{
        width: sidebarCollapsed ? 64 : 240,
        backgroundColor: "#0f172a",
        color: "white",
        display: "flex",
        flexDirection: "column",
        transition: "width 0.2s",
        position: "fixed",
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 50,
      }}>
        {/* Logo */}
        <div style={{
          padding: sidebarCollapsed ? "20px 12px" : "20px 20px",
          borderBottom: "1px solid #1e293b",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          {!sidebarCollapsed && (
            <div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>KargoGig</div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>Company Portal</div>
            </div>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              fontSize: 18,
              padding: 4,
            }}
          >
            {sidebarCollapsed ? "→" : "←"}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 8px" }}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <a
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: sidebarCollapsed ? "12px 16px" : "10px 16px",
                  borderRadius: 8,
                  color: isActive ? "white" : "#94a3b8",
                  backgroundColor: isActive ? "#1e40af" : "transparent",
                  textDecoration: "none",
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                  marginBottom: 4,
                  transition: "all 0.15s",
                  justifyContent: sidebarCollapsed ? "center" : "flex-start",
                }}
              >
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                {!sidebarCollapsed && item.label}
              </a>
            );
          })}
        </nav>

        {/* User */}
        {!sidebarCollapsed && (
          <div style={{
            padding: "16px 20px",
            borderTop: "1px solid #1e293b",
            fontSize: 13,
          }}>
            <div style={{ color: "#e2e8f0", fontWeight: 500, marginBottom: 2 }}>
              {user?.user_metadata?.company_name || "Company"}
            </div>
            <div style={{ color: "#64748b", fontSize: 12 }}>{user?.email}</div>
          </div>
        )}
      </aside>

      {/* Main */}
      <main style={{
        flex: 1,
        marginLeft: sidebarCollapsed ? 64 : 240,
        transition: "margin-left 0.2s",
      }}>
        {/* Top bar */}
        <header style={{
          backgroundColor: "white",
          borderBottom: "1px solid #e2e8f0",
          padding: "12px 24px",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: 16,
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}>
          <span style={{ fontSize: 13, color: "#64748b" }}>{user?.email}</span>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.push("/login");
            }}
            style={{
              padding: "6px 14px",
              border: "1px solid #e2e8f0",
              borderRadius: 6,
              fontSize: 13,
              cursor: "pointer",
              backgroundColor: "white",
            }}
          >
            Sign out
          </button>
        </header>

        <div style={{ padding: 24 }}>{children}</div>
      </main>
    </div>
  );
}

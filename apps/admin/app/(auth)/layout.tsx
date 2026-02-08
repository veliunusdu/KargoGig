export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 420, border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>
          KargoGig Admin
        </h1>
        {children}
      </div>
    </div>
  );
}

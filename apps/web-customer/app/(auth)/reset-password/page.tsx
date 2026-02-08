"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const supabase = createSupabaseBrowser();
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
  }, [supabase]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) return setMsg(error.message);
    setMsg("Password updated. Redirecting to login...");
    setTimeout(() => (window.location.href = "/login"), 700);
  }

  // Prevent hydration mismatch by not rendering until client-side
  if (!mounted) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Reset password</h2>
        <p>Loading...</p>
      </div>
    );
  }

  if (hasSession === false) {
    return (
      <div style={{ display: "grid", gap: 8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Reset password</h2>
        <p>Open the reset link from your email — this page needs an active reset session.</p>
        <a href="/forgot-password">Send reset email again</a>
      </div>
    );
  }

  if (hasSession === null) {
    return (
      <div style={{ display: "grid", gap: 10 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600 }}>Reset password</h2>
        <p>Checking session...</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600 }}>Set new password</h2>

      <input
        placeholder="New password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button disabled={loading} type="submit">
        {loading ? "Updating..." : "Update password"}
      </button>

      {msg && <p>{msg}</p>}
    </form>
  );
}

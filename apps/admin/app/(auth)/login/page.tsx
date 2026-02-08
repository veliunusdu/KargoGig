"use client";

import { useState } from "react";
import { createSupabaseBrowser } from "@kargogig/ui-auth/client";

export default function LoginPage() {
  const supabase = createSupabaseBrowser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) return setMsg(error.message);
    window.location.href = "/";
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "grid", gap: 10 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600 }}>Admin Login</h2>

      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

      <button disabled={loading} type="submit">
        {loading ? "Logging in..." : "Login"}
      </button>

      {msg && <p style={{ color: "crimson" }}>{msg}</p>}
    </form>
  );
}
